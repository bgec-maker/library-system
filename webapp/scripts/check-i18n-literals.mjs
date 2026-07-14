#!/usr/bin/env node
// ADR-023 「웹앱 다국어」 + FRONTEND.md 「다국어」 수용 기준 재현: views/**·shells/**·student/**의
// .tsx 안 JSX 한글(가-힣) 리터럴을 검출하는 CI 전용 이중 방어선. eslint.config.js의
// no-restricted-syntax 규칙(JSXText / JSX 속성 리터럴 / JSX 표현식 안 템플릿 리터럴)과 같은
// 경계를 정규식으로 재검사한다 — eslint 설정 오류로 뚫리는 걸 막는 것이 목적
// (check-view-boundary.mjs와 동일한 "이중검증" 패턴, 같은 파일이 두 방법으로 검사됨).
//
// 코드 주석(// 한 줄, /* */ 여러 줄)은 CLAUDE.md 컨벤션("사용자 대화·문서·주석 = 한국어")대로
// 한글일 수 있다 — 이 스크립트는 문자열 리터럴/주석을 구분하는 아주 작은 상태 기계로 주석을
// 먼저 걷어낸 뒤에만 검사한다. 문자열 리터럴 "내용"(예: shell.toast('메시지'), console.error(…))
// 은 의도적으로 범위 밖이다 — ADR-023 문구 그대로 "JSX 내" 리터럴만 강제 대상이고, 그 밖의
// 하드코딩(토스트 메시지 등)은 요구사항 4번에 따라 이미 수동으로 t()로 이관했다.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const SCAN_DIRS = ['views', 'shells', 'student'].map((d) => join(import.meta.dirname, '..', 'src', d));

const HANGUL = /[가-힣]/;
// identifier="...한글..." — 등호 바로 뒤에 따옴표(공백 없음)만 잡아 JSX 속성 리터럴만 겨냥한다.
// `const message = '...'`처럼 등호 앞뒤에 공백이 있는 일반 대입/객체 리터럴은 걸리지 않는다.
const ATTR_LITERAL = /[a-zA-Z][\w-]*=(["'])(?:(?!\1)[\s\S])*?[가-힣](?:(?!\1)[\s\S])*?\1/g;
// identifier={`...한글...`} — JSX 표현식 컨테이너 안 템플릿 리터럴 속성값(예: Dock.tsx의 최소화 라벨).
const ATTR_TEMPLATE = /[a-zA-Z][\w-]*=\{\s*`[^`]*[가-힣][^`]*`\s*\}/g;

function walk(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (extname(full) === '.tsx') files.push(full);
  }
  return files;
}

/**
 * 아주 작은 상태 기계 — 문자열('/"/`)·한 줄 주석(//)·블록 주석(/* *‍/) 구간을 구분한다.
 * 반환:
 *   codeMasked — 주석 문자만 공백으로 치환한 텍스트(줄바꿈은 보존, 문자열 내용은 그대로 유지).
 *                JSX 속성 리터럴/템플릿 정규식은 여기에 대해 돌려 주석 안 한글을 오탐하지 않는다.
 *   bare       — 각 글자가 문자열·주석 밖(코드 그 자체, 곧 JSX 텍스트 자식과 동치)인지 여부.
 */
function stripComments(text) {
  let state = 'normal'; // normal | sq | dq | tpl | lc | bc
  let out = '';
  const bare = new Array(text.length).fill(false);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const c2 = i + 1 < text.length ? text[i + 1] : '';
    if (state === 'normal') {
      if (c === '/' && c2 === '/') {
        state = 'lc';
        out += '  ';
        i++;
        continue;
      }
      if (c === '/' && c2 === '*') {
        state = 'bc';
        out += '  ';
        i++;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') {
        state = c === "'" ? 'sq' : c === '"' ? 'dq' : 'tpl';
        out += c;
        continue;
      }
      out += c;
      bare[i] = true;
      continue;
    }
    if (state === 'lc') {
      if (c === '\n') {
        state = 'normal';
        out += c;
      } else {
        out += ' ';
      }
      continue;
    }
    if (state === 'bc') {
      if (c === '*' && c2 === '/') {
        state = 'normal';
        out += '  ';
        i++;
        continue;
      }
      out += c === '\n' ? '\n' : ' ';
      continue;
    }
    // sq | dq | tpl — 문자열/템플릿 리터럴 내부. 이스케이프는 다음 글자까지 통째로 건너뛴다.
    const quote = state === 'sq' ? "'" : state === 'dq' ? '"' : '`';
    if (c === '\\' && i + 1 < text.length) {
      out += c + text[i + 1];
      i++;
      continue;
    }
    if (c === quote) {
      state = 'normal';
      out += c;
      continue;
    }
    out += c;
  }
  return { codeMasked: out, bare };
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}

function lineText(text, lineNo) {
  return text.split('\n')[lineNo - 1] ?? '';
}

const violations = [];
const files = [];
for (const dir of SCAN_DIRS) walk(dir, files);

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const { codeMasked, bare } = stripComments(text);
  const flaggedLines = new Set();

  // 1) JSX 텍스트 자식과 동치 — 주석·문자열 밖(코드 그 자체)에 맨몸으로 나온 한글.
  for (let i = 0; i < text.length; i++) {
    if (bare[i] && HANGUL.test(text[i])) {
      const line = lineOf(text, i);
      const key = `text:${line}`;
      if (!flaggedLines.has(key)) {
        flaggedLines.add(key);
        violations.push(`${file}:${line} — JSX 텍스트 한글 리터럴: ${lineText(text, line).trim()}`);
      }
    }
  }

  // 2) JSX 속성 문자열/템플릿 리터럴 (예: title="저장", title={`${x} (최소화됨)`}).
  for (const re of [ATTR_LITERAL, ATTR_TEMPLATE]) {
    re.lastIndex = 0;
    let m = re.exec(codeMasked);
    while (m) {
      const line = lineOf(codeMasked, m.index);
      const key = `attr:${line}`;
      if (!flaggedLines.has(key)) {
        flaggedLines.add(key);
        violations.push(`${file}:${line} — JSX 속성 한글 리터럴: ${lineText(text, line).trim()}`);
      }
      m = re.exec(codeMasked);
    }
  }
}

if (violations.length) {
  console.error(`i18n 한글 리터럴 위반 ${violations.length}건 (views/**·shells/**·student/**, *.tsx):\n` + violations.join('\n'));
  process.exit(1);
}
console.log(`i18n 한글 리터럴 검사 통과 (${files.length}개 파일 검사, JSX 텍스트·속성 리터럴 0건)`);
