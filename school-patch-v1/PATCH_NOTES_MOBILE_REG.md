# PATCH_NOTES_MOBILE_REG — 폰 ISBN 등록 도구 (2026-07-14)

`docs/TASK_MOBILE_REG.md` 구현. **P4(ISBN 자동조회)를 웹앱 형태로 흡수** — 사이드바 단건 등록이 아니라
GAS Web App(`doPost`) + GitHub Pages PWA(`spike/register.html`) 구조로 만들었다. 여러 사람이 동시에
폰으로 등록할 수 있어야 한다는 요구 때문에, 소유자 1인만 편집 가능한 바운드 사이드바로는 애초에
불가능한 문제였다(`school-patch-v1/README.md` §권한 참고).

---

## 바뀐 것

### 1. `Code.gs` — 새 섹션 "폰 ISBN 등록 Web App"

- `LIBRARY_MVP.SHEETS.BOOK_CACHE` / `HEADERS['21_BOOK_CACHE']` 신설 (isbn13·title·subtitle·authors·publisher·published_year·page_count·cover_url·source·cached_at). **기존 시트는 건드리지 않음** — 신규 시트 추가만이므로 `ensureSchema_`가 다음 `setupLibraryMvp` 실행 시 자동 생성한다.
- `doPost(e)` — JSON 요청 → `ScriptProperties.MOBILE_REG_TOKEN` 검증 → `action` 분기 → `{ok,data|error}` 봉투로 응답. `runApi_`를 그대로 재사용해 기존 규약과 100% 동일한 오류 형식을 유지.
- `apiLookupIsbn_` — `CacheService`(6h, GAS 허용 최대치) → `21_BOOK_CACHE` 시트 → 미스 시 알라딘 `ItemLookUp` 순으로 조회. **TITLES에 이미 있는 ISBN인지도 함께 확인**해 `isDuplicate`/`existingTitleId`/`existingTitle`을 응답에 포함(정상 흐름에서 "복본으로 추가할까요?" 원탭 배너용).
- `apiRegisterByIsbn_` / `registerByIsbn_` — **`executeWrite_('REGISTER_BY_ISBN', ...)` 안에서 `registerTitle_`/`registerCopy_`를 그대로 재사용**. `executeWrite_`·`registerTitle_`·`registerCopy_`·`writeAudit_`·`assignNextReservation_`(예약 배정, `registerCopy_`가 내부 호출)은 **한 줄도 수정하지 않았다** — CLAUDE.md §2 준수.
  - ISBN 신규 등록 시도 → `registerTitle_`이 내부적으로 `DUPLICATE_ISBN`을 던지면(동시 등록 레이스로 그 사이 다른 기기가 먼저 커밋한 경우) **잡아서 복본 추가로 자동 폴백**. 클라이언트에는 에러로 보이지 않고 정상 성공 응답이 간다.
  - 복본은 `copyCount`(1~50)만큼 같은 락·같은 `requestId`·같은 보상 트랜잭션 안에서 `registerCopy_`를 반복 호출 — 원자적으로 전부 성공하거나 전부 롤백.
  - 소장본(`08_COPIES`) `note` 필드에 `"폰 등록 · <operator>"`를 직접 기록 — **Web App은 소유자 권한으로 실행되어 `Session`으로는 실제 스캔한 사람을 구분할 수 없으므로**, payload로 받은 `operator`를 소장본 행 자체와 감사 로그 summary 양쪽에 남긴다.
- `normalizeIsbn13Strict_` — EAN-13 체크디지트 + `978`/`979` 프리픽스 검증(서버 측 방어선. 1차 방어는 클라이언트).

### 2. `appsscript.json`

- `https://www.googleapis.com/auth/script.external_request` 스코프 추가 (알라딘 `UrlFetchApp` 호출용) → **재승인 필요**, 정상입니다.
- `webapp: { executeAs: "USER_DEPLOYING", access: "ANYONE_ANONYMOUS" }` 추가 — "나(소유자)로 실행 + 모든 사용자" 조합을 매니페스트에 명시.

### 3. `spike/register.html` — 신규 PWA 페이지 (스파이크 확장)

