import { test, expect } from '@playwright/test';
import { installApiMock, MOCK_API_URL } from './mockApi';

// todo/129 「학생 관리 상주 회귀」 — 난민학교 대응(124~128)의 웹앱 계약을 봉인한다:
//   ① 목록 = 반 라벨 표시 + 기본 필터 재학중(졸업생 비노출) ② 반 필터 칩 ③ 학생 카드 스캔
//   → 1명 핀 ④ 반 이동 = 수정 카드 반 select → memberUpdate 요청 본문(classNo) 단정
//   ⑤ 신규 등록 → 토스트 + 목록 반영 ⑥ 일괄 붙여넣기 = 헤더 무시·오류 줄 표시·성공 집계.
// 목 명단은 가짜 이름만(mockApi.ts 주석 — 아동 PII 비커밋 원칙).

test.setTimeout(60_000);

test('학생 관리 — 목록·필터·스캔 핀·반 이동·등록·일괄', async ({ page }) => {
  await installApiMock(page);
  const memberUpdateBodies: Array<Record<string, unknown>> = [];
  await page.route(`${MOCK_API_URL}**`, async (route) => {
    const body = route.request().postData() ?? '';
    if (body.includes('"memberUpdate"')) {
      try {
        memberUpdateBodies.push(JSON.parse(body) as Record<string, unknown>);
      } catch {
        /* 본문 수집 실패는 아래 단정에서 드러난다 */
      }
    }
    await route.fallback();
  });

  await page.goto('./');
  await page.fill('#sg-url', MOCK_API_URL);
  await page.fill('#sg-token', 'e2e-token');
  await page.fill('#sg-operator', 'E2E 사서');
  await page.getByRole('button', { name: '저장하고 시작' }).click();
  await expect(page.locator('.dock')).toBeVisible();

  await page.locator('.dock-icon[title="학생 관리"]').click();
  const view = page.locator('.mem-view');
  await expect(view).toBeVisible();

  // ① 기본 = 재학중만(Mock Dana는 GRADUATED — 비노출), 반 라벨 렌더
  const grid = view.locator('.data-table-grid tbody tr');
  await expect(grid).toHaveCount(3);
  await expect(view).toContainText('Mock Ari');
  await expect(view).toContainText('Love');
  await expect(view).not.toContainText('Mock Dana');

  // 상태 전체로 바꾸면 졸업생 노출
  await view.locator('.mem-status-select').selectOption('ALL');
  await expect(grid).toHaveCount(4);
  await expect(view).toContainText('Mock Dana');
  await view.locator('.mem-status-select').selectOption('ACTIVE');

  // ② 반 필터 칩 — Hope만
  await view.locator('.mem-chip', { hasText: 'Hope' }).click();
  await expect(grid).toHaveCount(2);
  await expect(view).not.toContainText('Mock Ari');

  // ③ 학생 카드 스캔(S: 접두) — 1명 핀 + 해제
  await page.evaluate(() => (window as unknown as { __e2eScan: (v: string) => void }).__e2eScan('S:0000001'));
  await expect(view.locator('.mem-scanpin')).toBeVisible();
  await expect(grid).toHaveCount(1);
  await expect(view).toContainText('Mock Ari');
  await view.locator('.mem-scanpin .ghost').click();
  await expect(view.locator('.mem-scanpin')).toHaveCount(0);

  // ④ 반 이동 — Mock Bora(HOPE) → FAITH. 요청 본문의 classNo까지 단정한다(계약의 핵심).
  await grid.filter({ hasText: 'Mock Bora' }).click();
  const form = view.locator('.mem-form');
  await expect(form).toBeVisible();
  await expect(form).toContainText('Mock Bora');
  await form.locator('#mem-class').selectOption('FAITH');
  await form.locator('.mem-formActions button').first().click();
  await expect(page.locator('.toast', { hasText: '저장 완료' })).toBeVisible();
  await expect(form).toHaveCount(0); // 수정 성공 = 카드 닫힘
  expect(memberUpdateBodies.length).toBe(1);
  expect(memberUpdateBodies[0].memberKey).toBe('0000002');
  expect(memberUpdateBodies[0].classNo).toBe('FAITH');
  await expect(grid.filter({ hasText: 'Mock Bora' })).toContainText('Faith');

  // ⑤ 신규 등록 — 연속 입력(카드 유지·이름 비움) + 목록 반영
  await view.getByRole('button', { name: '학생 등록' }).first().click();
  await expect(form).toBeVisible();
  await form.locator('#mem-name').fill('Mock Erin');
  await form.locator('#mem-class').selectOption('LOVE');
  await form.locator('#mem-birth-year').selectOption('2020');
  await form.locator('.mem-formActions button').first().click();
  await expect(page.locator('.toast', { hasText: 'Mock Erin' })).toBeVisible();
  await expect(form).toBeVisible(); // 등록은 카드 유지(연속 입력)
  await expect(form.locator('#mem-name')).toHaveValue('');
  await expect(grid.filter({ hasText: 'Mock Erin' })).toHaveCount(1);
  await form.locator('.mem-formActions .ghost').click();

  // ⑥ 일괄 — 헤더 줄 무시, 유효 2 + 반 오류 1, 성공 2 집계·완료 잔존
  await view.locator('.mem-bulk summary').click();
  await view.locator('.mem-bulk textarea').fill('이름,반,출생연도\nMock Fay, Love, 2023\nMock Gil, Hope, 2019\nMock Bad, Star, 2020');
  await expect(view.locator('.mem-bulk-table tbody tr')).toHaveCount(3);
  await expect(view.locator('.mem-bulk-state--error')).toHaveCount(1);
  await view.locator('.mem-bulk-actions button').click();
  await expect(page.locator('.toast', { hasText: '성공 2' })).toBeVisible();
  await expect(view.locator('.mem-bulk-state--ok')).toHaveCount(2); // 목록 갱신 후에도 완료 장부 잔존(중복 등록 방지)
  await expect(view.locator('.mem-bulk-actions button')).toBeDisabled();
  await expect(grid.filter({ hasText: 'Mock Fay' })).toHaveCount(1);
});
