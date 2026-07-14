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
