# 06 · 시각화 V1 (4종)
참조: docs/VIZ.md(원칙 3개 필독), docs/DESIGN.md 시각화 램프
- src/viz/ 계층 신설(수제 SVG, 라이브러리 금지) · 대출 잔디 · 장서vs대출 트리맵 · 회전율 사분면 · 예약 압력
- Code.gs: 일배치 트리거→VIZ_CACHE 시트 + `viz` 읽기 액션 + 샘플 폴백
- 각 차트에 sr-only 표 대체 + 행동 버튼
완료 조건: 대시보드·reports에 착륙 · 램프 외 색 0 · 지연 로딩
