#!/usr/bin/env node
// todo/42 「단위 테스트 상주화」 — tests/unit/*.test.ts를 esbuild(vite의 기존 의존성 — 새
// devDependency 없음)로 번들해 node로 실행하고 exit code로 판정한다. 다른 검사 스크립트와
// 같은 철학: 프레임워크 무도입, 실패는 exit 1.
//
// 핵심 장치 — 스텁 주입 플러그인: src/services/** 안에서의 `./api` 상대 임포트를
// tests/unit/stubs/api.ts로 치환한다. 소스는 무수정(프로덕션 코드에 테스트용 주입점을 만들지
// 않는다), 테스트 파일과 피검 모듈이 같은 스텁 인스턴스를 공유하므로 호출 계측이 성립한다.
// dataChangeBus는 순수 pub/sub라 실물을 그대로 쓴다(치환 불필요).
import { build } from 'esbuild';
import { readdirSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const UNIT_DIR = join(ROOT, 'tests', 'unit');
const STUB_API = join(UNIT_DIR, 'stubs', 'api.ts');
const OUT_DIR = join(ROOT, 'node_modules', '.cache', 'unit-tests');

const stubPlugin = {
  name: 'stub-api-for-services',
  setup(b) {
    b.onResolve({ filter: /^\.\/api$/ }, (args) => {
      if (args.importer.includes(join('src', 'services'))) return { path: STUB_API };
      return undefined;
    });
  }
};

const testFiles = readdirSync(UNIT_DIR).filter((f) => f.endsWith('.test.ts'));
if (testFiles.length === 0) {
  console.error('tests/unit/*.test.ts가 없습니다.');
  process.exit(1);
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

let failed = 0;
for (const file of testFiles) {
  const outfile = join(OUT_DIR, file.replace(/\.test\.ts$/, '.test.mjs'));
  await build({
    entryPoints: [join(UNIT_DIR, file)],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    plugins: [stubPlugin],
    logLevel: 'silent'
  });
  const run = spawnSync(process.execPath, [outfile], { stdio: 'inherit' });
  if (run.status !== 0) {
    failed += 1;
    console.error(`✗ ${file} 실패 (exit ${run.status})`);
  }
}

if (failed > 0) {
  console.error(`단위 테스트 실패 — ${failed}/${testFiles.length} 파일`);
  process.exit(1);
}
console.log(`단위 테스트 통과 — ${testFiles.length}개 파일 (tests/unit/)`);
