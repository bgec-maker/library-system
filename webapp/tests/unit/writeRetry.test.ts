// todo/42 — todo/37 검증 하네스의 정식판. 재시도 대기(1.5s+3s)를 실제로 기다리므로
// 이 파일이 단위 스위트에서 가장 느리다(~10s) — 상한을 늘리기 전에 정당화부터 할 것.
import { apiCallWithRetry } from '../../src/services/writeRetry';
import { calls, setPlan } from './stubs/api';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok —', msg);
}

(async () => {
  setPlan(['BUSY_RETRY', 'BUSY_RETRY', 'ok']);
  let r = await apiCallWithRetry('checkout', { requestId: 'r1' });
  assert(r.ok && calls.length === 3, `BUSY×2 → 3차 성공 (호출 ${calls.length})`);

  setPlan(['VALIDATION_ERROR']);
  r = await apiCallWithRetry('checkout', { requestId: 'r2' });
  assert(!r.ok && r.error.code === 'VALIDATION_ERROR' && calls.length === 4, '검증 오류 즉시 반환(재시도 없음)');

  setPlan(['CLIENT_TIMEOUT', 'ok']);
  r = await apiCallWithRetry('checkout', { requestId: 'r3' });
  assert(!r.ok && r.error.code === 'CLIENT_TIMEOUT' && calls.length === 5, 'CLIENT_TIMEOUT 재시도 제외(블로킹 예산)');

  setPlan(['NETWORK_ERROR', 'ok']);
  r = await apiCallWithRetry('checkout', { requestId: 'r4' });
  assert(r.ok && calls.length === 7, 'NETWORK 1회 → 2차 성공');

  setPlan(['BUSY_RETRY', 'BUSY_RETRY', 'BUSY_RETRY', 'ok']);
  r = await apiCallWithRetry('checkout', { requestId: 'r5' });
  assert(!r.ok && r.error.code === 'BUSY_RETRY' && calls.length === 10, '3회 소진 시 마지막 실패 반환');

  console.log('writeRetry ALL PASS');
})();
