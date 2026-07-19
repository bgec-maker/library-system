# PATCH_NOTES — 학교화 패치 v1 (2026-07-14)

원본 MVP 패키지(공공도서관 모델)를 **학교 도서관용으로 전환**한 패치입니다.
원본: `Code.gs.orig` / `Sidebar.html.orig` 로 보존.

---

## 🚀 GAS 재배포 대기 대장 (누적 — 여기만 보면 됨)

Code.gs는 레포에서 이미 갱신됐지만 **실제 GAS에는 아직 배포되지 않은** 변경의 누적 목록.
배포는 한 번이면 전부 반영된다: Apps Script 편집기에서 Code.gs 교체 → 배포 관리 → **새 버전**
(URL 유지, 새 스코프 없음 → 재동의 없음). 배포 후 아래 「배포 후 조치」를 순서대로.

| # | 항목 | 내용 | 배포 전 웹앱 상태(폴백) |
|---|---|---|---|
| 1 | todo/90 schemaReport | 스키마 대조 리포트(읽기 전용) | 설정 화면에 섹션 자체가 안 보임 — 무해 |
| 2 | todo/124 난민학교 코어 | 반 코드북 이중 모드·birth_year·학생 검증 완화(반만 필수)·담임 리포트 classCode 모드·검증 리스트 교정 | 웹앱 변화 없음(서버 선행분) |

**배포 후 조치(1회)**: 스프레드시트 새로고침 → 📚 도서관 관리 → 관리 → **「스키마 업그레이드
(반·생년)」 실행** (birth_year 열 추가 + CLASS 코드군 시드 LOVE/HOPE/FAITH + 검증 리스트
재적용 — 멱등이라 여러 번 눌러도 안전). 이후 설정 화면 「스키마 대조」가 초록인지 확인.

---

## 바뀐 것

### 1. 회원 → 학생 모델 (`09_MEMBERS` 스키마 변경)

| 제거 | 추가 |
|---|---|
| `birth_date`, `address` (개인정보 최소화) | `school_no`(학번) `grade` `class_no` `student_no` `graduated_at` `suspended_until` `suspend_reason` |

- 등록 시 **전화/이메일 필수 규칙 제거** — 학생은 연락처가 없습니다 (보호자 연락처는 선택 입력)
- 학생 등록 필수값: 이름 + 학년 + 반. 중복 검사: **학번** 또는 **학년·반·번호 좌석**
- `MEMBER_TYPE`에 `STUDENT`(기본값)·`TEACHER`, `MEMBER_STATUS`에 `GRADUATED`·`TRANSFERRED` 추가
- 상태를 `GRADUATED`로 바꾸면 `graduated_at` 자동 기록. **미반납·수령대기예약·미변상이 있으면 졸업/전출 차단** (기존 가드 재사용)
- 검색 결과의 학생 표시: `0000018 · 3학년 2반 12번` (전화·이메일 마스킹 대신)

### 2. 연체 = 돈이 아니라 **대출 정지**

- `CONFIG.OVERDUE_SUSPEND_MULTIPLIER = 1` (연체 1일 → 정지 1일. 0이면 끔)
- **반납 시**: 연체 일수만큼 `suspended_until` 기록 (기존 정지가 더 길면 유지)
- **대출 시**: 정지 중이면 차단 — `"2026-07-20까지 대출 정지 중입니다 (연체 6일 반납)"`
- **미변상 차단**: `REPLACEMENT` 부과금이 미납/부분납이면 신규 대출 차단
- 사이드바 회원 변경 폼에 **「대출 정지 해제」 체크박스** (사서 재량 해제)
- 연체료(`overdue_fee_per_day`)는 전 정책 0 — FINES는 **분실 변상 전용**으로만 사용

### 3. 번호 체계 = 6자리 + Luhn 검증숫자 (ADR-004 정합)

- `nextNumericCode_()` 신설 — 회원번호·바코드 모두 `000001`+검증숫자 → **`0000018`** (7자리)
- 한 자리 오타 100% 검출 (검증 완료)
- `member_no`·`school_no`·`barcode` 열에 **텍스트 서식(@)** — 앞자리 0 보존 (ADR-007)
- 기존 `M-000001`·`C-000001` 접두사 방식 폐기 (`*_PREFIX` 설정은 "(사용 안 함)" 표기)
- ⚠️ 대량 임포트 후에는 `setupLibraryMvp` 재실행 권장 (신규 행 서식 보장)

### 4. 성능 — 요청 스코프 테이블 캐시

- `readTable_()` 결과를 실행 단위로 캐시. 쓰기(append/update/롤백)마다 해당 시트 무효화
- 대출 1건당 전체 시트 로드 **8~10회 → 3~4회**. 5,000권 규모에서 체감 차이 큼

### 5. 학교 정책 매트릭스 (`13_POLICIES` 7행 추가)

