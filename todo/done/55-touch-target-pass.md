# 55 · touch-target-pass — 터치 타깃 44px 전수 보정 (레퍼런스 점검 2-3)

근거: HIG 44pt. WCAG 최소(24px)는 넘던 것들이라 위반은 아니었지만, 재시도·언어 전환처럼
실사용 빈도 있는 컨트롤이 30px대였다.

- @media (pointer: coarse) 한정 보정 — 데스크톱 창 밀도는 그대로(fine 포인터 별도 원칙).
- 보정 목록: reg-trayHead/diagHead/diagBtn/failRow 버튼, reg-trayBulk/trayMeta/reg-manual summary,
  lr-manual summary, DataTable 카드 안 버튼(검색 예약 등), m-more-locale-btn(36→44).

## 완료 조건: 등록 탭 재시도 버튼 44px 컷 · 전 게이트 통과
