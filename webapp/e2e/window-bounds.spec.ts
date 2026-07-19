import { test, expect } from '@playwright/test';
import { installApiMock, MOCK_API_URL } from './mockApi';

// todo/130 「창 좌표 격리 상주 회귀」 — 계약(useWindowStore.clampRectToWorkspace):
//   ① 드래그로 창을 화면 밖에 완전히 버릴 수 없다(4방향 — 종전엔 우·하 무제한이라 던진 좌표가
//     localStorage에 저장돼 재열기해도 화면 밖 = 영구 유실이었다)
//   ② 저장된(오염 포함) rect는 열기 시점에 뷰포트 안으로 교정된다
//   ③ 서(w) 핸들 리사이즈가 최소 폭에 닿아도 우변은 고정이다(창 미끄러짐 앵커 버그)
//   ④ 브라우저 창 축소 시 열린 창 전부 재클램프된다.
const MIN_VISIBLE = 120; // 스토어 상수와 계약 일치(수치 동기 — 바뀌면 여기도 의도적으로)
const TITLEBAR_H = 36;

test.setTimeout(60_000);

test('창 경계 — 드래그 탈출 불가·오염 복원 교정·서 리사이즈 앵커·뷰포트 축소', async ({ page }) => {
  await installApiMock(page);
  await page.goto('./');
  await page.fill('#sg-url', MOCK_API_URL);
  await page.fill('#sg-token', 'e2e-token');
  await page.fill('#sg-operator', 'E2E 사서');
  await page.getByRole('button', { name: '저장하고 시작' }).click();
  await expect(page.locator('.dock')).toBeVisible();
  const viewport = page.viewportSize()!;

  // ① 우하단으로 과도 드래그 — 잡을 곳(타이틀바 120px·상단 줄)이 화면 안에 남는다
  await page.locator('.dock-icon[title="대출·반납"]').click();
  const win = page.locator('.window').first();
  const bar = win.locator('.window-titlebar');
  let bb = (await bar.boundingBox())!;
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.width + 800, viewport.height + 800, { steps: 8 });
  await page.mouse.up();
  let wb = (await win.boundingBox())!;
  expect(wb.x).toBeLessThanOrEqual(viewport.width - MIN_VISIBLE + 2);
  expect(wb.y).toBeLessThanOrEqual(viewport.height - TITLEBAR_H + 2);

  // 재열기해도(저장 좌표 경유) 여전히 화면 안 — 유실 불가 확인
  await win.getByRole('button', { name: '닫기' }).click();
  await page.locator('.dock-icon[title="대출·반납"]').click();
  wb = (await page.locator('.window').first().boundingBox())!;
  expect(wb.x).toBeLessThanOrEqual(viewport.width - MIN_VISIBLE + 2);
  expect(wb.y).toBeLessThanOrEqual(viewport.height - TITLEBAR_H + 2);
  await page.locator('.window').first().getByRole('button', { name: '닫기' }).click();

  // ② 오염된 저장 rect(x:5000,y:5000) — 열기 시점 교정
  await page.evaluate(() => localStorage.setItem('win:search', JSON.stringify({ x: 5000, y: 5000, w: 480, h: 560 })));
  await page.locator('.dock-icon[title="통합 검색"]').click();
  const search = page.locator('.window').first();
  await expect(search.locator('.window-titlebar__title')).toHaveText('통합 검색');
  wb = (await search.boundingBox())!;
  expect(wb.x).toBeLessThanOrEqual(viewport.width - MIN_VISIBLE + 2);
  expect(wb.y).toBeLessThanOrEqual(viewport.height - TITLEBAR_H + 2);

  // ③ 서(w) 핸들로 최소 폭 이하까지 축소 시도 — 우변 고정(±2px), 창이 밀리지 않는다
  //    (검색 min [480,560] — 현재 폭이 이미 최소라 어떤 우측 드래그도 전부 클램프 구간)
  const before = (await search.boundingBox())!;
  const rightEdgeBefore = before.x + before.width;
  const wHandle = search.locator('.window-resize--w');
  const hb = (await wHandle.boundingBox())!;
  await page.mouse.move(hb.x + 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + 260, hb.y + hb.height / 2, { steps: 6 });
  await page.mouse.up();
  const after = (await search.boundingBox())!;
  expect(Math.abs(after.x + after.width - rightEdgeBefore)).toBeLessThanOrEqual(2);
  expect(after.width).toBeGreaterThanOrEqual(478); // min 유지

  // ④ 브라우저 창 축소 — 디바운스(150ms) 후 전 창 재클램프
  await page.setViewportSize({ width: 900, height: 600 });
  await page.waitForTimeout(400);
  const smallWb = (await search.boundingBox())!;
  expect(smallWb.x).toBeLessThanOrEqual(900 - MIN_VISIBLE + 2);
  expect(smallWb.y).toBeLessThanOrEqual(600 - TITLEBAR_H + 2);
  expect(smallWb.width).toBeLessThanOrEqual(900 - 76 + 2); // 워크스페이스 폭 캡
  expect(smallWb.height).toBeLessThanOrEqual(600 + 2);
});
