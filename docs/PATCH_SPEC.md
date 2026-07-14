# PATCH_SPEC.md — MVP 패키지 학교화 패치 명세

> 대상: `mvp-package/` (Code.gs 2,179줄 · Sidebar.html · 19시트 워크북)
> 근거: `DECISIONS.md` ADR-016 (패키지 채택), ADR-017 (다국어)
> 원칙: **검증된 로직(보호·멱등·보상·예약)은 건드리지 않는다. 도메인·성능·비상경로만 고친다.**

## 실행 순서

| 순서 | 패치 | 크기 | 왜 이 순서인가 |
|---|---|---|---|
| 1 | **P1 학교화** | 대 | 스키마 확정 — 실데이터 입력 전 필수 |
| 2 | **P5 barcode 체계** | 소 | 라벨 인쇄 전 필수. 되돌릴 수 없음 |
| 3 | **P4 ISBN 자동조회** | 중 | 0단계(5,000권 등록)의 심장 |
| 4 | **P2 성능** | 중 | 실사용 전 — 대출 1건 8~10회 전체읽기 제거 |
| 5 | **P3 수기입력** | 중 | GAS 사망 대비 비상 경로 |
| 6 | **P6 불사 미리보기** | 소 | GAS 죽어도 눈은 뜨게 |
| 7 | **P7 한/영** | 중 | 기능 완성 후 표면 작업 |

⚠️ 실데이터가 아직 없으므로 스키마 변경은 **마이그레이션 없이 `setupLibraryMvp` 재실행(재생성)** 으로 처리한다. 실데이터 투입 후에는 이 방식 금지.

---

## P1 · 학교화 — 공공도서관 모델 → 학교 모델

### P1-a. MEMBERS 스키마

`LIBRARY_MVP.HEADERS['09_MEMBERS']` 및 `ensureSchema_` 수정:

- **추가**: `student_id`(학번) · `grade`(학년) · `class_no`(반) · `class_seq`(번호) · `suspended_until`(정지해제일) · `suspend_reason`(정지사유) · `nickname`(닉네임 — 웹앱 랭킹용)
- **제거**: `address` (학생 대상 과수집)
- **선택화**: `phone` `email` `birth_date` — 학생은 빈칸 허용. `registerMember_`의 필수 검증에서 제외하되, **값이 있으면** 기존 중복 검증 유지
- `member_no` 발급은 유지하되 `student_id`(학번)로도 검색 가능하게 `findMemberByKey_` 확장

### P1-b. CODEBOOK 코드 추가

```
MEMBER_TYPE   STUDENT 학생 / TEACHER 교사        (GENERAL·CHILD는 유지 — 삭제 금지)
MEMBER_STATUS GRADUATED 졸업 / TRANSFERRED 전출 / ON_LEAVE 휴학
MATERIAL_TYPE REFERENCE 참고도서 / AV 시청각 / SET 전집 / TEACHER_ONLY 교사용
```

### P1-c. 연체료 → 대출 정지

학교는 돈을 받지 않는다. `FINES`는 **REPLACEMENT(분실 대체비) 전용**으로 남긴다.

- `CONFIG` 추가: `SUSPEND_DAYS_PER_OVERDUE_DAY = 1` (연체정지배수)
- `return_()`: `overdueDays > 0`이면 `member.suspended_until = max(기존값, today + overdueDays × 배수)` 갱신 + `suspend_reason` 기록. OVERDUE 부과금 생성 로직은 `overdue_fee_per_day > 0`일 때만(기본 정책 0 유지)
- `checkout_()`: 기존 `BLOCK_CHECKOUT_WHEN_OVERDUE`(연체 중 차단)에 **더해** `suspended_until > today`면 `MEMBER_SUSPENDED` 오류 — 메시지에 해제일·사유 포함
- 사이드바 관리 탭에 **정지 수동 해제** 버튼 (`apiClearSuspension`) — 감사 로그 필수

### P1-d. 정책 매트릭스 시드

`13_POLICIES`에 행 추가 (기존 POL-DEFAULT 유지):

| member_type | material_type | loan_days | max_open_loans | 비고 |
|---|---|---|---|---|
| STUDENT | BOOK | 14 | 3 | |
| STUDENT | REFERENCE | — | **0** | 관내열람 = 한도 0으로 표현 |
| STUDENT | AV | 7 | 1 | |
| STUDENT | TEACHER_ONLY | — | 0 | |
| TEACHER | * | 21 | 5 | |

`checkout_()`의 `LOAN_LIMIT` 오류 메시지: 한도 0이면 "이 자료는 관내열람 전용입니다"로 분기.

