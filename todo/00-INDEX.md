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
- [x] **H1 camera-ui-mobile — 🔥 긴급: 모바일 스캔 무대 (등록 스프린트 품질)**
- [x] **H2 scanner-window-desktop — 🔥 긴급: 데스크톱 스캐너 창 (ADR-026 포함)**
- [x] 10 i18n-debt — 린트 JSX밖 확장 + 창 제목 로케일 구독
- [x] 11 book-detail — 스텁(28줄) → 완성
- [x] 12 reservations-front — 예약 걸기 + 관리 뷰
- [x] 13 renew-lost-compensate — 연장·분실·변상 웹앱 처리
- [x] 14 inventory-mode — 장서점검 + ZXing Worker
- [x] 15 search-plus — 미러 전문검색 + 초성 + 필터
- [x] 16 register-plus — 무ISBN 수동 + 복본 일괄
- [x] 17 enrich-batch — 기존 등록분 서지 일괄 보강
- [x] 18 viz-v1-b — 하루의 파도 · 열두 달 · 연체 흐름 · 반 참여 링
- [x] 19 viz-v1-c — 서가 온도 · 장서 나이 · 학년 격차 · 예산
- [x] 20 book-page-public — /b/ 읽기 전용 (빌리기=로그인 배너)
- [x] 21 manual-entry — 수기입력 시트+흡수 (P3)
- [x] 22 sidebar-i18n — 사이드바 한/영 (P7)
- [x] 23 annual-reset — 리셋 마법사 + 학생 CSV + LOANS 아카이브
- [x] 24 annual-report — R3 연간 운영 보고서
- [x] 25 hygiene — operator 서버 주입 + 에러 바운더리 + 오프라인 큐 검증
- [x] 26 settings-view — 정책·설정 읽기 + 무결성 점검 버튼
- [x] 27 e2e-ci — Playwright 스모크 CI 상주
- [x] 28 register-pipeline — 등록 순차 제출 큐 (저장 중에도 다음 스캔)
- [x] 29 read-cache — 읽기 API 캐시·중복제거 (야간 최적화 배치)
- [x] 30 perf-audit — 성능 예산 감사 자동화 + 위반 수정
- [x] 31 derived-bench — 파생 뷰 O(n²) 감사·실측
- [x] 32 security-pass — 보안 점검 (GAS·Pages 맞춤)
- [x] 33 e2e-pipeline — 등록 파이프라인 회귀 스펙 CI 상주
- [x] 34 viz-label-audit — viz 라벨 렌더 크기 실측 감사
- [x] 35 i18n-key-check — t() 키 실존 검증 (34 실측 중 발견한 vizInsights 키 불일치)
- [x] 36 ci-verify-gate — CI 검사 단일화(신규 게이트 2종 누락 해소) + VERIFY.md 개정
- [x] 37 write-retry — 쓰기 BUSY_RETRY 자동 흡수(공유 헬퍼, UX 불변)
- [x] 38 sync-resilience — catalog 동기화 고착·setConfig 가드·inventory 재스캔 복구
- [x] 39 offline-queue-cleanup — 죽은 offlineQueue 정리 + FRONTEND.md 정합
- [x] 40 hygiene-2 — 오류 표시·useMemo·role/aria 소형 4건
- [ ] 41 mobile-e2e — 모바일 셸 스모크 CI 상주
- [x] 43 ios-tabbar-viewport — 아이폰 하단 탭 배치 수정 (현장 제보 — 큐 순서 앞지름)
- [ ] 42 unit-tests — 서비스 단위 테스트 상주화 (의존성 0)

## waiting/ (사용자만 승격)
field-verify-stub(🅿) · repo-rename(도메인) · student-surface(🟡로그인 — 20이 비로그인 절반 선취) · viz-v2v3 · locales(🟡)
