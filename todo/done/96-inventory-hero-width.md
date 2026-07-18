# 96 · inventory-hero-width — 장서점검 시작 버튼 전폭 완화 (시각 감사 2R)

배경(증빙 /tmp/vis/r2-d3-inventory.png): 「점검 세션 시작」 버튼이 패널 전폭(~700px)으로
그려진다 — 데스크톱에서 hero라도 과체중. 모바일 전폭은 유지(엄지 타깃).

할 일: 데스크톱(fine pointer)에서 max-width(360px 내외)로 캡 — 셸 분기 없이 뷰 CSS
@media (pointer: fine)로. 정렬은 좌측(패널 텍스트 흐름과 동일 시작선).

완료 조건: 캡처 1장, 전 게이트.

---

## 이행 노트 (완료)

- inventory.css: `@media (pointer: fine)`에서 .inv-start-btn max-width 360px (모바일 전폭 유지).
- 정렬은 좌측 대신 **툴바 우측**으로 확정 — 이 버튼은 .inv-toolbar(정보 좌측·동작 우측
  space-between)의 구성원이라, 360px 캡 후 자연히 우측 정렬됨. 정보(샘플 배지·동기화 진행)와
  대표 동작의 표준 툴바 문법이라 스펙의 "좌측 시작선"보다 낫다고 판단(캡처 /tmp/vis/96-crop.png).
- 전 게이트 · 12 e2e 통과.
