# 90 · schema-report-prep — 🅿 schemaReport 백엔드 준비 (배포는 사용자)

배경: 실물 시트와 코드 가정의 최종 대조 도구(운영 진단). 프론트는 UNKNOWN_ACTION 폴백이
안전하므로 먼저 출시 가능 — 배포되면 자동 활성.

할 일: Code.gs에 apiWebSchemaReport_(읽기 전용: 시트명·헤더·행수) 추가분 작성(기존 함수 무수정),
PATCH_NOTES 갱신. 설정 화면에 접힘 섹션 — 액션 실패(UNKNOWN_ACTION)면 섹션 미노출.

완료 조건: 프론트는 게이트·e2e 통과로 먼저 배포, GAS 재배포는 사용자에게 안내문으로.

---

## 이행 노트 (완료 — 프론트 선출시, GAS 재배포는 사용자 🅿)

- Code.gs 추가분(기존 함수 무수정): doPost 디스패치 1줄 + apiWebSchemaReport_() —
  HEADERS 22종 + 22_MANUAL_ENTRY 대조(존재/헤더 누락·여분/데이터 행수 + 버전 표식).
  ensureSchema_ 미호출(생성 부수효과 없는 순수 진단), 셀 본문 안 읽음(헤더 1행+행수만).
- 프론트: fetchSchemaReport()(UNKNOWN_ACTION → unavailable — 진단 도구라 샘플 폴백 없음),
  설정 화면 「스키마 대조」 접힘 섹션(summary=제목+판정 배지, 표=시트/행수/판정) —
  재배포 전에는 섹션 자체 미노출, 배포 시 자동 활성.
- PATCH_NOTES.md에 배포 절차 안내(새 버전 배포, 새 스코프 없음 — 재동의 화면 없음).
- Code.gs 구문 검사(new Function) 통과 · 전 게이트 · 빌드 · 12 e2e 통과.
