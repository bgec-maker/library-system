import { test, expect } from '@playwright/test';
import { installApiMock, MOCK_API_URL } from './mockApi';

// todo/65 「예약 흐름 e2e」 — 걸기(검색)→목록(예약 관리)→취소→빈 상태(+54 다음 행동 버튼)까지.
// 학생 확정은 스캔 전용 UI라서 DEV 한정 주입 통로(window.__e2eScan, services/scanBus)를 쓴다 —
// 가짜 카메라는 디코드 가능한 QR을 못 만들기 때문(사유는 scanBus 주석에).

test.setTimeout(60_000);

test('예약 걸기(학생 스캔 확정) → 목록 확인 → 취소 → 빈 상태 경로 버튼', async ({ page }) => {
  await installApiMock(page);

  // 예약 3종 액션만 상태 보유 목으로 덮어쓴다(나머지는 installApiMock으로 fallback).
  let reserved = false;
  const ROW = {
    reservationId: 'rsv-e2e-1',
    titleId: 'title-zebra',
    title: 'Zebra Tales',
    memberId: 'm-1001',
    memberNo: '1001',
    memberName: 'E2E Student',
    statusCode: 'WAITING',
    queueSeq: 1,
    assignedCopyId: '',
    assignedBarcode: '',
    requestedAt: '2026-07-18 10:00',
    readyAt: '',
    pickupExpiresAt: '',
    pickupExpiresAtMs: 0
  };
  await page.route(`${MOCK_API_URL}**`, async (route) => {
    let action = '';
    try {
      action = String(JSON.parse(route.request().postData() ?? '{}').action ?? '');
    } catch {
      action = '';
    }
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (action === 'reserve') {
      reserved = true;
      return json({ ok: true, data: { title: 'Zebra Tales', queueSeq: 1, statusCode: 'WAITING' }, error: null });
    }
    if (action === 'reservations') {
      return json({
        ok: true,
        data: reserved ? { items: [ROW], waitingCount: 1, readyCount: 0 } : { items: [], waitingCount: 0, readyCount: 0 },
        error: null
      });
    }
    if (action === 'cancelReservation') {
      reserved = false;
      return json({ ok: true, data: {}, error: null });
    }
    await route.fallback();
  });

  await page.goto('./');
  await page.fill('#sg-url', MOCK_API_URL);
  await page.fill('#sg-token', 'e2e-token');
  await page.fill('#sg-operator', 'E2E 사서');
  await page.getByRole('button', { name: '저장하고 시작' }).click();
  await expect(page.locator('.dock')).toBeVisible();

  // ① 검색 창 — 카탈로그 행의 「예약」 → 학생 스캔 대기 패널
  await page.locator('.dock-icon[title="통합 검색"]').click();
  const search = page.locator('.window').nth(0);
  await expect(search.locator('.data-table-grid tbody tr').first()).toBeVisible();
  await search.locator('.data-table-grid tbody tr', { hasText: 'Zebra Tales' }).getByRole('button', { name: '예약' }).click();
  await expect(search.locator('.search-reserve-waiting')).toContainText('학생증을 스캔');

  // ② 학생 스캔 주입 → 예약 확정(대기 1번째) 토스트 + 패널 소멸
  await page.evaluate(() => {
    (window as unknown as { __e2eScan: (raw: string) => void }).__e2eScan('S:1001');
  });
  await expect(page.locator('.toast.success', { hasText: '대기 1번째' })).toBeVisible();
  await expect(search.locator('.search-reserve-waiting')).toHaveCount(0);

  // ③ 예약 관리 — 목록에 방금 건이 보이고, 취소하면 빈 상태 + 다음 행동 버튼(todo/54)
  await page.locator('.dock-icon[title="예약 관리"]').click();
  const rsv = page.locator('.window').nth(1);
  await expect(rsv.locator('.data-table-grid tbody tr', { hasText: 'Zebra Tales' })).toBeVisible();
  await rsv.locator('.data-table-grid tbody tr', { hasText: 'Zebra Tales' }).getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.locator('.toast.success', { hasText: '예약을 취소했습니다' })).toBeVisible();
  await expect(rsv.locator('.data-table-empty')).toBeVisible();
  await expect(rsv.locator('.data-table-empty-action')).toHaveText('통합 검색에서 예약 걸기');
});
