import { test, expect } from '@playwright/test';
import { installApiMock, MOCK_API_URL } from './mockApi';

// todo/66 「모바일 뒤로가기 트랩·스택 e2e」 — StackNav의 히스토리 계약(FRONTEND '탭+스택')을
// 상주 보증한다: ① push→back=pop ② 루트에서 back=앱 유지(depth-0 sentinel 재적재, PWA "종료"
// 방지 트랩) ③ 중첩 push 후 연속 back ④ 탭 전환 시 스택 reset. 57 입장 모션·69 pop 역재생이
// 전부 이 지반 위를 지나므로, 모션 작업 전에 지반부터 자동화한다.

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, permissions: ['camera'] });
test.setTimeout(60_000);

test('스택 push/pop · 루트 뒤로가기 트랩 · 탭 전환 reset', async ({ page }) => {
  await installApiMock(page);

  await page.goto('./');
  await page.fill('#sg-url', MOCK_API_URL);
  await page.fill('#sg-token', 'e2e-token');
  await page.fill('#sg-operator', 'E2E 사서');
  await page.getByRole('button', { name: '저장하고 시작' }).click();
  await expect(page.locator('.m-tabbar')).toBeVisible();
  const appUrl = page.url();

  // ① push → 브라우저 back = pop (탭 화면 복귀, 문서 이탈 없음)
  await page.locator('.m-tab', { hasText: '더보기' }).click();
  await page.locator('.m-more-item', { hasText: '리포트' }).click();
  await expect(page.locator('.m-stack-title')).toHaveText('리포트');
  await page.goBack();
  await expect(page.locator('.m-stack-overlay')).toHaveCount(0);
  await expect(page.locator('.m-more-item', { hasText: '리포트' })).toBeVisible();
  expect(page.url()).toBe(appUrl);

  // ② 루트에서 back — sentinel 재적재로 앱이 그대로 남는다(제스처/버튼 이탈 방지 트랩)
  await page.goBack();
  await expect(page.locator('.m-tabbar')).toBeVisible();
  expect(page.url()).toBe(appUrl);
  // 트랩이 재적재됐는지 한 번 더 — 연속 back에도 견딘다
  await page.goBack();
  await expect(page.locator('.m-tabbar')).toBeVisible();

  // ③ 중첩 push(장서 대장 → 도서 상세) 후 연속 back으로 한 층씩 pop
  //    (리포트 허브의 카드는 같은 스택 항목 안 패널 전환이라 push가 아니다 — 진짜 중첩은
  //     "push된 뷰에서 다른 뷰를 여는" 경로: 대장 행 → 상세.)
  await page.locator('.m-more-item', { hasText: '장서 대장' }).click();
  await expect(page.locator('.m-stack-title')).toHaveText('장서 대장');
  await page.locator('.data-table-card').first().click();
  await expect(page.locator('.m-stack-title')).toHaveText('도서 상세');
  await page.goBack();
  await expect(page.locator('.m-stack-title')).toHaveText('장서 대장');
  await page.goBack();
  await expect(page.locator('.m-stack-overlay')).toHaveCount(0);

  // ④ push 상태에서 탭 전환 — 스택이 즉시 reset되고, 이후 back도 앱을 벗어나지 않는다
  await page.locator('.m-more-item', { hasText: '리포트' }).click();
  await expect(page.locator('.m-stack-title')).toHaveText('리포트');
  await page.locator('.m-tab', { hasText: '통합 검색' }).click();
  await expect(page.locator('.m-stack-overlay')).toHaveCount(0);
  await expect(page.locator('.search-view')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.m-tabbar')).toBeVisible();
  expect(page.url()).toBe(appUrl);
});
