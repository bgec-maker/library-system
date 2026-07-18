# 56 · press-states — 프레스 피드백 통일 (대기업 감각 1)

인터랙션 표준 「프레스 상태(필수)」 이행. 누르면 반드시, 즉시(60ms), 같은 방식으로.

- 전역 button: 구 translateY(1px) → scale(0.98) + 60ms transition(transform/opacity만).
- 클릭 가능한 카드(.data-table-card.is-clickable): scale(0.99) — 면적이 커서 더 미세하게.
- 데스크톱 표 행: :active = deep-tint 한 단계(스케일은 표에 부적합).
- hover 격리: 표 행 hover를 (hover:hover) and (pointer:fine)으로 — 터치 유령 hover 금지.
- prefers-reduced-motion: 스케일 대신 배경/투명도 반응만.
- 예외 명단(자기 규칙 유지): .m-tab(배경 방식)·.m-stack-back(투명도)·.m-more-item(배경 방식).

## 완료 조건: 프레스 홀드 증빙 컷(58 커밋에서 합성 전달) · 전 게이트
