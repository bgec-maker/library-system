# 35 · i18n-key-check — t() 키 실존 검증 + vizInsights 키 불일치 수정

## 왜 (todo/34 실측 중 발견)
reports 허브 7번째 카드가 번역 대신 원시 키 문자열("views.reports.vizInsights.cardLabel")을
렌더하고 있었다 — ko/en.json에서 vizInsights 객체가 views.reports 안이 아니라 views 바로
아래에 중첩돼, 코드가 부르는 경로와 어긋남(todo/06부터). 기존 방어선의 사각지대:
check-i18n-literals(한글 리터럴)와 check-i18n-completeness(ko↔en 짝)는 "코드가 부르는 키가
사전에 실존하는가"를 안 본다.

## 무엇
1. ko/en.json에서 views.vizInsights → views.reports.vizInsights로 이동(양쪽 동일)
2. scripts/check-i18n-keys.mjs — src의 t('리터럴') 전수 추출 → ko.json 평탄 키에 없으면 실패
   (동적 키 t(변수)·템플릿은 범위 밖 — 리터럴만. registry 등 동적 경로는 지금도 값 검증이
   런타임 폴백으로 드러난다)
3. verify 체인 편입 + 자기검증(가짜 키 심어 exit 1 확인)
## 완료 조건: 체커가 현재 버그를 잡는 것 확인 → 수정 후 0건, 전 게이트 통과
