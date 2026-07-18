# 74 · date-format-util — 날짜 표기 유틸 통일

배경: toLocaleTimeString/DateString 호출이 산재 — 같은 정보가 화면마다 다른 정밀도로 나온다.

할 일: formatDate/-Time/-DateTime 유틸(초 제거·연도 생략 규칙) 신설, recentOps·트레이·예약·
리포트 사용처 치환. 인쇄물은 기존 명시 포맷 유지.

완료 조건: 사용처 목록 기록, 전 게이트.