| | 대출일 | 권수 | 연장 |
|---|---|---|---|
| 학생 × 일반도서 | 14 | 3 | 1회/7일 |
| 학생 × **참고도서** | **0 = 대출 불가 (관내열람)** | | |
| 학생 × 시청각 | 7 | | 연장 없음 |
| 학생 × 교사용 | **0 = 대출 불가** | | |
| 교사 × 일반도서 | 30 | 10 | 2회/14일 |

`MATERIAL_TYPE`에 `REFERENCE`·`AV`·`SET`·`TEACHER_ONLY` 추가.

### 6. 운영센터 「🚨 비상 조회」 (33행~)

**Apps Script가 완전히 죽어도 동작하는 순수 수식 4개** — 바코드 입력 → 서명 / 상태 / 대출자 / 반납예정.
복본(같은 ISBN 여러 권) 정확 구분 검증 완료. 조회 전용 — 쓰기는 Phase B 수기입력 시트에서.

---

## ⚠️ 이 환경에서 검증하지 못한 것

**GAS 런타임이 없어 코드 실행 검증 불가.** 구문 검사(node)와 값 검증(xlsx)만 통과했습니다.
아래 프로토콜을 **실제 Google Sheets에서 반드시** 수행하세요.

## 테스트 프로토콜 (실제 시트에서, 순서대로)

1. xlsx 업로드 → Google Sheets로 저장 → Code.gs/Sidebar.html 교체 → `setupLibraryMvp` 실행 (README 절차)
2. **학생 등록**: 이름+학년+반만으로 등록됨 / 회원번호가 `0000018` 형식 / 같은 좌석 재등록 시 차단
3. **도서+소장본 등록**: 바코드 자동발급 7자리 / 같은 ISBN 2권 등록(복본)
4. **대출**: 학생×일반도서 → 반납예정 +14일 / **참고도서 → "대출 한도(0권)" 차단 확인**
5. **연체 반납**: `13_POLICIES` 대출일수를 임시 0으로 → 대출 → 반납 → `suspended_until` 기록 확인 → **재대출 시도 → 정지 차단 메시지** → 회원 변경 폼 「정지 해제」 → 대출 성공
6. **분실**: 분실 처리(변상비 입력) → **변상 전 대출 차단** → 납부 처리 → 대출 성공
7. **졸업 차단**: 미반납 학생 상태를 GRADUATED로 → 차단 확인 → 반납 후 → 성공 + `graduated_at` 기록
8. **비상 조회**: 운영센터 33행에 대출중 바코드 입력 → 서명·대출자 표시 확인
9. **무결성 점검** 메뉴 실행 → 이슈 0건

## Phase B (다음 작업)

1. **ISBN 자동조회** (국중→알라딘, `external_request` 스코프) — 0단계의 심장
2. ~~**수기입력 시트 + absorb** — GAS 사망 시 쓰기 경로~~ **완료 (todo/21, 2026-07-15)**: `22_MANUAL_ENTRY` 시트(유일한 비보호 쓰기 시트) + `absorbManualEntries_()`/`runAbsorbManualEntries()`(사이드바 관리 메뉴 「수기입력 흡수」) + 웹앱 대시보드 미처리 건수. 시트 번호는 원 스펙의 "20"이 아니라 "22"를 썼다(20/21은 그 사이 VIZ_CACHE/BOOK_CACHE가 먼저 차지) — README.md "수기입력" 절 참고.
3. **연간 리셋 마법사** — 진급→졸업(미반납 체크)→신입생 CSV→LOANS 연도 아카이브
4. ~~**명렬표 CSV 일괄 등록**~~ → 웹앱 학생 관리 뷰의 붙여넣기 일괄 등록으로 대체 진행(todo/127 — 이름·반·출생연도 형식, 난민학교 명렬표 기준)
5. ~~**한/영 전환** — 사이드바 사용자별 토글 (CODEBOOK label_en 활용)~~ **완료 (todo/22, 2026-07-15)**: `Sidebar.html`에 `I18N`(ko/en) 사전 + 헤더 `KO`/`EN` 토글 + `PropertiesService.getUserProperties()` 기반 사용자별 저장(`getUserLocale_`/`setUserLocale_`/`apiGetUserLocale`/`apiSetUserLocale`, 이 코드베이스 최초의 UserProperties 사용) + 오류 코드→영어 메시지 매핑(76개, 매핑 없으면 서버 한글 폴백) + CODEBOOK `label_en`/CATEGORIES `name_en`을 내려주는 새 함수 `apiGetCodeLabels()`(기존 `getCodes_`/`apiBootstrap`은 무수정 — PATCH_SPEC의 "이미 존재, 추가 작업 없음"은 실제로는 틀렸다, `docs/ASSUMPTIONS.md` "todo/22" 절 참고) + `refreshDashboard_()`가 `writeDashboardToSheet_(sheet, data)`로 추출된 동일 로직을 `01_운영센터`와(존재할 때만) `01_Console_EN`에 이중 기록.
6. `02_사용법` 시트 학교화 갱신 — **부분 완료**: 수기입력 절차는 README.md "수기입력" 절에 문서화했다(이 저장소의 `도서관_관리_MVP.xlsx`가 이미 20/21 스키마와 어긋난 초기 부트스트랩 템플릿이라 xlsx 내부 `02_사용법` 탭 자체는 이 라운드에서 편집하지 않았다 — 실제 운영 스프레드시트의 `02_사용법` 탭에는 README.md 내용을 사서/관리자가 직접 옮겨 적어야 한다). todo/22에서 영어 언어 안내 섹션도 같은 방식으로 README.md "한/영 전환" 절에 추가했다 — `01_Console_EN` 탭도 같은 제약으로 수기 생성이 필요하다(README.md 참고).

