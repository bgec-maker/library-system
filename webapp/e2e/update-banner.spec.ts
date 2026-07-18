import { test, expect } from '@playwright/test';
import { installApiMock, MOCK_API_URL } from './mockApi';

// todo/86 — 새 버전 감지 배너. UpdateBanner는 탭 복귀(visibilitychange→visible) 시
// index.html을 재조회해 <meta name="build-id">를 번들 상수와 비교한다.
//
// 시나리오 구성: dev 서버의 실제 index.html은 build-id="dev"(번들 __BUILD_ID__와 동일)라
// ① 같은 빌드 → 배너 없음은 라우트 목 없이 그대로 검증된다. ② 다른 빌드는 index.html
// fetch만 라우트로 가로채 다른 build-id를 응답(문서 내비게이션 URL은 './'라 '**/index.html'
// 글롭에 안 걸린다 — fetch 전용 가로채기). 두 시나리오 사이 page.reload()로 모듈 상태
// (스로틀 시각)를 초기화한다.

test.setTimeout(60_000);

async function bootToShell(page: import('@playwright/test').Page) {
  await page.goto('./');
  await expect(page.locator('#sg-url')).toBeVisible();
  await page.fill('#sg-url', MOCK_API_URL);
  await page.fill('#sg-token', 'e2e-token');
  await page.fill('#sg-operator', 'E2E 사서');
  await page.getByRole('button', { name: '저장하고 시작' }).click();
  await expect(page.locator('.session-gate-overlay')).toHaveCount(0);
  await expect(page.locator('.dock')).toBeVisible();
}

test('탭 복귀 시 build-id 비교 — 같으면 침묵, 다르면 배너+새로고침', async ({ page }) => {
  await installApiMock(page);
  await bootToShell(page);

  await test.step('① 같은 빌드: visibilitychange를 쏴도 배너가 뜨지 않는다', async () => {
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    // fetch 왕복 여유를 주고 나서 부재를 단정한다(즉시 단정하면 거짓 통과 가능).
    await page.waitForTimeout(600);
    await expect(page.locator('.update-banner')).toHaveCount(0);
  });

  await test.step('② 다른 빌드: index.html 응답을 갈아끼우면 배너가 뜬다', async () => {
    await page.route('**/index.html', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html><head><meta name="build-id" content="e2e-new" /></head><body></body></html>'
      })
    );
    // 리로드로 모듈 스로틀 상태 초기화(같은 페이지에서 재검사는 60초 간격 제한에 걸린다).
    await page.reload();
    await expect(page.locator('.dock')).toBeVisible();

    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const banner = page.locator('.update-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('새 버전이 배포되었습니다');
  });

  await test.step('③ 새로고침 버튼 → 페이지 리로드(배너는 새 문서에서 사라진 상태)', async () => {
    await page.evaluate(() => {
      (window as unknown as { __e2eMarker?: number }).__e2eMarker = 1;
    });
    await page.locator('.update-banner button').click();
    // 리로드되면 이전 문서의 전역 마커가 사라진다 — 실제 리로드가 일어났다는 증거.
    await expect(page.locator('.dock')).toBeVisible();
    const marker = await page.evaluate(() => (window as unknown as { __e2eMarker?: number }).__e2eMarker);
    expect(marker).toBeUndefined();
    await expect(page.locator('.update-banner')).toHaveCount(0);
  });
});
