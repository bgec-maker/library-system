# todo/ — 실행 큐 (Claude Code 상시 루프)

## 루프 프로토콜
1. 아래 큐의 **최상단 미완료 항목** 파일을 연다
2. 완료 조건을 전부 충족할 때까지 구현 (참조 문서는 docs/ — 법전. 어기지 말 것)
3. 검증: `lint · tsc · build · size · 비밀값 grep(ttbbgec/alansgk)` 전부 통과
4. 커밋 `todo/NN: 제목` + **push** (Actions가 /app/ 자동 배포 — 사용자 관전 포인트)
5. 파일을 `todo/done/`으로 이동 + 이 INDEX 체크 — **같은 커밋에**
6. 1로. 큐가 비면(waiting/만 남으면) 종료 보고

## 무정지 규칙 (전 항목 공통)
- 질문 금지 — 가정은 `docs/ASSUMPTIONS.md`에 기록 후 진행
- 실패 자체수정 2회 → 막히면 `docs/BLOCKERS.md` 기록하고 **다음 항목으로** (전체 정지 금지)
- 멈추는 유일한 사유: spike/ 삭제 · force push · 비밀값 커밋 · Code.gs 기존 함수 수정 — 직전
- 새 doPost 액션은 사용자가 새 버전 배포 전까지 서버에 없다 → **「샘플 데이터」 배지 폴백 필수** (배지 없는 목데이터 = 가짜 성공 = 위반)

## 큐 (위에서부터)
- [x] 01 repo-cleanup
- [x] 02 perf-ci + i18n 기반
- [x] 03 camera-on-demand
- [x] 04 dashboard-baselayer
- [x] 05 reports-r1
- [x] 06 viz-v1
- [x] 07 integration-checkpoint
- [x] 08 catalog + DataTable
- [ ] 09 r1-remaining + en 완역

## waiting/ (게이트 열리면 큐로 승격 — 사용자만 승격 가능)
field-verify-stub(🅿 현장) · repo-rename(도메인 후) · student-surface(🟡 로그인) · admin-automation · viz-v2v3 · locales(🟡 언어 목록)
