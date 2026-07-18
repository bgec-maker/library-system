# 93 · card-meta-nowrap — 모바일 카드 메타 값 중간 줄바꿈 (시각 감사 1R)

배경(증빙 /tmp/vis/m4-reservations.png): DataTable 모바일 카드의 메타 그리드에서 날짜 값이
"2026-07-" / "16 15:00"으로 **값 중간에서 꺾인다**. 표 모드의 nowrap 열 옵션(todo/47)이
카드 모드에는 적용되지 않아서다. 4쌍 이상일 때 라벨·값 정렬도 흐트러진다.

할 일: 카드 메타 렌더에 col.nowrap 반영(white-space:nowrap) + 메타 그리드 정렬 정돈
(라벨 고정폭 정렬·행 간격). mono 열 옵션도 카드 값에 동일 반영 확인.

완료 조건: 예약 관리 카드 재캡처(꺾임 없음), 전 게이트, e2e.

---

## 이행 노트 (완료)

- DataTable 카드 dd에 col.nowrap 반영(.is-nowrap → white-space:nowrap) + dd 전반 word-break:
  keep-all("1번/째" 어절 중간 꺾임 방지). nowrap 지정: reservations.requestedAt ·
  reports.unpaidFines.assessedAt · book-detail checkedOutAt/dueAt/requestedAt (전부 타임스탬프).
- 2쌍/줄 그리드는 nowrap 값이 반폭을 넘으면 옆 쌍을 짓누른다(재캡처 실측: "대기/1번/째" 3줄) —
  호출측 명시 강등 prop `cardMetaColumns: 1|2`(기본 2, todo/52 압축 유지) 신설, 예약 관리만 1로.
  :has(9쌍) 자동 강등 규칙은 그대로.
- 카드에선 행동 버튼도 값 정렬(우측)에 맞춤(.data-table-card .rsv-row-actions).
- 재캡처: 날짜 한 줄 유지·라벨/값 정렬 정돈(/tmp/vis/93-crop2.png). 전 게이트 · 12 e2e 통과.
