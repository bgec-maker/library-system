# 30 · perf-audit — 성능 예산 감사 자동화 + 위반 수정

## 왜
DESIGN·FRONTEND의 성능 법(backdrop-filter 금지·그림자 1겹·표지 width/height·초 단위 네트워크
폴링 금지)이 지금은 사람 기억에만 있다 — 기존 grep 이중방어 패턴(경계·i18n)과 같은 방식으로 CI화.

## 무엇
- scripts/check-perf-budget.mjs: ① css의 backdrop-filter 0건 ② box-shadow 다중 겹 검출
  ③ <img>에 width/height(또는 aspect-ratio 클래스) 부재 검출 ④ 60초 미만 setInterval 리터럴
  검출(허용 목록 주석 규약) — 위반 시 exit 1
- npm run verify 체인에 편입 + 현재 위반 전부 수정
## 완료 조건: 스크립트가 실제 위반을 하나 이상 잡아내는 걸 확인(일부러 위반 심어 자기검증) 후
현행 코드 0건, verify 통과