스파이크의 스캔 루프·ZXing 사용법을 그대로 재사용하되:
- **EAN-13만** 인식(QR 인식 코드 제거), 부가기호(5자리)·체크디지트 불일치는 클라이언트에서 즉시 무시.
- **10fps 스로틀 + 조준 프레임 크롭**(reticle 영역만 잘라 디코더에 전달)으로 CPU 부하 절감. ⚠️ **Web Worker 오프로딩은 이번 범위에 넣지 않았다** — 검증 프로토콜 항목 5(20권 연속·발열)에서 문제가 발견되면 다음 개선 항목.
- 최초 1회 Web App URL·공유 토큰·작업자 이름 입력 → `localStorage` 저장(기기별).
- 스캔 → 조회(스피너) → 확인·보정 폼(자동 저장 없음, 사서가 반드시 확인) → 저장 → **등록번호 화면 가득 크게 표시** → 다음 스캔.
- 저장 요청은 매번 `crypto.randomUUID()`로 `requestId` 생성, **실패해도 같은 `requestId`로만 재시도**(멱등 보장) — 실패는 화면 하단 "실패 목록"에 쌓이고 자동 재시도는 하지 않는다(무한 재시도 방지, 사람이 탭해야 재시도).
- fetch는 `Content-Type` 헤더를 지정하지 않는다(문자열 body의 fetch 기본값은 `text/plain`) — CORS 프리플라이트를 유발하지 않기 위한 의도적 선택. GAS Web App은 OPTIONS를 처리하지 않으므로 프리플라이트가 뜨면 요청 자체가 실패한다.

### 4. `spike/sw.js`, `spike/register.manifest.webmanifest`

- `register.html`을 독립된 홈 화면 설치 대상으로 분리(diagnostic 스파이크 페이지와 별개 아이콘/설치). 캐시 버전 `spike-v1` → `spike-v2`.

---

## 범위에서 뺀 것 (의도적)

- **국립중앙도서관 보강 조회** — `ALADIN_TTB_KEY`만 사용. `NLK_API_KEY` 확보 후 `lookupAladin_` 실패/보강 경로에 추가 예정 (TASK_MOBILE_REG §사용자가 미리 할 일 항목 2).
- **TITLES에 `page_count` 정식 컬럼 추가** — 이미 데이터가 들어간 시트의 헤더 확장은 `ensureSchema_`가 자동으로 못 채워서(누락 헤더는 오류로 중단) 운영 중 스키마 마이그레이션이 된다. 게이미피케이션 가중치 산식이 아직 미정(CLAUDE.md 🟡)이라 지금 강행할 이유가 없어 **`description`에 텍스트로만 보강 기록**하고 정식 컬럼화는 보류.
- Web Worker 오프로딩(위 참고).

---

## ⚠️ 이 환경에서 검증하지 못한 것

**GAS 런타임도, 알라딘 실서버 호출도, 실제 아이폰도 여기 없다.** `Code.gs`는 `node --check`로 구문만,
`register.html`의 인라인 스크립트도 `node --check`로 구문만 확인했다. 아래를 **실제 환경에서 반드시** 수행해야
"수용 기준 10개 통과"를 주장할 수 있다.

- **알라딘 응답 필드 매핑 미검증** — `lookupAladin_`의 `item.author`/`item.pubDate`/`item.subInfo.itemPage`/`item.cover`는 알라딘 공식 문서 기준으로 작성했을 뿐, 실제 TTB 키로 한 번도 호출해보지 못했다. 첫 조회 시 응답 JSON을 로그(`console.log`)로 한 번 찍어 필드명이 맞는지 확인 권장.
- 아이폰 설치형 PWA에서의 실측 발열/배터리/20권 연속 성능.

## 사전 준비 (설치 순서)

1. Apps Script 편집기에서 이 `Code.gs`/`appsscript.json`으로 교체 → 저장 시 **재승인 팝업** 뜸(정상, `script.external_request` 추가 때문) → 승인.
2. **관리 → 최초 설정/스키마 확인**(`setupLibraryMvp`) 1회 실행 → `21_BOOK_CACHE` 시트 자동 생성·보호 확인.
3. **프로젝트 설정 → 스크립트 속성**에 `MOBILE_REG_TOKEN`(아무 임의 문자열, 예: openssl로 생성한 32자)과 `ALADIN_TTB_KEY`(알라딘 TTB 키) 등록.
4. **배포 → 새 배포 → 웹 앱** — 실행 사용자: **나**, 액세스 권한: **모든 사용자**. 배포 후 나오는 `.../exec` URL을 복사.
5. `library-system` 레포 push → GitHub Pages에 `spike/register.html` 반영 확인.
6. 아이폰에서 `https://bgec-maker.github.io/library-system/register.html` 접속 → Safari 공유 → 홈 화면에 추가 → 그 아이콘으로 재실행 → 최초 설정 화면에 3단계 URL/토큰/이름 입력.

