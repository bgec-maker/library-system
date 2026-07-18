# 36 · ci-verify-gate — CI 검사 단일화 + VERIFY.md 낡은 경고 개정

## 왜 (전수 검토 발견 #1 — 게이트 구멍)
todo/30(check-perf-budget)·35(check-i18n-keys)를 npm run verify에는 넣었지만, pages.yml은
검사를 **개별 나열**하고 있어 이 둘이 CI에서 실행되지 않는다. 또 VERIFY.md 36~40행이
"ZXing Worker 미구현(규칙 7 부분 미충족)" 경고를 유지 중인데 todo/14가 이미 구현했다
(camera.ts:29·185, public/zxing-worker.js) — 낡은 경고는 다음 세션을 오도한다.

## 무엇
1. pages.yml 검사 스텝을 `npm run verify` 한 줄로 교체 — 앞으로 verify에 검사를 추가하면
   CI가 자동 포함(단일 원천). tsc는 build가 다시 하지만 순수 중복 실행이라 무해.
2. VERIFY.md 「알려진 스코프 축소」 절을 "해소됨(todo/14)"로 개정 + 확인 방법 한 줄.
## 완료 조건: 워크플로 yaml 문법 검증, verify 로컬 통과
