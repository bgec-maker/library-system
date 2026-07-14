# 08 · 장서 대장 + 공용 DataTable
참조: ADR-024, docs/FRONTEND.md 「공용 DataTable」·「catalog 뷰」, docs/DESIGN.md 테이블 절
- src/components/DataTable+Paginator(열 정의 API·정렬/필터·25/50/100·CSV·모바일 카드 변환·aria-sort)
- catalog 뷰: 미러(IndexedDB) 정본 — `catalogSync` 청크 동기화, **서버 페이지네이션 금지**
- recent-ops·reports 목록을 DataTable로 이관(중복 제거 증명)
완료 조건: 5,000행 목데이터에서 정렬/페이지 즉답 · 행 클릭→book-detail