## todo/90 · schemaReport (2026-07-18) — 재배포 필요 🅿

**추가분(기존 함수 무수정)**: doPost 디스패치 1줄 + `apiWebSchemaReport_()` (읽기 전용).

- **무엇**: 실물 스프레드시트와 코드 가정(LIBRARY_MVP.HEADERS 22종 + 22_MANUAL_ENTRY)의 최종
  대조 리포트 — 시트별 존재 여부·헤더 누락/여분·데이터 행수, 버전 표식(코드/설치/스키마).
- **안 하는 것**: 어떤 시트도 생성·수정하지 않는다(ensureSchema_ 미호출 — 그 함수는 누락 시트를
  만들어 버려 진단이 현장을 바꾼다). 셀 본문도 읽지 않는다(헤더 1행 + 행수만).
- **웹앱**: 설정 화면 하단 접힘 섹션 「스키마 대조」. **재배포 전(UNKNOWN_ACTION)에는 섹션이
  아예 보이지 않는다** — 배포하면 자동 활성. 프론트가 먼저 나가 있어도 무해.
- **배포 절차(사용자)**: Apps Script 편집기에서 Code.gs 교체 → 배포 → 배포 관리 → **새 버전** —
  기존 URL 유지. 새 스코프 없음(기존 Sheets 스코프만 사용)이라 재동의 화면은 뜨지 않는다.

## todo/124 · 난민학교 대응 코어 (2026-07-19) — 재배포 필요 🅿 (대장 #2)

**배경(명렬표 실물 확인)**: 반이 이름 반(Love/Hope/Faith), 학년·학번·출석번호 부재, 한 반에
출생연도 최대 7년 혼합(2018년생이 Hope·Faith 양쪽에 존재 — 배정은 수준별 개별 판단). 같은 반에
유사 이름 3인(Aisyah/Aisyah star/Alisyah) — 이름 매칭 위험, member_no+QR 축 설계가 실증됨.

**바뀐 것(수정 4곳 + 순수 추가)**:
- `registerMember_`: 학생 필수 「학년+반」→「반만」. `classNo`는 이중 모드(`classValueOrBlank_`
  — CLASS 코드군 있으면 코드 검증, 없으면 종전 양의 정수). `birthYear` 수용(1900~올해).
- `updateMember_`: 반 이동 이중 모드 + `birthYear` patch. 두 함수 모두 birth_year 열이 없는데
  값이 오면 **명시 실패**로 「스키마 업그레이드」 메뉴 안내(appendRecord_의 무음 유실 방지).
- `reportHomeroomClass_`: `classCode` 모드(학년 불요, 응답에 classCode/classLabel) — 종전
  grade+classNo 경로 무수정. 출석번호 전무 시 이름순 안정 정렬.
- `getDataValidationRules_` 교정: member_type에 STUDENT·TEACHER, status에 GRADUATED·TRANSFERRED
  — 학교 패치가 코드북에 넣고도 시트 검증 리스트는 안 고쳐 셀마다 무효 깃발이 서던 것.
- HEADERS `09_MEMBERS` 말미 `birth_year` + `upgradeSchemaClassBirth_()`/관리 메뉴 「스키마
  업그레이드(반·생년)」(멱등: 열 추가·CLASS 시드·검증 재적용).
- ③ 전원 진급은 무수정 — grade 공백 회원은 종전 필터가 이미 제외(이름 반 학교에선 자연 무력).

**개인정보 원칙과의 정합**: 학교 패치가 제거한 것은 `birth_date`(일 단위)다. 이번에 추가한
`birth_year`는 연 단위 — 학년이 없는 이 학교에서 나이 축이 아예 사라지는 문제(명렬표가 이름+
출생연도만 기록)에 대한 최소 수집. 일 단위 생일은 계속 저장하지 않는다.

**확장 규칙**: 반 신설/개명/폐반 = 16_CODEBOOK CLASS 행 추가/수정(label_ko·label_en·sort_order·
status_code) — 코드/배포 불필요. 숫자 반 학교로 되돌리기 = CLASS 행 전부 INACTIVE.
