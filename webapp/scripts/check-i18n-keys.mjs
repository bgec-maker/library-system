#!/usr/bin/env node
// todo/35 「t() 키 실존 검증」 — check-i18n-literals(한글 리터럴)·check-i18n-completeness(ko↔en
// 짝)가 못 보는 세 번째 축: 코드가 부르는 키가 사전에 실제로 있는가. 없는 키는 t()가 키
// 문자열을 그대로 돌려줘 화면에 원시 키가 노출된다(발견 사례: reports 허브 vizInsights 카드,
// todo/06부터 잠복). 리터럴 호출 t('a.b.c')만 검사한다 — t(변수)·템플릿 리터럴 등 동적 키는
// 정적으로 판정 불가(현재 코드에서 동적 키는 registry 타이틀 계열뿐이고, 그쪽은 화면 폴백으로
// 즉시 드러난다).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const SRC = join(import.meta.dirname, '..', 'src');
const KO = JSON.parse(readFileSync(join(SRC, 'i18n', 'ko.json'), 'utf8'));

function flatten(obj, prefix = '') {
  const out = new Set();
  for (const [key, value] of Object.entries(obj)) {
    const flatKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const k of flatten(value, flatKey)) out.add(k);
    } else out.add(flatKey);
  }
  return out;
}
const keys = flatten(KO);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (['.ts', '.tsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

const violations = [];
for (const p of walk(SRC)) {
  const text = readFileSync(p, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    // t('key') / t('key', {...}) — 작은따옴표 리터럴 1인자만. i18n 유틸 자신은 제외.
    for (const m of line.matchAll(/\bt\(\s*'([^']+)'/g)) {
      const key = m[1];
      if (!keys.has(key)) {
        violations.push(`${relative(join(SRC, '..'), p)}:${i + 1} 사전에 없는 키: ${key}`);
      }
    }
  });
}

if (violations.length > 0) {
  console.error(`i18n 키 실존 검사 실패 — ${violations.length}건:`);
  violations.forEach((v) => console.error('  ' + v));
  process.exit(1);
}
console.log(`i18n 키 실존 검사 통과 — 코드의 t('리터럴') 호출 전수가 ko.json에 존재.`);
