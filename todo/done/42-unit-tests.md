# 42 · unit-tests — 서비스 단위 테스트 상주화 (의존성 0)

## 왜
todo/29·32·37의 하네스(readCache 6종·writeRetry 5종·CSV 인젝션 방어)를 만들고 버렸다 —
검증은 반복 가능해야 한다(가짜 성공 금지의 연장). e2e는 통합 경로만 커버.

## 무엇
- webapp/tests/unit/{readCache,writeRetry,csv}.test.ts — 버린 하네스의 정식판
- scripts/run-unit-tests.mjs: esbuild JS API(이미 vite 의존으로 존재)로 번들하되 onResolve
  플러그인으로 ./api·./dataChangeBus를 테스트 스텁으로 치환(소스 무수정 주입) → node 실행,
  exit code 판정. 새 devDependency 없음.
- package.json test:unit + verify 체인 편입(= pages.yml CI 자동 포함)
## 완료 조건: 3파일 전부 통과 + 일부러 깨뜨려 exit 1 자기검증, verify·e2e 통과
