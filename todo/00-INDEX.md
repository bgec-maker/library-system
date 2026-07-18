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
- [x] 41 mobile-e2e — 모바일 셸 스모크 CI 상주
- [x] 43 ios-tabbar-viewport — 아이폰 하단 탭 배치 수정 (현장 제보 — 큐 순서 앞지름)
- [x] 44 pwa-launch-viewport — 설치형 PWA 콜드 스타트 탭바 보정 (현장 제보 2)
- [x] 45 standalone-viewport-hard — 설치형 콜드 스타트 최종 보정(screen 하한)+빌드 표식 (현장 제보 3)
- [x] 46 scan-stage-portal — 카메라 무대 탭바 갇힘 수정(body 포털)+가짜 카메라 e2e (현장 제보 4)
- [x] 47 finish-p1 — 디자인 연구 P1 3건(카탈로그 줄바꿈·등록폼 잘림·위젯 가림)
- [x] 48 finish-p2 — 디자인 연구 P2 4건(최근처리 내용화·트레이 접기·트리맵 대비·학생 응급)
- [x] 49 finish-p3 — 디자인 연구 P3 3건(창 높이·헤더 과밀·하단 3층)
- [x] 50 dock-redesign — 좌측 도크 그룹·호버 라벨·활성 표시
- [x] 51 dock-visual — 도크 시각 완성도(글리프 상태·브랜드 마크·로케일 경량화)
- [x] 52 mobile-polish — 모바일 전면 점검 이행(카메라 variant·카드 밀도·내부어 카피)
- [x] 53 tab-badge — 등록 탭 실패 배지 + 실패 사유 사람 말로 (레퍼런스 점검 2-1)
- [x] 54 empty-pathways — 빈 상태 다음 행동 버튼 (레퍼런스 점검 2-2)
- [x] 55 touch-target-pass — 터치 타깃 44px 전수 보정 (레퍼런스 점검 2-3)
- [x] 59 reskin-v2 — 표면 시스템 리스킨+배치 정리 (시안 B+웜 캔버스, 사용자 채택)
- [x] 56 press-states — 프레스 피드백 통일 (대기업 감각 1)
- [x] 57 motion-pass — 등장 모션 방향 사전 이행 (대기업 감각 2)
- [x] 58 skeleton-loading — 첫 로딩 스켈레톤 (대기업 감각 3)
- [x] 60 auto-resume-busy — BUSY류 등록 실패 부팅 자동 재개 (사용자 승인·실사례)
- [x] 61 queue-unit-tests — registerQueue 단위 테스트 상주화
- [x] 62 dock-badge-parity — 데스크톱 도크 등록 아이콘 실패 배지 (53 패리티)
- [x] 63 scan-route-tests — 스캔 라우팅 단위 테스트
- [x] 64 undo-e2e — 언두바 회귀 e2e
- [ ] 65 reservation-e2e — 예약 흐름 e2e
- [ ] 66 backtrap-e2e — 모바일 뒤로가기 트랩·스택 e2e
- [ ] 67 barcode-copy — 완료 카드 등록번호 탭 복사
- [ ] 68 scan-miss-hint — 스캔 미인식 힌트 (still-searching)
- [ ] 69 stack-pop-reverse — 스택 pop 역재생 모션 (57 보류분)
- [ ] 70 search-filter-chips — 검색 필터 활성 칩 표시
- [ ] 71 tray-desktop-density — 등록 트레이 데스크톱 밀도 점검
- [ ] 72 dash-deeplinks — 대시보드 카드 딥링크 전수 점검
- [ ] 73 currency-format — 금액 표기 통일 (Intl KRW)
- [ ] 74 date-format-util — 날짜 표기 유틸 통일
- [ ] 75 codebook-labels — 코드값 라벨 병기 (16_CODEBOOK 미러)
- [ ] 76 csv-column-set — CSV 내보내기 컬럼 선택
- [ ] 77 integrity-copy — 무결성 점검 결과 카피 정리
- [ ] 78 print-v2-audit — 인쇄 v2 정합 감사
- [ ] 79 recall-slip-pages — 회수 쪽지 페이지 나눔 검증
- [ ] 80 dialog-focus-trap — 다이얼로그 포커스 트랩·ESC
- [ ] 81 scan-aria-live — 스캔 결과 스크린리더 낭독
- [ ] 82 contrast-gate — 색 대비 검사 게이트
- [ ] 83 bundle-report — 번들 리포트 세분화
- [ ] 84 icon-import-audit — lucide 임포트 감사 스크립트
- [ ] 85 cover-fallback — 표지 이미지 폴백 전수
- [ ] 86 update-banner — 새 버전 감지 배너
- [ ] 87 skeleton-desktop-rows — 스켈레톤 데스크톱 표형 정합
- [ ] 88 i18n-en-pass — 영어 카피 품질 패스
- [ ] 89 handoff-refresh — HANDOFF·문서 최신화
- [ ] 90 schema-report-prep — 🅿 schemaReport 백엔드 준비 (배포는 사용자)
- [x] 42 unit-tests — 서비스 단위 테스트 상주화 (의존성 0)

## waiting/ (사용자만 승격)
field-verify-stub(🅿) · repo-rename(도메인) · student-surface(🟡로그인 — 20이 비로그인 절반 선취) · viz-v2v3 · locales(🟡)
