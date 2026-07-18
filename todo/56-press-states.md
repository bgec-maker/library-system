# 56 · press-states — 프레스 피드백 통일 ("대기업 감각" 1)

큰 회사 제품의 매끈함 절반은 "누르면 반드시, 즉시, 같은 방식으로 반응"이다.
지금은 :active가 있는 요소(.m-tab)와 없는 요소가 섞여 있다.

- 전역 규칙(styles/base.css): button:active·인터랙티브 카드 :active → transform: scale(0.98)
  (또는 배경 paper 한 단계), transition 60ms. transform/opacity만 — 성능 예산 준수.
- hover 효과는 @media (hover: hover) and (pointer: fine)으로 격리 — 터치에서 유령 hover 금지
  (도크 flyout에서 이미 쓰는 패턴).
- prefers-reduced-motion: scale 대신 배경 변경만.
- 예외 명단 작성: 탭바(.m-tab 기존 배경 방식 유지)·details summary·링크형 텍스트.

## 완료 조건: 대표 화면 3곳 프레스 상태 컷(모바일) · DESIGN.md 「인터랙션 표준」과 문구 일치 · 전 게이트
