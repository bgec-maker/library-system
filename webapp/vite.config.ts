import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// todo/45 — 실기기 배포 확인용 빌드 표식(설정 화면 하단에 표시). GitHub Actions가 주는
// GITHUB_SHA의 앞 7자, 로컬 빌드는 'dev'. 이 파일은 @types/node도(TS), TS 파서도(ESLint —
// eslint.config.js의 TS 파서 범위는 src/·e2e/뿐) 없이 읽히므로, 둘 다 통과하는 런타임
// 전역 조회로 process에 접근한다(의존성·설정 변경 없이 해결).
const processEnv = Reflect.get(globalThis, 'process')?.env ?? {};
const buildId = String(processEnv.GITHUB_SHA ?? 'dev').slice(0, 7);

// 병행 배포: GitHub Pages 사이트 루트(spike/ 산출물)는 그대로 두고
// 이 앱은 /library-system/app/ 경로에만 얹는다 (FRONTEND.md '기존 배포 철수' 1단계).
export default defineConfig({
  base: '/library-system/app/',
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    // scripts/check-bundle-size.mjs가 엔트리→청크 의존 그래프를 읽어 초기 JS gzip 예산을
    // 계산하는 데 필요하다(.vite/manifest.json). FRONTEND.md 「성능 예산」.
    manifest: true
  }
});
