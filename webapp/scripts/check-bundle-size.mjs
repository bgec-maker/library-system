#!/usr/bin/env node
// FRONTEND.md 「성능 예산」: "초기 JS: work ≤ 180KB gzip · student ≤ 70KB gzip — CI가 size 체크로
// 강제(초과=빌드 실패)". vite.config.ts의 build.manifest:true가 만든 dist/.vite/manifest.json
// (엔트리→청크 정적 import 그래프)을 읽어, 두 진입 흐름 각각의 "초기 JS"(엔트리 청크 + 그
// 정적 import만, 다른 라우트에서만 닿는 청크는 제외)의 gzip 합계를 계산한다.
//
//   work    = index.html(main.tsx→boot.tsx) 공용 청크 + DesktopShell.tsx 청크 그래프,
//             또는 + MobileShell.tsx 청크 그래프 — boot.tsx가 부팅 시 둘 중 하나만 선택하므로
//             (FRONTEND.md "셸은 부팅 시 하나만 선택") 더 큰 쪽을 예산 비교에 쓴다.
//   student = 같은 공용 청크 + StudentRoot.tsx 청크 그래프(#/b/... 라우트, 셸 코드 미로딩).
//
// npm run build 뒤에 실행한다(빌드 산출물 dist/가 있어야 함). `npm run size`.
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const MANIFEST_PATH = join(DIST, '.vite', 'manifest.json');

const BUDGET_BYTES = {
  work: 180 * 1024,
  student: 70 * 1024
};

if (!existsSync(MANIFEST_PATH)) {
  console.error(
    `매니페스트를 찾을 수 없습니다: ${MANIFEST_PATH}\n` +
      `→ vite.config.ts의 build.manifest:true를 확인하고, 먼저 "npm run build"를 실행하세요.`
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

function findEntryKey() {
  const key = Object.keys(manifest).find((k) => manifest[k].isEntry);
  if (!key) throw new Error('매니페스트에서 isEntry 엔트리를 찾을 수 없습니다 — vite 빌드 산출물을 확인하세요.');
  return key;
}

function findKeyEndingWith(suffix) {
  const key = Object.keys(manifest).find((k) => k.endsWith(suffix));
  if (!key) throw new Error(`매니페스트에서 "${suffix}"로 끝나는 엔트리를 찾을 수 없습니다 — 코드 스플리팅 지점이 바뀌었을 수 있습니다.`);
  return key;
}

// 정적 import 그래프만 따라간다 — 동적 import(React.lazy, 다른 라우트/뷰 전용 청크)는 이
// "초기 JS"에 포함하지 않는다. FRONTEND.md 정의 그대로: "엔트리 청크 + 그 정적 import".
function collectStatic(key, visited = new Set()) {
  if (visited.has(key)) return visited;
  const entry = manifest[key];
  if (!entry) return visited;
  visited.add(key);
  for (const dep of entry.imports ?? []) collectStatic(dep, visited);
  return visited;
}

function gzipSizeOf(key) {
  const entry = manifest[key];
  if (!entry?.file || !entry.file.endsWith('.js')) return 0;
  const buf = readFileSync(join(DIST, entry.file));
  return gzipSync(buf).length;
}

function sumGzip(keys) {
  let total = 0;
  const breakdown = [];
  for (const key of keys) {
    const size = gzipSizeOf(key);
    if (size > 0) breakdown.push({ key, file: manifest[key].file, size });
    total += size;
  }
  breakdown.sort((a, b) => b.size - a.size);
  return { total, breakdown };
}

function fmtKb(bytes) {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function printBreakdown(label, result) {
  console.log(`\n${label} — 초기 JS gzip 합계: ${fmtKb(result.total)}`);
  for (const b of result.breakdown) {
    console.log(`  ${fmtKb(b.size).padStart(9)}  ${b.key}`);
  }
}

let failed = false;
try {
  const entryKey = findEntryKey();
  const desktopKey = findKeyEndingWith('shells/desktop/DesktopShell.tsx');
  const mobileKey = findKeyEndingWith('shells/mobile/MobileShell.tsx');
  const studentKey = findKeyEndingWith('student/StudentRoot.tsx');

  const baseSet = collectStatic(entryKey);
  const desktopSet = new Set([...baseSet, ...collectStatic(desktopKey)]);
  const mobileSet = new Set([...baseSet, ...collectStatic(mobileKey)]);
  const studentSet = new Set([...baseSet, ...collectStatic(studentKey)]);

  const desktopResult = sumGzip(desktopSet);
  const mobileResult = sumGzip(mobileSet);
  const studentResult = sumGzip(studentSet);

  const workBytes = Math.max(desktopResult.total, mobileResult.total);
  const workLabel = desktopResult.total >= mobileResult.total ? 'desktop' : 'mobile';

  console.log('=== 번들 예산 체크 (FRONTEND.md 「성능 예산」) ===');
  printBreakdown('work · desktop 셸', desktopResult);
  printBreakdown('work · mobile 셸', mobileResult);
  printBreakdown('student (#/b/...)', studentResult);

  console.log('\n--- 요약 (todo/07 「번들 예산 실측 기록」이 참조하는 숫자) ---');
  console.log(`work    (${workLabel} 기준, 더 큰 쪽 채택) : ${fmtKb(workBytes)} / 예산 ${fmtKb(BUDGET_BYTES.work)}`);
  console.log(`student                             : ${fmtKb(studentResult.total)} / 예산 ${fmtKb(BUDGET_BYTES.student)}`);

  if (workBytes > BUDGET_BYTES.work) {
    console.error(`\n[FAIL] work 번들이 예산을 초과했습니다: ${fmtKb(workBytes)} > ${fmtKb(BUDGET_BYTES.work)}`);
    failed = true;
  }
  if (studentResult.total > BUDGET_BYTES.student) {
    console.error(`\n[FAIL] student 번들이 예산을 초과했습니다: ${fmtKb(studentResult.total)} > ${fmtKb(BUDGET_BYTES.student)}`);
    failed = true;
  }

  // 수용 기준 재확인: "학생 번들: /b/ 진입 시 사서 셸 코드 미로딩" — student의 정적 import
  // 그래프에 셸 청크가 전혀 섞여 있지 않아야 한다.
  const shellLeakage = [...studentSet].filter((k) => k.includes('/shells/'));
  if (shellLeakage.length > 0) {
    console.error(`\n[FAIL] student 번들에 셸 코드가 섞여 있습니다: ${shellLeakage.join(', ')}`);
    failed = true;
  }
} catch (err) {
  console.error(`[FAIL] 번들 예산 체크 중 오류: ${err instanceof Error ? err.message : String(err)}`);
  failed = true;
}

if (failed) {
  process.exit(1);
}
console.log('\n[OK] 번들 예산 통과');
