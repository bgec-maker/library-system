import { defineConfig, devices } from '@playwright/test';

// todo/27 「E2E 스모크 CI 상주」 — 이 프로젝트 최초의 자동화 테스트 프레임워크(webapp/package.json에
// vitest/jest 등 어떤 테스트 러너도 없었다). 완료 조건: Actions에서 e2e 잡 초록 + 로컬 `npm run e2e` 문서화.
//
// webServer는 `vite dev`를 그대로 쓴다(`vite preview`로 dist/를 서빙하는 대신) — 이유:
//   1) 이 E2E 스위트는 SessionGate·목 백엔드·셸 UI 상태 전이를 검증한다. 이 동작은 dev 서버든
//      프로덕션 번들이든 동일하다 — 번들 자체의 크기·트리쉐이킹 결과를 검증하는 게 아니다.
//   2) 번들 예산·프로덕션 빌드 산출물 검증은 이미 별도 게이트(npm run build && npm run size,
//      .github/workflows/pages.yml)가 담당한다 — 이 워크플로(e2e.yml)에서 또 빌드를 돌리면
//      매 실행마다 tsc -b + vite build 시간이 추가로 들 뿐 이 스위트가 검증하려는 것과 무관하다.
//   3) `vite dev`가 `vite build && vite preview`보다 기동이 훨씬 빠르다 — CI 잡을 가볍게 유지.
// vite.config.ts의 base:'/library-system/app/'는 dev 서버에도 그대로 적용되므로(확인됨: 로컬
// 실행 결과 http://localhost:5173/library-system/app/ 에서 200) baseURL도 그 경로를 포함한다.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:5173/library-system/app/',
    trace: 'retain-on-failure',
    // i18n/index.ts의 감지 순서(localStorage → navigator.language → 'ko') — Playwright
    // 기본 브라우저 로케일은 'en-US'라 이걸 안 고정하면 매 실행이 영어로 시작해 한글 텍스트
    // 셀렉터가 전부 어긋난다. 이 앱의 실제 1순위 사용자(한국 학교 사서)와도 일치하는 값.
    locale: 'ko-KR'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173/library-system/app/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
