import { test, expect } from '@playwright/test';
import { installApiMock, MOCK_API_URL, CHECKOUT_BARCODE, CHECKOUT_STUDENT_CODE, REGISTER_ISBN, REGISTER_BARCODE } from './mockApi';

// todo/41 「모바일 셸 스모크」 — FRONTEND.md 제1원칙(두 셸이 같은 뷰를 공유)의 나머지 절반.
// 기존 스위트는 전부 데스크톱 셸(창 관리자)만 돌아서 탭+스택 셸은 회귀 무방비였다(todo/43의
// 아이폰 탭바 제보가 그 증거). boot.tsx detectPlatform은 (pointer: coarse) 또는 폭<900이면
// mobile을 고른다 — 뷰포트 390×844 + hasTouch로 둘 다 충족시킨다.
//
// 주의: iOS Safari의 동적 뷰포트(주소창 접힘, todo/43의 dvh)는 Playwright로 재현할 수 없다 —
// 이 스펙이 보증하는 건 "모바일 셸에서 핵심 업무 흐름이 돈다"까지이고, 실기기 인셋·주소창
// 동작은 현장 검증(VERIFY) 영역으로 남는다.

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, permissions: ['camera'] });
test.setTimeout(60_000);

test('모바일 셸 — 탭바 4칸 · 대출 흐름 · 등록 파이프라인 · 더보기→리포트 push', async ({ page }) => {
  await installApiMock(page);

  await test.step('세션게이트 통과 → 탭바 렌더', async () => {
    await page.goto('./');
    await page.fill('#sg-url', MOCK_API_URL);
    await page.fill('#sg-token', 'e2e-token');
    await page.fill('#sg-operator', 'E2E 사서');
    await page.getByRole('button', { name: '저장하고 시작' }).click();

    // 데스크톱 셸이 아니라 모바일 셸이 선택됐는지 — 탭바가 있고 도크는 없어야 한다.
    await expect(page.locator('.m-tabbar')).toBeVisible();
    await expect(page.locator('.dock')).toHaveCount(0);
    await expect(page.locator('.m-tab')).toHaveCount(4);
  });

  await test.step('스캔 탭(=대출·반납) — 수동 입력으로 대출 1건', async () => {
    // 스캔 탭이 시작 화면(FRONTEND.md "스캔이 항상 첫 탭 + 앱 시작 화면").
    await page.getByText('수동 입력 (카메라 사용 불가 시)').click();
    const manualInput = page.locator('.lr-manual-row input');
    const applyBtn = page.getByRole('button', { name: '적용' });

    await manualInput.fill(CHECKOUT_BARCODE);
    await applyBtn.click();
    await expect(page.locator('.lr-slot-value.mono').first()).toHaveText(CHECKOUT_BARCODE);

    await manualInput.fill(`S:${CHECKOUT_STUDENT_CODE}`);
    await applyBtn.click();
    await expect(page.locator('.lr-op', { hasText: '대출' }).first()).toContainText('완료');
  });

  await test.step('등록 탭 — 파이프라인(저장 즉시 scan 복귀 + 트레이 완료)이 모바일 셸에서도 동작', async () => {
    await page.locator('.m-tab', { hasText: '도서 등록' }).click();
    await page.getByRole('button', { name: '수동 입력', exact: true }).click();
    await page.locator('#regManualIsbn').fill(REGISTER_ISBN);
    await page.getByRole('button', { name: '조회', exact: true }).click();
    await expect(page.locator('#regTitle')).toHaveValue('E2E New Title');
    await page.getByRole('button', { name: '저장', exact: true }).click();

    await expect(page.locator('.reg-scan')).toBeVisible();
    await expect(page.locator('.reg-bignum')).toHaveText(REGISTER_BARCODE);
  });

  await test.step('카메라 무대 — body 포털 + 탭바 위 전면(todo/46 회귀) + 미인식 힌트(todo/68)', async () => {
    // 등록 탭의 scan 화면에서 카메라 시작(가짜 장치 — playwright.config launchOptions).
    await page.getByRole('button', { name: '카메라 시작' }).click();
    const stage = page.locator('.scan-stage');
    await expect(stage).toBeVisible();
    // iOS WebKit fixed-갇힘 회귀 방지의 핵심 단정 2개: ① body 직속(포털) ② 탭바 영역까지 덮는 전면.
    expect(await stage.evaluate((el) => el.parentElement === document.body)).toBe(true);
    const box = await stage.boundingBox();
    const viewportH = page.viewportSize()?.height ?? 0;
    expect(box?.y).toBe(0);
    expect((box?.height ?? 0) >= viewportH - 1).toBe(true);
    // todo/68 — 가짜 카메라는 아무것도 디코드하지 못한다 → 6초 뒤 미인식 힌트가 떠야 하고,
    // 스캔(주입)이 오면 즉시 접혀야 한다(디코드 생존 신호 리셋).
    await expect(stage.locator('.scan-stage__missHint')).toBeVisible({ timeout: 9_000 });
    await page.evaluate(() => {
      // unknown 대상(미인식 부류) — 힌트 리셋은 "디코드 생존" 신호면 충분하고, ISBN 같은 유효
      // 대상을 넣으면 등록 플로우가 진행돼 무대가 닫혀버린다(이 스텝의 관심사 아님).
      (window as unknown as { __e2eScan: (raw: string) => void }).__e2eScan('???');
    });
    await expect(stage.locator('.scan-stage__missHint')).toHaveCount(0);
    // 종료(X) — 무대가 닫히고 scan 화면 복귀.
    await stage.getByRole('button').last().click();
    await expect(stage).toHaveCount(0);
  });

  await test.step('더보기 → 리포트 push(StackNav) — 탭 미배정 뷰 진입 경로', async () => {
    await page.locator('.m-tab', { hasText: '더보기' }).click();
    // todo/72 — 요약 스트립의 예약 대기 타일 = 예약 관리 딥링크(데스크톱 예약 도착 카드 패리티)
    await page.locator('.m-dash-summary-link').click();
    await expect(page.locator('.m-stack-title')).toHaveText('예약 관리');
    await page.goBack();
    await expect(page.locator('.m-stack-overlay')).toHaveCount(0);
    await page.locator('.m-more-item', { hasText: '리포트' }).click();
    await expect(page.locator('.m-stack-title')).toHaveText('리포트');
    // 리포트 허브 카드가 실제로 렌더됐는지 한 장만 확인(뷰 공유의 증거).
    await expect(page.getByRole('button', { name: '장서 시각화' })).toBeVisible();
  });
});
