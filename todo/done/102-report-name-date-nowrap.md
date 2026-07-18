# 102 · report-name-date-nowrap — 리포트 표 이름·날짜 꺾임 (시각 감사 6R)

배경(증빙 /tmp/vis/r6-recall.png·r6-unpaid.png): 좁은 리포트 창에서 이름이 "박지/호"로,
반납 예정일이 "2026-06-/20"으로 꺾인다. 한글 이름(2~5자)과 날짜는 통짜가 맞다.

할 일: recall/homeroom(연체 목록)/unpaid의 name·dueAtText·colMember에 nowrap 지정
(todo/95와 같은 계약 — 폭 부족은 표 가로 스크롤 담당).

완료 조건: 재캡처, 전 게이트, e2e.

---

## 이행 노트 (완료)

- recall·homeroom(연체 목록) name/dueAtText, unpaid colMember에 nowrap — 이름·날짜 통짜
  (재캡처 /tmp/vis/102-crop.png: 박지호·2026-06-20 한 줄, 책 제목만 자연 개행).
- 전 게이트 · 12 e2e(하드 게이트 패턴) 통과.
