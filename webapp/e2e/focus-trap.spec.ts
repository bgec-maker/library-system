import { test, expect } from '@playwright/test';
import { installApiMock, MOCK_API_URL, CHECKOUT_BARCODE, CHECKOUT_STUDENT_CODE } from './mockApi';

// todo/80 「다이얼로그 포커스 트랩」 — 키보드 사용자 계약: 첫 포커스=취소(위험 동작 비선택,
// NN/g), Tab 순환이 다이얼로그 밖으로 새지 않음, ESC=취소, 닫히면 연 버튼으로 복귀.
// 진입 경로는 반납 직후 언두바의 「대신 연장」(공용 ConfirmDialog 소비처 중 e2e로 가장 짧은 길).

test.setTimeout(60_000);

test('ConfirmDialog — 첫 포커스·Tab 순환·ESC 취소·포커스 복귀 + 설정 오버레이 ESC', async ({ page }) => {
  await installApiMock(page);

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

  // 대출 → 반납(같은 책 재적용) → 반납 언두바에 「대신 연장」이 뜬다
  await manualInput.fill(CHECKOUT_BARCODE);
  await applyBtn.click();
  await manualInput.fill(`S:${CHECKOUT_STUDENT_CODE}`);
  await applyBtn.click();
  await expect(win.locator('.lr-op', { hasText: '대출' }).first()).toContainText('완료');
  await manualInput.fill(CHECKOUT_BARCODE);
  await applyBtn.click();
  await expect(win.locator('.lr-op', { hasText: '반납' }).first()).toContainText('완료');

  const undoBar = page.locator('.lr-undo-bar');
  await expect(undoBar).toBeVisible();
  await undoBar.getByRole('button', { name: '대신 연장' }).dispatchEvent('click');

  const dialog = page.locator('[role="alertdialog"]');
  await expect(dialog).toBeVisible();

  // ① 첫 포커스 = 취소(ghost) — 위험 동작(확인)이 기본 선택되지 않는다
  await expect
    .poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent ?? ''))
    .toContain('취소');

  // ② Tab 순환 — 취소 → 확인 → (wrap) 취소, Shift+Tab 역방향
  await page.keyboard.press('Tab');
  const confirmText = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent ?? '');
  expect(confirmText).not.toContain('취소');
  await page.keyboard.press('Tab');
  await expect
    .poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent ?? ''))
    .toContain('취소');
  await page.keyboard.press('Shift+Tab');
  const backText = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent ?? '');
  expect(backText).toBe(confirmText);

  // ③ ESC = 취소 + ④ "열기 직전 포커스"로 복귀. 주의: 복귀 목표는 「대신 연장」이 아니다 —
  //    openRedirect가 다이얼로그를 여는 순간 언두바(와 그 버튼)를 즉시 걷어내므로(clearUndo),
  //    트랩의 계약은 "직전 activeElement 복원"이고 이 시나리오에선 그것이 「적용」이다.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent ?? ''))
    .toContain('적용');

  // ⑤ 설정 오버레이(완료 상태 재진입)는 ESC로 닫힌다 — 부팅 게이트와 달리 선택적 모달
  await page.locator('.dock-settings').click();
  await expect(page.locator('.session-gate-overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.session-gate-overlay')).toHaveCount(0);
});
