import { test, expect, type Page } from '@playwright/test';
import { installApiMock, MOCK_API_URL } from './mockApi';

// todo/79 「회수 쪽지 페이지 나눔 검증」 — 절취 쪽지가 페이지 경계에서 잘리면 "잘라서 담임에게
// 전달"이 불가능해진다(print.css page-break-inside 규칙의 존재 이유). 브라우저는 조각화 결과를
// DOM으로 노출하지 않으므로, 무결성을 다음 불변식 사슬로 보증한다:
//   ① 모든 쪽지에 break-inside/page-break-inside: avoid 계산값이 실제로 걸려 있고
//   ② 어떤 쪽지도 A4 본문 높이보다 크지 않다(avoid는 "한 페이지에 들어가는" 상자만 지켜줄 수
//      있다 — 이보다 큰 쪽지는 규칙과 무관하게 반드시 쪼개진다. 이것이 유일한 실패 조건).
// ①+② ⇒ 어떤 볼륨에서도 쪽지 분할 0. 30·60·120건 시나리오로 확인한다.

test.setTimeout(120_000);

const PAGE_CONTENT_HEIGHT_PX = Math.floor(((297 - 20 - 16) / 25.4) * 96); // A4 - @page 상하 여백(20/16mm) ≈ 986px

function recallReport(count: number) {
  const classes: Array<{ grade: number; classNo: number; items: unknown[] }> = [];
  let made = 0;
  let grade = 1;
  let classNo = 1;
  while (made < count) {
    const size = Math.min(4 + ((made * 7) % 5), count - made); // 반별 4~8건 변주
    classes.push({
      grade,
      classNo,
      items: Array.from({ length: size }, (_, i) => ({
        studentNo: i + 1,
        name: `학생${made + i + 1}`,
        title: `아주 길 수도 있는 책 제목 표본 ${made + i + 1} — 부제까지 붙는 경우`,
        dueAtText: '2026-06-30',
        overdueDays: ((made + i) % 30) + 1
      }))
    });
    made += size;
    classNo += 1;
    if (classNo > 8) {
      classNo = 1;
      grade += 1;
    }
  }
  return { libraryName: 'BGEC Library', generatedAt: '2026-07-15 09:00', asOfDate: '2026-07-15', totalCount: count, classes };
}

async function openRecallPreview(page: Page, count: number): Promise<void> {
  await page.route(`${MOCK_API_URL}**`, async (route) => {
    let action = '';
    let type = '';
    try {
      const body = JSON.parse(route.request().postData() ?? '{}') as { action?: string; type?: string };
      action = String(body.action ?? '');
      type = String(body.type ?? '');
    } catch {
      /* noop */
    }
    if (action === 'report' && type === 'recall-notice') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: recallReport(count), error: null })
      });
    }
    await route.fallback();
  });

  await page.locator('.dock-icon[title="리포트"]').click();
  const win = page.locator('.window').nth(0);
  // dispatchEvent — 반복 진입 시 좌표 클릭이 창 포커스/부유 위젯과 경합해 멈출 수 있다
  // (undo.spec 관례). 아래 print-root 가시성 단정이 결과를 보증한다.
  await win.getByRole('button', { name: '회수 쪽지' }).first().dispatchEvent('click');
  await win.getByRole('button', { name: /미리보기/ }).first().dispatchEvent('click');
  await expect(win.locator('.print-root .print-recall-slip').first()).toBeVisible({ timeout: 8_000 });
}

test('회수 쪽지 30·60·120건 — avoid 계산값 + 쪽지 높이 ≤ A4 본문(분할 불가능 불변식)', async ({ page }) => {
  await installApiMock(page);
  await page.goto('./');
  await page.fill('#sg-url', MOCK_API_URL);
  await page.fill('#sg-token', 'e2e-token');
  await page.fill('#sg-operator', 'E2E 사서');
  await page.getByRole('button', { name: '저장하고 시작' }).click();
  await expect(page.locator('.dock')).toBeVisible();

  for (const count of [30, 60, 120]) {
    // readCache('report', 60s TTL)가 직전 시나리오 데이터를 돌려주지 않게 리로드로 모듈 상태 초기화
    // (세션게이트는 localStorage 유지, page.route는 네비게이션을 넘어 유지된다).
    await page.reload();
    await expect(page.locator('.dock')).toBeVisible();
    await openRecallPreview(page, count);
    const win = page.locator('.window').nth(0);

    // 구조 확인: .print-recall-slip = 반 묶음(한 반이 한 열), .print-recall-item = 학생 칸.
    // 사용자 관점 무결 단위는 "학생 칸"이다 — 반 묶음은 한 페이지를 넘으면 브라우저가 avoid를
    // 포기하고 안에서 쪼갤 수 있(어야 하)고, 그때 학생 칸의 avoid가 최종 방어선.
    const itemCount = await win.locator('.print-root .print-recall-item').count();
    expect(itemCount).toBe(count);

    await page.emulateMedia({ media: 'print' });
    const stats = await win.locator('.print-root').evaluate((root) => {
      const check = (selector: string) => {
        const els = Array.from(root.querySelectorAll(selector));
        let maxH = 0;
        let avoidOk = els.length > 0;
        for (const el of els) {
          const cs = getComputedStyle(el);
          const breakInside = cs.breakInside || cs.getPropertyValue('page-break-inside');
          if (!/avoid/.test(breakInside)) avoidOk = false;
          const h = el.getBoundingClientRect().height;
          if (h > maxH) maxH = h;
        }
        return { maxH, avoidOk, n: els.length };
      };
      return { slips: check('.print-recall-slip'), items: check('.print-recall-item') };
    });
    await page.emulateMedia({ media: 'screen' });

    expect(stats.items.n).toBe(count);
    // 학생 칸: avoid + 페이지보다 작음 ⇒ 어떤 볼륨에서도 칸 분할 0 (최종 방어선).
    expect(stats.items.avoidOk).toBe(true);
    expect(stats.items.maxH).toBeLessThan(PAGE_CONTENT_HEIGHT_PX);
    // 반 묶음: avoid 선언 자체는 유지돼야 한다(작은 반은 통째로 한 페이지에).
    expect(stats.slips.avoidOk).toBe(true);

  }
});
