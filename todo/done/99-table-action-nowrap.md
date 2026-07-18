# 99 · table-action-nowrap — 표 셀 행동 버튼 세로 낱자 꺾임 (시각 감사 4R)

배경(증빙 /tmp/vis/r4-d2-search-results.png): 최소 폭 창의 검색 결과 표에서 처리 열 「예약」
버튼이 "예/약" 세로 낱자로 꺾인다. 셀 안 버튼은 통짜여야 하고, 폭 부족은 표의 가로 스크롤
(.data-table-scroll)이 담당하는 게 맞다.

할 일: DataTable.css — .data-table-grid td button { white-space: nowrap } (공용 지점 한 곳).

완료 조건: 재캡처, 전 게이트.

---

## 이행 노트 (완료)

- DataTable.css: .data-table-grid tbody td button { white-space: nowrap } — 공용 지점 한 곳.
- 재캡처: 최소 폭 검색 결과에서 「예약」 한 줄 유지(/tmp/vis/99-crop.png). 전 게이트 통과.
