# 103 · print-footer-overlap — 인쇄 fixed 푸터의 본문 겹침 (사용자 이미지 제보)

배경(사용자 전달 캡처 — 연간 운영 보고서 인쇄 화면): 본문 중간을 가로지르는 「BGEC 도서관 …
도서관 시스템」 띠. 두 겹의 사실: ① 캡처상 위치는 print 매체 에뮬레이션 + fullPage 스티칭이
fixed 요소를 뷰포트 이음새마다 반복해 그린 **캡처 아티팩트**지만, ② 실제 Chrome 인쇄에서도
`position:fixed` 푸터는 매 페이지 본문 **위에 덧그려진다** — 본문이 페이지 하단까지 차는 모든
장에서 마지막 1~2줄이 푸터에 깔린다(print.css에 공간 예약이 전혀 없음을 확인). 내용 파괴가
"푸터 매장 반복"의 이득보다 크다.

할 일: @media print의 .print-footer fixed 해제 → 화면 미리보기와 동일하게 문서 말미 1회
(정적, border-top+margin-top). 페이지 번호는 기존 @page @bottom-center(Chrome 점진 향상)
그대로. 아키텍처 주석(5번 항목)에 개정 사유 기록.

완료 조건: 인쇄 스냅샷 e2e(smoke·print-recall) 통과, 재캡처에 겹침 부재, 전 게이트.

---

## 이행 노트 (완료)

- print.css: @media print의 .print-footer fixed 해제 → 문서 말미 1회(정적, 미리보기와 동형).
  쪽수는 기존 @page @bottom-center(여백 상자 — 본문과 구조적으로 못 겹침) 그대로.
- 아키텍처 주석 5번을 개정 사유와 함께 갱신(반복 매장 < 본문 무결).
- 재캡처: 연간 보고서 인쇄에서 중간 띠 소멸, 푸터는 말미 1회(/tmp/vis/r7-print-annual.png).
  smoke 인쇄 스냅샷·print-recall 페이지 나눔 e2e 포함 12본 통과 · 전 게이트.
