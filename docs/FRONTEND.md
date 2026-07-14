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
  services/         camera.ts  scanBus.ts  api.ts  offlineQueue.ts  catalog.ts  session.ts
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

## 데스크톱 셸 — 창 관리자

- **창**: 드래그(타이틀바) · 리사이즈(모서리 8방향) · z-순서(클릭=최상단+포커스) · 최소화→하단 도크 · 닫기 · 좌/우 스냅(화면 절반)
- **위치·크기 영속**: `localStorage['win:'+viewId]` — 재접속 시 복원
- **동시 창 최대 6개** (성능 가드), `single:true` 뷰는 재실행 시 기존 창 포커스
- **좌측 런처 도크**: 레지스트리의 role-필터된 아이콘. 클릭=열기/포커스
- **스캐너는 창이 아니다**: 우하단 고정 도크 위젯(카메라 프리뷰 축소판 + 상태점). 닫기 불가, 접기만 — 카메라 생명주기를 창 개폐와 분리(기존 결정)
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

## 플랫폼 주의 2개

- **iOS 저장소 축출**: 미사용 7일 후 사이트 저장소를 지울 수 있음 → `offlineQueue`는 적재 즉시 전송 시도(장기 보관 금지), 클라이언트에만 존재하는 데이터 금지(진실은 항상 시트). 카탈로그 미러는 지워져도 재동기화로 복구되는 캐시로만 취급
- **Windows 웹캠**: 고정초점 저가 웹캠은 EAN-13 판독 실패 가능(미실측 리스크) — 실패 시 대안: 폰을 스캐너로 쓰고 데스크톱은 조회·창 작업 전용

## 서비스 계약

- `api.ts`: doPost JSON, `MOBILE_REG_TOKEN` 방식 토큰(정식 로그인 결정 전까지), requestId=UUID 자동 부여, 30s 타임아웃 후 동일 ID 재시도
- `offlineQueue.ts`: 실패 요청 IndexedDB 적재 → 온라인 복귀 시 순차 재전송 (서버 멱등이 중복 흡수)
- `catalog.ts`: 카탈로그 미러(IndexedDB) — 검색은 브라우저에서, GAS 0회
- `session.ts`: role(LIBRARIAN/STATION) — 스테이션은 기기 토큰, 학생 검색 UI 자체를 렌더하지 않음(ADR-011)

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
