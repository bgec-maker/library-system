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

## 실행 기록 (2026-07-17)
- VERIFY.md 개정: 완료·push됨.
- **pages.yml 교체는 보류**: push가 `refusing to allow a Personal Access Token to ... workflow
  without workflow scope`로 거부됨 — 현 fine-grained 토큰은 Contents 전용(의도된 최소 권한).
  적용 방법 둘 중 하나: ① GitHub 토큰 설정에서 이 토큰에 **Workflows: Read and write** 추가
  후 재요청 ② GitHub 웹 편집기로 pages.yml의 검사 나열 4줄을 `npm run verify` 스텝으로 교체.
  준비된 패치: 세션에 보관(재생성 1분). CI 구멍(perf-budget·i18n-keys 미실행)은 그때까지 유지됨.
