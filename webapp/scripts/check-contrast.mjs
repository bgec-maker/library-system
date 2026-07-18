// todo/82 — 토큰 대비 게이트. tokens/work.css·student.css의 hex 토큰을 파싱해 "실제로 그
// 조합으로 쓰는" 전경/배경 쌍의 WCAG 대비율을 계산한다. 본문/작은 글자 쌍은 4.5:1(AA),
// 아이콘·대형 강조 쌍은 3:1. 리스킨류 작업이 토큰을 만질 때 눈대중 대신 이 게이트가 지킨다.
// (쌍 목록은 "존재하는 조합 전수"가 아니라 코드가 실제 사용하는 조합의 명시 목록 — 새 조합을
// 쓰기 시작하면 여기에도 추가하는 것이 규약이다.)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseTokens(file) {
  const css = readFileSync(join(root, file), 'utf-8');
  const map = {};
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) {
    if (!(m[1] in map)) map[m[1]] = m[2]; // 첫 정의 우선(:root)
  }
  return map;
}

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function ratio(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

// [전경, 배경, 최소비, 근거(사용처)] — 스킨별로 "실제 쓰는 조합"만 검사한다.
const WORK_PAIRS = [
  ['--ink', '--paper', 4.5, '본문/캔버스'],
  ['--ink', '--panel', 4.5, '본문/카드'],
  ['--ink-2', '--paper', 4.5, '보조 본문/캔버스'],
  ['--ink-2', '--panel', 4.5, '보조 본문/카드'],
  ['--ink-3', '--paper', 4.5, '라벨(fs-xs)/캔버스 — 작은 글자라 AA 본문 기준'],
  ['--ink-3', '--panel', 4.5, '라벨(fs-xs)/카드'],
  ['--panel', '--deep', 4.5, '셸 헤더·기본 버튼 텍스트'],
  ['--panel', '--fail', 4.5, '오류 토스트·danger 버튼·배지 텍스트'],
  ['--panel', '--pass', 4.5, '성공 토스트 텍스트'],
  ['--panel', '--wait', 4.5, '샘플 배지·경고 토스트 텍스트'],
  ['--deep', '--paper', 4.5, '톤 버튼 텍스트/캔버스'],
  ['--deep', '--panel', 4.5, '고스트 텍스트/카드'],
  ['--pass', '--panel', 4.5, '등록번호 큰 숫자/카드'],
  ['--fail', '--panel', 4.5, '실패 텍스트/카드'],
  ['--ink', '--brass', 4.5, 'warn 버튼 텍스트'],
  ['--brass', '--deep', 3, '도크 활성 아이콘(그래픽 3:1)']
];
// 학생 표면: 도크·샘플 배지·warn 버튼이 없다 — 존재하는 조합만.
const STUDENT_PAIRS = WORK_PAIRS.filter(([f2, b]) =>
  !(f2 === '--panel' && b === '--wait') && !(f2 === '--brass') && !(f2 === '--ink' && b === '--brass')
);

let failed = 0;
for (const [file, pairs] of [
  ['src/tokens/work.css', WORK_PAIRS],
  ['src/tokens/student.css', STUDENT_PAIRS]
]) {
  const tokens = parseTokens(file);
  for (const [fg, bg, min, why] of pairs) {
    const f = tokens[fg];
    const b = tokens[bg];
    if (!f || !b) continue; // 스킨에 없는 토큰 쌍은 대상 아님
    const r = ratio(f, b);
    if (r < min) {
      failed += 1;
      console.error(`[대비 미달] ${file} ${fg}(${f}) on ${bg}(${b}) = ${r.toFixed(2)}:1 < ${min}:1 — ${why}`);
    }
  }
}

if (failed > 0) {
  console.error(`색 대비 검사 실패 — ${failed}건`);
  process.exit(1);
}
console.log('색 대비 검사 통과 — work/student 토큰 사용 조합 전수(AA 4.5:1 · 그래픽 3:1)');
