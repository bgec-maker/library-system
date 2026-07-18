# 90 · schema-report-prep — 🅿 schemaReport 백엔드 준비 (배포는 사용자)

배경: 실물 시트와 코드 가정의 최종 대조 도구(운영 진단). 프론트는 UNKNOWN_ACTION 폴백이
안전하므로 먼저 출시 가능 — 배포되면 자동 활성.

할 일: Code.gs에 apiWebSchemaReport_(읽기 전용: 시트명·헤더·행수) 추가분 작성(기존 함수 무수정),
PATCH_NOTES 갱신. 설정 화면에 접힘 섹션 — 액션 실패(UNKNOWN_ACTION)면 섹션 미노출.

완료 조건: 프론트는 게이트·e2e 통과로 먼저 배포, GAS 재배포는 사용자에게 안내문으로.
