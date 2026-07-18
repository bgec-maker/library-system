import { test, expect } from '@playwright/test';
import { installApiMock, MOCK_API_URL } from './mockApi';

// todo/115 「장서 점검 세션 상주 회귀」 — 연 1회의 핵심 워크플로(시작→스캔 집계→종료→분실
// 후보)가 지금까지 e2e 시야 밖이었다(목 바코드가 Luhn 위반이라 스캔 주입이 분류 단계에서
// 조용히 탈락 — 같은 항목에서 목을 유효값으로 교정). 계약:
//   ① 시작 시 대상 = 대출가능·예약대기(대출중 제외) ② 유효 스캔 = 집계 + inventoryScan 기록
//   ③ 대상 밖(대출중) 스캔은 집계 안 됨 ④ 종료 시 미스캔 대상만 분실 후보.
// 스캔은 DEV 주입 채널(__e2eScan) — 실 카메라 없이 스캔 소비 계약만 검증한다.

test.setTimeout(60_000);

test('점검 세션 — 시작(3권)→유효 스캔(1/3)→대출중 무시→종료(분실 후보 2권)', async ({ page }) => {
  await installApiMock(page);
  let invCalls = 0;
  await page.route(`${MOCK_API_URL}**`, async (route) => {
    const body = route.request().postData() ?? '';
    if (body.includes('"inventoryScan"')) {
      invCalls += 1;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { updated: true }, error: null })
      });
      return;
    }
    await route.fallback();
  });

  await page.goto('./');
  await page.fill('#sg-url', MOCK_API_URL);
  await page.fill('#sg-token', 'e2e-token');
  await page.fill('#sg-operator', 'E2E 사서');
  await page.getByRole('button', { name: '저장하고 시작' }).click();
  await expect(page.locator('.dock')).toBeVisible();

  await page.locator('.dock-icon[title="장서 점검"]').click();
  const invView = page.locator('.inv-view');
  await expect(page.locator('.inv-start-btn')).toBeEnabled();

  // ① 시작 — 목 카탈로그 4권 중 대출중(2000024) 제외 3권이 대상
  await page.locator('.inv-start-btn').dispatchEvent('click');
  await expect(invView).toContainText('0 / 3');

  // ② 유효 스캔(대출가능 2000008) — 집계 1/3 + 서버 기록 1회
  await page.evaluate(() => (window as unknown as { __e2eScan: (v: string) => void }).__e2eScan('2000008'));
  await expect(invView).toContainText('1 / 3');
  expect(invCalls).toBe(1);

  // 같은 책 재스캔 — 이중 집계 없음(멱등)
  await page.evaluate(() => (window as unknown as { __e2eScan: (v: string) => void }).__e2eScan('2000008'));
  await page.waitForTimeout(300);
  await expect(invView).toContainText('1 / 3');

  // ②-b todo/116 — 뒤표지 ISBN(EAN-13) 오스캔: 침묵 대신 안내 토스트(현장 최빈 오조작)
  await page.evaluate(() => (window as unknown as { __e2eScan: (v: string) => void }).__e2eScan('9788936433598'));
  await expect(page.locator('.toast', { hasText: '등록번호 라벨' })).toBeVisible();
  await expect(invView).toContainText('1 / 3'); // 집계 불변

  // ③ 대상 밖(대출중 2000024) 스캔 — 집계 불변(회원이 갖고 있는 책은 서가에 없는 게 정상)
  await page.evaluate(() => (window as unknown as { __e2eScan: (v: string) => void }).__e2eScan('2000024'));
  await page.waitForTimeout(300);
  await expect(invView).toContainText('1 / 3');

  // ④ 종료 — 미스캔 대상 2권(2000016·2000032)만 분실 후보
  await page.getByRole('button', { name: '세션 종료' }).dispatchEvent('click');
  await expect(invView).toContainText('장서 점검 결과');
  await expect(invView).toContainText('분실 후보 2권');
  await expect(invView).toContainText('2000016');
  await expect(invView).toContainText('2000032');
  await expect(invView).not.toContainText('2000008');
});
