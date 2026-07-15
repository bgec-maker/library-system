# 13 · 연장·분실·변상
- loan-return 반납 대기 화면 + book-detail 소장본 행에 「연장」「분실 처리」
- 변상 완료: book-detail·reports(미변상 목록)에서
- doPost: renew/markLost/markCompensated — 사이드바 api* 내부 패턴 문자 그대로(executeWrite_ 직접), operator note 관통
완료: 연장 시 반납예정 +7일 · 분실→학생 정지 연동 · 전부 실행취소 불가 명시(확인 다이얼로그 — 즉시실행 예외)
