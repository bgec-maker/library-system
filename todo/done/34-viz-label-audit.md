# 34 · viz-label-audit — viz 라벨 렌더 크기 실측 감사

## 왜
todo/30이 SVG 텍스트를 정적 검사에서 면제하며 남긴 숙제: viewBox 스케일에서 라벨의 **실제
렌더 px**은 컨테이너 폭에 따라 달라진다. DESIGN.md 12px 최소 가독성이 실화면에서 지켜지는지
Playwright로 실측한다(뷰포트: 모바일 360px · 데스크톱 1280px, 샘플 데이터).

## 방법
페이지 내 평가로 각 SVG의 scale = 렌더 폭 / viewBox 폭을 구해
렌더 px = CSS font-size × scale 을 라벨 클래스별로 계산·기록.

## 처리 기준
- 데스크톱 기준 12px 미달 → 좌표 font-size 상향(레이아웃 확인 스크린샷 포함)
- 모바일만 미달 → 숫자 기록 + 판단 필요 항목으로 남김(차트 밀도와 트레이드오프 —
  viz-v2v3 착수 시 재설계 대상일 수 있음, 임의 재설계는 범위 밖)
## 완료 조건: 실측 표 기록, 수정분은 verify·e2e 통과

## 실측 결과 (2026-07-17, 데스크톱 1280 · 샘플 데이터 · scale=렌더폭/viewBox폭 반영)
| 라벨 | 수정 전 렌더 | 수정 후 렌더 | 조치 |
|---|---|---|---|
| viz-bar-axis-label (하루의 파도) | 9.5px | **12.7px** | css 9→12 (눈금 4개라 충돌 없음) |
| viz-shelf-tile-code / -avg (서가 온도) | 10 / 9px | **12 / 12px** | css→12 (84px 고정 타일, 3자 이내) |
| viz-treemap-label / -dim | 10.6 / 9.6px | **12.8 / 12.8px** | css→12 + 표시 임계 42→52px(넘침 방지) |
| viz-heatmap-month-label (대출 잔디) | 9px(무스케일) | **12px** | css→12 (월 간격 56px, 스크린샷 확인) |
| viz-budget-band-label | 12.1px(css 8) | **15.1px** | css 8→10 (좁은 창 여유) |
| viz-quadrant-axis/quadrant-label | 14.5px(css 9) | 14.5px | **원복 유지** — 위반 아님. 10px 상향 실험이 "90일 미만"·"90일~1년" 라벨 충돌을 유발해 9px 원복(스크린샷 대조) |
| viz-ring-pct | 12px | 12px | 이상 없음 |
- 스크린샷 대조: 잔디·파도·트리맵·사분면 충돌 없음. 모바일 좁은 폭에서 viewBox 스케일이 1
  미만으로 떨어지는 케이스는 남은 관찰 항목(viz-v2v3 재설계 시 재실측).
