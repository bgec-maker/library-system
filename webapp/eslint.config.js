import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

// FRONTEND.md 제1원칙 — "뷰는 셸을 모른다":
// src/views/** 안에서 window.*(단, window.location 제외)·matchMedia·innerWidth 전역·
// shells/** import를 금지한다. 뷰가 셸에 원하는 건 ShellContext로만 전달돼야 한다.
// 수용 기준 문구 그대로: `matchMedia|innerWidth|window\.(?!location)` grep 0건 + 셸 import 0건.
const viewBoundaryRules = {
  'no-restricted-globals': [
    'error',
    { name: 'matchMedia', message: 'views/**는 셸을 모른다 — ShellContext 또는 셸 훅을 통해서만 반응형 정보를 받으세요.' },
    { name: 'innerWidth', message: 'views/**는 셸을 모른다 — window.innerWidth 대신 ShellContext가 넘겨주는 값을 쓰세요.' },
    { name: 'innerHeight', message: 'views/**는 셸을 모른다 — window.innerHeight 대신 ShellContext가 넘겨주는 값을 쓰세요.' },
    { name: 'outerWidth', message: 'views/**는 셸을 모른다.' },
    { name: 'outerHeight', message: 'views/**는 셸을 모른다.' }
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: "MemberExpression[object.name='window'][property.name!='location']",
      message: 'views/**에서 window.* 직접 접근 금지(window.location 제외). ShellContext를 쓰세요.'
    }
  ],
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['**/shells/**', '@/shells/**'],
          message: 'views/**는 셸 컴포넌트를 import할 수 없습니다 — ShellContext로만 통신하세요.'
        }
      ]
    }
  ]
};

// ADR-023 「웹앱 다국어」 + FRONTEND.md 「다국어」: "views/**·shells/**·student/** JSX 내
// 한글 문자열 리터럴을 린트로 검출 — 모든 UI 문자열은 사전 키". esquery의 정규식 속성 매칭
// ([value=/…/])으로 Hangul(가-힣) 리터럴을 잡는다. 대상은 명시적으로 "JSX 안" —
// JSXText(마크업 텍스트) · JSX 속성값 문자열 리터럴(예: title="저장") · JSX 표현식 컨테이너
// 안의 템플릿 리터럴(예: title={`${x} (최소화됨)`}). 코드 주석은 이 AST 노드들에 애초에
// 안 걸린다(주석은 이 셀렉터들이 보는 트리에 없다) — 이 프로젝트 컨벤션(CLAUDE.md: "주석 =
// 한국어")과 자연히 공존한다. shell.toast()/console.error() 같은 순수 함수 인자 문자열은
// 의도적으로 범위 밖(ADR-023 문구 그대로 "JSX 내"에 한정) — 그 문자열들은 4번 요구사항에
// 따라 수동으로 t()로 이관했다.
const HANGUL = '/[\\uAC00-\\uD7A3]/';
const i18nLiteralRules = {
  'no-restricted-syntax': [
    'error',
    {
      selector: `JSXText[value=${HANGUL}]`,
      message: '뷰/셸/학생 표면 JSX 텍스트에 한글 리터럴 금지 — src/i18n의 t(\'key\')로 옮기세요(ADR-023).'
    },
    {
      selector: `JSXAttribute > Literal[value=${HANGUL}]`,
      message: '뷰/셸/학생 표면 JSX 속성 문자열에 한글 리터럴 금지 — t(\'key\')로 옮기세요(ADR-023).'
    },
    {
      selector: `JSXExpressionContainer TemplateElement[value.raw=${HANGUL}]`,
      message: 'JSX 표현식 안 템플릿 리터럴에 한글 리터럴 금지 — t(\'key\', {…})로 옮기세요(ADR-023).'
    }
  ]
};

export default [
  // public/은 정적 자산(zxing.js 벤더 번들 포함) — 소스 코드가 아니므로 대상에서 제외.
  { ignores: ['dist/**', 'node_modules/**', 'public/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-unused-vars': 'off',
      // TS의 전역 lib(DOM 등) 타입 식별자를 base no-undef가 오탐한다 — tsc가 더 정확히 잡아준다.
      'no-undef': 'off'
    }
  },
  {
    // 뷰 경계 — 이 프로젝트에서 가장 강제력이 큰 규칙.
    files: ['src/views/**/*.{ts,tsx}'],
    rules: viewBoundaryRules
  },
  {
    // 다국어 강제 — views/shells/student의 JSX 안 한글 리터럴 금지(ADR-023).
    // check-i18n-literals.mjs가 CI 전용 이중 방어선으로 동일 경계를 regex로 재검사한다.
    files: ['src/views/**/*.tsx', 'src/shells/**/*.tsx', 'src/student/**/*.tsx'],
    rules: i18nLiteralRules
  },
  {
    // CI 스크립트 — Node 전역(console/process 등) 사용.
    files: ['scripts/**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node }
  },
  {
    // 설정 파일 자체 — Node 전역에서 실행됨.
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node }
  }
];
