import { test, expect, type Page } from '@playwright/test';
import { installApiMock, MOCK_API_URL } from './mockApi';

// todo/135 「박스 이탈 상주 회귀」 — 실기기 제보(최근 처리 카드가 화면 좌우로 이탈·앱 전체
// 옆스크롤)를 낳은 계열의 재발 방지. 계약:
//   ① 셸 스크롤러(.m-shell-main/.m-stack-body)와 문서에 가로 스크롤 여지가 없다
//   ② 검출기는 심은 위반을 반드시 잡는다(자가 검증 — todo/134 교훈: 고정 대기가 lazy 셸을
//     앞질러 주입이 무음 불발되면 "0건"이 고무도장이 된다. 먼저 잡힘을 증명하고 0건을 믿는다)
//   ③ 제보 동일 길이 토큰(20자 mono)·EN 로케일에서도 대표 화면이 깨끗하다.
// 전 표면 매트릭스는 134의 1회 스윕이 담당했고, 상주는 대표 화면 + 공용 부품 계약만 절제 유지.

test.setTimeout(90_000);

async function horizontalLeaks(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bad: string[] = [];
    const doc = document.scrollingElement;
    if (doc && doc.scrollWidth > vw + 1) bad.push(`document ${doc.scrollWidth}>${vw}`);
    for (const sel of ['.m-shell-main', '.m-stack-body']) {
      const sc = document.querySelector(sel);
      if (sc && sc.scrollWidth > sc.clientWidth + 1) bad.push(`${sel} ${sc.scrollWidth}>${sc.clientWidth}`);
    }
    return bad;
  });
}

test('가로 이탈 — 검출기 자가 검증 + 최근 처리 스트레스 + 학생 관리 + EN 설정', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApiMock(page);
  // 제보와 같은 길이의 토큰 — 최근 처리 목 응답(스트레스 상주분)
  await page.route(`${MOCK_API_URL}**`, async (route) => {
    const body = route.request().postData() ?? '';
    if (body.includes('"recentOps"')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            rows: [
              {
                occurredAt: '2026-07-18 22:12',
                operationType: 'APPEND',
                summary: 'Phone register append with long summary text',
                targetType: 'MOBILE_REGISTER',
                entityId: 'TTL-8291129A3C9B4099',
                actorId: 'STF-BEF6692DEE684AD9'
              }
            ]
          },
          error: null
        })
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
  await expect(page.locator('.m-shell-main')).toBeVisible(); // lazy 셸 정착 — 고정 대기 금지(134)

  // ② 자가 검증 — 700px 요소를 심으면 반드시 검출돼야 한다
  await page.evaluate(() => {
    const el = document.createElement('div');
    el.id = 'overflow-selftest';
    el.style.width = '700px';
    el.style.height = '10px';
    document.querySelector('.m-shell-main')!.appendChild(el);
  });
  const selfTest = await horizontalLeaks(page);
  expect(selfTest.length).toBeGreaterThan(0);
  await page.evaluate(() => document.getElementById('overflow-selftest')?.remove());
  expect(await horizontalLeaks(page)).toEqual([]);

  // ① 최근 처리 — 제보 토큰으로 카드 렌더 후 이탈 0
  await page.getByRole('button', { name: '더보기' }).click();
  await page.getByRole('button', { name: '최근 처리' }).click();
  await expect(page.locator('.data-table-card').first()).toBeVisible();
  await expect(page.locator('.data-table-card').first()).toContainText('TTL-8291129A3C9B4099');
  expect(await horizontalLeaks(page)).toEqual([]);
  await page.locator('.m-stack-back').first().click();

  // 학생 관리 — 카드 그리드 다른 소비처 교차 검증
  await page.getByRole('button', { name: '더보기' }).click();
  await page.getByRole('button', { name: '학생 관리' }).click();
  await expect(page.locator('.data-table-card').first()).toBeVisible();
  expect(await horizontalLeaks(page)).toEqual([]);
  await page.locator('.m-stack-back').first().click();

  // ③ EN 로케일 — 긴 영문 라벨의 설정 화면
  await page.getByRole('button', { name: '더보기' }).click();
  await page.getByRole('button', { name: 'EN' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.m-stack-body')).toBeVisible();
  await page.waitForTimeout(400);
  expect(await horizontalLeaks(page)).toEqual([]);
});
