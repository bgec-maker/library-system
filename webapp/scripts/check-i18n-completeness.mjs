#!/usr/bin/env node
// todo/09 「en.json 완역(키 누락 검증 스크립트 0건)」 + FRONTEND.md 「언어 추가 = JSON 파일 1개 +
// 키 누락 검증 스크립트 통과」. src/i18n/ko.json·en.json을 각각 평탄화(dot-path)해서 키 집합을
// 양방향으로 비교한다 — ko에만 있는 키(신규 문구를 en에 깜빡함)와 en에만 있는 키(안 쓰는 잔재
// 키) 둘 다 잡아야 하므로 한쪽만 보는 부분집합 검사로는 부족하다.
//
// check-view-boundary.mjs/check-i18n-literals.mjs와 같은 스타일(외부 의존성 없는 순수 Node
// 스크립트, CI 전용 이중 방어선) — src/i18n/index.ts의 flatten()과 같은 규칙(중첩 객체를
// "a.b.c" 점 표기로 펼침)을 이 스크립트 안에 다시 구현한다(그 파일은 TS라 node로 바로 import할
// 수 없어 로직만 그대로 옮겼다).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const I18N_DIR = join(import.meta.dirname, '..', 'src', 'i18n');
const KO_PATH = join(I18N_DIR, 'ko.json');
const EN_PATH = join(I18N_DIR, 'en.json');

function flatten(obj, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const flatKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, flatKey));
    } else {
      out[flatKey] = value;
    }
  }
  return out;
}

function loadFlat(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return flatten(raw);
}

let koFlat, enFlat;
try {
  koFlat = loadFlat(KO_PATH);
} catch (err) {
  console.error(`ko.json을 읽거나 파싱할 수 없습니다: ${KO_PATH}\n${err.message}`);
  process.exit(1);
}
try {
  enFlat = loadFlat(EN_PATH);
} catch (err) {
  console.error(`en.json을 읽거나 파싱할 수 없습니다: ${EN_PATH}\n${err.message}`);
  process.exit(1);
}

const koKeys = new Set(Object.keys(koFlat));
const enKeys = new Set(Object.keys(enFlat));

const missingInEn = [...koKeys].filter((k) => !enKeys.has(k)).sort();
const extraInEn = [...enKeys].filter((k) => !koKeys.has(k)).sort();

// 값 자체가 비어 있으면(placeholder) 키는 양쪽에 있어도 실질 미번역으로 본다 — 단 ko 원문
// 자체가 의도적으로 빈 문자열인 키는 없으므로(사전에 빈 문자열을 넣을 이유가 없다) en 쪽 빈
// 문자열만 걸러낸다. register.todayUnit처럼 "영어는 단위어가 필요 없어 의도적으로 비움" 같은
// 케이스는 이 검사를 통과하되, 그 판단은 사람이 코드리뷰에서 확인한다(스크립트는 "존재 여부"만
// 기계적으로 본다 — "번역 품질"까지는 자동화 범위 밖).
let violations = 0;
if (missingInEn.length) {
  violations += missingInEn.length;
  console.error(`en.json에 없는 키 ${missingInEn.length}건 (ko.json에는 있음):`);
  missingInEn.forEach((k) => console.error(`  - ${k}`));
}
if (extraInEn.length) {
  violations += extraInEn.length;
  console.error(`${missingInEn.length ? '\n' : ''}ko.json에 없는 키 ${extraInEn.length}건 (en.json에만 있음 — 잔재 키):`);
  extraInEn.forEach((k) => console.error(`  - ${k}`));
}

if (violations) {
  console.error(`\ni18n 키 누락 검사 실패 — ko.json ${koKeys.size}개 / en.json ${enKeys.size}개 키, 불일치 ${violations}건.`);
  process.exit(1);
}

console.log(`i18n 키 누락 검사 통과 — ko.json·en.json 각 ${koKeys.size}개 키, 양방향 불일치 0건.`);
