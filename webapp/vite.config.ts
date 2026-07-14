import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 병행 배포: GitHub Pages 사이트 루트(spike/ 산출물)는 그대로 두고
// 이 앱은 /library-system/app/ 경로에만 얹는다 (FRONTEND.md '기존 배포 철수' 1단계).
export default defineConfig({
  base: '/library-system/app/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    // scripts/check-bundle-size.mjs가 엔트리→청크 의존 그래프를 읽어 초기 JS gzip 예산을
    // 계산하는 데 필요하다(.vite/manifest.json). FRONTEND.md 「성능 예산」.
    manifest: true
  }
});
