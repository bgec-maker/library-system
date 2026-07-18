import { test, expect } from '@playwright/test';
import { MOCK_API_URL, CHECKOUT_BARCODE, CHECKOUT_STUDENT_CODE } from './mockApi';

// todo/37 「쓰기 BUSY_RETRY 자동 흡수」 회귀 스펙 — 대출(checkout)이 서버 락 경합(BUSY_RETRY)을
// 한 번 맞아도 사용자 개입 없이 같은 requestId 재시도로 완료되는지. register-pipeline.spec.ts와
// 같은 시나리오 제어형 목 패턴(installApiMock은 항상 성공이라 실패 경로엔 부적합).

test.setTimeout(60_000);

test('대출 중 BUSY_RETRY 1회 → 개입 없이 자동 재시도 성공 (같은 requestId)', async ({ page }) => {
  let checkoutAttempts = 0;
  const checkoutRequestIds = new Set<string>();

  await page.route(MOCK_API_URL + '**', async (route) => {
    const payload = JSON.parse(route.request().postData() ?? '{}') as {
      action?: string;
      requestId?: string;
    };
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    switch (payload.action) {
      case 'copyStatus':
        // mockApi.ts의 copyStatus 응답 모양 그대로(views/loan-return이 기대하는 필드 전부).
        return json({
          ok: true,
          data: {
            copyId: 'copy-e2e', barcode: CHECKOUT_BARCODE, statusCode: 'AVAILABLE', title: 'Retry Book',
            titleStatusCode: 'ACTIVE', onLoan: false, loanId: '', dueAt: '', memberNo: '', memberName: ''
          },
          error: null
        });
      case 'checkout': {
        checkoutAttempts += 1;
        if (payload.requestId) checkoutRequestIds.add(payload.requestId);
        if (checkoutAttempts === 1) {
          return json({ ok: false, data: null, error: { code: 'BUSY_RETRY', message: '다른 작업이 처리 중입니다.' } });
        }
        return json({ ok: true, data: { memberName: 'E2E 학생', dueAt: '2026-07-31' }, error: null });
      }
      default:
        return json({ ok: true, data: {}, error: null });
    }
  });

  await page.goto('./');
  await page.fill('#sg-url', MOCK_API_URL);
  await page.fill('#sg-token', 'e2e-token');
  await page.fill('#sg-operator', 'E2E 사서');
  await page.getByRole('button', { name: '저장하고 시작' }).click();
  await expect(page.locator('.dock')).toBeVisible();

  await page.locator('.dock-icon[title="대출·반납"]').click();
  const win = page.locator('.window').nth(0);
  await win.getByText('수동 입력 (카메라 사용 불가 시)').click();
  const manualInput = win.locator('.lr-manual-row input');
  const applyBtn = win.getByRole('button', { name: '적용' });

  await manualInput.fill(CHECKOUT_BARCODE);
  await applyBtn.click();
  await expect(win.locator('.lr-slot-value.mono').first()).toHaveText(CHECKOUT_BARCODE);

  await manualInput.fill(`S:${CHECKOUT_STUDENT_CODE}`);
  await applyBtn.click();

  // 1차 BUSY_RETRY → 1.5초 백오프 → 2차 성공. 사용자 개입 없이 「완료」에 도달해야 한다.
  const checkoutOp = win.locator('.lr-op', { hasText: '대출' }).first();
  await expect(checkoutOp).toContainText('완료', { timeout: 15_000 });
  expect(checkoutAttempts).toBe(2);
  // 멱등의 전제 — 재시도가 새 requestId를 만들지 않았는지(같은 ID 재전송이어야 서버가 흡수).
  expect(checkoutRequestIds.size).toBe(1);
});
