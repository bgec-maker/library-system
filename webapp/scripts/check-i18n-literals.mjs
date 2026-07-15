#!/usr/bin/env node
// ADR-023 「웹앱 다국어」 + FRONTEND.md 「다국어」 수용 기준 재현: views/**·shells/**·student/**의
// .tsx 안 JSX 한글(가-힣) 리터럴을 검출하는 CI 전용 이중 방어선. eslint.config.js의
// no-restricted-syntax 규칙(JSXText / JSX 속성 리터럴 / JSX 표현식 안 템플릿 리터럴)과 같은
// 경계를 정규식으로 재검사한다 — eslint 설정 오류로 뚫리는 걸 막는 것이 목적
// (check-view-boundary.mjs와 동일한 "이중검증" 패턴, 같은 파일이 두 방법으로 검사됨).
//
// 코드 주석(// 한 줄, /* */ 여러 줄)은 CLAUDE.md 컨벤션("사용자 대화·문서·주석 = 한국어")대로
// 한글일 수 있다 — 이 스크립트는 문자열 리터럴/주석을 구분하는 아주 작은 상태 기계로 주석을
// 먼저 걷어낸 뒤에만 검사한다. (todo/02 당시) 문자열 리터럴 "내용"(예: shell.toast('메시지'),
// console.error(…))은 의도적으로 범위 밖이었다 — ADR-023 문구 그대로 "JSX 내" 리터럴만 강제
// 대상이었고, 그 밖의 하드코딩(토스트 메시지 등)은 요구사항 4번에 따라 이미 수동으로 t()로
// 이관했었다.
//
// **todo/10에서 이 갭을 메운다**: 아래 CALL_HANGUL_CHECKS가 eslint.config.js의 새 6개
// no-restricted-syntax 선택자(toast/pushToast/throw/alert)와 같은 경계를 정규식으로
// 재검사한다. console.error/warn/log는 개발자 전용 진단 로그라 여전히 범위 밖 — 트리거
// 정규식 자체가 toast/pushToast/throw/alert 이름만 찾기 때문에 console.* 호출은 애초에
// 매칭 대상에 들어오지 않는다(별도 허용목록 불필요, eslint 쪽과 동일한 논리).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const SCAN_DIRS = ['views', 'shells', 'student'].map((d) => join(import.meta.dirname, '..', 'src', d));

const HANGUL = /[가-힣]/;
// identifier="...한글..." — 등호 바로 뒤에 따옴표(공백 없음)만 잡아 JSX 속성 리터럴만 겨냥한다.
// `const message = '...'`처럼 등호 앞뒤에 공백이 있는 일반 대입/객체 리터럴은 걸리지 않는다.
const ATTR_LITERAL = /[a-zA-Z][\w-]*=(["'])(?:(?!\1)[\s\S])*?[가-힣](?:(?!\1)[\s\S])*?\1/g;
// identifier={`...한글...`} — JSX 표현식 컨테이너 안 템플릿 리터럴 속성값(예: Dock.tsx의 최소화 라벨).
const ATTR_TEMPLATE = /[a-zA-Z][\w-]*=\{\s*`[^`]*[가-힣][^`]*`\s*\}/g;

// todo/10 — JSX 밖: toast()/pushToast() 호출, throw 문, alert() 호출의 인자에 나오는 한글
// 문자열/템플릿 리터럴. HANGUL 상수를 그대로 재사용(.source)해 한글 범위를 이 파일 안에서
// 또 새로 정의하지 않는다. eslint.config.js의 새 6개 no-restricted-syntax 선택자와 1:1 대응.
const QUOTED_HANGUL = new RegExp(`(["'\`])(?:(?!\\1)[\\s\\S])*?${HANGUL.source}(?:(?!\\1)[\\s\\S])*?\\1`);
// 트리거 다음 지점부터 statement 끝까지를 scanStatementSpan()으로 잘라 그 구간 안에 위 패턴이
// 있는지만 본다 — 인자가 몇 번째든(첫 인자든 아니든), new Error(...) 처럼 한 겹 더 감싸져
// 있든 모두 잡는다(eslint 쪽 `ThrowStatement Literal[...]`처럼 자손 전체를 보는 것과 동치).
// console.error/warn/log는 이름 자체가 이 트리거들과 다르므로 애초에 매칭되지 않는다.
const CALL_TRIGGERS = [
  { name: 'toast() 인자', re: /(?:\.toast|\bpushToast)\s*\(/g },
  { name: 'alert() 인자', re: /\balert\s*\(/g }
];
const THROW_TRIGGER = /\bthrow\b/g;

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

/**
 * trigger 위치(문자열 인덱스)부터 depth-aware(괄호·대괄호·중괄호)로 문(statement)이 끝나는
 * 지점까지의 구간을 반환한다 — 세미콜론이 depth 0에서 나오거나, 시작 지점보다 얕은 depth로
 * 내려가는 닫는 괄호를 만나면 종료. 문자열/템플릿 리터럴 내부의 괄호·세미콜론은 quote-aware로
 * 건너뛴다(예: pushToast('a;b(c)')처럼 문자열 안 구두점이 있어도 문이 끝난 걸로 오판하지 않음).
 */
function scanStatementSpan(text, startIndex) {
  let depth = 0;
  let quote = null;
  let i = startIndex;
  for (; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') {
      depth++;
      continue;
    }
    if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) break; // 시작 지점을 감싸던 괄호 밖으로 나감 — 문 종료로 간주
      depth--;
      continue;
    }
    if (c === ';' && depth === 0) break;
  }
  return text.slice(startIndex, i + 1);
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

  // 3) todo/10 — toast()/pushToast()·alert() 호출 인자 구간에 한글 리터럴/템플릿이 있는지.
  for (const { name, re } of CALL_TRIGGERS) {
    re.lastIndex = 0;
    let m = re.exec(codeMasked);
    while (m) {
      const parenIndex = m.index + m[0].length - 1; // 정규식이 소비한 마지막 글자가 항상 '('
      const span = scanStatementSpan(codeMasked, parenIndex);
      if (QUOTED_HANGUL.test(span)) {
        const line = lineOf(codeMasked, m.index);
        const key = `call:${line}`;
        if (!flaggedLines.has(key)) {
          flaggedLines.add(key);
          violations.push(`${file}:${line} — ${name}에 한글 리터럴/템플릿: ${lineText(text, line).trim()}`);
        }
      }
      m = re.exec(codeMasked);
    }
  }

  // 4) todo/10 — throw 문(bare `throw '...'` / `throw new Error('...')` 둘 다) 구간의 한글.
  THROW_TRIGGER.lastIndex = 0;
  let tm = THROW_TRIGGER.exec(codeMasked);
  while (tm) {
    const span = scanStatementSpan(codeMasked, tm.index + tm[0].length);
    if (QUOTED_HANGUL.test(span)) {
      const line = lineOf(codeMasked, tm.index);
      const key = `throw:${line}`;
      if (!flaggedLines.has(key)) {
        flaggedLines.add(key);
        violations.push(`${file}:${line} — throw 인자에 한글 리터럴/템플릿: ${lineText(text, line).trim()}`);
      }
    }
    tm = THROW_TRIGGER.exec(codeMasked);
  }
}

if (violations.length) {
  console.error(`i18n 한글 리터럴 위반 ${violations.length}건 (views/**·shells/**·student/**, *.tsx):\n` + violations.join('\n'));
  process.exit(1);
}
console.log(`i18n 한글 리터럴 검사 통과 (${files.length}개 파일 검사, JSX 텍스트·속성 리터럴 · toast·throw·alert 인자 0건)`);
