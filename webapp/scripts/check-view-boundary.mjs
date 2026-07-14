#!/usr/bin/env node
// FRONTEND.md 수용 기준 문구 그대로 재현하는 독립 grep 검사.
// eslint 규칙과 동일한 경계를 잡지만, eslint 설정 오류로 뚫리는 걸 막는 이중 방어선(CI 전용).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const VIEWS_DIR = join(import.meta.dirname, '..', 'src', 'views');

const FORBIDDEN = [
  { name: 'matchMedia', pattern: /\bmatchMedia\s*\(/ },
  { name: 'innerWidth', pattern: /\binnerWidth\b/ },
  { name: 'window.* (window.location 제외)', pattern: /\bwindow\.(?!location\b)\w+/ },
  { name: '셸 import', pattern: /from\s+['"][^'"]*\/shells\// }
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (['.ts', '.tsx'].includes(extname(full))) files.push(full);
  }
  return files;
}

let violations = [];
let files = [];
try {
  files = walk(VIEWS_DIR);
} catch {
  console.error('views 디렉터리를 찾을 수 없습니다:', VIEWS_DIR);
  process.exit(1);
}

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const rule of FORBIDDEN) {
      if (rule.pattern.test(line)) {
        violations.push(`${file}:${i + 1} — ${rule.name}: ${line.trim()}`);
      }
    }
  });
}

if (violations.length) {
  console.error(`뷰 경계 위반 ${violations.length}건:\n` + violations.join('\n'));
  process.exit(1);
}
console.log(`views/** 경계 검사 통과 (${files.length}개 파일 검사, matchMedia|innerWidth|window.(?!location)|셸 import 0건)`);
