import { test, expect } from '@playwright/test';
import { installApiMock, MOCK_API_URL } from './mockApi';

// todo/108 「창 스냅 좌표 계약」 — 창 left는 .desktop-workspace(margin-left: DOCK_WIDTH=76)
// 내부 좌표다. 화면 좌표로 착각해 DOCK_WIDTH를 이중 가산하면 좌스냅 76px 갭·우스냅 76px
// 화면 밖(닫기 버튼 소실)이 된다 — 시각 감사 8R이 적발한 실결함의 상주 회귀 방어.
// 스냅 버튼은 dispatchEvent: 두 창이 겹친 상태에서 좌표 클릭은 위 창에 가로채인다(관례).

test.setTimeout(60_000);

const DOCK_W = 76;

test('좌/우 절반 스냅 — 도크 플러시·뷰포트 내 완결(닫기 버튼 가시)', async ({ page }) => {
  await installApiMock(page);
  await page.goto('./');
  await page.fill('#sg-url', MOCK_API_URL);
  await page.fill('#sg-token', 'e2e-token');
  await page.fill('#sg-operator', 'E2E 사서');
  await page.getByRole('button', { name: '저장하고 시작' }).click();
  await expect(page.locator('.dock')).toBeVisible();

  await page.locator('.dock-icon[title="대출·반납"]').click();
  await page.locator('.dock-icon[title="통합 검색"]').click();
  const left = page.locator('.window').nth(0);
  const right = page.locator('.window').nth(1);
  await expect(right.locator('.window-titlebar__title')).toHaveText('통합 검색');

  await left.getByRole('button', { name: '왼쪽 절반' }).dispatchEvent('click');
  await right.getByRole('button', { name: '오른쪽 절반' }).dispatchEvent('click');

  const viewportW = page.viewportSize()!.width;
  const lb = (await left.boundingBox())!;
  const rb = (await right.boundingBox())!;

  // ① 좌스냅: 도크 오른끝에 플러시(±1px) — 76px 갭 회귀 방지
  expect(Math.abs(lb.x - DOCK_W)).toBeLessThanOrEqual(1);
  // ② 우스냅: 오른끝이 뷰포트 안(±1px) — 화면 밖 76px 회귀 방지
  expect(rb.x + rb.width).toBeLessThanOrEqual(viewportW + 1);
  // ③ 두 창이 나란히 이어짐(좌 오른끝 ≈ 우 왼끝)
  expect(Math.abs(lb.x + lb.width - rb.x)).toBeLessThanOrEqual(1);
  // ④ 우측 창의 닫기 버튼이 실제로 화면 안에서 보인다(소실 증상 직접 단정)
  const closeBtn = right.getByRole('button', { name: '닫기' });
  await expect(closeBtn).toBeVisible();
  const cb = (await closeBtn.boundingBox())!;
  expect(cb.x + cb.width).toBeLessThanOrEqual(viewportW);
});
