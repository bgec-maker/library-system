# 04 · 대시보드 기저층
참조: ADR-021, docs/FRONTEND.md 대시보드 절, docs/FEATURES.md(조용한 신호)
- 데스크톱 워크스페이스 바탕 = 대시보드(창 아님) · 카드 6종 · 조용한 신호(리포트 직행 버튼) · 연체 상위 · 최근 처리
- Code.gs에 `dashboard` 읽기 액션(getDashboardData_ 재사용 — 기존 함수 무수정) · 갱신: 진입+트랜잭션후+수동+5분
- **샘플 폴백**: UNKNOWN_ACTION → 「샘플 데이터」 배지 + src/mocks/
완료 조건: 창 전부 닫으면 대시보드 · 모바일 더보기 상단 요약 · 배지 동작
