import { test, expect } from '@playwright/test';
import { installApiMock, MOCK_API_URL } from './mockApi';

// todo/137·138 「도움말 탭 상주 회귀」 — 계약:
//   ① 공지: 고정(pinned)이 먼저, WARN은 「중요」 pill ② 새 공지 부팅 토스트는 세션 1회,
//   도움말 열람(lastSeen 갱신) 후 재부팅엔 안 뜬다 ③ 재배포 전(UNKNOWN_ACTION)엔 공지만
//   안내 한 줄로 접히고 사용법 가이드는 정상 동작 ④ 가이드 섹션 열기·EN 전환.

test.setTimeout(90_000);

test('도움말 — 공지 정렬·부팅 토스트 1회·가이드 섹션', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApiMock(page);
  await page.goto('./');
  await page.fill('#sg-url', MOCK_API_URL);
  await page.fill('#sg-token', 'e2e-token');
  await page.fill('#sg-operator', 'E2E 사서');
  await page.getByRole('button', { name: '저장하고 시작' }).click();

  // ② 새 공지 부팅 토스트(최신 = 고정 WARN 공지 제목)
  await expect(page.locator('.toast', { hasText: '새 공지' })).toBeVisible();
  await expect(page.locator('.toast', { hasText: '휴관' })).toBeVisible();

  // 도움말 진입 — 공지 정렬·pill
  await page.getByRole('button', { name: '더보기' }).click();
  await page.getByRole('button', { name: '도움말' }).click();
  const view = page.locator('.help-view');
  await expect(view).toBeVisible();
  const notices = view.locator('.help-notice');
  await expect(notices).toHaveCount(2);
  await expect(notices.first()).toContainText('휴관'); // ① 고정 우선
  await expect(notices.first().locator('.help-notice-level--warn')).toHaveText('중요');
  await expect(notices.first().locator('.help-notice-pin')).toBeVisible();

  // ④ 가이드 — TOC 칩으로 섹션 열기
  await view.locator('.help-toc-chip', { hasText: '대출·반납' }).click();
  const loanSection = view.locator('#help-sec-loan-return');
  await expect(loanSection).toHaveAttribute('open', '');
  await expect(loanSection).toContainText('실행 취소');

  // ② 열람으로 lastSeen 갱신 — 재부팅(리로드) 시 토스트가 다시 뜨지 않는다
  // (세션은 localStorage에 저장돼 게이트 없이 바로 셸이 뜬다 — fill 재시도 금지: 없는
  //  셀렉터 대기 30초가 테스트 예산을 태운다)
  await page.reload();
  await expect(page.locator('.m-shell-main')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(900); // 토스트가 뜬다면 뜰 시간
  await expect(page.locator('.toast', { hasText: '새 공지' })).toHaveCount(0);
});

test('도움말 — 재배포 전 폴백: 공지만 접히고 가이드는 산다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApiMock(page);
  // notices 액션만 미배포 상태로 덮어쓴다(UNKNOWN_ACTION)
  await page.route(`${MOCK_API_URL}**`, async (route) => {
    const body = route.request().postData() ?? '';
    if (body.includes('"notices"')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, data: null, error: { code: 'UNKNOWN_ACTION', message: 'pre-deploy' } })
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
  await expect(page.locator('.m-shell-main')).toBeVisible();
  await expect(page.locator('.toast', { hasText: '새 공지' })).toHaveCount(0); // 미배포 = 토스트 없음

  await page.getByRole('button', { name: '더보기' }).click();
  await page.getByRole('button', { name: '도움말' }).click();
  const view = page.locator('.help-view');
  await expect(view).toContainText('서버 업데이트 후 표시');
  // ③ 가이드는 정상 — 섹션 열고 내용 확인
  await view.locator('.help-toc-chip', { hasText: '장서 점검' }).click();
  await expect(view.locator('#help-sec-inventory')).toContainText('세션 종료');
});
