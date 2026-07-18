# 106 · shelf-tile-contrast — 서가 온도 짙은 타일의 글자 침몰 (시각 감사 7R)

배경(증빙 /tmp/vis/r8-insights-2.png): 서가 타일 텍스트가 항상 --ink/--ink-2(어두운 색)라
뜨거운 서가(--viz-seq-4/5, 짙은 남색)에서 "만화-1 6.5"가 배경에 침몰한다 — 데이터 값이
배경색을 정하는 화면이라 check-contrast(정적 쌍 게이트)가 못 보는 사각.

할 일: tile.level ≥ 3(seq-4/5)이면 --deep 모디파이어로 텍스트를 --panel/--paper로 반전
(트리맵류 관례). 시각 재캡처로 대비 확인.

완료 조건: 재캡처, 전 게이트, e2e.

---

## 이행 노트 (완료)

- ShelfHeatmap: level≥3(seq-4/5) → --deep 반전(코드 --panel · 값 --paper), level=2(seq-3) →
  값 --ink 강화(--ink-2는 2.6:1 저대비). 재캡처: 만화-1 6.5 백색 가독(/tmp/vis/106-crop.png).
- 데이터가 배경을 정하는 화면이라 정적 대비 게이트 사각 — 컴포넌트 레벨 분기로 해소.
- 전 게이트 · 12 e2e 통과.