### P1-e. 연간 리셋 마법사

메뉴 → 관리 → **연간 리셋**. 순서 강제(이전 단계 미완료 시 다음 단계 차단), 각 단계 `executeWrite_` 경유:

1. `checkUnreturnedAll_()` — 미반납 전체 목록 (학년-반 정렬 출력)
2. `graduateStudents_(grade)` — 대상 학년 일괄 GRADUATED. **미반납·미변상 학생은 건너뛰고 명단 반환** (기존 `assertMemberCanDeactivate_` 재사용)
3. `promoteAllStudents_()` — 재학생 전원 grade+1 (200건 배치, 커서)
4. `bulkRegisterStudents_(csv)` — 신입생 명렬표 (학번·이름·학년·반·번호). 200건 배치
5. `archiveLoans_(year)` — P2-b 호출

수용 기준: 미반납 학생 졸업 시도 → 차단 + 명단. 600명 진급이 6분 제한 내 (배치 확인).

---

## P2 · 성능

### P2-a. 요청 스코프 테이블 캐시

문제: `checkout_` 1건 = 전체 시트 read 8~10회 (`readTable_`이 매번 풀스캔, `appendRecord_`·`transactionUpdateRecord_` 내부에서도 재호출).

- `runApi_` 진입 시 캐시 객체 생성 → `readTable_`을 memoize (시트명 키)
- **쓰기(`appendRecord_`/`updateRecord_`) 발생 시 해당 시트 캐시 무효화** — 같은 요청 안에서 쓰고 다시 읽는 경로(`planNextReservation_` 등)가 있으므로 무효화 없으면 오답
- 트리거(`dailyLibraryMaintenance`)와 `refreshDashboard_`도 동일 캐시 경유

수용 기준: 대출 1건당 전체읽기 ≤ 3회 (Logger 카운트). 5,000 copies + 10,000 loans 모의 데이터에서 checkout < 2초.

### P2-b. LOANS 연도 아카이브

- `archiveLoans_(year)`: `status_code ∈ {RETURNED, LOST, VOID}` 이고 `checked_out_at < 해당연도 시작`인 행 → `10_LOANS_YYYY` 시트로 이동(append 후 원본 삭제 — **이 삭제는 행번호 무관 스키마라 안전**, ADR-002 폐기 참조). OPEN 대출은 절대 이동 금지
- 감사 로그에 건수 기록. 통계는 아카이브 시트 포함해 배치 계산

수용 기준: 아카이브 후 무결성 점검(`apiRunIntegrityCheck`) 통과 (FK 검사가 아카이브 시트도 보도록 확장).

---

## P3 · 수기입력 — GAS 사망 대비 비상 경로

새 시트 `20_MANUAL_ENTRY`. **유일하게 보호를 걸지 않는 쓰기 시트** (`protectDatabaseSheets_` 제외 목록에 추가).

```
일시 | 구분(대출/반납) | barcode | 학생(학번 또는 이름) | 처리자 | 메모 | 처리상태 | 처리결과
```

- 사서는 GAS가 죽었을 때 여기 **추가만** 한다 (사용법 시트에 절차 명시)
- `absorbManualEntries_()` (메뉴 → 관리): 미처리 행을 위→아래 순서로 `checkout_`/`return_` 재생. `requestId = 'MANUAL-' + 행번호` → **기존 멱등 체계가 중복 흡수를 자동 방지**
- 학생 해석: 학번 정확일치 → 이름 유일일치 → 실패 시 `처리상태=오류` + 사유 (동명이인 등). 오류 행은 건너뛰고 계속
- 운영센터에 미처리 건수 표시 (P6 수식으로)

수용 기준: 같은 흡수를 두 번 실행해도 대출 중복 0건. 동명이인 행은 오류 표시 후 나머지 정상 처리.

---

## P4 · ISBN 자동조회 (0단계의 심장)

- `appsscript.json`에 `https://www.googleapis.com/auth/script.external_request` 추가
- `CONFIG` 추가: `NLK_API_KEY`(국립중앙도서관) · `ALADIN_TTB_KEY`
- `apiLookupIsbn(payload)`: 국중(서지·KDC) → 실패 시 알라딘(**표지 URL·페이지수** — 게이미피케이션 가중치용) → 둘 다 실패 시 `NOT_FOUND` (수동 입력 경로 유지)
- 결과는 `CacheService`(6h) + `21_BOOK_CACHE` 시트에 저장 — 복본 재조회 무료
- Sidebar 도서등록 탭: ISBN 입력 → 조회 버튼 → 폼 자동완성 → 사서 확인 후 저장. **자동 저장 금지**
- `registerTitle_`에 `pages` 필드 추가 (TITLES 스키마에 `page_count` 컬럼 추가)

