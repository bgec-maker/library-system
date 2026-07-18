// todo/61 — registerQueue 단위 테스트. e2e(register-pipeline)가 브라우저 통합을 보증한다면,
// 여기는 큐의 미세 규칙(순서·중복·이월·부팅 재개 선별·보관 상한)을 빠르게 못 박는다.
// 실행 환경은 node(window 없음) — 모듈의 부팅 블록이 건너뛰어지므로 결정적이고,
// localStorage만 아래 인메모리 폴리필로 공급한 뒤 동적 import 한다(폴리필이 먼저).
// 백오프는 __setBackoffForTest로 10ms — writeRetry.test의 "상한 정당화" 원칙 준수.

const store = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v);
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  clear: () => {
    store.clear();
  },
  key: () => null,
  length: 0
} as unknown as Storage;

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok —', msg);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(pred: () => boolean, label: string, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeoutMs) {
      console.error('FAIL(timeout):', label);
      process.exit(1);
    }
    await sleep(10);
  }
}

(async () => {
  const api = await import('./stubs/api');
  const q = await import('../../src/services/registerQueue');
  q.__setBackoffForTest([10, 10, 10, 10]);

  const input = (id: string, title: string) => ({
    requestId: id,
    action: 'registerByIsbn' as const,
    payload: { requestId: id },
    title,
    isbn: id,
    copyCount: 1
  });

  // ① 순차 전송(동시 1건) + 적재 순서 보존
  api.setDelay(30);
  api.setPlan([
    { data: { barcodes: ['0001'], title: 'A', created: true } },
    { data: { barcodes: ['0002'], title: 'B', created: true } }
  ]);
  q.enqueueRegister(input('r1', 'A'));
  q.enqueueRegister(input('r2', 'B'));
  await waitFor(() => q.getRegisterQueueEntries().filter((e) => e.status === 'done').length === 2, '① r1·r2 완료');
  assert(api.calls.length === 2 && api.calls[0].includes('"r1"') && api.calls[1].includes('"r2"'), '순차 1건씩 · 적재 순서대로 전송');

  // ② 미완 상태 중복 적재 방지 (같은 requestId)
  api.setDelay(50);
  api.setPlan([{ data: { barcodes: ['0003'], title: 'C', created: true } }]);
  const before2 = api.calls.length;
  q.enqueueRegister(input('r3', 'C'));
  q.enqueueRegister(input('r3', 'C'));
  await waitFor(() => q.getRegisterQueueEntries().some((e) => e.requestId === 'r3' && e.status === 'done'), '② r3 완료');
  assert(api.calls.length - before2 === 1, '전송 중 같은 requestId 재적재는 무시(전송 1회)');
  api.setDelay(0);

  // ③ 재시도형(BUSY) 소진 → 실패 이월 + lastErrorCode 보존
  api.setPlan(['BUSY_RETRY', 'BUSY_RETRY', 'BUSY_RETRY', 'BUSY_RETRY', 'BUSY_RETRY']);
  const before3 = api.calls.length;
  q.enqueueRegister(input('r4', 'D'));
  await waitFor(() => q.readFailedList().some((f) => f.requestId === 'r4'), '③ r4 실패 이월');
  const f4 = q.readFailedList().find((f) => f.requestId === 'r4');
  assert(api.calls.length - before3 === 5, 'MAX_ATTEMPTS(5) 소진');
  assert(f4?.lastErrorCode === 'BUSY_RETRY' && (f4.autoResumes ?? 0) === 0, '실패 기록에 코드 보존·재개 0회');
  assert(!q.getRegisterQueueEntries().some((e) => e.requestId === 'r4'), '큐에서는 제거');

  // ④ 비재시도형(VALIDATION) → 1회 만에 즉시 이월
  api.setPlan(['VALIDATION']);
  const before4 = api.calls.length;
  q.enqueueRegister(input('r5', 'E'));
  await waitFor(() => q.readFailedList().some((f) => f.requestId === 'r5'), '④ r5 실패 이월');
  assert(api.calls.length - before4 === 1, '비재시도형은 재시도 없이 1회');

  // ⑤ 부팅 재개 선별 — BUSY(r4)만 재개, VALIDATION(r5)은 잔류. 같은 requestId 재사용.
  api.setPlan([{ data: { barcodes: ['0004'], title: 'D', created: true } }]);
  const resumed = q.resumeRetryableFailures();
  assert(resumed === 1, '⑤ 재시도형 1건만 재개');
  await waitFor(() => q.getRegisterQueueEntries().some((e) => e.requestId === 'r4' && e.status === 'done'), 'r4 재개 완료');
  assert(api.calls[api.calls.length - 1].includes('"r4"'), '같은 requestId로 재전송(멱등 계약)');
  const done4 = q.getRegisterQueueEntries().find((e) => e.requestId === 'r4');
  assert(done4?.autoResumes === 1, '재개 횟수 1로 이월');
  assert(q.readFailedList().some((f) => f.requestId === 'r5'), 'VALIDATION 건은 실패 목록 잔류');

  // ⑥ 재개 생애 상한(3회) + ⑦ 코드 없는 구버전 기록 — 둘 다 재개 제외
  const failedNow = q.readFailedList();
  failedNow.push(
    { requestId: 'r6', action: 'registerByIsbn', title: 'F', isbn: 'r6', payload: { requestId: 'r6' }, reason: 'BUSY_RETRY', lastErrorCode: 'BUSY_RETRY', autoResumes: 3 },
    { requestId: 'r7', action: 'registerByIsbn', title: 'G', isbn: 'r7', payload: { requestId: 'r7' }, reason: '옛 실패(코드 없음)' }
  );
  localStorage.setItem('lib.register.failed', JSON.stringify(failedNow));
  assert(q.resumeRetryableFailures() === 0, '⑥⑦ 상한 도달·코드 없음은 재개 0건');
  assert(q.readFailedList().length === 3, '실패 목록 3건(r5·r6·r7) 그대로');

  // ⑧ 완료 보관 상한(DONE_KEEP 30) — 오래된 완료부터 잘린다
  api.setPlan([]);
  for (let i = 0; i < 33; i += 1) q.enqueueRegister(input(`bulk-${i}`, `B${i}`));
  await waitFor(
    () => q.getRegisterQueueEntries().filter((e) => e.status !== 'done').length === 0,
    '⑧ 대량 완료'
  );
  const doneCount = q.getRegisterQueueEntries().filter((e) => e.status === 'done').length;
  assert(doneCount === 30, `완료 보관 30건 유지 (실측 ${doneCount})`);

  console.log('registerQueue ALL PASS');
})();
