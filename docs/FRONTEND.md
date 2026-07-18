# FRONTEND.md — 웹앱 프론트엔드 아키텍처

> 근거: ADR-018 (플로팅 윈도우 v1 격상). 목표: **뷰 코드 중복 0** — 데스크톱·모바일이 같은 업무 화면을 공유한다.

## 제1원칙 — 뷰는 셸을 모른다

```
뷰(View)  = 업무 화면 그 자체. 창인지 풀스크린인지 모른다.
셸(Shell) = 포장. 데스크톱은 플로팅 창, 모바일은 탭+스택.
```

**강제 수단 (희망사항 아님):**
- `src/views/**` 안에서 `window.`, `matchMedia`, `innerWidth`, 셸 컴포넌트 import **금지** — ESLint 룰로 차단
- 뷰가 셸에 원하는 것(제목 변경, 닫기 요청, 다른 뷰 열기)은 **`ShellContext` 인터페이스**로만: `{ setTitle, requestClose, open(viewId, params), toast }`
- 뷰가 받는 것: props + `ShellContext` + 서비스 훅. 그 외 채널 없음

## 기술 스택

- **Vite + React + TypeScript** (스파이크·register.html은 검증용 바닐라였고, 본편은 컴포넌트 규모상 React)
- 상태: **zustand** (창 상태·세션·큐). 서버 상태는 자체 훅 (React Query 불필요 — API가 단순)
- 라우팅: **hash 라우터** (GitHub Pages 제약). 딥링크: `#/b/0001234`(학생 책 페이지), `#/w/loan-return`(뷰 직행)
- 아이콘: **lucide-react** (인라인 SVG 번들 — CDN 금지 제약 통과, currentColor로 토큰 상속). 레지스트리 `icon: LucideIcon`
- 스타일: CSS 변수 토큰 2스킨 — `tokens/work.css`(paper #f2f0ea · navy #1b3a4b · brass #d9a441, 스파이크 계승) / `tokens/student.css`(같은 변수명, 발랄한 값). **컴포넌트는 변수만 참조** — 스킨 교체 = CSS 파일 교체

## 디렉터리 — 경계가 곧 규칙

```
webapp/src/
  views/            ★ 업무 코드는 여기만. 셸 API 접근 금지(린트)
    loan-return/  search/  book-detail/  inventory/  recent-ops/
  student/          학생 공개 표면 — 셸 없이 단독 라우트 (초경량 번들 분리)
    book-page/  my-shelf/  ranking/
  shells/
    desktop/        WindowManager, Window(타이틀바·리사이즈), Dock, Snap
    mobile/         TabBar, StackNav, BottomSheet
  services/         camera.ts  scanBus.ts  api.ts  registerQueue.ts  catalog.ts  session.ts
  registry.ts       ★ 뷰 메타데이터 단일 원천
  boot.tsx          셸 선택 + 스킨 로드
  tokens/           work.css  student.css
```

## ViewRegistry — 단일 원천

셸(도크 아이콘·탭·창 목록)은 전부 이 레지스트리를 읽어 렌더링한다. 뷰 추가 = 레지스트리 한 줄 + 뷰 폴더 하나.

```ts
type ViewMeta = {
  id: 'loan-return' | 'search' | 'book-detail' | 'inventory' | 'recent-ops';
  title: string; icon: string;
  roles: ('LIBRARIAN'|'STATION')[];      // 학생 표면은 별도 엔트리
  scan: 'focus' | 'none';                // 스캔 이벤트 관심 여부
  desktop: { min: [number,number]; single?: boolean };  // single: 중복 창 금지
  mobile: { tab?: number };              // 하단 탭 슬롯 (없으면 push 상세)
};
```

v1 레지스트리: `loan-return`(scan:focus, tab 0, single) · `register`(scan:focus, tab 1, single — **register.html 로직 흡수**, 작업자 이름은 session에서) · `search`(tab 2) · `inventory`(scan:focus, 더보기, single) · `book-detail`(push 전용) · `recent-ops`(더보기)

## 데스크톱 셸 — 창 관리자 + 대시보드 기저층 (ADR-021)

**워크스페이스의 바탕 = 대시보드.** 창이 아니라 기저층이다 — 닫기·이동 불가, 창을 모두 닫으면 항상 보인다.
- 구성: 오늘 카드 6종(대출·반납·대출중·연체·예약대기·분실) · **「조용한 신호」**(FEATURES.md R1 진입 버튼) · 연체 상위 · 최근 처리 · 마지막 백업
- 데이터: doPost 읽기 액션 `dashboard`(기존 getDashboardData_ 재사용 — 다음 Code.gs 배포에 포함). 갱신 = 진입 시 + 트랜잭션 후 + 수동 버튼 + 5분 자동. 초 단위 폴링 금지(GAS 할당량)
- 모바일 셸엔 기저층 없음 — 카드 요약은 「더보기」 상단에 축약 배치

- **창**: 드래그(타이틀바) · 리사이즈(모서리 8방향) · z-순서(클릭=최상단+포커스) · 최소화→하단 도크 · 닫기 · 좌/우 스냅(화면 절반)
- **위치·크기 영속**: `localStorage['win:'+viewId]` — 재접속 시 복원
- **동시 창 최대 6개** (성능 가드), `single:true` 뷰는 재실행 시 기존 창 포커스
- **좌측 런처 도크**: 레지스트리의 role-필터된 아이콘. 클릭=열기/포커스
- **스캐너 = 창 (ADR-026 — ADR-018 부수결정 개정)**: `shells/desktop/ScannerWindow`가 카메라 세션 그 자체다 — 창을 열면 카메라가 켜지고, 닫으면 꺼진다(연속 모드 핀 중엔 닫기 확인 1회). 최소화는 챙만 숨기고 카메라는 유지(러시아워). `ViewId`/`useWindowStore`에는 등록하지 않는 별도 창(뷰가 아니라 셸 관심사) — 우하단 도크 위젯은 상태점 + 열기/복원 버튼으로 축소
- **카메라는 온디맨드 (ADR-020 — '상시 구동' 반전)**: 기본 꺼짐. 시작 = 도크 위젯 클릭·스캔 뷰 시작 버튼·단축키 S — 셋 다 ScannerWindow를 여는 것이고, 그게 곧 카메라 시작이다 / **유휴 3분 자동 종료**(10초 전 토스트 예고) / **연속 모드 핀** = 러시아워용 유휴 타이머 해제(창에 표시) / 모바일 = 스캔 탭 진입 시 시작 버튼, 탭 이탈 시 즉시 종료. `getUserMedia` 단일 호출점·ref-count는 그대로
- 타이틀바 스캔 뱃지: 포커스 창이 `scan:focus`면 "스캔 수신" 표시, 핀 아이콘으로 고정(전역 1개, 고정 중 배너)

## 모바일 셸 — 탭 + 스택

- 하단 탭 4: 스캔(=loan-return) · 검색 · 점검 · 더보기. **스캔이 항상 첫 탭 + 앱 시작 화면**
- 상세(book-detail)는 push, Android 뒤로가기 = pop, 루트에서 뒤로가기 = 탭 유지
- 확인·짧은 폼은 BottomSheet (풀스크린 전환 최소화 — 스캔 흐름 끊지 않기)
- 타깃 최소 44px, 하단 1/3에 주요 액션 (한 손 조작)

## 스캔 라우팅 — 셸 공통 규칙

```
CameraService(싱글턴, 스트림 1개, ref-count) 
  → 디코드(런타임 기능 감지: BarcodeDetector 있으면 사용〔Android·macOS Chrome〕, 없으면 ZXing Worker+크롭+10fps〔iOS 전부 + **Windows/Linux Chrome 포함**〕)
  → scanBus.parse: 숫자(+Luhn)=책 · 'S'접두=학생 · URL '/b/'=책
  → 라우팅: 데스크톱=포커스 창(핀 우선) / 모바일=활성 탭 화면
  → 관심 창이 하나도 없으면 loan-return 자동 오픈 후 전달
```

피드백은 서비스 계층에서 일괄: 성공=사운드+초록 플래시(+모바일 진동), 실패=경고음. **뷰가 각자 구현하지 않는다.**

## 실행 정책 (🟡 확정 대기 — 기본값으로 구현)

- 대출·반납: **확인 탭 없음, 즉시 실행 + 실행취소 5초 스낵바** (스테이션 동일)
- 실행취소 = 반대 트랜잭션(기존 `취소` 구분) — 서버 왕복, 멱등 requestId

## 플랫폼 주의 3개

- **iOS 설치형 상단 safe-area**: `black-translucent` 상태바를 쓰므로 콘텐츠가 노치 밑까지 올라간다 → 모바일 셸 헤더는 반드시 `padding-top: calc(기본 + env(safe-area-inset-top))`. **브라우저 탭에선 재현 안 되고 설치형에서만 드러난다** — 검증은 홈 화면 아이콘으로. iOS는 매니페스트 orientation 잠금을 무시하므로 좌우 inset도 처리

- **iOS 저장소 축출**: 미사용 7일 후 사이트 저장소를 지울 수 있음 → `registerQueue`는 적재 즉시 전송 시도(장기 보관 금지 — 미전송분·완료 30건만 짧게 영속), 클라이언트에만 존재하는 데이터 금지(진실은 항상 시트). 카탈로그 미러는 지워져도 재동기화로 복구되는 캐시로만 취급
- **Windows 웹캠**: 고정초점 저가 웹캠은 EAN-13 판독 실패 가능(미실측 리스크) — 실패 시 대안: 폰을 스캐너로 쓰고 데스크톱은 조회·창 작업 전용

## 서비스 계약

- `api.ts`: doPost JSON, `MOBILE_REG_TOKEN` 방식 토큰(정식 로그인 결정 전까지), requestId=UUID 자동 부여, 30s 타임아웃 후 동일 ID 재시도
- `registerQueue.ts`: **등록 쓰기 전담** 순차 큐(todo/28) — localStorage 영속, BUSY_RETRY·네트워크·타임아웃 같은 requestId 백오프 재전송(서버 멱등이 흡수), 새로고침·online 복귀 시 자동 재개. 그 외 쓰기는 `writeRetry.ts`(todo/37)가 블로킹 UX 그대로 짧게 흡수
- (구 `offlineQueue.ts`는 소비자 0의 죽은 코드로 todo/39에서 제거 — 대출·반납의 **오프라인 적재**는 미구현이며 확정 지연 표시 등 UX 정책이 얽혀 🟡 사용자 결정 대기: `todo/waiting/offline-loans.md`)
- `catalog.ts`: 카탈로그 미러(IndexedDB) — 검색은 브라우저에서, GAS 0회
- `session.ts`: role(LIBRARIAN/STATION) — 스테이션은 기기 토큰, 학생 검색 UI 자체를 렌더하지 않음(ADR-011)

## 다국어 (ADR-023 — ADR-017 계승: 데이터는 코드, 표시는 사전)

- 자체 `t('key')` 유틸 — i18n 라이브러리 무도입(번들 예산). `src/i18n/{ko,en,…}.json`, **활성 로케일만 dynamic import**
- 감지: localStorage → navigator.language → ko. 전환 UI: 설정·더보기 + student 표면 상단 지구본
- **강제**: `views/**·shells/**·student/**` JSX 내 한글 문자열 리터럴을 린트로 검출(기존 grep 이중검증 확장) — 모든 UI 문자열은 사전 키
- 번역 안 하는 것: 서명·저자·학생 이름(데이터). 날짜·숫자는 `Intl.*(locale)` — 사전에 넣지 않는다
- 문형: 조사(을/를/이/가) 의존 회피 — "『아몬드』 대출 완료"식 명사형
- 언어 추가 = JSON 파일 1개 + 키 누락 검증 스크립트 통과. 초기 탑재 ko·en, 다문화 언어(🟡 목록 확정 대기)는 2차 런에서 사전 채움

## 공용 DataTable + Paginator (`src/components/`)

모든 목록 화면(catalog·reports·search·recent-ops)은 이 **하나**를 소비한다 — 표 UI 중복 금지.
- 열 정의 API(정렬자·렌더러·모바일 primary/secondary 매핑) · 클라이언트 정렬/필터 · 페이지 25/50/100(기본 50) · sticky 헤더 · 빈/로딩/오류 상태 내장(DESIGN 규칙) · CSV 내보내기(클라이언트 생성)
- 모바일: 테이블 → **카드 리스트 자동 변환** (가로 스크롤 지양)
- 접근성: `th scope` · `aria-sort` · 페이지 버튼 44px

## catalog (장서 대장) 뷰 — 2차 런 1순위

- 🔴 **서버 페이지네이션 금지** — GAS엔 부분 읽기가 없어 페이지마다 전체 스캔이 된다. 대신 **카탈로그 미러(IndexedDB)가 정본 캐시**: doPost `catalogSync`(청크 1,000행 · catalogVersion 델타) 백그라운드 동기화 → 정렬·필터·페이지는 로컬 0 네트워크
- 열: 등록번호(mono)·서명·저자·분류·상태·대출횟수·최근대출·서가·입수일 · 행 클릭 → book-detail
- 인라인 편집·대량 작업은 v2 — v1은 조회+진입점

## 성능 예산 (저사양 학교 환경이 기준기)

기준기: **4GB RAM 구형 윈도우 PC**(교무실 컴퓨터) + 보급형 안드로이드. 이 기계에서 쾌적해야 통과다.

- 초기 JS: **work ≤ 180KB gzip · student ≤ 70KB gzip** — CI가 size 체크로 강제(초과=빌드 실패)
- 창 드래그·리사이즈는 **transform만** (top/left 갱신 금지 — 리플로우 유발). `backdrop-filter` 금지, 그림자 1겹
- 200행 이상 목록은 가상화 또는 페이지네이션. 시각화는 지연 로딩(가시 영역만)
- 표지 이미지: lazy + width/height 명시(레이아웃 시프트 0)
- 서버 폴링 금지 — 대시보드 5분 주기만. 초 단위 setInterval 네트워크 호출은 리뷰 반려 사유
- 확장 용이 원칙 재확인: 새 기능 = 레지스트리 한 줄 + views/(또는 viz/) 폴더 하나. 셸·서비스 수정이 필요하면 설계 신호로 간주하고 FRONTEND.md 개정부터

## 수용 기준

- [ ] `views/**` 에서 `matchMedia|innerWidth|window\.(?!location)` grep 0건 + 셸 import 0건 (CI 린트)
- [ ] `getUserMedia` 호출 지점 **정확히 1곳** (camera.ts)
- [ ] 같은 뷰 파일이 두 셸에서 렌더 — 데스크톱 창/모바일 탭 스크린샷 비교로 확인
- [ ] 창 위치·크기 재접속 복원, 최소화·스냅·z-순서 동작
- [ ] 포커스 창 전환 시 스캔이 새 포커스 창으로 감 (핀 시 핀 창)
- [ ] 학생 번들: `/b/` 진입 시 사서 셸 코드 미로딩 (번들 분리 확인)
- [ ] iOS 설치형 PWA에서 스캔 연속 20건 (기존 스파이크 조건 유지)

## 기존 배포 철수 계획 (ADR-019) — 순서 엄수

1. **병행 배포**: 새 앱을 `webapp/` 빌드 → Pages의 `/app/` 경로에 배포. 스파이크·register.html은 **그대로 살려둔 채**
2. **검증**: 새 앱에서 등록 1권 + 대출·반납 1건이 실제 폰(설치형 PWA)에서 통과 — register.html의 수용 기준 그대로 재사용. ⚠️ 주차 중인 스모크 버그("스캔됐는데 시트에 안 보임")를 여기서 다시 만난다 — 같은 doPost를 쓰므로 이 단계에서 자연 검증/디버그됨
3. **리다이렉트 스텁**: `register.html`·스파이크 index를 새 앱으로 302/JS 리다이렉트하는 한 줄 페이지로 교체 — **폰 홈 화면에 설치된 구 PWA 아이콘이 깨지지 않게** (URL을 죽이면 도우미들 아이콘이 전부 먹통)
4. **제거**: 2주 뒤 스텁 삭제. 스파이크 코드는 zip의 `spike/`에 기록 보존

⚠️ 등록 스프린트가 **진행 중이라면** 세션 중간에 전환하지 않는다 — 그 세션은 register.html로 끝내고, 다음 세션부터 새 앱.

## v1 범위 밖 (다시 넣지 말 것)

창 간 드래그앤드롭 · 탭형 창 병합 · 멀티모니터 · 창 애니메이션 물리효과 · 데스크톱/모바일 중간의 "반응형 하이브리드"(셸은 부팅 시 **하나만** 선택, 리사이즈로 셸 전환 안 함 — 회전 시 태블릿만 예외 검토)
