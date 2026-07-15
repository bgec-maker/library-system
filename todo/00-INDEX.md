# todo/ — 실행 큐 (2차 배치: 10~27)

## 루프 프로토콜
1. 아래 큐의 **최상단 미완료 항목** 파일을 연다
2. 완료 조건 충족까지 구현 (docs/ = 법전. DESIGN·FRONTEND·VIZ·FEATURES·DECISIONS 준수)
3. 검증: `lint · tsc · build · size · 비밀값 grep(실제 키·토큰 값 — 규칙 문구 자기매치 제외)` 통과
4. 커밋 `todo/NN: 제목` + **push**
5. 파일을 `todo/done/`으로 이동 + INDEX 체크 — 같은 커밋에
6. 반복. 큐가 비면 종료 보고

## 무정지 규칙 (1차와 동일)
질문 금지(가정→ASSUMPTIONS.md) · 실패 2회 후 BLOCKERS.md 기록하고 다음 항목 · 멈춤 사유는 파괴 행위 직전뿐(spike 삭제·force push·비밀값·Code.gs 기존 함수 수정) · 새 doPost 액션은 **「샘플 데이터」 배지 폴백 필수** · Code.gs는 추가만

## 큐
- [x] 10 i18n-debt — 린트 JSX밖 확장 + 창 제목 로케일 구독
- [x] 11 book-detail — 스텁(28줄) → 완성
- [ ] 12 reservations-front — 예약 걸기 + 관리 뷰
- [ ] 13 renew-lost-compensate — 연장·분실·변상 웹앱 처리
- [ ] 14 inventory-mode — 장서점검 + ZXing Worker
- [ ] 15 search-plus — 미러 전문검색 + 초성 + 필터
- [ ] 16 register-plus — 무ISBN 수동 + 복본 일괄
- [ ] 17 enrich-batch — 기존 등록분 서지 일괄 보강
- [ ] 18 viz-v1-b — 하루의 파도 · 열두 달 · 연체 흐름 · 반 참여 링
- [ ] 19 viz-v1-c — 서가 온도 · 장서 나이 · 학년 격차 · 예산
- [ ] 20 book-page-public — /b/ 읽기 전용 (빌리기=로그인 배너)
- [ ] 21 manual-entry — 수기입력 시트+흡수 (P3)
- [ ] 22 sidebar-i18n — 사이드바 한/영 (P7)
- [ ] 23 annual-reset — 리셋 마법사 + 학생 CSV + LOANS 아카이브
- [ ] 24 annual-report — R3 연간 운영 보고서
- [ ] 25 hygiene — operator 서버 주입 + 에러 바운더리 + 오프라인 큐 검증
- [ ] 26 settings-view — 정책·설정 읽기 + 무결성 점검 버튼
- [ ] 27 e2e-ci — Playwright 스모크 CI 상주

## waiting/ (사용자만 승격)
field-verify-stub(🅿) · repo-rename(도메인) · student-surface(🟡로그인 — 20이 비로그인 절반 선취) · viz-v2v3 · locales(🟡)
