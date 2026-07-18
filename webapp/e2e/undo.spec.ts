import { test, expect } from '@playwright/test';
import { installApiMock, MOCK_API_URL, CHECKOUT_BARCODE, CHECKOUT_STUDENT_CODE } from './mockApi';

// todo/64 「언두바 회귀 e2e」 — 확인창 대신 되돌리기(NN/g, todo/13)가 이 앱 안전모델의 축인데
// 지금까지 자동화가 없었다. 리스킨(59)·모션(57)·프레스(56)가 계속 이 위를 지나가므로 상주 보증.
//
// 계약 근거: 대출의 실행취소 = 반대 트랜잭션(return)을 **새 requestId**로 보낸다(views/loan-return
// handleUndoClick). 언두는 5초 창 안에서만 — 여기서는 클릭이 즉시라 타이머 경계는 다루지 않는다
// (경계 타이밍은 flaky 유발 — 창 만료 동작은 수동 확인 영역으로 남긴다, ASSUMPTIONS 관례).

test.setTimeout(60_000);

test('대출 → 실행취소(5초 창) → 반대 트랜잭션(return) 완료·언두바 소멸', async ({ page }) => {
  await installApiMock(page);

  await page.goto('./');
  await page.fill('#sg-url', MOCK_API_URL);
  await page.fill('#sg-token', 'e2e-token');
  await page.fill('#sg-operator', 'E2E 사서');
  await page.getByRole('button', { name: '저장하고 시작' }).click();
  await expect(page.locator('.dock')).toBeVisible();

  await page.locator('.dock-icon[title="대출·반납"]').click();
  const win = page.locator('.window').nth(0);

  // 수동 입력 경로로 대출 1건 (mobile-smoke와 같은 공유 뷰 DOM — 창 안에서도 동일)
  await win.getByText('수동 입력 (카메라 사용 불가 시)').click();
  const manualInput = win.locator('.lr-manual-row input');
  const applyBtn = win.getByRole('button', { name: '적용' });
  await manualInput.fill(CHECKOUT_BARCODE);
  await applyBtn.click();
  await manualInput.fill(`S:${CHECKOUT_STUDENT_CODE}`);
  await applyBtn.click();
  await expect(win.locator('.lr-op', { hasText: '대출' }).first()).toContainText('완료');

  // 언두바 — 대출 직후 5초 창. 대출 모드에선 「실행취소」 단독(대신 연장/분실은 반납 전용).
  const undoBar = page.locator('.lr-undo-bar');
  await expect(undoBar).toBeVisible();
  await expect(undoBar).toContainText(CHECKOUT_BARCODE);
  await expect(undoBar.getByRole('button', { name: /실행취소/ })).toHaveCount(1);
  await expect(undoBar.locator('button')).toHaveCount(1);

  // dispatchEvent: 카운트다운(1s 틱) 재렌더로 Playwright 좌표 클릭이 안정성/적중에 흔들린다 —
  // 사람에겐 문제없는 클릭이므로 DOM 이벤트로 직접 발화. 아래 결과 3종 단정이 "옳은 대상을
  // 눌렀는지"를 증명하므로 가짜 통과를 만들 수 없다.
  await undoBar.getByRole('button', { name: /실행취소/ }).dispatchEvent('click');

  // 완료 신호 3종: 토스트 · 언두바 소멸 · 반대 트랜잭션(반납) 처리행 추가.
  await expect(page.locator('.toast.success', { hasText: '실행취소 완료' })).toBeVisible();
  await expect(undoBar).toHaveCount(0);
  await expect(win.locator('.lr-op', { hasText: '반납' }).first()).toContainText('완료');

  // 상태 원복 검증 — 같은 책 재적용 시 소장본 슬롯이 다시 채워진다(목의 loaned=false 복귀).
  // 자동 반납이 또 일어나지 않았음(반납 처리행이 1건뿐)도 함께 단정.
  await manualInput.fill(CHECKOUT_BARCODE);
  await applyBtn.click();
  await expect(win.locator('.lr-slot-value.mono').first()).toHaveText(CHECKOUT_BARCODE);
  await expect(win.locator('.lr-op', { hasText: '반납' })).toHaveCount(1);
});
