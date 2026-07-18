import { test, expect, type Page } from '@playwright/test';
import { installApiMock, MOCK_API_URL } from './mockApi';

test.setTimeout(120_000);

async function boot(page: Page) {
  await installApiMock(page);
  await page.goto('./');
  await page.fill('#sg-url', MOCK_API_URL);
  await page.fill('#sg-token', 'e2e-token');
  await page.fill('#sg-operator', 'E2E 사서');
  await page.getByRole('button', { name: '저장하고 시작' }).click();
  await expect(page.locator('.session-gate-overlay')).toHaveCount(0);
}

test('desktop 2R', async ({ page }) => {
  await boot(page);
  await page.locator('.dock-icon[title="설정"]').first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/vis/r2-d1-settings.png' });

  await page.locator('.dock-icon[title="최근 처리"]').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/vis/r2-d2-recentops.png' });

  await page.locator('.dock-icon[title="장서 점검"]').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/vis/r2-d3-inventory.png' });

  await page.locator('.dock-icon[title="도서 등록"]').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/vis/r2-d4-register.png' });
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('mobile 2R', async ({ page }) => {
    await boot(page);
    // 스캔 탭 수동 입력 펼침
    await page.getByText('수동 입력 (카메라 사용 불가 시)').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: '/tmp/vis/r2-m1-manual.png' });

    await page.locator('.m-tab', { hasText: '더보기' }).dispatchEvent('click');
    await page.waitForTimeout(300);
    await page.getByText('장서 대장').dispatchEvent('click');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: '/tmp/vis/r2-m2-catalog.png' });

    await page.locator('.m-stack-back').dispatchEvent('click');
    await page.waitForTimeout(500);
    await page.getByText('설정', { exact: true }).dispatchEvent('click');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: '/tmp/vis/r2-m3-settings.png' });
  });
});