> 참고: 웹앱의 **대량 등록은 기존 결정대로 브라우저에서 직접 API 호출** (GAS UrlFetch 절약). 이 패치는 사이드바 단건 등록용 — 사용량이 적어 GAS 직접 호출로 충분하다.

수용 기준: 유효 ISBN < 3초 자동완성. 무효 ISBN → 수동 입력으로 자연 전환. 같은 ISBN 재조회 시 UrlFetch 0회.

---

## P5 · barcode 체계 통일 (라벨 인쇄 전 필수)

현행 `COPY_BARCODE_PREFIX='C'` 자동발급을 **ADR-004 체계로 교체**:

- barcode = **6자리 순차 숫자 + Luhn 체크 1자리** (예: `0001234`). `nextHumanCode_` 수정
- `findCopyByKey_`: 체크문자 유무·앞자리 0 유무 모두 허용 (`0001234` = `000123` + 체크 = `123` 입력 동일 해석), 체크문자 불일치 시 `CHECKSUM_MISMATCH` 오류 (오타 방지 — 이게 체크문자의 존재 이유)
- 학생 `member_no`도 동일 체계 권장 (접두사 구분: 책 순수숫자 / 학생 `S` 접두 — 스캔 값 라우팅용)
- **QR 라벨 인쇄는 웹앱 소관** (URL형 `https://<도메인>/b/0001234`). 이 패치는 값 체계만 확정
- ⚠️ **도메인 미구매 상태 — 라벨 인쇄는 도메인 확정 후** (하드 제약 ⑧)

수용 기준: 세 가지 입력 형태가 같은 소장본 반환. 체크문자 틀리면 명확한 오류.

---

## P6 · 운영센터 불사(不死) 미리보기

운영센터는 현재 수식 0개 = GAS 죽으면 화면도 죽는다. **순수 수식** 셀 추가:

- barcode 입력 칸 → 서명·상태·대출자 표시: `08_COPIES` MATCH + `10_LOANS`에서 OPEN 대출 SUMPRODUCT 단일 패스 (P2-b 아카이브로 LOANS가 당해연도만 유지되므로 O(n) 허용 — **v3에서 발견한 O(n²) 패턴 금지**, 행별 하위범위 재스캔 없는 단일 패스만)
- `20_MANUAL_ENTRY` 미처리 건수 COUNTIF
- 라벨: "Apps Script가 응답하지 않을 때도 이 칸은 동작합니다"

수용 기준: Apps Script 비활성(권한 회수) 상태에서 barcode 입력 → 서명·대출자 표시.

---

## P7 · 한/영 다국어 (ADR-017)

- **Sidebar**: `I18N = {ko:{...}, en:{...}}` 사전(~150키), 상단 KO/EN 토글, `UserProperties`에 저장 → **사용자별** 언어 (한국인·영어 사용자 동시 상이 언어)
- **서버 메시지**: `fail_`이 이미 코드 반환 — 사이드바에서 코드→언어별 메시지 매핑(~70키). 매핑 없는 코드는 서버 한글 메시지 폴백
- **상태값 표시**: `16_CODEBOOK`의 `label_ko`/`label_en` 활용 (이미 존재 — 추가 작업 없음)
- **운영센터**: `01_Console_EN` 시트 추가, `refreshDashboard_`가 두 시트에 기록 (전역 토글 대신 시트 2장 — 각자 자기 탭)
- `02_사용법` 하단에 영어 섹션 추가

수용 기준: 토글 즉시 반영·재접속 유지. 두 브라우저에서 동시에 서로 다른 언어. 오류 메시지도 번역됨.

---

## 건드리지 말 것

- `executeWrite_` 보상 트랜잭션 · `protectDatabaseSheets_` 보호 로직 · 예약 배정 로직(`planNextReservation_` 계열) · 감사 로그 구조 — **검증된 자산. 수정 금지**
- DB 시트 헤더명 (HEADERS 상수와 동기화되는 것만 예외)
- 소유자=ADMIN 강제 로직

## 미결 (사용자 확인 필요)

- 🟡 도메인 (P5 라벨 전 필수)
- 🟡 영어 사용자 범위 — 교직원만? 학생도? (P7 범위·웹앱 i18n 우선순위 결정)
- 🟡 웹앱 로그인 방식 (기존 보류 유지 — 이 명세와 무관)
