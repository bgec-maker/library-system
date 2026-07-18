#!/usr/bin/env node
// todo/30 「성능 예산 감사 자동화」 — DESIGN.md·FRONTEND.md의 성능 법 중 grep으로 판정 가능한
// 항목을 CI 이중방어로 만든다(check-view-boundary/check-i18n-*와 같은 패턴: 외부 의존성 없는
// 순수 Node, 사람 기억 대신 스크립트).
//
// 검사 4종:
//  1) backdrop-filter 금지 (FRONTEND.md 성능 예산 — 저사양 기준기에서 합성 비용 큼)
//  2) box-shadow 다중 겹 금지 (DESIGN.md 「그림자 1겹」) — 최상위 쉼표로 레이어를 나눈 값 검출
//  3) <img>는 width·height·loading 3속성 필수 (DESIGN.md 「표지 lazy + width/height 명시,
//     레이아웃 시프트 0」) — JSX 스프레드 등 예외가 필요하면 img 태그 위 2줄 내
//     `perf-budget: img-ok(사유)` 주석으로 명시적 허용
//  4) setInterval은 선언 위 2줄 내 `perf-budget:` 마커 필수 — "초 단위 폴링 금지"를 정적으로
//     완전 판정할 수 없으므로(콜백 안 네트워크 호출 추적 불가) 대신 "모든 setInterval은 의도를
//     주석으로 선언해야 한다"로 강제한다. 마커 없는 setInterval 추가 = 빌드 실패 = 리뷰 유도.
//  5) CSS font-size에 12px 미만 px 리터럴 금지 (DESIGN.md 타입 6단 「12px 미만 금지」)
//     단 두 맥락은 면제한다(todo/30, docs/ASSUMPTIONS.md):
//     - @media print 블록 안: 인쇄 타이포는 DESIGN.md 「인쇄」 절의 별도 위계(A4·잉크 절약·
//       리포트당 1장)라 화면 가독성 최소치의 적용 대상이 아니다.
//     - SVG 텍스트(같은 규칙 블록에 fill: 선언): viewBox 스케일 SVG의 font-size는 좌표계
//       단위지 화면 px가 아니다 — 렌더 크기는 컨테이너 폭에 비례하므로 정적 px 검사로는
//       판정 불가(렌더 크기 검토는 시각 감사 항목으로 todo/30 「발견」에 기록).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const SRC = join(import.meta.dirname, '..', 'src');
const violations = [];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const files = walk(SRC);
const rel = (p) => relative(join(SRC, '..'), p);

// ── 1·2·5) CSS 규칙 ─────────────────────────────────────────────
for (const p of files.filter((f) => extname(f) === '.css')) {
  const text = readFileSync(p, 'utf8');
  const lines = text.split('\n');

  // @media print 블록 범위 계산(중괄호 깊이 추적) — 5)번 면제 판정용.
  const inPrint = new Array(lines.length).fill(false);
  let printDepth = -1; // -1 = 미진입, 그 외 = @media print가 열린 시점의 깊이
  let depth = 0;
  lines.forEach((line, i) => {
    if (printDepth === -1 && /@media\s+print/.test(line)) printDepth = depth;
    depth += (line.match(/\{/g) ?? []).length;
    if (printDepth !== -1) inPrint[i] = true;
    depth -= (line.match(/\}/g) ?? []).length;
    if (printDepth !== -1 && depth <= printDepth) printDepth = -1;
  });

  // 현재 줄이 속한 규칙 블록(가장 가까운 '{'부터 짝 '}'까지)에 fill: 이 있으면 SVG 텍스트.
  function blockHasFill(idx) {
    let start = idx;
    while (start > 0 && !lines[start].includes('{')) start -= 1;
    let end = idx;
    while (end < lines.length - 1 && !lines[end].includes('}')) end += 1;
    return lines.slice(start, end + 1).some((l) => /(^|[\s{;])fill\s*:/.test(l));
  }

  lines.forEach((line, i) => {
    if (/backdrop-filter\s*:/.test(line)) {
      violations.push(`${rel(p)}:${i + 1} backdrop-filter 금지 (FRONTEND.md 성능 예산)`);
    }
    // box-shadow 값에서 괄호 안(rgba(...)·var(...))의 쉼표를 지운 뒤에도 쉼표가 남으면 다중 겹.
    const m = line.match(/box-shadow\s*:\s*([^;]+)/);
    if (m && m[1].replace(/\([^)]*\)/g, '').includes(',')) {
      violations.push(`${rel(p)}:${i + 1} box-shadow 다중 겹 금지 (DESIGN.md 「그림자 1겹」)`);
    }
    const fs = line.match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/);
    if (fs && Number(fs[1]) < 12 && !inPrint[i] && !blockHasFill(i)) {
      violations.push(`${rel(p)}:${i + 1} font-size ${fs[1]}px — 12px 미만 금지 (DESIGN.md 타입 6단)`);
    }
  });
}

// ── 3·4) TSX/TS 규칙 ────────────────────────────────────────────
const CODE_EXT = new Set(['.ts', '.tsx']);
for (const p of files.filter((f) => CODE_EXT.has(extname(f)))) {
  const text = readFileSync(p, 'utf8');
  const lines = text.split('\n');

  // <img … > — 태그가 여러 줄일 수 있으므로 '<img'부터 '>'까지 이어붙여 판정한다.
  for (let i = 0; i < lines.length; i++) {
    const col = lines[i].indexOf('<img');
    if (col === -1) continue;
    let tag = lines[i].slice(col);
    let j = i;
    while (!tag.includes('>') && j < lines.length - 1) tag += ' ' + lines[++j].trim();
    const allowed = lines.slice(Math.max(0, i - 2), i).some((l) => l.includes('perf-budget: img-ok'));
    if (allowed) continue;
    const missing = ['width', 'height', 'loading'].filter((attr) => !new RegExp(`[\\s{]${attr}\\s*=`).test(tag));
    if (missing.length > 0) {
      violations.push(`${rel(p)}:${i + 1} <img>에 ${missing.join('·')} 누락 (DESIGN.md 「표지 lazy + width/height, 레이아웃 시프트 0」)`);
    }
  }

  lines.forEach((line, i) => {
    if (!/\bsetInterval\s*\(/.test(line)) return;
    const marked = lines.slice(Math.max(0, i - 2), i + 1).some((l) => l.includes('perf-budget:'));
    if (!marked) {
      violations.push(
        `${rel(p)}:${i + 1} setInterval에 perf-budget 마커 없음 — 위 2줄 내 "// perf-budget: <의도>" 주석으로 네트워크 호출 없음/주기(≥60s)를 선언하세요 (FRONTEND.md 「서버 폴링 금지」)`
      );
    }
  });
}

if (violations.length > 0) {
  console.error(`성능 예산 감사 실패 — ${violations.length}건:`);
  violations.forEach((v) => console.error('  ' + v));
  process.exit(1);
}
console.log(`성능 예산 감사 통과 (${files.length}개 파일: backdrop-filter·그림자 겹·img 속성·setInterval 마커·최소 폰트)`);
