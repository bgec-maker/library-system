import { test, expect, type Page } from '@playwright/test';
import { MOCK_API_URL, REGISTER_ISBN, REGISTER_BARCODE } from './mockApi';

// todo/33 「등록 파이프라인 회귀 스펙」 — todo/28(순차 제출 큐)·29(읽기 캐시)의 핵심 보증을
// CI에 상주시킨다. smoke.spec.ts(행복 경로 한 줄기)와 달리 여기는 실패 경로가 주인공이라
// 자체 목 라우팅을 쓴다: registerByIsbn 응답을 시나리오별로 제어해야 하기 때문(installApiMock은
// 항상 성공을 돌려준다). 실제 GAS는 여전히 어떤 스펙에서도 호출되지 않는다.
//
// 서버 계약의 근거(school-patch-v1/Code.gs):
// - BUSY_RETRY: withWriteLock_ tryLock(10s) 실패 시 — 재전송은 같은 requestId로 안전
//   (executeWrite_의 OPERATIONS 멱등이 흡수). registerQueue 백오프는 2s부터.
// - 네트워크 유실 후 재전송도 같은 이유로 안전 — COMPLETED면 idempotent 재확인 응답.

test.setTimeout(90_000);

interface MockController {
  /** registerByIsbn 도착 횟수 */
  registerAttempts: () => number;
  /** n번째 시도까지의 응답 모드 지정 */
  setRegisterPlan: (plan: Array<'busy' | 'network' | 'ok'>) => void;
}

// 시나리오 제어형 목 백엔드 — plan 배열을 소진하면 이후는 전부 'ok'.
async function installScenarioMock(page: Page): Promise<MockController> {
  let attempts = 0;
  let plan: Array<'busy' | 'network' | 'ok'> = [];

  await page.route(MOCK_API_URL + '**', async (route) => {
    const payload = JSON.parse(route.request().postData() ?? '{}') as { action?: string };
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    switch (payload.action) {
      case 'lookupIsbn':
        return json({
          ok: true,
          data: { isbn: REGISTER_ISBN, title: 'Pipeline Book', authors: 'E2E', source: 'ALADIN', isDuplicate: false },
          error: null
        });
      case 'registerByIsbn': {
        attempts += 1;
        const mode = plan[attempts - 1] ?? 'ok';
        if (mode === 'busy') {
          return json({
            ok: false,
            data: null,
            error: { code: 'BUSY_RETRY', message: '다른 작업이 처리 중입니다. 잠시 후 다시 시도하세요.' }
          });
        }
        if (mode === 'network') return route.abort('failed');
        return json({
          ok: true,
          data: { titleId: 'title-pipeline', barcodes: [REGISTER_BARCODE], title: 'Pipeline Book', created: true, copyCount: 1 },
          error: null
        });
      }
      default:
        // dashboard·catalogSync·manualEntryPendingCount 등 나머지 읽기는 빈 성공으로 —
        // 이 스펙의 관심사가 아니다(각자의 샘플 폴백이 화면을 채운다).
        return json({ ok: true, data: {}, error: null });
    }
  });

  return { registerAttempts: () => attempts, setRegisterPlan: (p) => (plan = p) };
}

async function passSessionGate(page: Page): Promise<void> {
  await page.goto('./');
  await page.fill('#sg-url', MOCK_API_URL);
  await page.fill('#sg-token', 'e2e-token');
  await page.fill('#sg-operator', 'E2E 사서');
  await page.getByRole('button', { name: '저장하고 시작' }).click();
  await expect(page.locator('.dock')).toBeVisible();
}

async function saveOneBook(page: Page, registerWindow: ReturnType<Page['locator']>): Promise<void> {
  await registerWindow.getByRole('button', { name: '수동 입력', exact: true }).click();
  await registerWindow.locator('#regManualIsbn').fill(REGISTER_ISBN);
  await registerWindow.getByRole('button', { name: '조회', exact: true }).click();
  await expect(registerWindow.locator('#regTitle')).toHaveValue('Pipeline Book');
  await registerWindow.getByRole('button', { name: '저장', exact: true }).click();
}

test('BUSY_RETRY 2회 → 개입 없이 3차 자동 성공 (저장 즉시 scan 복귀·트레이 진행 노출)', async ({ page }) => {
  const mock = await installScenarioMock(page);
  mock.setRegisterPlan(['busy', 'busy', 'ok']);
  await passSessionGate(page);

  await page.locator('.dock-icon[title="도서 등록"]').click();
  const registerWindow = page.locator('.window').nth(0);
  await saveOneBook(page, registerWindow);

  // 파이프라인의 존재 이유: 서버가 BUSY_RETRY를 뱉는 중에도 다음 책 스캔이 가능해야 한다.
  await expect(registerWindow.locator('.reg-scan')).toBeVisible();

  // 1차 실패 후 백오프 대기(2s) — 트레이가 진행 상태(대기/저장 중/재시도)를 숨기지 않는다.
  await expect(
    registerWindow.locator('.reg-trayRow.status-retryWait, .reg-trayRow.status-sending, .reg-trayRow.status-queued')
  ).toBeVisible();

  // 백오프 2s+4s 소화 후 3차 성공 — 등록번호 카드가 뜬다. 사용자 개입 없음.
  await expect(registerWindow.locator('.reg-bignum')).toHaveText(REGISTER_BARCODE, { timeout: 20_000 });
  expect(mock.registerAttempts()).toBe(3);

  // 완료 트레이 비우기 — 미전송 항목이 없으니 트레이 자체가 사라진다.
  await registerWindow.getByRole('button', { name: '완료 항목 지우기' }).click();
  await expect(registerWindow.locator('.reg-bignum')).toHaveCount(0);
});

test('네트워크 유실 → 새로고침 → 부팅 펌프가 같은 requestId로 재개해 완료', async ({ page }) => {
  const mock = await installScenarioMock(page);
  // 1차는 fetch 단계 실패(iOS PWA "Load failed" 사례) — 큐에 남는다. 이후 응답은 성공.
  mock.setRegisterPlan(['network', 'ok']);
  await passSessionGate(page);

  await page.locator('.dock-icon[title="도서 등록"]').click();
  const registerWindow = page.locator('.window').nth(0);
  await saveOneBook(page, registerWindow);
  await expect(registerWindow.locator('.reg-scan')).toBeVisible();

  // 1차(network 실패)가 나갔음을 확인하고 나서 새로고침 — localStorage의 큐가 재개 대상.
  await expect.poll(() => mock.registerAttempts(), { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
  await page.reload();
  await expect(page.locator('.dock')).toBeVisible();

  // 부팅 펌프(registerQueue 모듈 초기화)가 사람 손 없이 같은 requestId로 재전송해 완료한다.
  await page.locator('.dock-icon[title="도서 등록"]').click();
  const reopened = page.locator('.window').nth(0);
  await expect(reopened.locator('.reg-bignum')).toHaveText(REGISTER_BARCODE, { timeout: 20_000 });
});
