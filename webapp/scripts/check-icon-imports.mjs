// todo/84 — lucide-react 임포트 감사. named import만 허용:
//   import { X, Camera } from 'lucide-react'      ← OK (트리쉐이킹 안전)
//   import * as Icons from 'lucide-react'          ← 금지 (전체 아이콘 셋이 번들에 실림)
//   import Lucide from 'lucide-react'              ← 금지
//   import('lucide-react')                         ← 금지 (동적 = 전체 셋 청크)
// 한 번의 실수로 번들이 수백 KB 부풀 수 있어 눈이 아니라 게이트가 지킨다(size 게이트는
// 총량만 보므로 원인 식별이 늦다 — 여기서 소스 수준으로 조기 차단).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(name)) yield p;
  }
}

const BAD = [
  [/import\s+\*\s+as\s+\w+\s+from\s+['"]lucide-react['"]/, '네임스페이스 임포트'],
  [/import\s+\w+\s*(,|\s+from)\s*['"]lucide-react['"]/, '기본(default) 임포트'],
  [/import\s*\(\s*['"]lucide-react['"]\s*\)/, '동적 임포트']
];

let failures = 0;
let files = 0;
let namedImports = 0;
for (const file of walk(SRC)) {
  files += 1;
  const text = readFileSync(file, 'utf-8');
  if (!text.includes('lucide-react')) continue;
  namedImports += (text.match(/import\s*\{[^}]*\}\s*from\s*['"]lucide-react['"]/g) ?? []).length;
  for (const [re, label] of BAD) {
    if (re.test(text)) {
      failures += 1;
      console.error(`[아이콘 임포트 위반] ${relative(ROOT, file)} — ${label}`);
    }
  }
}

if (failures > 0) {
  console.error(`lucide 임포트 감사 실패 — ${failures}건 (named import만 허용)`);
  process.exit(1);
}
console.log(`lucide 임포트 감사 통과 (${files}개 파일 · named import ${namedImports}건, 위반 0)`);
