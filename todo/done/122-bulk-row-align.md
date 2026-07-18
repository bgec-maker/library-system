# 122 · bulk-row-align — 대량 발권 줄 버튼 정렬 (관련 화면 전수 3/3)

배경: 복본 추가 발급 줄에서 발급 버튼이 reg-row2 flex 자식이라 라벨 높이까지 세로로 늘어나
입력과 기준선이 안 맞는다(r14 캡처).

할 일: 버튼을 입력 기준선에 정렬(align-self:flex-end), 높이는 입력과 동일하게. 재캡처.

완료 조건: 재캡처, 전 게이트.

---

## 이행 노트 (완료)

- .reg-bulkPanel .reg-row2 > button: align-self flex-end + flex 0 0 auto + min-width 96 —
  버튼이 라벨 높이까지 늘어나던 것 해소, 입력 기준선과 정렬(재캡처 /tmp/vis/122-crop2.png).
- 전 게이트 · 15 e2e 통과.
