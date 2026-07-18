# 73 · currency-format — 금액 표기 통일 (Intl KRW)

배경: 연체료·변상금이 화면마다 날수/원 표기가 제각각일 수 있다 — 리포트·미변상·정책·학생방.

할 일: formatKRW 유틸(Intl.NumberFormat ko-KR) 신설, 전 사용처 치환(en 로케일은 KRW 표기 유지).
0원·미정 표기 규칙 통일.

완료 조건: 사용처 목록 기록, 전 게이트.
