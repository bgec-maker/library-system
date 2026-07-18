# 98 · today-label-nowrap — EN 「Today: 0」 값 분리 줄바꿈 (시각 감사 3R)

배경(증빙 /tmp/vis/r3-m2-en-scan.png): 대출·반납 하단 "Today: 0"이 라벨과 값 사이에서 꺾여
값 0이 다음 줄로 떨어진다(캡션이 길어 flex 한 줄이 부족할 때).

할 일: .lr-recent-header 첫 span(카운트 라벨) white-space:nowrap — 캡션만 자연 개행.

완료 조건: EN 재캡처, 전 게이트.

---

## 이행 노트 (완료)

- loan-return.css: .lr-recent-header 첫 span white-space:nowrap — "Today: 0" 통짜 유지,
  개행은 캡션만(재캡처 /tmp/vis/98-crop.png). 전 게이트 · 12 e2e 통과.