## 테스트 프로토콜 — 수용 기준 10개 (실제 폰·시트에서, 순서대로)

**A. 기본 흐름**

1. 새 ISBN 스캔 → 조회 스피너(3초 이내 응답 확인, 알라딘 응답시간에 좌우) → 확인 폼에 서명·저자·출판사·발행년·페이지 자동 채움 → 값 확인 후 저장 → **등록번호 화면 가득 크게 표시** → 전체 소요 30초 이내였는지 스톱워치로 확인. → **[기준 1]**
2. 이미 등록된 ISBN을 다시 스캔 → "이미 있는 책입니다. 복본으로 추가할까요?" 배너 → **복본으로 추가** 원탭 → 저장 → 성공. → **[기준 3]**
3. 부가기호(ISBN 옆 5자리 EAN-5) 바코드만 단독으로 스캔 시도 → 아무 반응 없이 스캔 계속(조회 안 뜸) 확인. → **[기준 6]**

**B. 멱등·캐시**

4. 저장 직전 기기를 비행기 모드로 전환해 타임아웃을 인위 발생 → "실패 목록"에 추가됨 확인 → 비행기 모드 해제 → 실패 목록에서 **재시도** 탭 → 등록 1건만 생성(시트에서 같은 바코드 중복 없음, `18_SYS_OPERATIONS`에서 같은 `request_id` 한 줄만 `COMPLETED`) 확인. → **[기준 2]**
5. 방금 등록/조회한 ISBN을 즉시 재스캔 → Apps Script 실행 기록(Executions)에서 `UrlFetchApp` 호출이 없었는지(=`lookupAladin_` 미호출, 캐시 히트) 확인. → **[기준 4]**

**C. 병렬 다중 사용자 — 여기가 핵심**

6. **폰 2대**를 준비해 서로 다른 `operator` 이름으로 설정. **한 번도 등록 안 된 새 ISBN**을 두 폰에서 최대한 동시에 스캔·저장 → `03_TITLES`에 해당 서지가 **1건만** 생성되고 `08_COPIES`에 복본이 **2건** 생성되는지 확인(먼저 도착한 요청이 `created:true`, 늦은 요청은 화면에 에러 없이 성공하며 `created:false`로 표시되어야 함). → **[기준 8]**
7. **폰 3대**로 각자 다른 책 20권씩(서로 겹치지 않는 서가/구역 분담) 연속 등록 → 종료 후 `08_COPIES`의 `barcode` 열 전체에서 **중복 0건**, 등록 시도한 60권이 전부 존재(유실 0) 확인 — `무결성 점검` 메뉴로도 이슈 0건 확인. → **[기준 9]**
8. 6·7에서 생성된 소장본들을 `08_COPIES`에서 열어 **`note` 열에 `폰 등록 · <operator 이름>`이 각 행마다 정확히 남아있는지** 확인 — 등록한 사람을 시트만 보고 특정할 수 있어야 함. → **[기준 10]**

**D. 지구력·보안**

9. 아이폰 설치형 PWA에서 **20권 연속** 등록 — 스캔이 계속 인식되는지, 기기가 뜨겁게 느껴지거나 앱이 죽는지 관찰. 문제 있으면 Web Worker 오프로딩을 다음 패치로 올릴 것. → **[기준 5]**
10. 로컬에서 `grep -riE "ALADIN_TTB_KEY\s*[:=]\s*['\"]|MOBILE_REG_TOKEN\s*[:=]\s*['\"]" .` 또는 `grep -rn` 으로 실제 키/토큰 **값 문자열**이 레포 어디에도 없는지 확인(키 이름 자체는 코드에 등장하는 게 정상 — `ScriptProperties`에서 읽어오는 참조일 뿐). → **[기준 7]**

## 결과 기록

A~D(총 10개 수용 기준) 전부 통과하면 이 도구를 "0단계 착수 조건 충족"으로 승격하고
CLAUDE.md 상단 상태표의 `▶ 즉시` 줄을 지우세요. 하나라도 실패하면 이 문서에 실패 재현 조건을 추가로 기록하세요.
