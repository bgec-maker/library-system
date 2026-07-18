# 82 · contrast-gate — 색 대비 검사 게이트

배경: 토큰 조합(ink-3 on paper 등)의 WCAG 대비를 눈대중으로 지켜왔다 — 게이트로 굳히면
리스킨류 작업이 안전해진다.

할 일: scripts/check-contrast.mjs — tokens/*.css 파싱, 지정 전경/배경 쌍 목록의 대비율 계산,
4.5:1(본문)/3:1(대형·아이콘) 미달 시 실패. verify에 편입.

완료 조건: verify 체인 포함, 현행 토큰 전부 통과(미달 발견 시 토큰 보정 포함).
