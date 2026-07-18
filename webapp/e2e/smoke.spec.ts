import { test, expect } from '@playwright/test';
import { installApiMock, MOCK_API_URL, CHECKOUT_BARCODE, CHECKOUT_STUDENT_CODE, REGISTER_ISBN, REGISTER_BARCODE } from './mockApi';

// todo/27 「E2E 스모크 CI 상주」 — 이 프로젝트 최초의 자동화 테스트. 단일 시나리오로 순서대로
// 이어간다(스펙 원문 그대로): 세션게이트 → 대출·반납(목 서버) → 등록 → catalog 정렬 → 언어 토글
// → 인쇄 CSS 스냅샷. 데스크톱 셸 하나로 고정(뷰포트 1280×720, pointer:fine — boot.tsx의
// detectPlatform()이 매 실행 결정론적으로 데스크톱을 고르게 한다).
//
// 백엔드는 전부 mockApi.ts의 page.route()가 가로챈다 — 실제 GAS 배포·school-patch-v1/Code.gs는
// 이 스위트가 존재하는지조차 모른다.

test.setTimeout(60_000);

test('세션게이트 → 대출·반납 → 등록 → catalog 정렬 → 언어 토글 → 인쇄 스냅샷', async ({ page }) => {
  await installApiMock(page);

  await test.step('SessionGate: 최초 URL·토큰·작업자 설정', async () => {
    await page.goto('./');
    await expect(page.locator('#sg-url')).toBeVisible();
    // todo/112 — 오형식 URL은 침묵 대신 힌트 + 버튼 비활성(형식 검증 상주 단정)
    await page.fill('#sg-url', 'not-a-url');
    await page.fill('#sg-token', 'e2e-token');
    await page.fill('#sg-operator', 'E2E 사서');
    await expect(page.locator('#sg-url-hint')).toBeVisible();
    await expect(page.getByRole('button', { name: '저장하고 시작' })).toBeDisabled();
    await page.fill('#sg-url', MOCK_API_URL);
    await expect(page.locator('#sg-url-hint')).toHaveCount(0);
    await page.fill('#sg-token', 'e2e-token');
    await page.fill('#sg-operator', 'E2E 사서');

    const saveBtn = page.getByRole('button', { name: '저장하고 시작' });
    await expect(saveBtn).toBeEnabled();
    // todo/120 — 폼 표준: 마지막 필드에서 Enter로도 제출된다(버튼과 같은 canSave 판정).
    await page.locator('#sg-operator').press('Enter');

    await expect(page.locator('.session-gate-overlay')).toHaveCount(0);
    await expect(page.locator('.dock')).toBeVisible();
  });

  const loanReturnWindow = page.locator('.window').nth(0);
  const registerWindow = page.locator('.window').nth(1);
  const catalogWindow = page.locator('.window').nth(2);

  await test.step('대출·반납 창 열기', async () => {
    await page.locator('.dock-icon[title="대출·반납"]').click();
    await expect(loanReturnWindow.locator('.window-titlebar__title')).toHaveText('대출·반납');
  });

  await test.step('대출(checkout) — 소장본 스캔 후 학생 스캔', async () => {
    await loanReturnWindow.getByText('수동 입력 (카메라 사용 불가 시)').click();
    const manualInput = loanReturnWindow.locator('.lr-manual-row input');
    const applyBtn = loanReturnWindow.getByRole('button', { name: '적용' });

    await manualInput.fill(CHECKOUT_BARCODE);
    await applyBtn.click();
    await expect(loanReturnWindow.locator('.lr-slot-value.mono').first()).toHaveText(CHECKOUT_BARCODE);

    await manualInput.fill(`S:${CHECKOUT_STUDENT_CODE}`);
    await applyBtn.click();

    const checkoutOp = loanReturnWindow.locator('.lr-op', { hasText: '대출' }).first();
    await expect(checkoutOp).toContainText('완료');
    await expect(loanReturnWindow.locator('.lr-recent-header')).toContainText('오늘 1건');
  });

  await test.step('반납(return) — 대출 중인 소장본 재스캔 시 자동 반납', async () => {
    const manualInput = loanReturnWindow.locator('.lr-manual-row input');
    const applyBtn = loanReturnWindow.getByRole('button', { name: '적용' });

    await manualInput.fill(CHECKOUT_BARCODE);
    await applyBtn.click();

    const returnOp = loanReturnWindow.locator('.lr-op', { hasText: '반납' }).first();
    await expect(returnOp).toContainText('완료');
    await expect(loanReturnWindow.locator('.lr-recent-header')).toContainText('오늘 2건');
  });

  await test.step('등록(register) — ISBN 조회 후 신규 서지·소장본 저장', async () => {
    await page.locator('.dock-icon[title="도서 등록"]').click();
    await expect(registerWindow.locator('.window-titlebar__title')).toHaveText('도서 등록');

    await registerWindow.getByRole('button', { name: '수동 입력', exact: true }).click();
    await registerWindow.locator('#regManualIsbn').fill(REGISTER_ISBN);
    await registerWindow.getByRole('button', { name: '조회', exact: true }).click();

    await expect(registerWindow.locator('#regTitle')).toHaveValue('E2E New Title');

    await registerWindow.getByRole('button', { name: '저장', exact: true }).click();

    // todo/28 파이프라인: 저장은 registerQueue 적재 후 즉시 scan 화면으로 복귀하고(다음 책을
    // 바로 스캔 가능), 결과는 하단 트레이의 최신 완료 카드에 뜬다 — 등록번호 크게(.reg-bignum)와
    // 서명(.reg-resultTitle)은 결과 화면 시절 클래스를 트레이가 그대로 이어받는다.
    await expect(registerWindow.locator('.reg-scan')).toBeVisible();
    await expect(registerWindow.locator('.reg-bignum')).toHaveText(REGISTER_BARCODE);
    await expect(registerWindow.locator('.reg-resultTitle')).toContainText('E2E New Title');
  });

  await test.step('catalog — 서명 열 정렬 클릭 시 행 순서 변경', async () => {
    await page.locator('.dock-icon[title="장서 대장"]').click();
    await expect(catalogWindow.locator('.window-titlebar__title')).toHaveText('장서 대장');

    const firstRowTitleCell = catalogWindow.locator('.data-table-grid tbody tr').first().locator('td').nth(1);
    await expect(catalogWindow.locator('.data-table-grid tbody tr')).toHaveCount(4);
    // 미정렬 초기 순서 = catalogSync 응답 배열 순서(services/catalog.ts, Map 삽입 순서 보존) — mockApi.ts의 CATALOG_ROWS 그대로.
    await expect(firstRowTitleCell).toHaveText('Zebra Tales');

    await catalogWindow.getByRole('button', { name: '서명', exact: true }).click();
    await expect(firstRowTitleCell).toHaveText('Apple Season');
  });

  await test.step('언어 토글 — 이미 열린 창 제목이 즉시 영문으로 전환', async () => {
    await expect(loanReturnWindow.locator('.window-titlebar__title')).toHaveText('대출·반납');
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(loanReturnWindow.locator('.window-titlebar__title')).toHaveText('Checkout / Return');
  });

  const reportsWindow = page.locator('.window').nth(3);

  await test.step('인쇄 CSS 스냅샷 — 미대출 학생 발굴 리포트', async () => {
    // 언어 토글 스텝 다음이 이 스텝이라(스펙이 명시한 순서 그대로) 영문 로케일에서 실행된다 —
    // mockApi.ts의 report 응답도 ASCII로만 채워 둬서, CI 러너에 한글 CJK 폰트가 없어도
    // 두부(tofu) 글리프 없이 안정적으로 렌더된다.
    await page.locator('.dock-icon[title="Reports"]').click();
    await expect(reportsWindow.locator('.window-titlebar__title')).toHaveText('Reports');

    await reportsWindow.getByRole('button', { name: 'Find students with no loans', exact: true }).click();
    await reportsWindow.getByRole('button', { name: 'Preview', exact: true }).click();

    const printRoot = reportsWindow.locator('.print-root');
    await expect(printRoot).toBeVisible();
    await expect(printRoot).toContainText('Students with no loans');
    await expect(printRoot).toContainText('Alex Kim');

    await page.emulateMedia({ media: 'print' });
    // 인쇄 매체 규칙(styles/print.css)이 실제로 적용됐는지 계산된 스타일로 확인한다. 픽셀
    // 스크린샷 비교는 일부러 쓰지 않았다 — OS별 폰트 렌더링 차이로 로컬(macOS)에서 만든
    // 베이스라인이 CI(ubuntu-latest)의 베이스라인과 다르고(Playwright 관례상 플랫폼별 스냅샷
    // 파일이 분리된다), 이 샌드박스엔 Linux 베이스라인을 만들 Docker가 없어 그 스크린샷은
    // 첫 CI 실행에서 거의 확실히 실패했을 것이다("Actions에서 e2e 잡 초록"이라는 이 항목의
    // 완료 조건과 직접 충돌). 아래 두 계산된 스타일 검사만으로도 "인쇄 CSS가 실제로 적용되는지"
    // (인쇄 대상은 보이고, 인쇄 제외 요소는 숨는지)는 플랫폼과 무관하게 안정적으로 확인된다.
    await expect(printRoot).toHaveCSS('visibility', 'visible');
    // "종류로 돌아가기" 툴바(.reports-toolbar.no-print)는 선택된 리포트가 있는 동안 항상 DOM에
    // 남아 있다(TypeSelector 자체는 이 시점엔 이미 언마운트됨) — .no-print가 인쇄 매체에서
    // 실제로 숨는지 확인할 안정적인 대상.
    await expect(reportsWindow.locator('.reports-toolbar')).toHaveCSS('visibility', 'hidden');

    await page.emulateMedia({ media: 'screen' });
  });
});
