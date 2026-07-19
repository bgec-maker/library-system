# ASSUMPTIONS.md — 에이전트가 혼자 내린 판단 기록

> 문서에 없는 결정을 혼자 내려야 했을 때, 근거와 함께 한 줄로 남긴다. 사용자가 나중에 뒤집을 수 있도록.

---

## todo/02 · 성능 CI + i18n 기반 (2026-07-15)

- **ESLint/`check-i18n-literals.mjs`의 한글 리터럴 검출 범위는 "JSX 내"로 한정**했다(JSXText·JSX 속성
  문자열 리터럴·JSX 표현식 컨테이너 안 템플릿 리터럴). ADR-023 원문("JSX 내 한글 문자열 리터럴을
  린트로 검출")이 명시적으로 "JSX 내"라고 못 박았기 때문이다. `shell.toast('메시지')`·
  `console.error('...실패...')`처럼 JSX 밖 일반 함수 인자로 쓰인 한글 문자열은 이 두 검사 도구가
  구조적으로 검출하지 않는다. 단, 요구사항 4번("existing screen strings... including toasts")에
  따라 **토스트/에러 메시지는 이미 전부 수동으로 `t()`로 이관**했다 — 다만 향후 누군가 새 토스트를
  하드코딩 한글로 추가해도 이 두 린트는 잡아내지 못한다(회귀 방지가 안 됨). `console.error(...)`
  진단 로그 문자열은 사용자 화면에 노출되지 않는 개발자 전용 문구라 의도적으로 번역 대상에서
  제외했다(CLAUDE.md "주석 = 한국어" 관례와 같은 결로 취급).

- **`registry.ts`의 `ViewMeta.title`은 로케일 전환 시 "제자리 변경"(mutate)** 방식으로 구현했다.
  `types.ts`가 "이 파일은 계약이므로 함부로 넓히지 않는다"고 명시해 `title` 타입을 함수로 바꾸지
  않고 `string`으로 유지했고, 대신 `subscribeLocale` 콜백이 기존 `VIEW_REGISTRY` 배열의 각 객체
  `.title` 필드를 새 로케일 문자열로 덮어쓴다. 배열/객체 참조가 그대로라 `useMemo`로 캐싱한
  소비자(`MobileShell`의 `mobileTabViews`)도 다음 렌더에서 자동으로 새 값을 읽는다.
  **알려진 한계**: 이미 열려 있는 데스크톱 창의 타이틀바 텍스트(`Window.tsx`의 로컬 `title` state)는
  뷰가 마운트 시 1회 호출하는 `shell.setTitle(...)`로 seed된 뒤 로케일 변경에 반응해 재실행되지
  않으므로, 토글 시점에 **이미 열려 있던 창**의 제목은 새로고침(창을 닫았다 다시 열기)해야
  갱신된다. 도크 아이콘 tooltip·모바일 탭 라벨·"더보기" 목록 등 레지스트리를 직접 읽는 나머지
  전부는 즉시 갱신된다. 이 정도면 "언어 토글로 en 전환 동작"이라는 완료 조건을 충분히
  시연 가능하다고 판단했다 — 완벽한 실시간 반영이 필요해지면 후속 항목에서 `Window.tsx`가
  레지스트리 변경에도 구독하도록 확장하면 된다.

- **언어 토글 UI 라벨은 "한국어/English" 대신 ASCII 로케일 코드("KO"/"EN")로 표시**했다(데스크톱
  Dock 하단, 모바일 "더보기" 상단). 언어 이름 자체를 사전 키로 넣을지(둘 다 같은 표기라 무의미)
  아니면 하드코딩 한글 리터럴로 둘지(린트 위반) 애매했는데, ASCII 코드로 표시하면 두 문제 모두
  피할 수 있고 어차피 지구본 아이콘 같은 명확한 언어 선택기 관례상 코드 표기도 흔하다.

- **학생 표면(`src/student/**`) 언어 토글(지구본 아이콘)은 이번 항목에서 만들지 않았다** — todo가
  명시적으로 "student-surface toggle... explicitly scoped to a LATER todo item (09)"라고 못 박았기
  때문. `t()`/`setLocale`/`getLocale`은 이미 범용 유틸로 분리돼 있어 09번 항목이 학생 표면에
  토글 버튼만 얹으면 되도록(shells에 강결합 없이) 만들어 뒀다.

- **번들 예산 스크립트의 "work" 수치는 desktop·mobile 두 흐름 중 더 큰 쪽을 채택**한다.
  `boot.tsx`가 부팅 시 둘 중 하나만 고르므로(FRONTEND.md "셸은 부팅 시 하나만 선택") 실제 사용자는
  둘 중 하나만 받지만, CI 예산 게이트는 더 나쁜 경우를 기준으로 통과/실패를 판정해야 안전하다고
  판단했다. 두 흐름의 gzip 합계를 각각 출력해 todo/07("번들 예산 실측 기록")이 참조할 수 있게 했다.

- **`check-bundle-size.mjs`의 gzip 크기는 Node `zlib.gzipSync` 기본 압축 레벨** 기준이다. 실제
  GitHub Pages(정적 호스팅)의 서버 gzip/brotli 레벨과 정확히 같지 않을 수 있지만, 이 프로젝트
  전반의 "gzip 크기" 규약(FRONTEND.md 성능 예산 문구 자체가 특정 레벨을 지정하지 않음)과 업계
  관행(`gzip-size` 등 유사 도구도 동일하게 기본 레벨 사용)에 부합하는 합리적 근사치로 판단했다.

- **`registry.ts`의 `title` 필드는 마이그레이션 범위에 포함**시켰다(todo가 "your judgement"로
  위임한 항목). 도크 tooltip·탭 라벨·창 타이틀바에 실제로 렌더되는 UI 문자열이라 범위에서
  제외할 이유가 없다고 판단했다.

## todo/03 · 카메라 온디맨드 (2026-07-15)

- **모바일 "탭 진입 시 시작 버튼"은 셸 레벨 오버레이가 아니라, 데스크톱 "뷰 버튼"과 같은
  `components/ScanCameraStart.tsx` 컴포넌트를 뷰 파일(loan-return/inventory/register) 안에
  한 번만 심는 방식으로 통합**했다. 처음엔 MobileShell.tsx가 `.m-shell-main` 위에 오버레이를
  직접 렌더하는 안을 검토했지만, StackNav의 push 오버레이(`.m-stack-overlay`, `position:absolute;
  inset:0; z-index:20`)가 스택 화면(예: 더보기→장서 점검)일 때 `.m-shell-main` 전체를 덮어버려서
  그 안에 있는 셸 레벨 오버레이가 안 보이게 되는 문제가 있었다. FRONTEND.md의 "같은 뷰 파일이 두
  셸에서 렌더" 원칙을 이용해 뷰 안에 버튼을 심으면 데스크톱 창이든 모바일 탭이든 스택 push
  화면이든 항상 그 뷰와 같은 DOM 위치에 나타나 z-index 경합이 원천적으로 없다. 데스크톱
  ScannerDockWidget(위젯 클릭)과 DesktopShell의 단축키 S는 이 컴포넌트와 무관하게 별도 트리거로
  구현했다 — "위젯/뷰 버튼/단축키 S" 셋이 서로 다른 코드 경로임을 유지하기 위해서다.

- **연속 모드 핀은 `stop()`(수동 종료·모바일 이탈)을 막지 않는다** — `cameraSession.stop()`은
  `continuous` 값과 무관하게 항상 즉시 끈다. 연속 모드가 막는 건 오직 "유휴 3분 자동 종료"
  타이머뿐이다. ADR-020 문구("모바일 = ... 이탈 시 종료")가 예외 없이 "이탈 시"라고 못박았고,
  위젯의 수동 종료 버튼도 사용자가 명시적으로 누른 행동이라 핀 여부와 무관하게 존중해야 한다고
  판단했다. 또한 **연속 모드 핀 상태 자체는 `stop()`/`start()` 사이클을 넘어 유지**된다(껐다 다시
  켜도 핀은 그대로) — 사용자가 명시적으로 체크박스를 풀기 전까진 "이번 세션 내내 연속" 의도로
  해석했다.

- **데스크톱 단축키 S는 (시작 전용이 아니라) 토글**로 구현했다(꺼져 있으면 켜고, 켜져 있으면
  끈다). todo 원문이 "calls cameraSession.start()/toggles it"로 둘 다 허용했고, 토글 쪽이 위젯의
  수동 종료 버튼과 기능이 중복되지 않으면서 단축키 하나로 켜고 끄는 자연스러운 UX라고 판단했다.
  가드는 `e.metaKey/ctrlKey/altKey`가 눌려 있거나 `document.activeElement`/이벤트 타깃이
  input·textarea·contenteditable일 때 무시하도록 했다(폼 입력 중 'S' 타이핑을 가로채지 않기 위해).

- **`register.tsx`의 기존 `scanHint`("스캐너가 활성화되어 있습니다...") 문구를 카메라 상태와
  무관하게 항상 참인 문장**("카메라가 켜져 있으면 ISBN 바코드를 스캔하세요")으로 바꿨다.
  `cameraSession` 상태를 이 뷰에서 또 한 번 구독해 조건부로 문구를 바꾸는 대신(그 로직은 이미
  `ScanCameraStart` 안에 있다), 문구 자체를 상태 독립적으로 만들어 중복 구독을 피했다.

- **`camera.*` i18n 키는 `views/register.*`·`shell.desktop.*`처럼 화면별로 쪼개지 않고 최상위
  `camera` 네임스페이스 하나로 모았다** — 위젯(shells/desktop)·뷰 버튼(components, 3개 뷰에서
  재사용)·모바일 더보기(shells/mobile)가 전부 같은 문구("카메라 시작"·"연속 모드" 등)를 공유해야
  해서, 셸/뷰별로 흩어놓으면 같은 뜻의 키가 3~4벌 중복될 뻔했다.

## todo/04 · 대시보드 기저층 (2026-07-15)

- **KPI 6칸 매핑과 "3개 데이터 없는 개념"** — FRONTEND.md 원문("오늘 카드 6종: 대출·반납·대출중·
  연체·예약대기·분실")이 가리키는 "오늘 대출 건수"·"오늘 반납 건수"·"분실 권수"는
  `getDashboardData_()`의 `stats` 객체(`activeTitles, availableCopies, openLoans, dueToday,
  overdue, activeReservations, activeMembers` 7개)에 대응 필드가 없다. 새 필드를 추가하려면
  보호 대상인 `getDashboardData_`를 고쳐야 해서(절대 규칙 위반) 대신 실제 있는 7개 중 6개를
  정직한 라벨로 채웠다: **대출중**(openLoans)·**오늘 반납 예정**(dueToday — "오늘 반납 완료
  건수"가 아니라 "오늘이 반납 기한인 미반납 건수"라는 뜻을 라벨에 그대로 반영)·**가용
  소장본**(availableCopies)·**예약 대기**(activeReservations)·**활성 회원**(activeMembers)·
  **연체**(overdue). **`activeTitles`(활성 서명)는 6칸에서 제외**했다 — 하루 운영 관점에서
  "지금 당장 무엇을 해야 하는가"에 덜 직결되는 장서 규모 통계라, 카탈로그/리포트 쪽에서 다루는
  게 더 적합하다고 판단했다. 6칸의 좌측 강조색은 DESIGN.md의 고정 범주 순서
  (deep·brass·pass·wait·ink-2·fail)를 그대로, 순서대로 적용했다(대출중=deep, 오늘 반납
  예정=brass, 가용 소장본=pass, 예약 대기=wait, 활성 회원=ink-2, 연체=fail) — 차트 전용
  규칙이지만 "임의 색 금지" 원칙을 지키면서 6개에 색을 배정할 별도 규칙을 새로 만들지 않기
  위해 재사용했다.

- **"마지막 백업"은 실제 데이터가 없어 "데이터 없음" 문구로 정직하게 표시**하고 생략하지
  않았다 — FRONTEND.md가 대시보드 구성 5요소 중 하나로 명시했으므로 자리 자체는 유지하되,
  `refreshedAt`(API 재조회 시각)을 "마지막 백업"인 것처럼 재라벨링하면 실제로 일어나지 않은
  백업 이벤트를 암시하는 거짓 정보가 된다고 판단했다. `refreshedAt`은 헤더의 "최근 갱신"에만
  쓴다. 백업 타임스탬프를 실제로 노출하려면 백엔드에 그 값을 반환하는 필드가 추가돼야 한다
  (역시 `getDashboardData_` 수정 필요 — 이번 범위 밖).

- **「조용한 신호」 5개 리포트의 `reportType` 문자열**(`no-loan-finder`·`homeroom-report`·
  `weeding-recommend`·`recall-notice`·`donor-thanks`)은 **잠정 식별자**다. FEATURES.md R1이
  기능 이름만 한글로 정의했고 리포트 종류 코드 자체는 아직 어디에도 확정돼 있지 않아서, `reports`
  뷰가 `params.type`으로 구분할 수 있도록 영문 kebab-case 코드를 새로 만들었다. todo/05(리포트
  허브 구현)가 실제 리포트 타입 enum을 정할 때 이 문자열들을 그대로 채택하거나 자유롭게
  바꿔도 된다 — 지금은 플레이스홀더 뷰가 그대로 받아 표시만 하므로 바꿔도 파급 효과가 없다.

- **`reports` 뷰는 이번 항목에서 라우팅 골격만** 만들었다(레지스트리 엔트리 + lazy import +
  "다음 항목에서 구현됩니다" 스텁, `recent-ops`/`inventory` 스텁과 동일 패턴). FEATURES.md가
  "구현 형태: 레지스트리에 `reports` 뷰 1개"라고 못박았고, 실제 종류 선택→미리보기→인쇄는
  todo/05 몫이라 여기서 앞서 만들지 않았다 — 「조용한 신호」 버튼이 죽은 버튼이 되지 않도록
  최소한만 만든 것이다.

- **「최근 처리」 패널은 재구현하지 않고 `recent-ops` 창으로 링크만** 했다. `recent-ops/index.tsx`
  자체가 아직 스텁("완전 구현은 이후 라운드")이라 재사용할 실제 로직이 없었다 — 지금 로직을
  복제하면 나중에 두 곳을 따로 고쳐야 하는 중복만 남긴다고 판단했다.

- **`dashboardData` 서비스의 갱신 트리거 통합 지점을 `ensureAutoRefresh()` 하나로 합쳤다** —
  호출될 때마다 즉시 1회 조회 + (최초 호출에서만) 5분 인터벌·`dataChangeBus` 구독을 등록한다.
  데스크톱 기저층은 셸 부팅 시 1회만 마운트되므로 "진입 시 갱신"이 곧 1회 호출로 끝나고, 모바일
  "더보기" 화면은 `MobileShell`이 탭을 조건부 렌더라 진입할 때마다 새로 마운트돼 같은 함수
  호출만으로 "더보기 진입마다 갱신"까지 자연히 만족된다 — 두 플랫폼이 서로 다른 마운트 수명을
  가져도 셸 쪽에 특별한 분기 없이 서비스 쪽 가드(인터벌·구독은 idempotent, 조회는 매번) 하나로
  해결했다.

- **UNKNOWN_ACTION과 그 외 오류를 명확히 분리**했다 — `dashboardData.refresh()`는
  `UNKNOWN_ACTION`만 "샘플 폴백"(정상 상태, 배지만 표시)으로 취급하고, 네트워크·타임아웃 등
  나머지 오류는 `error` 필드에 원문 그대로 담아 `dash-error` 배너로 노출한다(마지막으로
  성공했던 데이터는 지우지 않는다). CLAUDE.md 검증 원칙 "가짜 성공 금지(샘플 배지)"를 그대로
  따른 것 — "백엔드가 이 액션을 아직 모름"과 "백엔드가 죽었음"을 같은 화면 신호로 뭉개지 않는다.

## todo/05 · 리포트 R1 (2026-07-15)

- **R1-1 미대출 학생 발굴의 `sinceDate` 기본값 = "최근 3개월"(오늘 - 90일)**로 임의 지정했다
  (`reportNoLoanFinder_`, Code.gs). FEATURES.md는 "기간 내 대출 0회"라고만 쓰고 정확한 창을
  못박지 않았다 — 학기 시작일 같은 학사력 개념은 CONFIG 시트에 없어(getConfig_로 조회 가능한
  키가 없음) 새 설정을 만들려면 CONFIG 스키마를 건드려야 하는데(보호 대상은 아니지만 이번
  스코프 밖), 대신 호출측이 `payload.sinceDate`로 언제든 덮어쓸 수 있게 열어뒀다. 웹앱 폼도
  "이 날짜 이후"를 직접 입력하는 선택형 필드로 노출한다(비워두면 서버 기본값 적용).

- **R1-2 담임 리포트의 `grade`/`classNo`/`month`는 전부 사용자가 폼에 입력**한다 — 서버는
  셋 다 필수로 검증하고(`VALIDATION_ERROR`), "이 사서가 몇 학년 몇 반 담당인지" 같은 매핑은
  MEMBERS/STAFF 스키마 어디에도 없어 자동 추론할 근거가 없다. 프론트는 `month`만 "이번 달"로
  기본값을 채우고(화면 진입 시점 로컬 날짜 기준, `new Date()`) `grade`/`classNo`는 1/1로 시작
  — 실제 의미 없는 placeholder이며 사서가 매번 바꿔 입력해야 한다.

- **인쇄 머리의 "OO학교 도서관 시스템" 셋째 칸을 학교명 반복 없이 고정 브랜드 문구로
  렌더**했다(`components/PrintDocument.tsx`). DESIGN.md 원문은 "학교명 · 생성일 ·
  'OO학교 도서관 시스템'" 세 조각을 나열하는데, 첫 칸에 이미 `libraryName`(예:
  `getConfig_('LIBRARY_NAME', ...)`가 이미 "OO초등학교 도서관"처럼 "도서관"을 포함해 내려올
  수도 있음)을 보여주므로 셋째 칸에서 또 이어붙이면 "OO초등학교 도서관 OO초등학교 도서관
  시스템"처럼 중복될 위험이 있었다. 대신 셋째 칸은 `t('print.systemBrand')`(고정 "도서관
  시스템")만 적어 정보는 그대로 다 나오되 중복은 피했다.

- **인쇄 페이지 번호는 실제 쪽수 계산에 기대지 않고 `position:fixed` 꼬리 + Chrome 전용
  `@page{@bottom-center}` 점진적 향상으로 절충**했다(`styles/print.css`). CSS Paged Media의
  `@page` 여백 상자(`counter(page)`)는 브라우저 지원이 들쭉날쭉(Firefox·Safari는 사실상
  미지원)이라 신뢰할 수 없다 — 대신 항상 나타나는 `<footer>` 엘리먼트(학교명·브랜드 문구)를
  기본으로 깔고, Chrome 계열에서만 실제 쪽수가 얹히는 방식을 추가 향상으로 얹었다. 매 페이지
  "반복" 여부까지는 브라우저마다 보장되지 않지만, 리포트가 대부분 A4 1장 전제(R1-2)이거나
  분량이 예측 가능한 명단(R1-1)이라 치명적이지 않다고 판단했다.

- **`ShellContext`에 `print(): void`를 추가**했다(`types.ts`). views/**는 `window.print()`를
  직접 부를 수 없다(check-view-boundary.mjs·eslint 규칙) — "함부로 넓히지 않는다"는 이
  인터페이스의 원칙에 따라 스타일시트 선택 같은 옵션 없이 인자 없는 트리거 한 줄만 추가했다.
  데스크톱(`Window.tsx`)·모바일(`MobileShell.tsx`의 tabShell, `StackNav.tsx`) 세 곳 모두
  구현이 필요했다(각자 자기 ShellContext 객체를 따로 만든다, 기존 구조 그대로).

- **"오직 리포트만 인쇄"는 `visibility` 뒤집기 기법 + 데스크톱 전용 표식 클래스로 구현**했다
  (`styles/print.css`, 상세 사유는 그 파일 맨 위 주석). 요약: (1) `body *`를 전부
  `visibility:hidden`(display:none이 아님 — 자손만 다시 보이게 할 방법이 없어서), (2)
  `.print-root`(`PrintDocument.tsx`)와 그 자손만 `visibility:visible`로 복귀, (3) 데스크톱
  창(`.window`)은 고정 px + `overflow:hidden`이라 인쇄 버튼을 누른 창에만 `Window.tsx`가
  `.is-print-target` 표식을 붙이고(`afterprint`에서 제거) 그 조상 체인만
  `position:static`·`overflow:visible`·크기 `auto`로 풀어준다 — 안 그러면 리포트가 창 한
  칸 크기(예: 560×520px)로 잘린다. 표식 없는 다른 창은 원래 `absolute`+화면 밖이라 손댈
  필요조차 없다. (4) 모바일은 뷰가 한 번에 하나만 마운트되므로(StackNav 스택 최상단 1개,
  탭 1개) 표식 없이 셸 조상을 그냥 항상 풀어준다 — 단 이 전제는 "인쇄 가능한 뷰 = 탭 매핑이
  없는 push 전용 뷰"일 때만 성립한다(`reports`가 그렇다). 훗날 인쇄 가능한 뷰가 탭에도
  매핑되면 이 전제를 다시 봐야 한다.

- **`views/reports/index.tsx`의 리포트 종류 5개는 todo/04가 잠정 지정한 `reportType` 문자열과
  라벨 키(`dashboard.quietSignal.*`)를 그대로 재사용**했다(DESIGN.md "같은 행동 같은 이름
  관통"). 미구현 3종(죽은 장서·회수 쪽지·기증 감사장)은 선택 시 "다음 항목에서 구현됩니다"
  플레이스홀더만 보여주고 실제 로직은 만들지 않았다(todo/09 몫) — 가짜 리포트를 만들지 않는다.

- **`i18n/{ko,en}.json`의 `views.reports.requestedType` 키를 제거**했다 — todo/04 스텁이
  디버그 표시용으로 쓰던 키인데, 이번 항목이 스텁을 실제 허브로 교체하면서 더 이상 쓰이지
  않는다(허브가 `params.type`을 직접 선반영하지, 문자열로 되돌려 보여주지 않는다). `comingSoon`
  키는 텍스트만 "허브 자체가 미구현"에서 "이 리포트 종류가 미구현"으로 좁혀 재사용했다.

## todo/06 · 시각화 V1 (2026-07-15)

- **`VIZ_CACHE` 시트 번호 = `20_VIZ_CACHE`**로 정했다 — `LIBRARY_MVP.SHEETS`의 기존 번호 접두사가
  01~19·21까지 채워져 있고 `20`만 비어 있었다(`21_BOOK_CACHE`가 마지막).

- **20_VIZ_CACHE는 "당일 재계산 가능한 파생 캐시"로 취급해 매일 4행을 지우고 다시 쓴다**
  (`runVizDailyBatch_`, Code.gs). CLAUDE.md 절대 규칙 6번("행 삭제 금지 — 상태 코드로")·ADR-012는
  대출·회원·감사 로그처럼 감사·법적 근거가 있는 업무 원장에 적용되는 규칙이고, 언제든 원장에서
  다시 계산해낼 수 있는 읽기 전용 요약 캐시에는 해당하지 않는다고 판단했다 — 원장 자체의 행은
  하나도 지우지 않으며, 이 배치는 `executeWrite_`/`checkout_`/`return_` 같은 보호된 업무
  트랜잭션 경로도 거치지 않는다(순수 캐시 유지보수). Code.gs에도 같은 근거를 주석으로 남겼다.

- **연도 아카이브 LOANS 시트가 아직 없다** — `computeLoanHeatmapViz_`는 `LIBRARY_MVP.SHEETS`에
  아카이브 패턴(예: `LOANS_2025` 같은 키)이 없는 것을 확인하고 현재 살아 있는 `10_LOANS` 한
  시트만 훑는다. 대출 이력이 몇 년 쌓여 `10_LOANS` 자체가 아주 커지면(수만 행) 이 함수의
  선형 스캔 비용이 늘어난다 — 아카이브 정책이 생기면 이 함수도 "올해분 + 필요시 최근 아카이브
  1개" 정도로 확장해야 한다.

- **트리맵 집계에서 서명 하나는 "대표 카테고리" 하나에만 귀속**시켰다(`computeCategoryTreemapViz_`).
  `07_TITLE_CATEGORIES`는 서명 하나가 여러 카테고리에 걸칠 수 있게 해 두지만, 트리맵은 면적의
  합이 전체와 맞아야 의미가 있어 중복 계상을 피해야 한다. `is_primary`가 있으면 그 카테고리를,
  없으면 처음 매핑된 카테고리를 쓴다. 비활성 카테고리(`status_code !== 'ACTIVE'`)로만 연결된
  서명은 어느 분야에도 잡히지 않는다(트리맵에서 조용히 빠짐 — 별도 "미분류" 칸은 만들지 않았다).

- **회전율 사분면은 (대출횟수 버킷 6단) × (입수경과 버킷 5단) = 최대 30칸 히스토그램으로
  집계**해 GAS 셀 용량(~50KB)을 절대 위협하지 않게 했다(`computeTurnoverQuadrantViz_`,
  `VIZ_TURNOVER_LOAN_BUCKETS_`/`VIZ_TURNOVER_AGE_BUCKETS_DAYS_`). 소장본 개별 좌표는 내려주지
  않는다 — 5,000권이든 5만 권이든 페이로드 크기가 똑같다. 대신 프론트(`TurnoverQuadrant.tsx`)는
  각 칸을 버킷 중심의 버블(반지름 ∝ √count)로 그린다. `acquired_at`이 비어 있는 소장본은
  집계에서 제외하고 개수만 `skippedNoAcquiredDate`로 함께 내려 화면에 각주로 표시한다.

- **"스타/신참/잠자는/죽은" 4분류 경계는 VIZ.md에 정의가 없어 프론트에서 임의 지정**했다
  (`TurnoverQuadrant.tsx`의 `quadrantFor`): 입수 1년 미만(ageBucketIndex ≤ 1)은 "젊음", 그
  이상은 "오래됨"으로 나누고, 젊은 쪽은 대출 3회 이상(loanBucketIndex ≥ 3)이면 스타·아니면
  신참, 오래된 쪽은 대출 0회면 죽은·아니면 잠자는으로 분류했다. 4개 범주 색은 DESIGN.md
  범주 고정 순서(deep·brass·pass·wait·ink-2·fail)에서 앞 4개를 정의 순서대로 배정했다
  (스타=deep, 신참=brass, 잠자는=pass, 죽은=wait) — 순서가 고정이라는 규칙을 지키다 보니
  "잠자는=pass(녹색 계열)"처럼 신호등 직관과는 살짝 어긋나는 배정이 생겼지만, "차트마다 색
  의미가 흔들리지 않게"라는 규칙의 취지(위치별 고정 배정)를 우선했다.

- **대출 잔디(`LoanHeatmap.tsx`)는 행동 버튼을 달지 않았다** — "언제 붐비나"는 순수 관찰용
  질문이라 이 항목 범위 안에 자연스러운 이동 목적지가 없다(과거 근무 배치 화면 등은 아직 없음).
  task 노트가 명시적으로 허용한 예외를 그대로 따랐다.

- **트리맵·사분면의 행동 버튼은 둘 다 미구현 상태인 `weeding-recommend` 리포트로 연결**했다
  (`onNavigate('reports', { type: 'weeding-recommend' })`). 이 리포트 본문은 아직
  없지만(todo/09 몫) `views/reports/index.tsx`의 `REPORT_TYPES`에 `implemented:false`로 이미
  등록되어 있어 실제로 열리는(placeholder를 보여주는) 경로다 — 죽은 링크가 아니라 "여기서 곧
  구현될 예정" 화면으로 도착한다.

- **예약 압력의 행동 버튼은 대기 인원 1위 서명의 `book-detail` 뷰로 연결**했다
  (`onNavigate('book-detail', { titleId })`). `views/book-detail/index.tsx`가 아직 스텁이라
  실제 서지 조회는 보여주지 못하지만(todo 후속 몫) 파라미터 계약(`titleId`)은 이미 그 스텁이
  받는 모양과 일치한다.

- **리포트 허브의 6번째 카드("장서 시각화")는 `REPORT_TYPES` 배열에 섞지 않고 별도
  `viz-insights` 식별자로 분리**했다(`views/reports/index.tsx`). `report` 액션의 `type`
  파라미터(`ReportTypeId`)와 `viz` 액션의 `type`(`VizType`)은 이름 공간이 다른 별개 계약이라
  섞으면 오해를 부른다 — 리포트인 척하지 않는 명확히 다른 화면으로 분리했다.

- **대시보드 착륙 지점 = 대출 잔디 + 예약 압력, 리포트 허브 착륙 지점 = 트리맵 + 사분면**으로
  나눴다(task 노트의 제안을 그대로 채택). 전자 둘은 "매일 훑어보는 운영 신호"에 가깝고, 후자
  둘은 "가끔 들여다보는 의사결정 자료"에 가까워 리포트 허브의 "허브 진입" 카드로 두는 편이
  자연스럽다고 판단했다.

- **`tokens/work.css`/`student.css`에 `--viz-seq-1~5`(순차)·`--viz-div-1~5`(발산) 5단 램프를
  새로 추가**했다 — DESIGN.md는 순차 램프 변수명(`--viz-seq-1~5`)만 명시하고 발산 램프는
  "fail↔paper↔pass"라는 끝점만 설명해 변수명을 정하지 않았으므로, 순차와 대칭적인 5단
  구조(`--viz-div-1`=fail, `--viz-div-3`=paper·중립, `--viz-div-5`=pass)로 이름 붙였다. 값은
  각 스킨의 기존 `paper`/`deep`/`fail`/`pass` 리터럴을 선형 RGB 보간해 두 파일에만 hex로
  박아뒀다(DESIGN.md "색상 리터럴은 tokens/ 두 파일에만 존재"). 범주(≤6) 램프는 새 변수를
  만들지 않고 기존 `--deep`/`--brass`/`--pass`/`--wait`/`--ink-2`/`--fail`을 그 순서 그대로
  참조하는 방식으로 썼다(DashboardBaseLayer.tsx의 KPI 카드 6종이 이미 쓰던 관례와 동일).

- **DESIGN.md가 "추가"라고 적어 둔 간격 토큰(`--sp-1~8`)은 `tokens/*.css` 어디에도 실제
  정의돼 있지 않다** — 기존 gap임(todo/06 범위 밖). `src/viz/viz.css`는 이 토큰을 새로
  도입하지 않고 `dashboard.css`/`reports.css`가 이미 쓰는 대로 일반 px 리터럴을 그대로
  썼다(레이아웃 여백이며 DESIGN.md가 명시적으로 색 금지 대상으로 예시를 든 곳은 아니다) —
  간격 토큰 정의 자체는 이번 항목의 스코프가 아니라고 판단해 손대지 않았다.

- **트리맵 레이아웃은 완전한 squarify 알고리즘 대신 "누적합 절반 분할" slice-and-dice
  변형**을 썼다(`layoutTreemap`, `CategoryTreemap.tsx`) — 카테고리가 최대 몇십 개 수준이라
  packing 품질보다 구현 단순성·예측 가능성을 우선했다. aspect ratio가 극단적으로 나쁜 사각형이
  생길 수 있지만 각 사각형에 `<title>` 툴팁 + sr-only 표로 정확한 값을 항상 확인할 수 있다.

- **예약 압력의 추이(trend)는 최근 6주를 7일 창 단위로 집계**했다
  (`computeReservationPressureViz_`, `VIZ_RESERVATION_TREND_WINDOWS_`/`_WINDOW_DAYS_`). VIZ.md는
  "대기열 추이"라고만 쓰고 구간 길이를 명시하지 않아 스파크라인이 읽기 좋은 정도(6개 점)로
  임의 지정했다. 대기열이 있는 서명이 50개를 넘으면 `VIZ_RESERVATION_MAX_TITLES_`로 상위
  50개만 내려준다(대기 인원 내림차순).

## todo/08 · 장서 대장 + 공용 DataTable (2026-07-15)

- **카탈로그 IndexedDB 미러를 COPY 단위(1행 = 소장본 1건)로 재설계**했다 — v1 스텁은
  title 중심(`copies` 중첩 배열)이었지만, FRONTEND.md의 catalog 열 목록(등록번호·서명·저자·
  분류·상태·대출횟수·최근대출·서가·입수일)에서 barcode·상태·서가·입수일이 전부 소장본
  단위 값이라 title 중심 구조로는 표현할 수 없다. `services/catalog.ts`의 `CatalogCopyRow`가
  제목·저자·분류를 이미 조인해서 펼쳐 넣은 평면 구조다. IndexedDB 스토어 이름도 `titles` →
  `copies`로 바뀌어 `DB_VERSION`을 1→2로 올렸다(`onupgradeneeded`에서 구 스토어를 지운다 —
  재동기화로 복구되는 캐시일 뿐이므로 안전).

- **서버 동기화 액션 이름을 `syncCatalog`(v1 스텁 표기)에서 `catalogSync`로 확정**했다 —
  ADR-024 원문이 정확히 이 이름("catalogSync 청크 동기화")을 쓰고 있어 그대로 따랐다.

- **델타 커서는 새 `catalogVersion` 카운터를 만들지 않고 기존 `TITLES`/`COPIES`의
  `updated_at` 컬럼을 그대로 썼다** — task 노트가 명시한 대로 HEADERS 배열에 이미 있는
  컬럼이라 스키마 변경이 필요 없었다. 클라이언트는 자기 시계가 아니라 서버 응답의
  `serverTime`을 다음 호출의 `afterUpdatedAt`으로 그대로 돌려보낸다(클럭 스큐로 인한 델타
  누락 방지) — 이 값은 IndexedDB `meta` 스토어에 저장하고 localStorage는 쓰지 않았다(이미
  열려 있는 같은 DB 커넥션에 커서를 같이 두는 편이 저장소 종류를 하나 더 늘리는 것보다
  단순하다고 판단).

- **`apiWebCatalogSync_`가 응답에 `totalCopies`(COPIES 시트 전체 행 수)를 추가로 얹었다** —
  todo 노트의 "동기화 중… N/5000" 예시 진행률 표시를 실제로 구현하려면 전체 개수가 필요한데,
  서버가 이미 COPIES 테이블을 읽고 있으므로 `.rows.length`를 얹는 데 추가 비용이 거의 없다.
  이 필드는 ADR-024가 요구하는 최소 응답 계약(`rows`·`hasMore`·`serverTime`)에 더해진 것일 뿐
  다른 의미를 갖지 않는다.

- **catalog 열의 "상태"는 서버가 라벨을 만들어 내려주지 않고 원본 status_code
  문자열(`AVAILABLE`/`ON_LOAN`/…)을 그대로 돌려주고, 프런트(`views/catalog/index.tsx`의
  `STATUS_LABEL_KEYS`)가 i18n으로 매핑**한다 — `loan-return`(`apiCopyStatus_`)·`10_LOANS`
  등 기존 웹앱 액션도 전부 이 방식(원본 코드 반환 + 프론트 매핑)이라 CODEBOOK 조인을 서버에
  새로 추가하지 않고 기존 관례를 따랐다.

- **catalog 뷰 아이콘은 `Library`(lucide-react)를 선택**했다 — task 노트가 제안한 `Library`/
  `BookMarked` 중 `BookMarked`는 이미 `student/my-shelf`(다른 번들, 다른 표면)에서 쓰이고
  있어 헷갈리지 않지만, 완전히 새 아이콘을 쓰는 편이 더 명확하다고 판단했다.

- **`views/search/index.tsx`·`views/inventory/index.tsx`는 이번 항목 범위 밖으로 남겨두고
  syncCatalog를 catalogSync로 갱신하는 주석 수정만** 했다 — 두 뷰 모두 todo/08 목록에 없고
  각각 통합 검색·장서 점검이라는 별도 항목의 몫이다. 실 구현은 앞으로
  `services/catalog.ts`(useCatalogSync/getCatalogState)를 그대로 재사용하면 되도록
  주석에 남겨 뒀다.

- **`views/recent-ops/index.tsx`는 자동 갱신 싱글턴 스토어(`dashboardData.ts` 패턴) 대신
  reportData.ts류의 "열 때 한 번 조회 + 수동 새로고침" 패턴을 택했다** — 최근 처리는
  대시보드처럼 상시 응시하는 화면이 아니라 필요할 때 열어보는 목록이라 5분 자동 갱신·
  트랜잭션 후 구독까지는 과설계라고 판단했다. `apiWebRecentOps_`의 기본 한도는 100건
  (서버 상한 500건)으로, 화면은 그중 최근 100건을 DataTable로 보여주고 정렬·필터·CSV는
  전부 그 100건 안에서 로컬 처리한다.

- **담임 리포트(R1-2)의 4개 표형 목록(대출 현황·미대출 명단·연체 목록·인기책)을 DataTable로
  이관**하되, **`.print-root`/`.print-table`로 가는 인쇄 경로는 손대지 않았다** — 온스크린
  "정렬·필터 가능한 표" 구획(`no-print`, 인쇄 시 숨김)을 새로 추가하고 기존 인쇄 미리보기
  프레임은 그대로 아래에 남겨, 인쇄 결과물이 이 항목 이전과 바이트 단위로 동일하다.
  `noLoanList`는 `loanStatus`와 같은 `HomeroomLoanStatusRow` 모양이라 같은 열 정의를
  공유했다(별도 컬럼 세트를 만들지 않음 — "표 UI 중복 금지"). 반면 **R1-1(미대출 학생
  발굴)의 반별 그룹 이름 목록은 그대로 뒀다** — FEATURES.md 자신이 "숫자가 아니라 명단"이라고
  명시한 그룹핑 구조라 표 형태(행=레코드 1개)에 자연스럽게 맞지 않는다고 판단했다(task
  노트가 명시적으로 이 경계를 확인해 달라고 요청한 부분이기도 하다).

- **DataTable 자체의 내장 카피(빈/로딩/오류·페이지네이터 라벨 등)도 `t()`로 이관**했다 —
  `src/components/DataTable/**`는 `check-i18n-literals.mjs`/뷰 경계 린트의 검사 대상(`views/**·
  shells/**·student/**`)이 아니지만, task 노트가 "기존 프로젝트 관례에 맞춘다"고 명시했고
  실제로 한/영 전환 시 표 안 문자열만 한국어로 고정되는 건 이상하므로 그대로 따랐다. 새
  `components.dataTable.*` 네임스페이스를 만들어 도메인 뷰의 `views.*` 네임스페이스와
  분리했다.

- **CSV는 현재 필터·정렬이 적용된 전체 데이터셋(현재 페이지가 아니라)을 내보낸다** — task
  노트의 "currently-loaded (not just currently-visible-page) dataset" 문구를 "필터로 걸러낸
  뒤 정렬까지 반영된 전체 배열"로 해석했다. 필터를 안 걸었으면 로드된 전체(5,000행급도 포함)가
  그대로 나간다.
  50개만 내려준다(대기 인원 내림차순).

## todo/09 · R1 잔여 + en 완역 (2026-07-15)

- **R1-5 기증 감사장의 "기증자별" 그룹화는 `08_COPIES.acquisition_source` 원문 문자열을 그대로
  그룹 키로 쓴다**(`reportDonorThanks_`, Code.gs) — 08_COPIES에는 기증자 개인 식별 필드가
  없고(HEADERS 배열은 절대 규칙상 수정 금지), `acquisition_source`는 `16_CODEBOOK`에 코드군도
  없는 순수 자유 텍스트다(`registerCopy_`가 `validateCodeInput_` 없이 `safeText_`로만 저장,
  현재 웹앱 등록 화면도 이 값을 아예 입력받지 않는다). 즉 "기증자별"을 정확히 재현할 스키마
  근거가 전혀 없다 — todo/04의 KPI 매핑 갭·todo/06의 회전율 버킷 갭과 같은 범주의 "백엔드에
  필드 X가 없다, 대신 이렇게 근사한다" 판단이다. 실무 입력값이 "기증-홍길동"처럼 사람 이름을
  담고 있으면 사실상 기증자별 그룹이 되지만 "DONATION" 같은 굵은 코드면 그룹이 하나로 뭉친다
  — 이걸 감추지 않고 프론트(`views/reports/index.tsx`의 `DonorThanksPanel`)가
  `views.reports.donor.disclaimer`로 "그룹명은 실제 기증자 이름이 아니라 등록 시 입력한 입수
  경로 원문"이라는 사실을 화면·인쇄물 양쪽에 그대로 노출한다("OOO님께 감사드립니다" 같은
  확인되지 않은 인적 문구는 만들지 않았다). `acquisition_source`가 빈 소장본은 그룹화에서
  제외하고 개수를 `skippedNoSource`로 함께 내려 각주로 보여준다(VIZ.md 턴오버 사분면의
  `skippedNoAcquiredDate`와 같은 관례).

- **R1-4 회수 쪽지의 "방학 미반납"은 학사력 개념이 없어 "현재 연체 전체"로 단순화**했다
  (`reportRecallNotice_`, Code.gs) — 방학 시작·종료일 같은 학사력 설정이 `17_CONFIG`
  스키마 어디에도 없다(`getConfig_`로 조회 가능한 키 없음). 새 설정을 만들려면 CONFIG
  스키마를 건드려야 해 이번 스코프 밖이라, `LOANS.status_code === 'OPEN' && due_at < now`
  전체를 대상으로 했다. 또한 회수 쪽지는 담임 학급 배부용이라 `member_type_code === 'STUDENT'`
  (학급이 있는 재학생)만 포함하고 교직원 등은 제외했다.

- **R1-3 구매 후보(복본)의 "회전율 상위"는 예약 대기열(WAITING/READY) ÷ 현재 복본 수 비율로
  근사**했다(`reportWeedingRecommend_`, Code.gs) — FEATURES.md가 "예약 누적·회전율 상위"라고만
  쓰고 정확한 산식을 못박지 않아, "복본 1권에 대기 3명"이 "복본 10권에 대기 3명"보다 훨씬
  급하다는 직관을 살리는 비율(`ratio = queueLength / max(copyCount,1)`)로 정렬했다(단순 대기
  인원 내림차순보다 예산 배분 의사결정에 더 직접적이라고 판단). 분모(`copyCount`)는
  폐기(WITHDRAWN)·분실(LOST)을 뺀 실제 유통 중 복본 수 — 대출 중인 복본도 포함한다(대출
  중이라 대기가 생기는 것이므로 분모에서 빼면 오히려 왜곡된다). 폐기 후보 판정의 "2년"은
  FEATURES.md 원문이 그대로 명시한 값(`WEEDING_MIN_AGE_YEARS_ = 2`)이라 임의 지정이 아니다.

- **R1-4 회수 쪽지의 "한 반이 한 열" 절취 인쇄는 한 줄에 3개 열(`.print-recall-slip`
  `width: 33.333%`)로 고정**했다(`styles/print.css`) — DESIGN.md는 "절취선(dashed) + 한 반이
  한 열"이라고만 쓰고 한 줄에 몇 개 열을 둘지는 명시하지 않아, A4 세로 여백(14mm) 안에서
  번호·이름·책 제목·반납일이 한 줄에 읽기 편한 최소 폭 기준으로 임의 결정했다. R1-1/R1-2가
  쓰는 `.print-table`/`.print-class-group`과는 형태가 완전히 달라(다단 그리드 vs 줄글 표)
  겹쳐 쓰지 않고 `.print-recall-grid`/`.print-recall-slip` 등 새 클래스를 추가했다(이 파일
  헤더 주석이 todo/09 몫으로 예고한 그대로 — 기존 규칙은 손대지 않고 순수 추가).

- **5개 리포트 전부 "미리보기" 버튼을 눌러야 조회되는 온디맨드 방식을 유지**했다 — R1-3/4/5는
  필수 파라미터가 없어(폼 입력 없이 바로 조회 가능) 패널 마운트 시 자동 조회하는 편이 더
  매끄러울 수도 있었지만, R1-1(미대출 학생 발굴)도 이미 모든 파라미터가 선택값인데 자동
  조회를 하지 않는다 — 5종 전부 같은 상호작용 패턴을 유지하는 편이 "예상 밖 동작"을 만들지
  않는다고 판단했다(`services/reportData.ts`의 "종류+조건을 고른 다음 그때 한 번 조회"
  원칙과도 일치).

- **금액(가격 합계) 표시는 사전에 문자열을 박아 넣지 않고 `Intl.NumberFormat(intlLocaleTag(),
  { style: 'currency', currency: 'KRW' })`로 로케일에 맞춰 렌더**한다(`views/reports/index.tsx`
  `formatCurrency`) — ADR-023 "날짜·숫자는 사전에 넣지 않고 Intl.*(locale)" 원칙을 금액에도
  그대로 적용했다. 통화 코드 `KRW`는 하드코딩이지만 이 프로젝트 전체가 원화 기준 학교 예산을
  다루고 CONFIG에 통화 설정 개념 자체가 없어(다국어 통화 지원은 범위 밖) 합리적 고정값으로
  판단했다.

- **R1-3/4/5의 새 DataTable/인쇄 열 라벨은 최대한 기존 키를 재사용**했다(DESIGN.md "같은 행동
  같은 이름 관통") — 등록번호·서명·저자·서가·입수일은 `views.catalog.col.*`(todo/08 카탈로그
  열과 동일 개념), 대기 인원은 `viz.reservationPressure.colQueue`(todo/06), 복본수는
  `views.register.labelCopyCount`, 회수 쪽지의 번호·이름·책 제목·반납 예정일·연체일은 담임
  리포트(`views.reports.homeroom.*`)의 동일 개념 열을 그대로 재사용했다. 정말 새로운 개념(폐기/
  구매 후보 비율, 입수 경로, 합계 금액, 절취 안내 문구 등)만 `views.reports.weeding/recall/
  donor.*` 네임스페이스에 새 키로 추가했다.

- **학생 표면(`src/student/StudentRoot.tsx`) 언어 토글은 셸 컴포넌트가 아니라 `StudentRoot`
  자신에 직접 구현**했다 — 이 표면엔 `ShellContext`가 없어(todo/02 ASSUMPTIONS 참고) 데스크톱
  `Dock.tsx`(LocaleSwitch)·모바일 `MobileShell.tsx`(LocaleRow)와 똑같은 컴포넌트를 재사용할
  통로가 없다. `setLocale`/`getLocale`/`useLocale`은 이미 셸과 무관한 범용 함수/훅이라 여기서
  바로 호출했다. 버튼 색은 모바일 더보기의 `.m-more-locale-btn`과 같은 토큰 조합(비활성=
  paper/rule, 활성=deep/#fff)을 그대로 재사용해 표시 방식(ASCII KO/EN 코드)의 일관성을
  유지했고, 이 표면 고유 표식으로 지구본 아이콘(`lucide-react` `Globe`, size 16 — 인라인 버튼
  아이콘 관례)만 얹었다(FRONTEND.md "student 표면 상단 지구본" 문구 그대로). `student/**`는
  뷰 경계 린트 대상은 아니지만 i18n 리터럴 린트 대상이라(FRONTEND.md) 토글의 라벨은 전부
  `t()`/ASCII 코드로만 구성했다.

- **`check-i18n-completeness.mjs`는 값이 아니라 "키 존재 여부"만 양방향으로 검사**한다 —
  ko.json에만 있는 키(en 번역 누락)와 en.json에만 있는 키(안 쓰는 잔재 키) 둘 다 실패로
  잡지만, 번역 품질(예: 영어 값이 사실 한국어를 그대로 베낀 placeholder인지)까지는 기계적으로
  판별할 수 없어 자동화 범위 밖으로 뒀다 — en.json 전체(330개 키)를 사람이 직접 훑어 실제
  의미가 통하는 영어로 옮기는 작업은 이번 항목에서 수동으로 수행했다(스크립트는 회귀 방지용
  이중 방어선).

## todo/10 · i18n 부채 상환 (2026-07-15)

- **JSX 밖 한글 리터럴 검출 범위는 "toast(shell.toast/pushToast) · throw(new Error(...) 포함,
  bare throw 포함) · alert()" 세 호출 패턴으로 한정**했다(`eslint.config.js`의
  `i18nLiteralRules` 뒤쪽 6개 선택자 + `check-i18n-literals.mjs`의 `CALL_TRIGGERS`/
  `THROW_TRIGGER`). todo 원문 "toast·throw·alert 인자 등"의 "등"을 "화면에 그대로 노출되는
  다른 함수 호출까지 무한정 확장"으로 읽지 않고 이 세 가지로 좁혔다 — 임의의 문자열 리터럴을
  전부 막는 규칙("no string literals anywhere")은 오탐이 너무 많아진다는 todo 본문의 명시적
  경고를 따른 것. **`console.error`/`console.warn`/`console.log`는 별도의 "허용목록" 코드 없이
  구조적으로 제외**된다 — 새 선택자/트리거가 애초에 콜백 이름을 `toast`/`pushToast`/`alert`
  또는 `throw` 키워드로만 좁혀서 짚기 때문에, 콘솔 호출(`callee.property.name === 'error'`
  등)은 매칭 대상 자체에 들어오지 않는다. 검증: 스크래치 파일에 `shell.toast('한글')`·
  `pushToast('한글')`·`throw new Error('한글')`·`throw '한글'`·`alert('한글')` 5종을 넣고
  eslint(`no-restricted-syntax`)·`check-i18n-literals.mjs` 둘 다 5건 전부 잡는 것을 확인했고,
  같은 파일의 `console.error('한글')`는 둘 다 잡지 않는 것도 함께 확인한 뒤 파일을 삭제해
  되돌렸다(최종 diff에 남지 않음).

- **`check-i18n-literals.mjs`의 호출-인자 검사는 정규식 하나로 "인자 문자열이 어디 있는지"를
  정확히 파싱하지 않고, 트리거(`.toast(`/`pushToast(`/`alert(`/`throw`) 다음 지점부터
  depth-aware(괄호·대괄호·중괄호 + quote-aware)로 statement 끝까지 잘라낸 뒤 그 구간 안
  어디든 한글이 든 따옴표/템플릿 리터럴이 있으면 위반으로 잡는 방식(`scanStatementSpan` +
  `QUOTED_HANGUL`)으로 구현**했다 — eslint 쪽 `CallExpression[...] Literal[...]`/
  `ThrowStatement Literal[...]`가 자손 전체를 보는 것(첫 번째 인자든 `new Error(...)`처럼
  한 겹 더 감싸져 있든 다 잡음)과 동치가 되도록 맞춘 것이다. 대신 이론적으로 그 statement
  안에 중첩된, 실제로는 무관한 콜백의 한글 리터럴(예: `shell.toast(process(() => { ... }))`
  형태의 아주 드문 코드)까지 같이 잡힐 수 있는 과탐 여지가 있다 — 이 프로젝트의 실제 호출
  스타일(토스트 인자는 항상 그 자리에서 조립되는 문자열/템플릿)에서는 발생하지 않는 패턴이라
  감수할 만한 트레이드오프로 판단했다.

- **`Window.tsx`가 로케일 변경(`subscribeLocale`)을 구독해 열린 창의 타이틀바를 "기본 제목"
  일 때만 즉시 갱신**하도록 만들었다(ASSUMPTIONS todo/02가 명시한 "알려진 한계" 해소).
  판별 방법: `shell.setTitle(next)`가 호출될 때마다 그 시점의 `getViewMeta(viewId)?.title`
  (레지스트리 기본값)과 `next`를 비교해 다르면 `isCustomTitleRef.current = true`로 표시한다.
  로케일 변경 콜백은 이 플래그가 true면 아무것도 하지 않고(커스텀 제목을 건드리지 않음),
  false면 그 순간의(이미 `registry.ts`의 `subscribeLocale` 콜백이 새 언어로 mutate해 둔)
  `getViewMeta(viewId)?.title`을 다시 읽어 title state에 반영한다. **지금은 사실상 모든 뷰가
  마운트 시 `shell.setTitle(getViewMeta(id)?.title ?? t(...))`로 레지스트리 기본값을 그대로
  재확인만 하므로(book-detail도 todo/11 전까지는 스텁이라 마찬가지) 이 플래그는 지금 항상
  false로 유지되고, 열려 있는 모든 창의 타이틀바가 로케일 토글에 즉시 반응한다.**
  **todo/11(book-detail)이 알아야 할 것**: book-detail이 실제 서지 제목(예: "아몬드")으로
  `shell.setTitle("아몬드")`를 호출하는 순간 그 값은 레지스트리 기본값("도서 상세"/"Book
  Detail")과 달라지므로 `isCustomTitleRef.current`가 true가 되고, **그 뒤로는 로케일을
  토글해도 이 Window.tsx 메커니즘이 제목을 다시 건드리지 않는다** — "아몬드"라는 값 자체는
  책 제목(데이터)이라 ADR-023 "서명은 사전에 넣지 않는다" 원칙상 로케일에 따라 바뀔 이유가
  없으므로 이대로도 대부분 무해하지만, 만약 book-detail이 제목에 번역 가능한 텍스트를 덧붙이는
  형태(예: `"아몬드" + " · " + t('registry.bookDetail.title')` 같은 접미사)를 쓴다면 그
  번역 부분은 로케일 토글에 반응하지 않고 고정된 채로 남는다 — book-detail이 그런 동적 접미사를
  원한다면 자기 자신의 `useLocale()` 구독으로 로케일이 바뀔 때마다 직접 `shell.setTitle(...)`을
  다시 호출해 스스로 최신화해야 한다(그러면 그 호출도 위 판별 로직을 다시 통과해 여전히 레지스트리
  기본값과 다르므로 커스텀으로 남는다 — 문제 없음, 매번 스스로 다시 세팅하는 쪽 책임이다).

## todo/11 · book-detail 완성 (2026-07-15)

- **서지 상세 조회는 (a) catalog 미러 확장이 아니라 (b) 신규 읽기 전용 액션 `apiWebTitleDetail_`
  로 구현**했다(`school-patch-v1/Code.gs`). 미러(services/catalog.ts)는 COPY 1행 = 소장본 1건
  구조라(todo/08) TITLES 전용 서지 필드(cover_url·description·published_year 등)를 얹으면 소장본
  10권짜리 서명은 같은 값이 10번 중복 저장되고, catalog 목록 렌더엔 필요 없는 필드로 미러 크기만
  불어난다. ADR-024가 막는 건 "5,000행 목록의 서버 페이지네이션"이지 "한 건 상세 조회"가 아니라고
  판단해, book-detail은 매번 살아있는 값을 직접 읽는 왕복 1회를 택했다. 같은 이유로 각 소장본의
  현재 대출자·반납예정일도 미러의 스냅샷(statusCode)이 아니라 그때그때 10_LOANS를 조인해서
  내려준다(loan-return의 `copyStatus`와 같은 "신선도가 중요한 값은 실시간 조회" 원칙) — 소장본이
  많은 인기 서명이라도 서버가 이미 COPIES/LOANS를 한 번씩만 훑으므로 "코피당 N회 호출" 문제
  자체가 생기지 않는다(다건 조회를 뷰가 아니라 서버가 한 번에 처리).

- **`writeAudit_` 호출부를 전수 확인한 결과, LOAN 이벤트의 `entity_id`는 barcode/copy_id가
  아니라 loan_id다** — `checkout_`(CHECKOUT)만 `after_json`에 `copy_id`를 함께 남기고,
  `return_`(RETURN)·`renew_`(RENEW)·`markLoanLost_`(MARK_LOST)는 before/after JSON 어디에도
  `copy_id`가 없다. 즉 `apiWebRecentOps_`에 아무리 정교한 `entityId` 필터를 걸어도 "이 소장본이
  언제 반납/연장/분실됐는지"는 감사 로그만으로 재구성할 수 없다 — `checkout_`/`return_`은 이 항목
  수정 금지 대상이고(절대 규칙), `renew_`/`markLoanLost_`도 "이 항목에서 ONLY 사냥된 수정은
  `apiWebRecentOps_` 추가뿐"이라는 todo 본문 제약상 손댈 수 없다. 그래서 **"최근 이력"의 1차
  소스는 감사 로그가 아니라 `apiWebTitleDetail_`이 10_LOANS를 직접 훑어 만드는 `loanHistory`**
  (copy_id 컬럼을 원장이 항상 갖고 있어 완전히 정확)로 했고, `apiWebRecentOps_`의 새
  `entityId` 필터(entity_id 직접 일치 + LOAN 타입일 때 `after_json.copy_id` 매칭까지만)는
  book-detail에서 "운영 기록"이라는 이름의 **보조** 피드(등록·상태변경·CHECKOUT만 잡히는 부분
  이력)로만 쓴다 — 화면에 두 절을 분리해 두어("최근 이력" = 대출 이력 표, "운영 기록" = 감사
  로그 표) 반납 이벤트가 빠진 것처럼 보이는 오해를 만들지 않았다.

- **`apiWebRecentOps_`의 `entityId` 필터는 `cleanCode_`로 대소문자·공백을 정규화한 뒤 비교**한다
  (기존 `findCopyByKey_` 등과 동일 관례). `entityId`를 생략하면 기존 동작과 100% 동일 — 새
  파라미터 추가일 뿐 기존 정렬·상한 로직은 손대지 않았다(하위호환, todo가 사전 승인한 유일한
  기존 함수 수정).

- **21_BOOK_CACHE에서 `page_count`를 최선노력으로 곁들였다** — 03_TITLES엔 페이지수 컬럼이
  없다(HEADERS 배열 확인, `registerByIsbn_`도 같은 이유로 description에 문자열로만 보강 기록).
  새 TITLES 컬럼을 만드는 건 스키마 확장(더 큰 결정, 이번 스코프 밖)이라, 대신 이미 ISBN 조회
  캐시로 존재하는 21_BOOK_CACHE(진위 데이터 아님, 부가 캐시)에서 같은 isbn13으로 찾히는 행이
  있으면 `pageCount`를 곁들이고 없으면 빈 값 그대로 둔다 — 화면(`views/book-detail/index.tsx`)은
  빈 값을 "정보 없음"(`common.none`)으로 정직하게 표시하고 페이지수를 지어내지 않는다. 폰으로
  등록되지 않은 서명(사서가 사이드바에서 직접 입력했거나 대량 이관된 구간)은 이 캐시가 없어
  거의 항상 "정보 없음"으로 보일 것이다 — 알려진 커버리지 한계로 남겨둔다.

- **`#/w/<viewId>?<query>` 딥링크 파서를 `webapp/src/deepLink.ts`(신규, 셸 공용 최상위 모듈)에
  구현**했다 — `views/**`가 아니라 `registry.ts`/`viewResolver.ts`와 같은 급의 최상위 모듈이라
  `window.location.hash`/`window.addEventListener`를 직접 써도 check-view-boundary.mjs 대상 밖
  이다. `DesktopShell.tsx`·`MobileShell.tsx`가 각자 마운트 시 `currentWindowDeepLink()`로 초기
  해시를 확인하고 `subscribeWindowDeepLink()`로 이후 hashchange까지 구독한 뒤, 각자의 오픈
  메커니즘(`useWindowStore.openWindow` / `openFn`→탭 전환 또는 `StackNav.push`)에 연결한다 —
  파싱 로직 자체는 `deepLink.ts` 한 곳에만 있고 두 셸에 중복이 없다. 레지스트리에 없는 viewId나
  패턴이 안 맞는 해시는 조용히 무시한다(오타·구버전 링크 방어, 에러 토스트를 띄우지 않음 — 첫
  화면 진입 순간부터 방해되는 걸 피했다).

- **book-detail의 `scan`을 `'none'`에서 `'focus'`로 전환**했다(`registry.ts`). 이전엔 `Window.tsx`
  의 핀 버튼조차 `meta?.scan === 'focus'`에서만 렌더돼 book-detail은 핀이 아예 불가능했다 —
  FRONTEND.md "진입: ... 스캔(핀 시)" 완료 조건이 이 전환을 요구한다. **스캔이 들어왔을 때
  갱신 방식은 `shell.open('book-detail', 새params)`(새 창을 여는 API)이 아니라 뷰 내부
  `useState`를 바꾸는 방식**을 택했다 — book-detail은 `desktop.single`이 아니므로(카탈로그
  여러 책을 나란히 비교하는 용도를 남겨두려고 이번 항목에서 `single`을 추가하지 않았다)
  `shell.open`을 쓰면 스캔할 때마다 새 창이 계속 열린다. 내부 state 갱신은 "핀 고정된 바로 그
  창"이 그 자리에서 갱신되는 net effect를 정확히 만족시키면서 창 증식을 만들지 않는다.

- **소장본이 많은 인기 서명에서 "copyStatus를 소장본마다 호출할지, 미러의 캐시된 상태로 보여줄지"
  트레이드오프는 애초에 발생하지 않도록 설계**했다 — `apiWebTitleDetail_`이 서버 쪽에서 COPIES·
  LOANS를 한 번씩만 훑어(readTable_은 요청 스코프 캐시, PATCH_SPEC P2) 모든 소장본의 실시간
  상태를 한 응답에 담아 내려주므로, 프론트는 소장본 개수와 무관하게 항상 API 호출 1회
  (`fetchTitleDetail`)만 한다. `apiCopyStatus_`를 소장본마다 반복 호출하는 안은 채택하지
  않았다(N배 왕복·N배 GAS 실행시간 소모, 인기 서명일수록 더 나빠지는 설계는 피해야 한다는
  ADR-014 "GAS 일일 실행시간 예산"과도 상충).

- **조작 버튼(예약·연장·분실 처리·변상)은 명확히 `disabled` 상태의 자리만 마련**했다
  (`views/book-detail/index.tsx` 「처리」 절) — 눌러도 아무 일도 안 일어나는데 활성화된 것처럼
  보이는 "죽은 버튼"을 만들지 않기 위해서다. 캡션(`actionsHint`)으로 "다음 항목(todo/12·13)에서
  연결됩니다"를 명시해, 왜 비활성인지 사서가 헷갈리지 않게 했다.

- **"운영 기록" 서브섹션의 action_code→라벨 매핑은 `views/recent-ops/index.tsx`의
  `ACTION_LABEL_KEYS`를 그대로 import하지 않고, book-detail에서 실제로 나올 법한 항목만 다시
  선언**했다 — 이 프로젝트의 기존 관례(`views/reports/index.tsx`가 catalog·homeroom의 i18n
  **키**는 재사용하되 라벨 매핑 **함수/객체**는 각 화면이 따로 갖는 패턴)를 그대로 따른 것이다.
  i18n 키 자체(`views.recentOps.action.*`)는 재사용해 같은 개념에 같은 문구가 나오게 했다.

- **`views.bookDetail.comingSoon` 키를 제거**했다(ko/en 양쪽) — 스텁이 완전 구현으로 교체돼
  더 이상 쓰이지 않는다. 새로 추가한 키는 전부 `views.bookDetail.*` 네임스페이스 안에 두되,
  이미 같은 개념을 가리키는 기존 키(`views.catalog.col.barcode/status/shelf/acquiredAt`,
  `views.recentOps.col.*`, `common.none`, `components.dataTable.errorPrefix`)는 새로 만들지
  않고 그대로 재사용했다(DESIGN.md "같은 행동 같은 이름 관통").

## H1 · 모바일 카메라 무대 (2026-07-15)

- **`ScanCameraStart.tsx`에 새 필수 prop `platform`을 추가**하면서 4개 호출부(loan-return·
  register·inventory·book-detail) 전부를 고쳤다 — todo 본문은 "loan-return/inventory/register"
  세 곳만 언급했지만 실제로는 `book-detail`(todo/11, `scan:'focus'`로 전환됨)도 같은 컴포넌트를
  쓰고 있어 넷째 호출부가 이미 존재했다. `platform`을 옵셔널로 두고 book-detail만 빠뜨리면 그
  화면만 조용히 데스크톱 취급을 받거나(타입 에러 없이) 모바일에서 깨지는 사각지대가 생기므로,
  네 곳 모두 `shell.platform`을 넘기게 통일했다.

- **`camera.offHint` 문구를 재정의(재사용)해서 ADR-020 카피로 바꿨다** — 새 키
  (`camera.offCard.hint` 등)를 만들지 않았다. `offHint`는 todo/03에서 추가된 뒤 실제로는
  어디서도 쓰인 적이 없는 채로 남아 있던 키였고(정확히 이 항목의 "꺼짐 상태" 카드를 위해
  미리 마련해 둔 것으로 보인다), 문구도 "카메라가 꺼져 있습니다 — 스캔하려면 켜세요"에서
  완료 조건이 요구하는 정확한 문장("카메라는 필요할 때만 켜집니다")으로 바꿔치기만 하면
  그대로 들어맞아서 재사용했다(ko/en 양쪽). 마찬가지로 무대의 종료 버튼은 새 키를 만들지 않고
  기존 `camera.stop`("카메라 끄기" — 이 역시 todo/03 이후 미사용 상태였다)을 재사용했다.

- **DESIGN.md가 문서화한 간격 토큰 `--sp-1~--sp-8`이 실제로는 `tokens/work.css`·
  `tokens/student.css` 어디에도 정의돼 있지 않다**(전체 저장소 grep 결과 0건, 기존 컴포넌트
  CSS도 전부 px 리터럴을 그대로 씀). 이번에 추가한 `base.css`의 `.scan-off-card*`,
  `components/camera/MobileScanStage.css`도 존재하지 않는 `var(--sp-*)`를 참조해 조용히
  깨진 스타일을 만들지 않도록, 기존 관례(px 리터럴)를 그대로 따랐다 — 토큰 정의 자체를 새로
  추가하는 건 디자인 시스템 전체에 영향을 주는 별도 결정이라 이 항목 범위 밖으로 남겨둔다.

- **조준 프레임 색은 `--brass`(평상시)·`--pass`(인식 순간)로 정했다** — `--pass`는 이미
  `ScanFlashOverlay.tsx`(전면 플래시)가 "인식 성공"의 의미로 쓰고 있어 그대로 이어받았고,
  평상시(조준 중) 색은 `Window.tsx`의 `.window-pin.is-pinned`(이 창이 지금 스캔을 받는
  대상)가 쓰는 `--brass`를 그대로 가져왔다 — "지금 이게 활성 대상"이라는 의미가 같다.

- **조준 프레임 사각형이 화면 밖으로 살짝 넘칠 수 있는 경우를 그대로 뒀다(고치지 않음)** —
  `services/camera.ts`의 `CROP.wRatio`(0.72, 네이티브 영상 폭의 72%)가 화면 종횡비가 카메라
  네이티브 종횡비보다 훨씬 좁고 긴 기기(예: 아주 좁은 폰 화면 + 4:3에 가까운 카메라)에서는
  `object-fit: cover`가 실제로 보여주는 폭 비율보다 커질 수 있다 — 이 경우 조준 프레임 좌우
  가장자리가 화면 경계를 넘어간다(`.scan-stage`의 `overflow: hidden`이 그 넘치는 부분만
  조용히 잘라낸다, 레이아웃이 깨지거나 예외가 나지 않는다 — 세로는 항상 정확히 맞는다,
  실측 트레이스는 최종 보고 참고). "조준 프레임 = 실제 디코드 크롭 영역과 픽셀 일치"가 완료
  조건이라 크롭 폭 자체를 줄이는 근사치 타협은 하지 않았고, `camera.ts`의 `CROP` 값도 이 항목
  대상이 아니라(수정 금지, export만 추가) 건드리지 않았다.

## H2 · 데스크톱 스캐너 창 (2026-07-16)

- **[오케스트레이터 리뷰 수정] `scannerWindowStore.ts`를 `shells/desktop/`가 아니라
  `services/`에 배치**했다(에이전트의 최초 구현은 `shells/desktop/`에 뒀었다). 이 모듈은
  `components/ScanCameraStart.tsx`가 import하는데, 그 컴포넌트는 `scan:'focus'` 뷰 4개
  (loan-return·register·inventory·book-detail) 안에 직접 박혀 두 셸 모두의 지연 청크에서
  공유된다 — "뷰는 셸을 모른다" 자동 검사(check-view-boundary.mjs) 자체는 `src/views/**`의
  직접 import만 훑어 이 배치가 CI를 통과하는 데는 문제가 없었지만, 뷰에 내장되는 공용
  컴포넌트가 참조하는 상태 모듈은 `cameraSession.ts`·`scanBus.ts`와 같은 층위(`services/`)에
  있는 게 이 프로젝트의 디렉터리 계약(`shells/desktop/`=그 셸 전용 코드)과 더 맞다고 판단해
  옮겼다 — 순수 파일 위치 정리이며 zustand 미도입 등 번들 분리 관련 판단은 그대로 유지했다
  (재검증: lint·tsc·build·size 전부 그대로 통과, 수치 변화 없음).

- **열기/닫기/최소화 상태와 위치·크기를 `ScannerWindow.tsx`(렌더링)와 분리한 별도 파일
  `services/scannerWindowStore.ts`로 뺐다** — `components/camera/aimRect.ts`가
  `ScanAimFrame.tsx`에서 분리된 것과 정확히 같은 이유(`react-refresh/only-export-components`
  린트, `--max-warnings 0`이라 위반 시 빌드 실패)다. 컴포넌트 파일은 컴포넌트만 export해야 하는데,
  `openScannerWindow`/`closeScannerWindow`/`minimizeScannerWindow`/`restoreScannerWindow`/
  `toggleScannerWindow`/`useScannerWindowState`를 `DesktopShell.tsx`·`ScannerDockWidget.tsx`·
  `components/ScanCameraStart.tsx` 세 파일이 각자 import해야 해서(todo가 명시한 요구사항)
  `ScannerWindow.tsx`에 co-locate하는 대안은 애초에 불가능했다.

- **`scannerWindowStore.ts`는 `useWindowStore.ts`(zustand)를 의도적으로 import하지 않는다.**
  `components/ScanCameraStart.tsx`는 `scan:'focus'` 뷰 4개(loan-return·register·inventory·
  book-detail)의 지연 청크에서 공유되고, 그 청크들은 데스크톱·모바일 양쪽에서 그대로
  재사용된다(`viewResolver.ts`의 `VIEW_COMPONENTS`가 뷰당 1개 청크만 만든다 — 셸별로 따로
  안 만든다). `scannerWindowStore.ts`가 zustand를 끌어오면 모바일 사용자도 그 뷰 청크를 열
  때마다 절대 쓰지 않는 데스크톱 창-관리자 상태 라이브러리를 함께 받는다. 이미 이 프로젝트가
  용인하는 종류의 트레이드오프이긴 하다(`ScanCameraStart.tsx`가 모바일 전용
  `MobileScanStage.tsx`를 무조건 정적 import해서 데스크톱 몫 청크에도 끼워 넣는 것과 동급) —
  하지만 zustand라는 새 의존성 하나를 추가로 끼워 넣을 이유는 없다고 판단해 피했다.

- **위 결정의 직접적인 결과로 `ScannerWindow`의 z-순서를 일반 창(`useWindowStore`의 zCounter,
  세션 내내 증가하는 카운터)과 상호작용시키지 않고, 고정 상수 `SCANNER_WINDOW_Z = 800`으로
  단순화**했다(todo가 명시적으로 허용한 두 선택지 — "zCounter와 interleave" 또는 "고정 높은
  z-index" — 중 후자). 800은 도크(500)·도크 위젯(700)보다 위, 토스트(9999)·인식
  플래시(9998)보다 아래, 일반 업무 창(zCounter는 1부터 시작)보다는 사실상 항상 위에 온다.
  트레이드오프: 한 세션에서 일반 창 열기/포커스/복원 조작이 누적 800회를 넘으면 이론적으로
  역전될 수 있다 — 실사용 세션에서 그 정도 누적 클릭에 도달할 가능성은 낮다고 보고 감수했다.
  이 선택 덕에 클릭 시 "포커스"라는 별도 개념이 필요 없어졌다(이미 항상 위이므로) — 그래서
  도크 위젯의 "창이 이미 열려 있을 때" 클릭 동작은 `focusScannerWindow()` 같은 걸 새로
  만들지 않고 `restoreScannerWindow()`(최소화 해제, 이미 펼쳐져 있으면 무해한 no-op) 하나로
  충분하다고 판단했다.

- **리사이즈는 `Window.tsx`의 8방향 대신 SE(오른쪽 아래) 코너 핸들 1개로 단순화**했다 — todo가
  "더 단순한 부분집합도 좋다, 단순화하면 문서화"라고 명시적으로 허용했다. 유틸리티 성격의
  단일 창(항상 최대 1개)에 8개 리사이즈 핸들을 전부 두는 복잡도가 실이익 대비 과하다고 판단했다.

- **닫기 확인(연속 모드 핀 중) 후 연속 모드 핀을 자동으로 해제**한다
  (`scannerWindowStore.closeScannerWindow`가 `cameraSession.stop()` 다음에
  `cameraSession.setContinuous(false)`도 호출) — todo가 "자동 해제 또는 stale 플래그로 방치,
  둘 다 당신 판단"이라고 위임한 지점이다. 카메라가 꺼진 채 "연속 모드"만 켜져 있는 상태는
  사용자에게 아무 의미가 없고, 다음에 창을 다시 열었을 때 그 핀이 남아 있으면 "왜 유휴
  자동종료가 하나도 안 걸리지"처럼 사용자가 잊고 있던 과거 의도가 조용히 되살아나는 쪽이
  stale 플래그를 방치하는 쪽보다 더 나쁜 놀라움이라고 판단해 자동 해제를 택했다.

- **바깥 챙(패널·테두리·그림자·타이틀바·최소화/닫기 버튼·리사이즈 핸들)은 새 CSS를 만들지
  않고 desktop.css의 `.window`/`.window-titlebar`/`.window-titlebar__title`/`.window-btn`/
  `.window-btn--close`/`.window-body`/`.window-resize`/`.window-resize--se`를 그대로
  재사용**했다(className을 그대로 붙여 씀) — 일반 창과 똑같은 시각 언어를 얻으면서 중복 CSS를
  피했다. 연속 모드 체크박스도 새 클래스를 만들지 않고 `ScannerDockWidget`(구)이 쓰던
  `.scanner-dock__continuous`를 그대로 재사용했다(desktop.css에 남겨 둠).

- **`ScannerDockWidget.tsx`를 여닫이 `<div>` + 내부 `<button>` 구조에서 `<button>` 하나로
  통째로 바꿨다** — ADR-026이 위젯을 "상태점+열기 버튼"으로 못박아서, 이제 이 위젯 전체가
  하나의 클릭 가능한 컨트롤이다(접기/펼치기 토글 상태 자체가 사라졌으므로 `collapsed` state도
  삭제). 상태 텍스트(`statusText()`, "스캔 중 (내장 디코더)" 등)는 `ScannerWindow.tsx`
  안으로 옮겨 그대로 재사용했다(같은 i18n 키 재사용, 새 키 없음).

- **`shell.desktop.scannerExpand`/`scannerCollapse`/`scannerStart`/`scannerStop` i18n 키
  4개를 ko/en 양쪽에서 제거**했다 — 접기/펼치기 토글과 위젯 안 시작/종료 버튼이 이번 개정으로
  전부 없어져 더 이상 어디서도 참조하지 않는다(제거 전 grep으로 사용처 0건 확인).

- **`docs/FRONTEND.md`의 "스캐너는 창이 아니다" 절을 ADR-026에 맞춰 함께 고쳤다** — todo
  본문은 `docs/DECISIONS.md`만 명시했지만, ADR-020(온디맨드 반전) 때도 FRONTEND.md의 해당
  절이 함께 갱신된 선례가 있고(현재 파일에 이미 반영돼 있음), FRONTEND.md 자체가 CLAUDE.md가
  "구현 전 필독"으로 지정한 법전이라 ADR과 반대되는 문장을 그대로 남겨두면 다음 항목을 집는
  에이전트가 낡은 규칙을 그대로 믿을 위험이 있다고 판단했다. ADR 표 자체(DECISIONS.md)는
  요청대로 손대지 않았고, 이전 ADR 항목은 전혀 건드리지 않았다.

- **`components/ScanCameraStart.tsx`(components/, views/** 아님)가
  `shells/desktop/scannerWindowStore.ts`를 직접 import**한다 — `check-view-boundary.mjs`는
  `src/views/**`만 훑고 eslint의 `no-restricted-imports`(셸 import 금지)도 `files:
  ['src/views/**/*.{ts,tsx}']`에만 걸려 있어 린트 위반은 아니지만, "components/가 shells/를
  아는" 방향이라 결이 조금 어긋난다. todo 본문이 정확히 이 세 파일(DesktopShell·
  ScannerDockWidget·ScanCameraStart)이 같은 트리거 모듈을 import하는 그림을 명시적으로
  그려서 그대로 따랐다 — 대안(트리거 함수를 services/로 옮기기)도 검토했지만, 그러면
  "카메라는 셸 관심사"라는 ADR-026의 프레이밍과 어긋나고(services/는 플랫폼 중립이어야
  하는데 창 위치/크기는 데스크톱 전용 개념) todo의 제안 파일 경로(`shells/desktop/
  ScannerWindow.tsx` 인접)와도 맞지 않아 원래 설계를 존중했다.

## todo/12 · 예약 프론트 (2026-07-15)

- **"도착 처리"는 새 백엔드 쓰기 액션을 만들지 않고 loan-return으로의 순수 내비게이션
  단축키로 구현**했다. `checkout_`(Code.gs)을 다시 읽어 확인한 결과, 예약이 "수령 완료"로
  바뀌는 지점은 배정된 회원이 그 소장본을 정상적으로 대출(체크아웃)하는 순간
  `checkout_` 안에서 부수효과로 처리된다(`ownReservation`을 찾아 `status_code: 'FULFILLED'`로
  갱신하는 라인) — 전용 "수령 확인" API가 애초에 없다. 그래서 관리 뷰의 「도착 처리」 버튼은
  `apiWebReservations_`·`apiWebReserve_`·`apiWebCancelReservation_` 중 무엇도 호출하지 않고
  `shell.open('loan-return')`만 부른다.
  **파라미터로 소장본/회원을 미리 채우는 방식(옵션 a)은 검토 후 기각**했다 — `loan-return`은
  `registry.ts`에서 `desktop.single: true`인데, `useWindowStore.openWindow`의 구현을 확인해보니
  이미 열려 있는 single 창에 대해서는 포커스/복원만 하고 `params`를 새 값으로 갱신하지
  않는다(`if (existing) { ...; return; }`로 조기 반환). 즉 loan-return 창이 이미 열려 있는
  상태(흔한 케이스 — 사서가 대출·반납 업무 중일 때 예약 관리를 함께 열어볼 확률이 높다)에서
  「도착 처리」를 누르면 prefill 파라미터가 조용히 무시되는, 신뢰할 수 없는 경로가 된다.
  그래서 옵션 (b)(내비게이션 + 토스트로 바코드·회원 안내)를 택했다 — `loan-return`/`checkout_`
  본문은 전혀 건드리지 않았고, 신뢰성이 창 상태에 좌우되지 않는다.

- **대시보드 「예약 도착」 카드의 READY 건수는 `getDashboardData_()`의 `readyItems`를 재사용하지
  않고, 새 `reservations` 액션에서 별도로 가져온다.** `getDashboardData_` 코드를 재확인한
  결과 `readyItems`는 `.slice(0, 7)`로 상위 7건만 잘라 내려준다("연체 상위"처럼 미리보기
  목적) — 실제 READY 총건수가 8건 이상이면 `readyItems.length`를 그대로 배지 숫자로 쓰면
  undercount가 난다. 정확한 총건수가 필요해서(사서가 "지금 몇 건이 수령 대기 중인지" 믿고 볼
  숫자) `getDashboardData_`를 수정하지 않고(절대 규칙) `apiWebReservations_`의
  `readyCount`(상한 없음, WAITING+READY 전체를 훑어 계산)를 별도 fetch(`useReadyReservationCount`,
  `services/reservationData.ts`)로 가져오는 쪽을 택했다. 대시보드 진입 시 API 왕복이 하나
  늘지만(대시보드 자체 fetch와 별개), 뷰포트 진입 시에만 fetch하는 `VizLazyMount`처럼 이미
  이 프로젝트가 "패널마다 자기 데이터를 각자 가져온다"는 패턴을 쓰고 있어 과설계로 보지
  않았다.

- **`apiWebReservations_`의 `waitingCount`/`readyCount`는 `payload.status` 필터와 무관하게
  항상 전체(WAITING+READY) 기준**으로 계산한다(반환하는 `items` 배열만 필터링됨). 그렇게
  하지 않으면(필터링된 집합에서 카운트를 뽑으면) 관리 뷰의 탭 배지 숫자가 "지금 보고 있는
  탭"에 종속돼 예를 들어 READY 탭을 보는 동안 대기(WAITING) 배지가 0으로 보이는 등 혼란스러운
  UI가 된다 — 탭 배지는 필터와 독립적인 전역 카운트여야 자연스럽다고 판단했다.

- **"만료임박" 임계값은 24시간(READY이고 `pickupExpiresAtMs - now ≤ 24h`)으로 임의
  지정**했다(`webapp/src/views/reservations/index.tsx`의 `URGENT_WINDOW_MS`). FEATURES.md·
  VIZ.md 어디에도 구체적인 값이 없어(todo 본문도 "e.g. ≤24h — your call"로 위임) 이미
  대기(hold) 보관 기본값이 정책상 며칠 단위(`policy.hold_days`, 기본 3일)인 점을 고려해
  "마지막 하루"를 임박으로 보는 게 합리적이라고 판단했다. 서버는 이 개념을 전혀 모른다(todo
  본문 지시대로 클라이언트 전용 판정) — `dailyLibraryMaintenance`(수정 금지 대상)가 매일
  한 번 만료(EXPIRED)를 정리하는 배치라, 이미 만료 시각이 지났지만 아직 그 배치가 돌기 전인
  READY 행도 있을 수 있는데 이 경우 `pickupExpiresAtMs - now`가 음수라 자동으로 "임박" 판정에
  포함된다(별도 하한 처리 불필요).

- **`src/views/recent-ops/index.tsx`의 `ACTION_LABEL_KEYS` 매핑 키 하나를 고쳤다**
  (`CANCEL_RESERVATION` → `CANCEL`) — 예약 취소 흐름을 실제로 연결하며 `cancelReservation_`의
  `writeAudit_` 호출부를 다시 읽어보니 실제로 기록되는 `action_code`는 `'CANCEL'`이다
  (`executeWrite_`에 넘기는 `operationType` `'CANCEL_RESERVATION'`과는 별개 값 — 전자는
  10_OPERATIONS 멱등 키용, 후자는 15_AUDIT_LOG 표시용). 기존 매핑 키가 `'CANCEL_RESERVATION'`
  이었던 건 이 액션이 프론트에서 실제로 호출된 적이 없어(이 항목 전까지 죽어 있던 조합) 아무도
  눈치채지 못한 잠재 버그였다 — `cancelReservation_` 자체는 건드리지 않고(절대 규칙 대상) 순수
  프론트 표시 매핑만 고쳤다.

- **book-detail의 「예약」 버튼은 학생 스캔을 기다리는 새 상태(`reserving`)를 추가**하고,
  기존 「책 스캔 → 같은 창 갱신」 scanBus 구독 하나에 「학생 스캔 → 예약 제출」 분기를 얹었다
  (별도 구독을 새로 만들지 않음 — loan-return처럼 book/student 두 슬롯을 동시에 관리할 필요가
  없다, 이 화면은 이미 책이 고정돼 있으므로 학생 슬롯 하나만 기다리면 된다). 다른 책으로
  전환되면(`query.copyKey`/`query.titleId` 변경) 대기 상태를 자동으로 접는다 — 이전 책에 걸린
  "학생증을 스캔하세요" 안내가 새 책 화면에 남아있는 혼란을 막기 위함.

- **`services/reservationData.ts`의 `createReservation`/`cancelReservation`(쓰기)은
  `fetchReservations`(읽기)와 달리 UNKNOWN_ACTION 샘플 폴백을 두지 않는다** — loan-return의
  `checkout`/`return`과 같은 원칙이다(쓰기는 흉내 낼 수 없다, CLAUDE.md 검증 원칙 "가짜 성공
  금지"). 완료 조건 "걸기→반납 시 자동배정→도착 목록 표시 흐름이 샘플 폴백으로도 시연됨"은
  쓰기를 가짜로 성공시켜서가 아니라, `mocks/reservations.ts`가 이미 그 흐름의 "결과"(대기 1건·
  도착알림 1건·만료임박 1건)를 미리 갖춘 표본 데이터로 보여줌으로써 만족시켰다.

## todo/13 · 연장·분실·변상 (2026-07-15)

- **확인 다이얼로그는 `ShellContext.confirm()` 확장이 아니라 새 공용 컴포넌트
  `components/ConfirmDialog.tsx`로 구현**했다. todo/05의 `print()` 선례(ShellContext에 인자
  없는 트리거 한 줄만 추가)를 다시 읽었지만, `print()`는 실제로 `window.print()`라는 **셸/플랫폼
  전용 API**를 대신 호출해줘야 해서 뷰가 원천적으로 닿을 수 없는 기능이었다. 반면 확인 다이얼로그는
  순수 시각적 오버레이(위에 뜨는 카드 + 확인/취소 버튼)일 뿐 셸의 도움이 전혀 필요 없다 —
  `components/SessionGate.tsx`가 이미 `.session-gate-overlay`(`position:fixed; inset:0`)로
  같은 패턴을 views/** 바깥(`src/components/`)에서 구현해 둔 선례를 그대로 따랐다. `components/**`는
  `check-view-boundary.mjs`·`no-restricted-imports` 셸 차단 대상이 아니라서(파일 목록:
  `files: ['src/views/**/*.{ts,tsx}']`) `window.confirm`을 원한다면 여기서는 쓸 수 있었겠지만,
  `ConfirmDialog.tsx` 안에서도 `window.confirm`을 쓰지 않고 순수 React 렌더 트리 오버레이로
  만들었다 — 브라우저 네이티브 confirm은 스타일링이 불가능하고(디자인 시스템 이탈) 비동기
  다이얼로그(분실 처리의 대체비 입력 같은 폼 요소)를 담을 수 없다. `book-detail`(소장본 행의
  연장·분실 처리·변상 완료)과 `loan-return`(반납 대기의 "대신 연장/분실 처리")이 이 컴포넌트
  하나를 공유한다 — "확인 UI 중복 금지"(DataTable과 같은 결). ShellContext 인터페이스 자체는
  이번 항목에서 전혀 넓히지 않았다(`types.ts`의 "함부로 넓히지 않는다" 원칙 유지).

- **loan-return의 "반납 대기 화면"은 기존 5초 실행취소 바를 3지선다로 확장하는 방식으로
  구현**했다(task 노트가 제안한 방향 그대로 채택) — 반납은 여전히 스캔 즉시 실행되고(FRONTEND.md
  즉시실행 정책을 약화하지 않음), 그 직후 5초 창의 버튼이 "실행취소" 하나에서 "실행취소 | 대신
  연장 | 대신 분실 처리" 셋으로 늘었다. 까다로운 지점은 `renew_`/`markLoanLost_`가 `OPEN` 대출만
  다루는데 반납이 이미 일어난 뒤라 대상 대출이 `RETURNED` 상태라는 것 — 그래서 "대신 연장/분실
  처리"는 **"반납 취소(재대출, 기존 undo와 같은 `checkout` 호출) → 그 자리에서 `renew_`/
  `markLoanLost_` 이어서 호출"**하는 합성 동작으로 구현했다(`handleRedirectConfirm`,
  `views/loan-return/index.tsx`). 둘 다 "실행취소 불가" 원칙에 따라 `ConfirmDialog`를 거치고,
  다이얼로그를 여는 순간(`openRedirect`) 기존 5초 타이머는 즉시 `clearUndo()`로 취소된다 —
  그 시점부터 "그냥 실행취소"는 더 이상 선택지가 아니다(대안을 골랐으니 그 대안으로 끝까지
  간다). **다이얼로그를 취소하면 반납은 이미 완료된 채로 그대로 남는다**(재대출도, 연장도,
  분실 처리도 일어나지 않은 상태 — "정상 반납"으로 취급) — 이건 데이터 손실이 아니라 애초에
  "취소를 누르지 않았다면 어차피 반납으로 끝났을 상태"와 동일해서 안전하다고 판단했다. 앞 단계
  (반납 취소=재대출)가 실패하면(예: 그 사이 다른 회원 예약이 그 소장본을 선점) 뒷단계는 시도하지
  않고 실패를 그대로 토스트로 알린다 — 이건 기존 "실행취소 자체가 실패할 수 있다"는 위험과 같은
  종류이지 이 항목이 새로 만든 위험이 아니다. 대출(checkout) 직후의 실행취소 바에는 이 두 버튼이
  뜨지 않는다(`undo.mode === 'return'`일 때만 렌더) — 방금 빌려준 책을 "대신 연장/분실 처리"하는
  것은 애초에 의미가 없다.

- **미변상 목록은 리포트 5종 배열(`REPORT_TYPES`)에 섞지 않고, `viz-insights`와 같은 방식으로
  분리된 7번째 카드(`unpaid-fines`)로 리포트 허브에 얹었다** — `report` 액션이 아니라 별도
  `unpaidFines` 액션을 쓰고, 그 자리에서 "변상 완료"라는 **쓰기** 액션을 실행한다는 점에서
  나머지 5개 리포트(전부 읽기 전용 미리보기+인쇄)와 성격이 다르다고 판단했다. 화면 구현도 리포트
  5종의 "미리보기 버튼을 눌러야 조회"(온디맨드) 패턴이 아니라 `views/reservations/index.tsx`와
  같은 "진입 즉시 조회 + 수동 새로고침 + `subscribeDataChange` 트랜잭션 후 자동 갱신" 패턴을
  택했다 — 리포트라기보다 "지금 처리해야 할 목록"에 가까운 화면이라고 봤다. 「변상 완료」 확인
  다이얼로그·완료/실패 토스트 i18n 키는 book-detail의 것(`views.bookDetail.confirmCompensate*`·
  `compensateDone`·`compensateFailed`)을 그대로 재사용했다(DESIGN.md "같은 행동 같은 이름 관통")
  — 새 키를 만들면 같은 개념("변상 완료 처리")의 문구가 두 벌로 갈라질 뻔했다.

- **"분실→학생 정지 연동"은 `markLoanLost_`에 새 정지 로직을 추가하지 않고, `checkout_`의 기존
  `unpaidReplacement` 체크(936~941행 — 미변상 REPLACEMENT 벌금이 있으면 신규 대출 자체를
  막음)를 그대로 둔 채 그 결과를 프론트에 "설명"만 추가했다** — `markLoanLost_`가 돌려주는
  `replacementFineAmount`가 0보다 크면(대체비가 부과됐다는 뜻) book-detail·loan-return 둘 다
  분실 처리 완료 토스트에 "이 회원은 완납 전까지 신규 대출이 제한됩니다"를 덧붙인다
  (`views.bookDetail.markLostDoneWithFine`/`views.loanReturn.redirectMarkLostDoneWithFine`).
  실제 차단은 이미 `checkout_`이 하고 있었다 — 이 항목은 그 기존 동작을 사서가 눈치채도록 웹앱에
  드러내는 일이었지, 새 "정지" 상태(예: `suspended_until` 필드 갱신 같은)를 만드는 일이 아니었다.

- **`views/recent-ops/index.tsx`와 `views/book-detail/index.tsx`(각자 독립적인
  action_code→i18n키 매핑 맵)에서 `MARK_LOAN_LOST`/`PAY_FINE` 키가 절대 매칭되지 않는 죽은
  키였던 걸 발견해 함께 고쳤다** — `markLoanLost_`/`payFine_`(Code.gs)이 `writeAudit_`에 실제로
  남기는 `action_code`는 각각 `'MARK_LOST'`/`'PAY'`다(executeWrite_에 넘기는 operationType
  `'MARK_LOAN_LOST'`/`'PAY_FINE'`과는 별개 값). 이 항목 전까지는 두 액션이 웹앱에서 한 번도
  실제로 호출된 적이 없어(사이드바 전용) 아무도 눈치채지 못한 잠재 버그였다 — todo/12가
  `cancelReservation_`의 `'CANCEL_RESERVATION'`→`'CANCEL'` 키를 고친 것과 정확히 같은 종류의
  발견이다. 두 함수 본문 자체(`markLoanLost_`/`payFine_`)는 건드리지 않았다(절대 규칙 대상) —
  프론트의 순수 표시 매핑만 고쳤다.

- **`payFine_`(Code.gs)은 `payload.note`를 전혀 소비하지 않는다**(`appendNote_` 호출이 없음 —
  `renew_`/`markLoanLost_`와 달리 FINES.note 필드를 이 함수가 건드리지 않는다). 그래서
  `services/loanActionsData.ts`의 `payFine()` 헬퍼는 `renewLoan()`/`markLoanLost()`와 달리
  `note` 파라미터를 받지 않는다 — "operator note 관통"은 실제로 note를 소비하는 함수에만
  적용했다(없는 파이프에 물을 흘려보낼 수는 없다). "변상 완료" 기본 동작은 `payFine_`가 지원하는
  부분 납부(`amount < remaining` → `PARTIAL`)를 프론트에서 강제로 막지는 않지만(서버가 이미
  그 값을 그대로 받아들인다), book-detail·reports 양쪽 다 UI상 `remainingAmount`(잔액 전액)만
  넘기도록 고정했다 — "완료"라는 라벨이 부분 납부를 허용하는 것처럼 보이면 혼란스럽다고 판단했다.

- **`apiWebUnpaidFines_`(신규 읽기 전용 액션)는 `payload`를 전혀 쓰지 않는다** — `apiWebDashboard_`
  와 같은 관례(전교 미변상 목록은 필터 파라미터가 필요 없다, 좁히는 건 클라이언트 몫 —
  book-detail이 `titleId`로, reports 허브는 전체를 그대로 보여준다). 전교 규모(수천 명)에서도
  FINES 시트 자체가 대출/회원 시트보다 훨씬 작아(분실은 흔치 않은 사건) 전체를 매번 읽어도
  성능 문제가 되지 않는다고 판단했다.

- **`mocks/titleDetail.ts`에 4번째 소장본(LOST, `C000454`/`0004514`)을 추가**하고
  `mocks/fines.ts`(신규)의 미변상 표본 하나가 그 `copyId`를 정확히 가리키게 만들었다 —
  재배포 전(UNKNOWN_ACTION) 샘플 폴백 상태에서도 book-detail을 열면 「변상 완료」 행 액션이
  실제로 보이는 시연 가능한 상태를 만들기 위해서다(CLAUDE.md 검증 원칙 "가짜 성공 금지"는
  쓰기에 적용되는 것이지, 읽기 샘플 데이터가 그 자체로 완결된 데모를 보여주는 것까지 막지
  않는다 — 기존 `mocks/reservations.ts`도 3버킷을 전부 채워 같은 방식으로 데모 완결성을
  추구했다).

## todo/14 · 장서점검 + ZXing Worker (2026-07-15)

- **장서 점검의 "보관중"(baseline-eligible) 상태 코드는 `AVAILABLE`·`HOLD_READY` 둘만 포함**했다
  — todo 본문이 예시로 든 "`AVAILABLE`/`ON_LOAN`, `LOST`/`WITHDRAWN`/`REPAIR`/`HOLD_READY` 제외"
  조합을 그대로 따르지 않고 의도적으로 갈랐다. 이유: 장서 점검은 "서가를 실제로 돌며 스캔"하는
  물리적 행위다 — `ON_LOAN`(대출 중) 소장본은 회원이 집에 가져간 상태라 서가에서 스캔될 수
  없는 게 **정상**이다. `ON_LOAN`을 대상에 넣으면 세션을 몇 번을 반복해도 "대출 중인 책 전부"가
  매번 미점검으로 남아 세션 종료 시 분실 후보 목록에 통째로 끼어든다 — 이러면 "분실 후보"라는
  결과 자체가 무의미해진다(진짜 분실 후보를 대출 중인 정상 책들 사이에서 찾기 어려워짐). 같은
  논리로 `REPAIR`(수선 중 — 수선 데스크에 있어 서가에 없는 게 정상)도 제외했다. `LOST`·
  `WITHDRAWN`은 이미 소재/상태가 확정된 것들이라 재점검 대상이 아니다. `HOLD_READY`(예약 수령
  선반)는 포함했다 — todo 본문도 "물리적으로 여전히 수령 선반에 있어야 하니 포함할 수도 있다"고
  짚었고, 실제로 이 상태의 책이 안 보이면(회원에게 아직 안 넘어갔는데 선반에도 없음) 그 자체가
  유의미한 이상 신호라고 판단했다. `webapp/src/views/inventory/index.tsx`의
  `ELIGIBLE_STATUS_CODES` 상수 주석에도 같은 근거를 남겼다.
- **baseline(대상 목록)은 세션 시작 시점에 스냅샷으로 고정**한다(그때그때 살아있는 카탈로그
  미러와 실시간 비교하지 않음) — todo 본문이 제시한 두 옵션 중 "이번 세션 동안 몇 권이 남았나"
  라는 질문에 더 맞는 쪽을 택했다. 세션 도중 다른 창에서 새 소장본이 등록되거나 상태가 바뀌어도
  이번 점검 세션의 진행률·분실 후보 계산에는 반영되지 않는다 — 다음 세션을 새로 시작하면 그때
  다시 최신 스냅샷을 뜬다.
- **세션이 시작된 뒤 스캔한 바코드가 baseline(위 두 상태) 밖이면(대출중·분실·폐기·수선중이거나
  카탈로그 미러에 아예 없는 바코드) 이번 점검에서는 조용히 무시**한다 — `last_inventory_at` 갱신
  자체도 하지 않는다. 대상 밖 소장본까지 매번 갱신하면 "언제 실제로 서가에서 봤는지"라는 필드의
  의미가 흐려진다고 판단했다(예: `ON_LOAN` 책을 실수로 스캔해도 최근점검일이 갱신되면, 정작 서가
  점검 때는 안 보였다는 사실이 감춰진다). 반대로, 진행 카운터(스캔 수)와 네트워크 쓰기 호출 두
  가지 모두 baseline 소속 여부로 문지기를 삼았다 — 두 수치가 항상 "같은 세션 로컬 Set"에서
  나오게 해 `미점검 잔여 + 스캔완료 = baseline 총계`가 항상 성립하도록 지켰다(todo 본문 지시:
  "두 숫자 다 같은 Set 비교에서 나와야 한다").
- **"점검 세션 시작" 버튼은 `cameraSession.start()`를 직접 부르지 않고
  `services/scannerWindowStore.ts`의 `openScannerWindow()`를 그대로 재사용**한다(ADR-020/026
  기존 단일 진입점). 이유: 데스크톱에서 카메라 스트림만 켜고 `ScannerWindow`(실제 미리보기가
  뜨는 유일한 곳)를 열지 않으면 사서 눈에는 카메라가 반응 없이 안 보이는 상태가 된다.
  `openScannerWindow()`는 이미 열려 있으면 아무것도 재시작하지 않는 멱등 호출이라(내부에서
  `if (!state.open) cameraSession.start(...)`) 모바일에서 다른 경로로 이미 카메라가 켜져 있어도
  안전하게 재사용할 수 있다. 세션 종료 시에는 `cameraSession.setContinuous(false)`만 호출하고
  카메라 자체(또는 `ScannerWindow`)는 강제로 끄지 않는다 — "세션 종료"가 "카메라 강제 종료"를
  뜻하지는 않는다고 판단했다(사서가 점검 직후 다른 화면에서 스캔을 이어갈 수도 있음).
- **`inventoryScan_`(Code.gs 신규)이 실패해도(네트워크 오류 등) 프론트의 세션-로컬 진행 카운트는
  되돌리지 않는다** — 스캔한 바코드는 `scannedBarcodes` Set에 이미 추가되고 진행률에도 반영된
  채로 남고, 실패는 토스트로만 알린다. 이 소장본을 "실제로 봤다"는 사실 자체는 로컬에서 이미
  확정된 사실이라(서버 응답을 기다리지 않고 다음 스캔으로 넘어가야 하는 연속 스캔 세션의
  핵심 요구) — 서버 쓰기 실패는 "그 확인을 서버 기록에도 반영하는 데 실패했다"는 별개 문제로
  다뤘다. 재시도 큐는 만들지 않았다(todo 범위 밖으로 판단 — 실패가 잦다면 다음 todo에서
  `retryApiCall` 같은 기존 재시도 규약을 얹을 수 있다).
- **인쇄 문서의 학교명(`PrintDocument`의 `libraryName`)은 새 서버 호출을 만들지 않고
  `services/dashboardData.ts`의 이미 떠 있는 대시보드 데이터를 재사용**한다
  (`shells/desktop/DashboardBaseLayer.tsx`/`shells/mobile/MobileShell.tsx`가 앱 부팅 시 항상
  이 서비스를 시작해 두므로, inventory 뷰는 그 상태를 구독만 하면 된다 — ADR-021 "대시보드
  기저층은 항상 떠 있다"). 생성 시각은 서버 `generatedAt` 대신 세션 종료 시점의 클라이언트
  시각을 `Intl.DateTimeFormat`(ADR-023)으로 포맷했다 — 이 인쇄물 자체가 서버 리포트 액션이
  아니라 전적으로 클라이언트에서 파생된 결과이기 때문이다.
- **ZXing 디코드 워커(`public/zxing-worker.js`)는 "ready" 메시지를 받은 뒤에야
  `decoder:'zxing'` 상태로 전환**한다(낙관적으로 먼저 켜두지 않음) — 워커 생성 자체나
  `importScripts('zxing.js')`가 실패할 수 있는데, 그 실패를 놓치면 카메라가 "정상"처럼 보이면서
  실제로는 아무 것도 디코드하지 못하는 조용한 고장 상태가 된다. `worker.onerror`와 워커가 보내는
  `{type:'error'}` 메시지 둘 다 기존 `CameraStatus`의 `state:'error'`로 흘려보내 사서에게
  "수동 입력을 사용하세요" 메시지가 뜨게 했다 — 새 공개 상태 필드를 추가하지 않고 기존 계약을
  그대로 재사용했다.
- **ZXing 워커의 busy 프레임 드랍은 "크롭·draw·getImageData까지 하고 나서 버림"이 아니라
  "busy 체크를 가장 먼저 하고, busy면 크롭·draw·getImageData 자체를 아예 건너뜀"으로
  구현**했다 — todo 설계 노트는 "크롭·draw·getImageData는 항상 하고, transfer만 조건부로
  한다"고 읽힐 수도 있는 문구였지만, `getImageData()`(GPU→CPU 픽셀 리드백)가 이 경로에서 가장
  비싼 연산이라 버릴 프레임에 대해서까지 그 비용을 치르는 건 "디코드를 메인 스레드 밖으로 옮겨
  메인 스레드를 자유롭게 한다"는 이 항목의 목적에 오히려 반한다고 판단했다. 동작 결과(프레임
  드랍, 큐잉 없음)는 todo가 요구한 그대로다.

## todo/15 · 검색 강화 (2026-07-15)

- **ISBN은 통합 검색 대상에서 실제로는 빠졌다** — todo 본문 "서명·저자·ISBN·등록번호 통합"을
  글자 그대로 구현하려 했으나, `services/catalog.ts`의 `CatalogCopyRow`(todo/08 미러 스키마)에
  애초에 `isbn13` 필드가 없다. 서버 `apiWebCatalogSync_`(school-patch-v1/Code.gs 3048행)의
  반환 객체를 직접 확인했고, 거기도 `isbn13`을 내려주지 않는다 — 즉 미러 자체에 ISBN 데이터가
  전혀 존재하지 않는다. 이 항목은 "Code.gs 변경 없음" 전제이고 `catalog.ts`의 동기화/커서
  로직(스키마 포함)도 건드리지 말라는 규칙이라, 필드를 새로 추가해 받아오는 선택지 자체가
  막혀 있었다. 그렇다고 있지도 않은 필드를 있는 척 매칭시키는 것은 CLAUDE.md 검증 원칙
  "가짜 성공 금지"에 어긋난다고 판단해, 검색 입력창 문구(`views.search.queryPlaceholder`)를
  "서명·저자·등록번호로 검색"으로 정직하게 좁혔다 — ISBN 문자열을 입력해도 어떤 행에도
  매칭되지 않고 그냥 "검색 결과가 없습니다"로 보인다(오작동이 아니라 데이터가 없어서 나는
  정상적인 빈 결과). 스캔 연동도 같은 이유로 `target.kind === 'isbn'` 이벤트는 조용히
  무시한다(등록 도구 쪽 몫으로 남김, 아래 스캔 연동 항목 참고). 실제로 ISBN까지 검색하려면
  다음 라운드에서 `apiWebCatalogSync_`가 `isbn13`을 함께 내려주도록 서버를 바꾸고
  `CatalogCopyRow`에 필드를 추가해야 한다 — 이번 항목의 범위 밖으로 남긴다.

- **DataTable(`components/DataTable/index.tsx`) 자체는 건드리지 않고, search 뷰가 자기 검색어·
  필터로 미러 전체를 먼저 걸러(`visibleRows`) DataTable에 넘기는 방식**을 택했다(todo 지시문의
  두 옵션 중 (b)). 이 컴포넌트는 catalog·recent-ops·reports(담임 리포트·미변상 목록)·
  reservations·book-detail 5곳이 공유하는 단일 구현체라, 그 안의 검색 상자를 초성 인식으로
  바꾸면 5곳 전부의 기존 동작(단순 부분 문자열 매칭)을 다시 검증해야 하는 회귀 위험을 새로
  떠안는다. 반면 "화면이 자기 상태로 `rows`를 미리 걸러 DataTable에 넘기고, DataTable 자신의
  검색 상자는 그 결과 안에서 한 번 더 좁히는 보조 역할로 남는다"는 패턴은 이미
  `views/reservations/index.tsx`(대기/도착/임박 탭이 `items`→`filteredRows`)가 정확히 같은
  모양으로 쓰고 있어 새 아키텍처가 아니라 기존 관례의 재사용이다. 그래서 `services/choseong.ts`
  (신규, 순수 유틸)를 만들어 search 뷰 안에서만 쓰고, DataTable에는 `searchPlaceholder`만
  "표시된 결과 안에서 추가 검색"으로 바꿔 두 검색 상자가 서로 다른 일을 한다는 걸 문구로
  구분했다. `npm run verify`(lint·view-boundary·i18n 이중검사·tsc)와 `npm run build`가 전부
  기존과 동일하게 통과했고, DataTable 자체를 전혀 수정하지 않았으므로 catalog·recent-ops·
  reports·reservations·book-detail 4곳(도서상세 포함 5곳)의 기존 동작은 코드 변경이 아예 없어
  회귀 가능성이 원천적으로 없다.

- **스캔 연동은 "검색 뷰 안에서 결과를 제자리 필터링"이 아니라 "book-detail로 이동"**을
  택했다(registry.ts에서 search를 `scan:'focus'`로 전환). todo 문구 "포커스 중 스캔 → 해당
  도서로"의 "해당 도서로"를 "그 책 화면으로"로 읽었다 — catalog 행 클릭이 이미 book-detail로
  이동하는 것과 같은 내비게이션 규약이고, search 결과의 행 클릭도 이번 항목에서 같은 곳으로
  이동하게 만들었으니(`shell.open('book-detail', {...})`) 스캔도 같은 목적지를 가리키는 편이
  "같은 행동 같은 이름 관통"(DESIGN.md) 원칙에 맞는다고 판단했다. book-detail 자신이
  `scan:'focus'`일 때 "제자리 갱신"을 하는 것(todo/11)과 다른 이유: book-detail은 이미 그 책
  화면 자체이니 제자리 갱신이 자연스럽지만, search는 여러 책이 늘어선 목록 화면이라 스캔된 한
  책만을 위해 목록 자체를 접어 넣는 것보다 "그 책 상세로 이동"이 사서 입장에서 더 예측 가능한
  동작이라고 봤다. 예약 대기(학생증 스캔을 기다리는 중) 상태에서 책 스캔이 들어오면 그 대기를
  접고(`setReservingTitleId(null)`) 이동한다 — book-detail이 새 책 스캔 시 `reserving` 상태를
  접는 것(같은 파일의 `useEffect(() => setReserving(false), [query.copyKey, query.titleId])`)과
  같은 이유(더 이상 화면에 남아 있지 않을 예약 대기 안내를 남겨두지 않는다).

- **초성 알고리즘 검증** — 유니코드 한글 음절 블록(U+AC00 "가" ~ U+D7A3 "힣")에서
  `choseongIndex = floor((code - 0xAC00) / (21 × 28))`로 초성 인덱스를 구한다. 코드 작성 시
  `node -e`로 실제 실행해 확인한 값(암산이 아니라 실행 결과):
  ```
  채 U+CC44 → offset 8260 → floor(8260/588)=14 → ㅊ
  식 U+C2DD → offset 5853 → floor(5853/588)=9  → ㅅ
  주 U+C8FC → offset 7420 → floor(7420/588)=12 → ㅈ
  의 U+C758 → offset 7000 → floor(7000/588)=11 → ㅇ
  자 U+C790 → offset 7056 → floor(7056/588)=12 → ㅈ
  ⇒ "채식주의자" → "ㅊㅅㅈㅇㅈ", 쿼리 "ㅊㅅㅈ"는 접두 3글자와 일치 → 매칭 성공
  아 U+C544 → offset 6468 → floor(6468/588)=11 → ㅇ
  몬 U+BAAC → offset 3756 → floor(3756/588)=6  → ㅁ
  드 U+B4DC → offset 2268 → floor(2268/588)=3  → ㄷ
  ⇒ "아몬드" → "ㅇㅁㄷ", 쿼리 "ㅇㅁㄷ"와 완전 일치 → 매칭 성공
  ```
  5,000행 목데이터(`mocks/catalog.ts`)에 위 두 예를 섞은 뒤 실제 필터 파이프라인(부분 문자열
  ∪ 초성)을 그대로 흉내 낸 스크립트로 재확인 — 초성 쿼리 "ㅊㅅㅈ"/"ㅇㅁㄷ" 둘 다 정확히 해당
  행 1건만 골라냈고, 5,002행 전체 스캔에 소요된 시간은 3ms 이하였다(완료 조건 "100ms 내"에
  여유 있게 들어온다). 행별 부분 문자열 대상(`plainText`)·초성 문자열(`choseongText`)은
  `state.rows` 참조가 바뀔 때만 `useMemo`로 다시 계산하고, 검색어 입력마다는 이미 계산된
  문자열을 재사용한다(`views/search/index.tsx`의 `searchIndex`).

- **예약 대기는 화면 전체에 하나만 허용**한다(행마다 독립적인 대기 상태를 두지 않음) — 여러
  서지의 「예약」 버튼을 동시에 누를 수 있게 하면 다음 학생 스캔이 어느 예약으로 가는지
  모호해진다. 그래서 `reservingTitleId`(전역 상태 하나)가 채워져 있으면 나머지 모든 행의
  「예약」 버튼을 비활성화한다 — book-detail(서지 하나짜리 화면이라 이 문제 자체가 없음)과
  달리 search는 목록 화면이라 이 조율이 필요했다.

## todo/16 · 등록 확장 (2026-07-15)

- **무ISBN 수동 등록을 기존 `confirm` 화면에 조건부 렌더링을 끼워넣는 대신 새 화면
  (`Screen = 'manualConfirm'`)으로 분리**했다. `confirm` 화면은 `screen === 'confirm' && lookup`
  가드로 시작해 `lookup.isbn`·`lookup.coverUrl`·`lookup.source`·`dupVisible`(ISBN 조회 시점
  중복 판정) 등 ISBN 흐름 전용 상태를 곳곳에서 참조한다. 여기에 "ISBN 없음" 분기를 섞으면
  ISBN 흐름 자체의 조건문이 더 복잡해져 "오늘과 똑같이 동작해야 한다"는 절대 요구를 깨뜨릴
  위험이 커진다. 대신 무ISBN 전용 상태(`manualForm: ManualFormState`, `EMPTY_MANUAL_FORM`)와
  전용 저장 경로(`submitManualRegister`→`registerTitle` 액션)를 완전히 분리해서, 기존
  `lookup`/`form`/`submitRegister`/`handleSave`/`beginLookup` 중 단 한 줄도 고치지 않고 새
  화면을 얹었다(diff에서 확인 가능 — 기존 함수 본문은 전부 그대로, `retryFailed`의 분기 추가와
  `handleNext`/`FailedEntry` 타입 확장만 공유 지점). 대신 시각적 언어(같은 `.reg-confirmForm`·
  `.reg-row2`·`.reg-srcTag` 클래스, 같은 라벨·버튼 배치)는 그대로 재사용해 "다른 화면인데
  다르게 안 보이는" 상태를 노렸다.
- **무ISBN 폼 필드는 사이드바 `titleForm`(`school-patch-v1/Sidebar.html` ~364행)의 부분집합만
  노출**한다 — 서명·저자(필수) + 부제·출판사·발행년·분류 코드(`categoryCodes`, 쉼표 구분)·설명
  (선택). 사이드바가 더 갖고 있는 판차(edition)·언어 코드·분류기호(classificationNo)·키워드는
  뺐다 — 데스크톱 사이드바는 사서가 앉아서 정식으로 입력하는 자리지만, 이 화면은 "폰 한 화면"
  이라는 todo의 완료 조건 자체가 입력 항목 밀도보다 손 빠른 등록을 우선한다고 읽었다. 뺀
  필드들은 모두 `registerTitle_`이 이미 기본값(빈 문자열/`KOR`)으로 처리하므로 서버 쪽엔 아무
  영향이 없다 — 나중에 필요해지면 폼에 입력 한 줄만 추가하면 된다.
- **"복본 추가"(복본 일괄 발급) 패널을 별도 화면 없이 `result` 화면 하나에 통합**했다. todo
  본문이 든 세 가지 진입 상황(① ISBN 경로로 새 서지+최초 소장본을 막 만든 직후, ② 무ISBN
  수동 경로로 막 만든 직후, ③ ISBN 조회가 이미 있는 서지임을 알아 "복본으로 추가"를 거쳐 저장한
  직후) 전부 `registerByIsbn_`/`registerTitle_`의 반환값에 `titleId`가 항상 실려 있고, 세 경우
  모두 저장 성공 후 도달하는 화면이 이미 하나(`screen === 'result'`)로 합쳐져 있었다. 그래서
  새 화면을 만들지 않고 `BulkCopyPanel`을 그 화면 아래 항상 붙였다 — 세 진입 경로를 구분하는
  코드 자체가 필요 없어졌다(모두 `result.titleId`만 본다).
- **"이 책 N권"의 N은 "이번에 새로 몇 권"이지 "총 몇 권"이 아니다** — 사용자가 입력창에 5를
  넣고 발급을 누르면 지금까지 이 패널에서 이미 발급한 개수와 무관하게 5개가 새로 추가된다
  (`BulkCopyPanel.runTo(issued.length + N)`). 부분 실패 후 "나머지 M개 재시도" 버튼만은 예외로
  같은 목표(`target`)를 그대로 재요청한다 — todo 문구 "이미 발급된 것은 그대로 두고 나머지만
  재시도"를 그대로 구현하려면 실패 시점의 목표를 기억해야 하기 때문이다.
- **순차 호출(await 하나씩) — `Promise.all` 아님**. 서버 `executeWrite_`의 `withWriteLock_`이
  모든 쓰기를 어차피 직렬화하므로 병렬로 쏴도 서버는 결국 순서대로 처리해 바코드가 서로
  충돌하지는 않는다. 하지만 그러면 클라이언트 쪽에서 "몇 번째 요청이 성공/실패했는지"가
  뒤섞여 실시간 진행률("3/5 발급 중…")과 부분 실패 시 "몇 권까지 확정됐는지"를 신뢰성 있게
  보여줄 수 없다 — 이 UI 요구 자체가 순차 호출을 강제한다(`school-patch-v1/Code.gs`의
  `apiWebRegisterCopy_` 주석에도 같은 근거를 남겼다).
- **인쇄 연동은 이번 항목에서 넣지 않았다(스코프 밖으로 명시적으로 결정)** — todo 본문이
  "당신 판단"이라고 남긴 지점. `shell.print()`/`PrintDocument`(`components/PrintDocument.tsx`)를
  쓰려면 `libraryName`이 필요한데, 기존 사용처(inventory·reports)는 전부 `useDashboardData()`를
  이미 구독 중인 화면이었다. register 뷰는 지금까지 대시보드 데이터를 전혀 참조하지 않는
  의도적으로 가벼운 화면이고(`services/api.ts`·`scanBus`·`session`만 의존), 이 패널 하나를
  위해 새 의존을 들이는 건 "발급된 바코드를 폰 화면에서 바로 보고 연필로 옮겨 적는다"는 이
  기능의 실제 사용 동선(사서가 책과 폰을 나란히 두고 한 권씩 옮겨 적음 — 인쇄물을 들고 서가를
  도는 동선이 아님)에 비해 이득보다 번들 비용·복잡도가 크다고 판단했다. 큰 굵은 모노스페이스
  목록(`.reg-bulkList`, `clamp(1.1rem, 4.5vw, 1.6rem)`)으로 화면 자체의 가독성을 높이는 쪽으로
  todo의 "연필 기입용" 요구를 충족했다. 나중에 "발급 목록을 인쇄해서 서가 담당끼리 나눠 든다"는
  요구가 실제로 나오면 그때 `PrintDocument`를 얹으면 된다.
- **웹앱 전용 wrapper의 `operationType` 문자열은 사이드바 wrapper와 다르게 새로 지었다**
  (`apiWebRegisterTitle_`→`'CREATE_TITLE'`, `apiWebRegisterCopy_`→`'CREATE_COPY'` vs 사이드바
  `apiRegisterTitle`/`apiRegisterCopy`의 `'REGISTER_TITLE'`/`'REGISTER_COPY'`) — todo 본문이
  `apiWebRegisterTitle_`에 대해 `'CREATE_TITLE'`을 명시했고, 대칭을 위해 `apiWebRegisterCopy_`도
  같은 명명 규칙(`CREATE_*`)으로 지었다. `executeWrite_`의 멱등 검사는 `requestId`가 실제로
  같을 때만 `operationType` 일치를 요구하므로(`newRequestId()`가 매 호출 새 UUID를 만든다) 이
  문자열이 사이드바 쪽과 달라도 충돌 가능성은 없다 — 다만 `18_SYS_OPERATIONS` 시트에서 폰 등록
  기록과 사이드바 등록 기록을 구분해 조회하려는 사람에게는 오히려 도움이 된다(위쪽
  `registerByIsbn_`도 자기 고유의 `'REGISTER_BY_ISBN'`을 쓰는 것과 같은 관례).
- **`FailedEntry`의 `payload`를 `RegisterPayload | ManualRegisterPayload` 유니온이 아니라
  `Record<string, unknown>` + 평평한 `title`/`isbn`/`action` 필드로 재구성**했다 — 실패 목록
  UI(`FailedList`)는 표시에 `title`/`isbn`만 있으면 되는데, 유니온으로 두면
  `ManualRegisterPayload`에는 `isbn` 키가 없어(`& Record<string, unknown>`로 흡수되긴 하지만)
  `entry.payload.isbn`의 타입이 `unknown`이 되어 JSX 자식으로 못 넣는다. 재시도
  (`retryFailed`)는 `entry.action`으로 분기해 `submitRegister`/`submitManualRegister` 중 맞는
  쪽에 `payload`를 `as` 캐스트해 넘긴다 — 두 액션의 payload 모양은 서로 다르지만 저장이 실제로
  일어나는 지점(각 `submit*` 함수)은 이미 타입이 확정된 자리라 캐스트가 안전하다.

## todo/17 · 서지 일괄 보강 (2026-07-15)

- **웹앱 설정 뷰(26)는 이번 항목에서 만들지 않았다** — todo 원문이 "웹앱 설정 뷰(26)에서 실행
  버튼"이라고 적었지만, `todo/26-settings-view.md`를 직접 열어 보니 26번 항목 자신이 "서지
  보강(17) 실행 버튼"을 자기 완료 조건으로 명시한다 — 즉 26이 17의 백엔드를 소비하는 방향이지
  그 반대가 아니다. 26이 아직 큐에 없는 상태에서 여기서 설정 뷰를 새로 만들면 26이 도착했을 때
  중복/폐기될 UI가 된다. 확인 결과 `webapp/src/registry.ts`의 `VIEW_REGISTRY`에는 `settings`
  엔트리가 전혀 없고 `webapp/src/views/`에도 관련 폴더가 없다 — 26번이 정말 빈 상태에서
  시작한다는 뜻이다. 대신 이번 항목은 (1) `Code.gs`에 `enrichBibliographic` doPost 액션을
  완결된 형태로 만들고, (2) 사이드바 관리 메뉴("서지 일괄 보강" → `runBibliographicEnrichment`)
  로 오늘 바로 완료 조건("빈 페이지수 항목이 실행 후 감소 로그")을 시연 가능하게 했다. 웹앱
  파일은 단 한 바이트도 건드리지 않았다(`npm run size` 결과 work desktop 69.4KB·student
  51.6KB로 todo/16 기준과 완전히 동일 — 번들 델타 0 확인).

- **"페이지 채움"을 `03_TITLES`가 아니라 `21_BOOK_CACHE`에 캐시 행을 만드는 일로 재해석**했다 —
  `03_TITLES`에는 애초에 페이지수 컬럼이 없다(HEADERS 배열 확인, `docs/ASSUMPTIONS.md` todo/11
  섹션이 이미 이 갭을 발견해 `apiWebTitleDetail_`이 `21_BOOK_CACHE`를 isbn13으로 최선노력
  조인하도록 만들어 뒀다). 따라서 이 배치의 실제 임무는 TITLES를 수정하는 게 아니라, TITLES에
  있는 모든 ISBN에 대해 `21_BOOK_CACHE`가 `page_count` 있는 행을 갖도록 채워서 그 기존 조인이
  실제로 값을 찾아내게 만드는 것이다. `cover_url`은 `03_TITLES`의 정식 컬럼이므로 이건 그대로
  TITLES에 직접 쓰되, 이미 값이 있으면 절대 덮어쓰지 않는다("채움"이지 "재조회 갱신"이 아니다).

- **후보 판정을 O(titles×book_cache)가 아니라 O(titles+book_cache)로 만들려고 인덱스를 새로
  만들었다**(`buildBookCacheIndexByIsbn_`) — 기존 `findBookCacheRow_`는 호출 1회마다
  `21_BOOK_CACHE`를 선형 탐색하는데(단건 조회 전용으로 설계됨, `apiLookupIsbn_`처럼 ISBN 1개만
  다루는 곳에서는 문제 없음), 이 배치는 전체 `03_TITLES`를 훑어 후보를 골라야 해서 그대로
  재사용하면 CLAUDE.md 절대 규칙 8번(파생 뷰 O(n²) 금지)에 걸린다. 대신 후보 "선정" 단계에서만
  새 인덱스 함수로 `21_BOOK_CACHE`를 1회 인덱싱하고, 실제 "처리" 루프(상한 ≤200건으로 이미
  크기가 고정됨)에서는 기존 `findBookCacheRow_`를 그대로 재사용했다 — 상한이 걸려 있어 titles
  전체 크기와 무관하게 안전하다. `findBookCacheRow_`/`bookCacheRowToPayload_`/`upsertBookCache_`/
  `lookupAladin_` 네 함수는 본문을 전혀 수정하지 않았다.

- **재실행 이어가기("resume")는 커서/북마크 없이 "후보 집합이 매번 자연히 줄어드는" 성질로
  구현**했다 — 이번 실행에서 채운 서지는 다음 실행의 후보 집합에서 자동으로 빠지므로, 매 실행이
  항상 "안정 순서의 다음 N건"을 그대로 뽑기만 해도 여러 번의 실행이 전체 백로그를 누적
  커버한다. 별도 진행 상태를 저장할 시트/프로퍼티가 필요 없다.

- **안정 순서는 `title_id` 정렬이 아니라 시트 원본 행 순서(= `readTable_`가 이미 보존하는
  append-only 생성 순서)를 그대로 썼다** — todo 본문이 "e.g. by title_id"라고 예시를 들었지만,
  실제로 `title_id`는 `newId_()`가 `Utilities.getUuid()` 기반으로 생성하는 랜덤 문자열이라
  사전식 정렬해도 생성 순서·서가 위치 등 어떤 의미 있는 순서와도 무관하다. 반면 시트 원본 행
  순서는 이미 안정적이고(같은 행 집합이면 항상 같은 순서) 오래된 서지(대개 폰 등록 이전, 알라딘
  조회를 거치지 않았을 가능성이 더 높은 서지)부터 먼저 보강한다는 의미도 있어 더 나은 선택이라고
  판단했다.

- **`ENRICH_BIBLIOGRAPHIC_BATCH_LIMIT_ = 200`은 리터럴 상수로 뒀다**(`getConfig_`/CONFIG 시트
  키로 만들지 않음) — `VIZ_LOAN_HEATMAP_DAYS_`·`TITLE_DETAIL_LOAN_HISTORY_LIMIT_` 등 이
  코드베이스의 기존 배치/조회 상한들이 전부 이런 리터럴 `var ..._ = N;` 관례를 따르고, CONFIG
  시트에 새 키를 추가하려면 스키마를 건드려야 해서(이번 스코프의 "추가만" 원칙에서 시트 스키마는
  대상이 아니지만 굳이 필요하지 않은 확장이라고 판단) 더 무거워진다. 다만 `payload.limit`을
  선택적으로 받아 **상한을 줄이는 방향으로만** 허용했다(`Math.min(requested,
  ENRICH_BIBLIOGRAPHIC_BATCH_LIMIT_)`) — 호출자가 상한 자체를 넘어서게 만들 수는 없어 안전
  마진(UrlFetch 절약)이 항상 보장되면서도, todo/26이나 테스트가 "이번엔 10건만" 같은 작은
  실행을 원할 때 재량을 준다.

- **실패 처리 방식**: `lookupAladin_(isbn)` 호출을 후보 하나마다 개별 `try/catch`로 감쌌다 —
  절판·품절 ISBN은 `fail_('NOT_FOUND', ...)`을, 네트워크/파싱 오류는 `fail_('ALADIN_UNAVAILABLE',
  ...)`을 던지는데(둘 다 `Error`를 `throw`하는 `fail_`의 표준 동작), 이 오류들은 그 한 건만
  `failures` 배열(메모리 내 요약, `{titleId, isbn, code, message}`)에 쌓고 다음 후보로 계속
  진행한다 — 배치 전체를 절대 중단하지 않는다. 감사 로그는 후보 1건마다 남기지 않고 실행 전체를
  요약하는 `writeAudit_` 호출 1번(`action_code='ENRICH_BIBLIOGRAPHIC'`, `entity_type='BATCH'`,
  `entity_id='BIBLIOGRAPHIC'`)만 남긴다 — 실패가 수백 건이어도 `15_AUDIT_LOG`가 부풀지 않는다.

- **`21_BOOK_CACHE` 쓰기(`upsertBookCache_`)는 `executeWrite_`의 보상 트랜잭션(`transaction`)에
  태우지 않았다** — `upsertBookCache_` 자신이 이미 일반 `updateRecord_`/`appendRecord_`만 쓰고
  `transactionUpdateRecord_`/`transactionAppendRecord_`를 쓰지 않게 설계돼 있다(위쪽 주석
  "BOOK_CACHE는 조회 결과 재사용을 위한 부가 캐시 시트일 뿐 진위 데이터가 아니다" 참고,
  `apiLookupIsbn_`도 트랜잭션 밖에서 호출). 이 배치가 나중에 실패해 롤백되더라도 그 사이 캐시에
  적재된 `page_count` 자체는 유효한 조회 결과이므로 되돌릴 이유가 없다고 판단했다 — 롤백 대상은
  `03_TITLES.cover_url` 변경(`transactionUpdateRecord_`로 정확히 태움)과 감사 로그뿐이다.

- **배치 자체는 `dailyLibraryMaintenance`와 달리 트랜잭션(보상 컨텍스트)을 그대로 활용**했다 —
  todo가 "간단한 비-트랜잭션 변형도 당신 판단"이라고 열어 뒀지만, `executeWrite_`가 어차피
  `transaction`을 만들어 콜백에 넘겨주므로 `TITLES.cover_url` 갱신에 `transactionUpdateRecord_`를
  쓰는 데 추가 비용이 없고, 이 코드베이스의 다른 모든 쓰기 경로(`checkout_`/`return_`/
  `reconcileCopyStatuses_` 등)와 동일한 규약을 유지하는 편이 향후 유지보수자가 "이 함수만 왜
  롤백이 안 되지"라고 헷갈릴 위험을 없앤다고 판단했다.

- **`buildLibraryMenu_`의 `adminMenu` 체인에 한 줄 추가** —
  `.addItem('서지 일괄 보강', 'runBibliographicEnrichment')`. 이 체인은 마지막 항목이 `;`로
  끝나는 fluent chain이라 새 항목을 추가하려면 기존 마지막 줄의 종결자를 `;`→`,`로 바꾸고 그
  아래 새 줄을 추가해야 한다(JS 문법상 불가피) — `installLibraryTriggers`에 독립 구문 한 줄을
  더한 todo/06의 선례(완전히 순수한 신규 줄 추가)와는 diff 모양이 살짝 다르지만, 같은 급의
  예외로 취급했다. `git diff`로 확인한 결과 `buildLibraryMenu_` 함수 안에서 실제로 바뀐 줄은
  이 두 줄(종결자 변경 1줄 + 신규 `.addItem` 1줄)뿐이고, 그 함수의 다른 어떤 줄도 건드리지
  않았다.

## todo/18 · 시각화 V1 2차 (2026-07-15)

- **`runVizDailyBatch_`의 `rows` 배열·`apiWebViz_`의 `validTypes` 배열에 각각 4줄만 추가**했다
  (`computeLoanTimeOfDayViz_`/`computeOverdueFlowViz_`/`computeClassParticipationViz_`/
  `computeMonthlyLoanCurveViz_`, 타입 문자열 `loan-time-of-day`/`overdue-flow`/
  `class-participation`/`monthly-loan-curve`) — todo/06이 만든 기존 4행·4개 타입 문자열의
  순서·값은 그대로다. `git diff`로 두 배열 다 순수 추가만 있었음을 확인했다(사용 방식은
  `installLibraryTriggers`/`buildLibraryMenu_`에 이미 쓰인 것과 같은 급의 "배열 확장" 예외).

- **연체 "발생"/"해소"의 정확한 정의**(`computeOverdueFlowViz_`) — 발생(occurred) = `due_at`이
  그 주에 속하고 이미 지난 날짜(`due_at < now`)이며, 아직 안 돌아왔거나(`returned_at` 없음 =
  지금도 연체 중) 늦게 돌아온 경우(`returned_at > due_at`). 해소(resolved) = `returned_at`이 그
  주에 속하고 `returned_at > due_at`인 경우만(제때 반납은 애초에 연체였던 적이 없으므로 "해소"로
  세지 않는다). 둘 다 계산 시점(`now`)과 무관하게 고정되는 사건이라(발생은 `due_at`, 해소는
  `returned_at` 기준) 언제 다시 돌려도 같은 주에 같은 값이 나온다 — 이 정합성이 "정책이 듣고
  있나"를 실제로 판단할 수 있게 하는 전제다. 창은 12주(≈1분기)로 잡았다 — VIZ.md가 정확한 주
  수를 명시하지 않아 임의 지정이지만, "추세가 꺾였는가"를 봐야 하는 목적이라 예약 압력의 6주
  (todo/06, 그냥 스파크라인 원재료)보다 길게 잡았다.

- **"반 참여 링"의 `noLoanRatio`는 VIZ.md 원문 "반별 미대출 비율" 그대로 방향을 유지**했다
  (`computeClassParticipationViz_`) — 값이 높을수록 그 반의 참여가 낮다는 뜻이다. 프론트
  (`ClassParticipation.tsx`)만 링을 채울 때 `participationRatio = 1 - noLoanRatio`로 뒤집어
  쓴다 — 링이 꽉 찰수록 "잘 빌리는 반"으로 직관적으로 읽히게 하려는 화면 쪽 선택일 뿐, 서버
  지표 자체의 이름·방향은 바꾸지 않아 둘의 관계가 나중에 헷갈리지 않게 했다. 무대출 판정 기간은
  reportNoLoanFinder_(todo/05)가 이미 쓰는 "최근 90일" 기본값을 그대로 재사용했다 — 정확히 같은
  질문("누가 최근에 안 빌렸나")을 반 단위로 다시 묻는 것뿐이라 별도 기간 정의를 또 만들지
  않았다.

- **하루의 파도(`computeLoanTimeOfDayViz_`)는 대출 잔디의 365일 창 대신 "최근 90일" 창을
  썼다** — 이 차트가 답하는 질문("점심 피크 — 스테이션·도우미 배치 근거")은 지금 이 학기
  운영에 필요한 인력 배치라, 방학처럼 패턴이 전혀 다른 옛 데이터가 섞이면 피크가 흐려진다.
  reportNoLoanFinder_가 이미 쓰는 "최근 90일" 창을 그대로 재사용해 새 기간 정의를 늘리지
  않았다. 시각(hour)은 스크립트 런타임 시간대가 아니라 `Utilities.formatDate(…, TIMEZONE,
  'H')`로 뽑는다 — `formatDate_`/`formatDateTime_`과 같은 관례(시간대 명시)를 그대로 따른
  것이다.

- **열두 달 곡선(`computeMonthlyLoanCurveViz_`)은 "현재 연도 포함 최근 4개년"으로 상한을
  뒀다** — VIZ.md는 "다년 겹침"이라고만 하고 몇 년인지 명시하지 않아 임의 지정이다. 겹쳐
  그리는 라인이 그보다 많아지면 방학 골짜기·개학 산의 대비가 오히려 흐려진다고 판단했다.
  대출 기록이 전혀 없는 연도는 결과 배열에서 뺐다(빈 0라인을 그리지 않는다 — 도서관 시스템
  가동 초기라 아직 데이터가 없는 지난 연도가 있을 수 있어서). 연·월 추출은 `formatDate_`
  (TIMEZONE 고정) 문자열을 슬라이스하는 방식을 썼다 — reportHomeroomClass_가 이미 쓰는 것과
  같은 관례.

- **연체 흐름의 두 계열(발생/해소) 색은 DESIGN.md의 범주(≤6) 고정 순서(deep·brass·pass·wait·
  ink-2·fail) 대신 발산 램프의 양 끝(`--viz-div-1`=fail·`--viz-div-5`=pass)을 썼다**
  (`OverdueFlow.tsx`) — DESIGN.md가 발산 램프를 정확히 "fail↔paper↔pass의 ±비교"용으로
  정의해 두었고, 발생(나쁜 쪽이 늘어나는 것)과 해소(좋은 쪽이 늘어나는 것)는 문자 그대로 그
  ±비교이지, 회전율 사분면의 4분류(스타/신참/잠자는/죽은, 딱히 좋고 나쁨의 축이 아닌 이름
  나열형 범주)와는 성격이 달라서다. 범주 고정 순서 규칙은 "이름 나열형 범주"에 적용하고, 이미
  존재하는 발산 램프의 원래 의미(±비교)에 정확히 들어맞는 경우에는 그 램프를 쓰는 것이 더
  DESIGN.md의 취지에 맞는다고 판단했다.

- **열두 달 곡선의 다년 라인 색은 순차 램프(`--viz-seq-1~5`)를 "최근성" 축에 재해석해 배정**
  했다(`MonthlyLoanCurve.tsx`) — 가장 최근 연도가 항상 `--viz-seq-5`(가장 짙음), 오래된
  해일수록 한 단계씩 옅어지되 `--viz-seq-2` 밑으로는 내려가지 않는다(1단은 paper에 너무
  가까워 선이 안 보인다). 순차 램프는 원래 "적음↔많음" 크기 비교용(DESIGN.md)이지만, "오래됨
  ↔최근"이라는 또 다른 단일 축의 크기 비교로 재사용한 것뿐이라 새 토큰을 만들지 않았다.

- **대시보드 착륙 지점 = 대출 잔디 + 예약 압력(기존) + 하루의 파도 + 열두 달 곡선(신규),
  리포트 허브 `viz-insights` 착륙 지점 = 트리맵 + 사분면(기존) + 연체 흐름 + 반 참여 링
  (신규)**으로 나눴다(task 노트가 제안한 분할을 그대로 채택) — 앞 둘 다 "매일 훑어보는 운영
  신호"(하루의 파도·열두 달 곡선도 시계열 관찰용이라 대출 잔디·예약 압력과 같은 성격)이고,
  뒤 둘은 "가끔 들여다보는 반/정책 단위 의사결정 자료"에 가깝다.

- **하루의 파도·열두 달 곡선은 행동 버튼을 달지 않았다** — 둘 다 순수 관찰용 질문("언제
  붐비나", "방학 골짜기·개학 산")이고 이 항목 범위에는 근무 배치 화면 같은 자연스러운 이동
  목적지가 없다(`registry.ts`의 `ViewId`에 그런 뷰가 없음). 대출 잔디(todo/06)가 이미 쓴 것과
  같은 VIZ.md 원칙 ③ 예외를 그대로 따랐다.

- **연체 흐름의 행동 버튼은 회수 쪽지(`recall-notice`) 리포트로 연결**했다
  (`onNavigate('reports', { type: 'recall-notice' })`) — "연체가 쌓이고 있다"를 본 다음 취할
  수 있는 가장 직접적인 다음 행동이 담임별 회수 쪽지 인쇄이기 때문이다. 아이콘도
  DashboardBaseLayer.tsx의 `QUIET_SIGNALS.recallNotice`와 같은 `Megaphone`을 재사용했다
  (DESIGN.md "같은 행동 같은 이름 관통").

- **반 참여 링의 행동은 카드 전체에 버튼 하나를 다는 대신, 링(반) 하나하나를 클릭 가능한
  버튼으로 만들어 그 반의 `grade`/`classNo`를 담임 리포트로 그대로 넘기는 방식**으로
  구현했다(`ClassParticipation.tsx`) — 카드 전체 버튼 하나로는 "어느 반인지" 특정할 수 없어
  task 노트가 요구한 "직행"이 되지 않는다. 이어서 `views/reports/index.tsx`의
  `HomeroomReportPanel`이 `initialGrade`/`initialClassNo` props(반 참여 링에서 넘어온
  경우에만 존재)를 받으면 입력칸을 채우고 진입 즉시 1회 자동으로 미리보기까지 실행하도록
  확장했다 — 담임 리포트 5개 패널 중 유일하게 이미 예외였던 `UnpaidFinesPanel`(진입 즉시
  자동 조회) 급의 새 예외가 하나 더 생긴 셈이다. 반 참여 링을 거치지 않고 리포트 허브 카드로
  직접 들어오면(`initialGrade`/`initialClassNo` 둘 다 없음) 기존과 동일하게 1학년 1반
  기본값 + 수동 미리보기 버튼 그대로다(과거 동작 보존).

## todo/19 · 시각화 V1 3차(마지막) (2026-07-15)

- **`runVizDailyBatch_`의 `rows` 배열·`apiWebViz_`의 `validTypes` 배열에 각각 4줄만 추가**했다
  (`computeShelfHeatmapViz_`/`computeCollectionAgeViz_`/`computeGradeReadingGapViz_`/
  `computeBudgetViz_`, 타입 문자열 `shelf-heatmap`/`collection-age`/`grade-reading-gap`/
  `budget-picture`) — todo/06·todo/18이 만든 기존 8행·8개 타입 문자열의 순서·값은 그대로다.
  `git diff`로 두 배열 다 순수 추가만 있었음을 확인했다(todo/18과 같은 급의 "배열 확장" 예외).
  이걸로 VIZ.md V1 표의 12행이 전부 이 두 배열에 모였다.

- **서가 온도(`computeShelfHeatmapViz_`)는 "이 소장본이 지금 서가를 점유하는가" 필터를
  회전율 사분면(`computeTurnoverQuadrantViz_`)과 정확히 똑같이(AVAILABLE/ON_LOAN/HOLD_READY/
  REPAIR) 재사용**했다 — 같은 질문을 다른 축(서가별)으로 다시 묻는 것뿐이라 새 필터를 만들지
  않았다. `shelf_code`는 `acquisition_source`처럼 CODEBOOK 코드군이 없는 자유 텍스트라, 물리적
  배치 순서(층·구역 접두사 같은 관례)를 문서·코드 어디에서도 찾지 못해 자연수 인식 정렬 대신
  **plain `localeCompare`로 사전순 정렬**했다(`reportWeedingRecommend_`의
  `acquiredAtText.localeCompare`/`purchaseCandidates`의 `title.localeCompare`와 같은 기존
  관례를 그대로 재사용 — GAS V8에서 `localeCompare(..., {numeric:true})` 같은 옵션 인자의
  런타임 동작을 검증할 방법이 없어 이미 안전이 확인된 무옵션 형태만 썼다). "죽은 구역" 판정
  (어느 정도가 "차갑다"인지의 임계값)은 서버가 내리지 않고 프론트(`ShelfHeatmap.tsx`의
  `levelForAvg`)가 상대 비교로 정한다 — `TurnoverQuadrant.tsx`의 `quadrantFor`·
  `ClassParticipation.tsx`의 `levelForRatio`와 같은 분업.

- **장서 나이(`computeCollectionAgeViz_`)의 상태 6종 고정 순서는 새로 정하지 않고 08_COPIES
  `status_code` 데이터 검증 배열(`LIBRARY_MVP.VALIDATIONS`)이 이미 쓰는 순서
  (AVAILABLE·ON_LOAN·HOLD_READY·REPAIR·LOST·WITHDRAWN)를 그대로 재사용**했다 — DESIGN.md
  범주(≤6) 고정 팔레트 한도에 정확히 맞아떨어진다(상태값 자체가 정확히 6종이라 "기타" 버킷이
  필요 없다). **"미점검"(차트 이름 자체가 "노후·미점검 장서 규모"라고 명시)은 7번째 색 계열로
  쪼개지 않고 최상위 요약 숫자(`staleUncheckedCount`) 하나로만 내려준다** — 7종째 색을 얹으면
  범주 고정 팔레트 한도(≤6)를 넘기 때문이다. 이 요약은 현재 유통 중(AVAILABLE/ON_LOAN/
  HOLD_READY/REPAIR)인 소장본 중 `last_inventory_at`이 비었거나
  `VIZ_COLLECTION_AGE_STALE_INSPECTION_DAYS_`(**새로 임의 지정한 365일** — todo/14 장서점검은
  "언제 점검했는지" 필드만 추가했을 뿐 "얼마나 오래되면 재점검이 필요한가" 기준을 정의하지
  않아, 기존에 재사용할 만한 값이 없었다)보다 오래된 것의 개수다.

- **학년 독서 격차(`computeGradeReadingGapViz_`)는 반 참여 링/미대출 발굴이 이미 쓰는 "최근
  90일" 창을 재사용하지 않고 180일(약 한 학기)로 새로 잡았다** — "정확히 같은 질문의 재사용"이
  아니라고 판단했기 때문이다: 반 참여 링은 "요즘 누가 안 빌렸나"라는 순간 스냅샷이지만, "어느
  학년이 비어 있나"는 학년 전체의 독서 습관 격차라는 더 느린 신호라 90일(한 분기)로는 시험
  기간 같은 일시적 요철에 너무 민감하게 흔들릴 수 있다고 봤다. VIZ.md는 정확한 기간을 명시하지
  않아 임의 지정이다. 버킷 인덱싱은 회전율 사분면이 이미 정의해 둔 `vizBucketIndex_` 헬퍼를
  그대로 재사용했다(새 버킷 로직을 또 만들지 않음). 버킷 4단(0회·1~3회·4~10회·11회+)의 색은
  이름 나열형 범주가 아니라 "적음↔많음"이라는 순서형 축이라 범주 고정 순서 대신 순차 램프
  (`--viz-seq-1~4`)를 배정했다 — 0회 버킷이 가장 옅은 색인 것 자체가 "비어 있음"을 시각적으로
  대변한다.

- **예산 그림(`computeBudgetViz_`)의 출처 버킷은 `reportDonorThanks_`(todo/09)가 이미 확립한
  자유 텍스트 그룹 키(`acquisition_source` 원문 문자열, `cleanText_`만 거침, CODEBOOK 코드군
  없음)를 정확히 그대로 재사용**했다 — 새 분류 체계를 만들지 않았다. 다만
  `reportDonorThanks_`는 그룹을 몇 개든 표로 나열하지만(리포트라 줄 수 제한이 없음), 이
  차트는 DESIGN.md 범주(≤6) 고정 팔레트 안에 있어야 해서(적층 영역의 색 계열 수 = 팔레트
  크기) **누적 금액 상위 5개(`VIZ_BUDGET_MAX_SOURCES_`)만 개별 계열로 두고 나머지는 "그 외
  출처"(`VIZ_BUDGET_OTHER_LABEL_`) 한 계열로 합쳤다**(정렬 동률은 `reportDonorThanks_`와 같은
  `localeCompare` 타이브레이크). **"기타"라는 문구는 의도적으로 쓰지 않았다** —
  `acquisition_source`가 자유 텍스트라 사서가 실제로 그 칸에 문자 그대로 "기타"를 입력해 뒀을
  수 있고, 그 값과 이 합산 버킷이 같은 라벨로 뒤섞이면 어느 쪽인지 헷갈린다(단, "그 외 출처"
  역시 이론상 똑같은 문구가 실제 입력값으로 존재할 극히 희박한 가능성까지는 막지 못한다 —
  `reportDonorThanks_`도 이런 자유 텍스트 충돌을 애초에 막지 않는 것과 같은 수준의 잔여
  위험으로 받아들였다).

- **예산 그림의 인쇄 호환(과제 노트가 명시한 요구 — todo/24 R3 연간 운영 보고서가 이 차트를
  그대로 삽입할 예정)은 `styles/print.css`/`PrintDocument.tsx`를 손대지 않고(읽기 전용
  참고로만 확인) `BudgetPicture.tsx` 쪽에서 세 가지로 해결**했다: ① 각 밴드 오른쪽 끝에
  출처명을 `<title>` 툴팁이 아니라 항상 보이는 `<text>`로 직접 라벨링, ② 밴드 사이에
  `var(--panel)` 테두리를 그어(CategoryTreemap.tsx의 rect stroke 관례 재사용) 색이 흑백
  인쇄에서 뭉개져도 경계가 보이게 함, ③ 범례를 스와치+출처명+`Intl.NumberFormat` 금액을 항상
  텍스트로 함께 표시(색만으로 구분하지 않음). 그래도 화면이 완전히 washed out되는 극단적
  경우를 대비해 다른 11종과 동일한 sr-only `<table>` 대체(모든 연도×출처 숫자)를 그대로
  유지했다 — `print.css`의 `.print-root table` 규칙이 어떤 `<table>`이든 테두리를 검정으로
  강제하므로 표 하나만으로도 이 차트의 정보가 전부 보존된다는 점을 근거로 확인했다(DESIGN.md
  "인쇄" 절 자체가 인쇄 밀집 콘텐츠는 표 중심으로 간다고 이미 전제함). `print.css`/
  `PrintDocument.tsx`를 실제로 고쳐야 할 필요는 발견하지 못했다 — `docs/BLOCKERS.md`에 남길
  실사용 블로커는 없었다.

- **예산 그림은 행동 버튼을 달지 않았다**(VIZ.md 원칙 ③의 명시적 예외) — 이 차트의 "그래서
  뭘 하나"는 화면 안 이동이 아니라 todo/24가 만들 인쇄 보고서에 그대로 삽입되는 것 자체이고,
  그 리포트가 아직 없어(todo 범위 밖) 지금 누를 수 있는 버튼이 없다. 대출 잔디/하루의 파도/
  열두 달 곡선(todo/06·18)이 이미 쓴 것과 같은 등급의 예외다.

- **서가 온도의 행동 버튼은 장서점검(`inventory`) 뷰로 연결**했다(`onNavigate?.('inventory')`,
  파라미터 없음) — "죽은 구역을 찾았다" 다음의 가장 직접적인 행동이 그 서가를 다시 훑어보는
  점검 세션 시작이기 때문이다. `inventory` 뷰(`views/inventory/index.tsx`)는 어느 서가인지
  특정해 받는 파라미터 계약이 아직 없어(세션 시작 버튼 하나로 전체 스캔 세션을 시작하는 구조)
  특정 서가로 필터링된 진입은 지원하지 못하지만, "점검을 시작할 수 있는 화면으로 이동"이라는
  최소 계약은 만족한다.

- **장서 나이의 행동 버튼은 트리맵·회전율 사분면과 같은 `weeding-recommend` 리포트로
  연결**했다 — "노후 + 이미 폐기·분실" 비중이 큰 연도를 본 다음 취할 다음 행동이 그 리포트이기
  때문이다(정확히 같은 목적지를 세 번째로 재사용).

- **학년 독서 격차의 행동은 카드 전체 버튼 하나 대신 학년(행) 하나하나를 클릭 가능한 버튼으로
  만들어 그 학년의 `grade`만 담임 리포트로 넘기는 방식**으로 구현했다(`ClassParticipation.tsx`
  반 참여 링과 같은 이유 — 카드 전체 버튼 하나로는 "몇 학년"인지 특정할 수 없다). 다만 이
  차트는 학년 단위 집계라 `classNo`까지는 특정할 수 없다 — `views/reports/index.tsx`의
  `HomeroomReportPanel`은 `initialClassNo`가 없으면 자동 미리보기를 건너뛰고 학년 칸만 채운 채
  기본 1반으로 대기한다(기존 동작 그대로, 이 항목에서 그 패널의 코드를 바꾸지 않았다 — 이미
  `grade`만 오는 경우를 정확히 이렇게 처리하도록 만들어져 있었다).

- **대시보드 착륙 지점에 서가 온도 1종만 추가하고(대출 잔디+예약 압력+하루의 파도+열두 달
  곡선+서가 온도, 총 5종), 리포트 허브 `viz-insights` 착륙 지점에 장서 나이·학년 독서 격차·
  예산 그림 3종을 추가**했다(트리맵+사분면+연체 흐름+반 참여 링+장서 나이+학년 독서 격차+
  예산 그림, 총 7종) — 4종을 정확히 2+2로 균등 분배하지 않은 이유: 장서 나이는 트리맵·회전율
  사분면과 같은 "폐기 판단" 계열(같은 `weeding-recommend` 목적지), 학년 독서 격차는 반 참여
  링과 같은 "참여 판단" 계열(같은 `homeroom-report` 목적지), 예산 그림은 과제 노트가 명시한
  대로 인쇄 보고서(todo/24) 재료라 그 목적지에 더 가까운 이 허브가 자연스러웠다. 반대로 서가
  온도는 "지금 서가가 어떤 상태인가"를 훑어보는 공간적 스냅샷이라 대출 잔디·예약 압력·하루의
  파도·열두 달 곡선과 같은 "매일 훑어보는 운영 신호" 성격에 더 가깝다고 판단했다. `viz-insights`
  칸이 4→7개로 늘어 과제 노트가 예시로 든 "6개는 부담스러울 수 있다"는 임계치를 넘지만, 이
  칸이 쓰는 `.reports-viz-grid`가 이미 `repeat(auto-fit, minmax(320px,1fr))` 자동 줄바꿈
  그리드이고(같은 리포트 허브의 유형 선택 카드 그리드도 이미 7장을 문제없이 담고 있음) 새
  상태·토글을 도입하는 "더 보기" UI 없이도 그냥 줄이 하나 더 생기는 것으로 충분하다고 판단해
  별도 접기/탭 UI를 새로 만들지 않았다.

- **`viz/viz.css`에 새 클래스만 추가**(`.viz-shelf-grid`/`.viz-shelf-tile`/`.viz-stack-bar-rect`/
  `.viz-grade-strip-*`/`.viz-budget-*`)했고 기존 클래스는 손대지 않았다 — 여전히 색상 리터럴
  없이 `var(--token)`/`var(--viz-seq-*)`/`var(--viz-div-*)`/DESIGN.md 범주 고정 토큰만
  참조한다(`grep -rEn '#[0-9a-fA-F]{3,6}' src/viz` 0건으로 확인).

## todo/20 · /b/ 공개 책 페이지 (읽기 전용) (2026-07-15)

- **핵심 설계 결정 — `doPost`를 건드리지 않고 완전히 독립된 `doGet(e)`을 새로 추가**했다
  (`school-patch-v1/Code.gs`, `doPost` 함수 바로 뒤). 기존 모든 action은
  `assertMobileToken_(MOBILE_REG_TOKEN)`을 거치는데, 이 토큰은 "사서 기기만 아는 공유 비밀"이
  존재 이유다 — 학생 공개 번들(`webapp/src/student/**`)에 이 토큰을 심으면(어떤 형태로든) 누구나
  네트워크 탭에서 추출해 대출·반납 같은 쓰기 액션까지 흉내 낼 수 있어 토큰 자체의 존재 이유가
  무너진다. GAS Web App은 `doPost`·`doGet`을 동시에 정의할 수 있다는 점을 이용해, 인증이 아예
  없는 순수 읽기 전용 진입점을 별도로 뒀다 — `doPost`·`assertMobileToken_`·`executeWrite_`·
  `checkout_`·`return_` 등 기존 함수는 `git diff`로 삭제/수정 라인 0건(순수 추가)임을 확인했다.
  `apiPublicBookPage_`/`publicAvailability_`도 새 함수이고, 기존 조회 헬퍼(`findCopyByKey_`·
  `findByIdRequired_`·`readTable_`·`runApi_`·`indexBy_`·`findBookCacheRow_` 등)만 읽기 전용으로
  재사용했다 — 쓰기 로직(`executeWrite_`)은 아예 거치지 않는다(바꿀 상태가 없다).

- **응답 필드를 8개로 엄격히 고정**했다(barcode 에코 포함): `barcode · title · subtitle ·
  authors · publisher · coverUrl · classification · pageCount · availability`. 이 목록에 없는
  것 — 회원/대출자 이름, 예약 대기열(`11_RESERVATIONS`), `title_id`/`copy_id` 등 내부 ID,
  `isbn13`, `description`, `08_COPIES.status_code` 원문. `apiWebTitleDetail_`(사서 전용,
  대출이력·회원명·예약 대기열까지 포함)과 조인 로직은 같지만 반환 객체는 완전히 다른, 훨씬 좁은
  셰이프다 — 같은 함수를 얇게 감싸는 방식(사서용 결과에서 민감 필드만 사후 제거)이 아니라 처음부터
  별도 함수(`apiPublicBookPage_`)로 새로 짜서 "실수로 필드 하나가 새 나가는" 리스크 자체를
  구조적으로 없앴다.

- **대출 가능 여부를 3단(`AVAILABLE`/`ON_LOAN`/`UNAVAILABLE`)으로만 뭉갰다**
  (`publicAvailability_`). `08_COPIES.status_code` 6종 중 `HOLD_READY`(특정 회원에게 배정된
  예약)·`REPAIR`·`LOST`·`WITHDRAWN`을 전부 `UNAVAILABLE`로 합친다 — 특히 `HOLD_READY`를
  `ON_LOAN`이 아니라 `UNAVAILABLE`로 묶은 것은 의도적 선택이다: 이 소장본은 대출 중이 아니라
  서가에 있지만 특정 회원을 위해 배정된 상태라, 3단 중 어느 쪽에 넣어도 "정확한 사정"은 아니지만
  `UNAVAILABLE`(지금은 빌릴 수 없어요) 쪽이 "누군가 이 책을 찜해 둠"이라는 예약 관련 정보를 조금이라도
  흘릴 위험이 없다.

- **"권장학년" 데이터 소스는 존재하지 않아 만들어내지 않고 그대로 생략했다.** 전체 저장소를
  훑어봐도(`06_CATEGORIES`/`16_CODEBOOK`/`03_TITLES` 헤더 전부 확인) 학년·연령 추천을 나타내는
  컬럼이나 코드군이 전혀 없다 — `grade`는 `09_MEMBERS`(학생 자신의 학년)에만 존재하고 도서 쪽에는
  대응 개념이 없다. 과제 노트가 "classification을 '권장학년'-스러운 프레이밍에 쓸 수 있으면 쓰고,
  없으면 지어내지 말고 생략하라"고 명시적으로 허락한 대로, `classification`(06_CATEGORIES의
  대표 분류, 예: "문학")은 반환하되 화면(`BookPage.tsx`)에는 **"권장학년"이 아니라 "분류"라는
  정직한 라벨**로 보여준다 — 분류를 학년 추천인 것처럼 재포장하지 않았다.

- **프론트가 GAS `doGet` URL을 아는 방법 — 이 라운드의 가장 애매했던 결정.** 사서 표면의
  `apiUrl`(`services/session.ts`)은 register.html 흐름으로 "기기별" localStorage에 저장되는
  값이라, 책 QR을 처음 찍어보는 낯선 방문자·학생의 브라우저에는 애초에 존재하지 않는다. 그렇다고
  `student/**`가 `services/session.ts`를 import하면 `StudentRoot.tsx`가 이미 명시한 번들 격리
  원칙(사서 셸·zustand 세션 스토어 미로딩)이 깨진다. 새 파일 `webapp/src/config/publicBackend.ts`를
  만들어 두 단계로 해석하게 했다: ① 빌드 시 채워 넣는 상수 `PUBLIC_GAS_EXEC_URL`(기본값 빈
  문자열 — CLAUDE.md 🟡 "도메인"·"Code.gs 새 버전 배포"가 둘 다 아직 사용자 결정 대기라 이
  라운드에서 실제 학교 URL을 하드코딩하지 않았다), ② `localStorage.getItem('lib.session.apiUrl')`을
  `services/session.ts`를 import하지 않고 **원시 키 이름만** 재사용(zustand 스토어는 전혀 딸려오지
  않음, 문자열 하나 읽는 것뿐 — 이 학교는 1교 1시트 단일 배포라 사서 기기에 이미 저장된 URL과
  공개 페이지가 불러야 할 URL이 사실상 같은 값이라는 점에 기댄 로컬 테스트 편의). 둘 다 없으면
  (즉 배포 담당자가 ①을 아직 채우지 않았고, 이 브라우저에 사서 세션도 없으면) 네트워크 요청 자체를
  시도하지 않고 곧장 샘플로 렌더한다 — "배포 전 = 항상 샘플" 관례를 그대로 따른다. **실제 학생
  방문자에게 진짜 데이터가 뜨려면 배포 담당자가 ①에 실제 GAS 배포 URL을 채워 넣는 후속 조치가
  필요하다** — 이 항목의 범위 밖(🟡 도메인 결정 이후)이라 다음 라운드로 넘긴다.

- **`services/publicBookData.ts`의 실패 처리 범위를 `services/titleDetail.ts`보다 의도적으로
  넓혔다.** `titleDetail.ts`는 `UNKNOWN_ACTION`일 때만 샘플로 폴백하고 그 밖의 서버 오류(예:
  `COPY_NOT_FOUND`)는 진짜 오류로 그대로 올려보낸다. 이 파일은 네트워크 실패·JSON 파싱 실패·
  `{ok:false}` 오류 응답을 **전부** 샘플 폴백으로 처리한다 — 과제 노트가 "network error, 404, or
  a JSON error response"를 전부 UNKNOWN_ACTION과 동일하게 취급하라고 명시했고, 두 가지 이유로도
  타당하다고 판단했다: (1) `doGet`은 `doPost`처럼 action 문자열을 검사하는 디스패치가 없어서,
  "아직 배포 전(구버전에 `doGet` 자체가 없음)"이라는 신호가 깨끗한 `UNKNOWN_ACTION` JSON이 아니라
  GAS가 자체적으로 뱉는 HTML 오류 페이지로 나타난다 — 우리 JSON 계약과 모양이 달라 파싱 단계에서부터
  실패하므로, "배포 전"과 "이 바코드는 진짜 없음"을 프론트에서 안정적으로 구분할 방법이 없다.
  (2) 이 표면은 인증 없는 낯선 방문자용이고 읽기 전용이라(되돌릴 데이터가 없음) 최악의 경우가
  "실재하지 않는 바코드에 샘플 표지가 뜬다" 정도다 — `SampleDataBadge`가 항상 같이 뜨므로 가짜
  성공은 아니다(CLAUDE.md 검증 원칙 준수). 사서 화면(`titleDetail.ts`)은 반대로 진행 중인 거래
  한복판에서 잘못된 샘플이 실제 오류를 가릴 위험이 더 크다고 봐서 그 화면은 기존의 좁은 폴백
  범위를 그대로 뒀다(이 항목에서 손대지 않음).

- **속도 제한(rate limiting)·쿼터 보호는 이번 라운드에 추가하지 않았다** — `doGet`은 인증이
  없는 공개 엔드포인트라 원리상 누구나 대량 호출로 컬렉션 전체 표지를 긁어갈 수 있다(과제 노트가
  이미 "실제 도서관 OPAC도 마찬가지"라고 명시적으로 허용한 위협 모델). GAS 자체의 실행 쿼터(6분
  실행 제한·일일 URL Fetch/트리거 총량)가 유일한 자연 방어선이고, 이 항목은 그 이상의 방어(예:
  `CacheService` 기반 IP 버킷)를 추가로 설계하지 않았다 — 실사용 트래픽이 나오기 전까지는
  과설계로 판단했다. 실제로 문제가 되면 후속 항목으로 넘길 사안이라 `docs/BLOCKERS.md`에는
  적지 않았다(지금 당장 막는 항목이 아니라 관측 대상).

- **cover 이미지가 없을 때(`coverUrl === ''`)도 같은 크기(120×180)의 자리표시자를 렌더**해
  레이아웃 시프트를 0으로 유지했다(FRONTEND.md 성능 예산 "표지 이미지: lazy + width/height
  명시"). 실제 `<img>`는 `coverUrl`이 있을 때만 그리고 `loading="lazy"` + 명시적 `width`/
  `height`를 붙였다 — 자리표시자 쪽은 이미지가 아니므로 lazy 속성 자체가 필요 없다.

- **`알라딘 인터넷서점` 출처 문구는 로케일과 무관하게 두 언어 사전 모두 한국어 원문 그대로
  뒀다**(`student.bookPage.footerAttribution`, ko.json·en.json 동일 값). VIZ.md가 이 문구를
  "(약관)"이라고 명시해 계약상 요구되는 고정 문자열로 취급했고, ADR-023이 애초에 번역 대상에서
  제외한 "데이터"류(서명·저자 등)에 준한다고 판단했다 — UI 언어가 en이어도 이 귀속 문구만은
  바뀌면 안 된다고 봤다.

## todo/21 · 수기입력 (2026-07-15)

- **시트 이름은 원 스펙(PATCH_SPEC.md P3)의 "20_MANUAL_ENTRY"가 아니라 "22_MANUAL_ENTRY"를
  썼다.** 그 스펙이 쓰인 뒤 20/21은 이미 다른 패치가 가져갔다 — `20_VIZ_CACHE`(todo/06),
  `21_BOOK_CACHE`(todo/17). 두 시트와 번호가 겹쳐도 실제 탭 이름 문자열은 서로 다르므로
  기술적으로는 동작하지만("20_MANUAL_ENTRY"와 "20_VIZ_CACHE"가 둘 다 존재), 혼란스러운 번호
  중복을 피하려고 다음 순번(22)을 골랐다. `LIBRARY_MVP.SHEETS.MANUAL_ENTRY` 상수 하나만 바꾸면
  되므로 나중에 사용자가 다른 번호를 원하면 되돌리기 쉽다.

- **"학번 정확일치"를 `09_MEMBERS.student_no`가 아니라 `school_no`(+ `member_no`) 기준으로
  구현했다.** 과제 메모가 예시로 든 필드명은 `student_no`였지만, 코드베이스 자체가 이미
  "학번"이라는 이름표를 다른 필드에 붙여 놨다 — `registerMember_`의 중복 검사가 `school_no`
  중복일 때 "같은 학번의 회원이 있습니다"라고 말한다(Code.gs 646~647행). `student_no`는 실제로는
  "번호"(반 좌석 번호)라는 라벨이고 `grade`+`class_no`와 묶여야만 유일하다(전교 유일이 아님,
  649~653행 dupSeat 검사). 학번 하나만으로 유일하게 특정하는 "학번 정확일치"라는 스펙 문장을
  만족하려면 실제로 전교 유일한 `school_no`를 써야 한다고 판단했다. 도서관 회원번호(`member_no`,
  `findMemberByKey_`가 이미 쓰는 식별자)도 같이 정확일치 후보로 받는다 — 사서가 학번 대신
  회원번호를 적는 경우도 흔할 것 같아서다. `resolveManualEntryMember_`(Code.gs) 주석에 같은
  근거를 남겼다.

- **`absorbManualEntries_()`는 역할 검사(`requireRole_(['ADMIN','LIBRARIAN'])`)를 행 루프
  진입 "이전"에 한 번만 한다** — `executeWrite_`도 각 행마다 같은 검사를 이미 하므로 과제 스펙
  문면만 보면 굳이 앞에 또 둘 필요는 없어 보이지만, 앞에 두지 않으면 권한 없는 계정이 실수로
  메뉴를 실행했을 때 대기 중인 행 전부가 "오류(권한 없음)"로 낙인찍혀 버린다 — 그러면 나중에
  정당한 ADMIN/LIBRARIAN이 실행해도 처리상태가 이미 채워져 있어 pending 필터에 걸리지 않고
  영원히 스킵된다. 권한 문제는 배치 전체를 조용히(행을 하나도 안 건드리고) 실패시키는 게 맞다고
  판단했다 — 동명이인 같은 "행 하나만의" 오류와는 성격이 다르다.

- **오류 행 재시도가 실패 시점에 따라 두 갈래로 갈린다는 걸 그대로 뒀다(우회하지 않았다).**
  `resolveManualEntryMember_`/구분 파싱처럼 `executeWrite_` 호출 이전에 실패한 행은 행 내용을
  고치고 처리상태 칸을 지우면 다음 실행에서 새로 시도되지만, `checkout_`/`return_`이
  `executeWrite_` 안에서 실제로 실패한 행(이미 대출 중·회원 정지 등)은 `18_SYS_OPERATIONS`에
  그 `requestId`가 `FAILED`로 이미 남아서 같은 행을 고쳐 같은 행번호로 다시 흡수해도
  `executeWrite_`(무수정)가 `FAILED_REQUEST_REQUIRES_REVIEW`로 거부한다. 이건 기존 멱등 체계의
  기존 설계("새 요청 ID로 다시 실행하라")를 그대로 물려받은 결과라 고치지 않았다 — 대신
  README.md 「수기입력」 절에 "이런 행은 고치지 말고 새 행에 다시 입력하라"고 명시했다.

- **`ensureManualEntrySheet_()`가 `barcode`·`학생(학번 또는 이름)` 열에 텍스트 서식(`@`)을
  선제적으로 건다** — 과제 스펙에 명시된 요구는 아니지만, `formatIdTextColumns_`(Code.gs
  318행)가 `08_COPIES.barcode`·`09_MEMBERS.member_no`/`school_no`에 정확히 같은 이유로 이미
  하는 조치다: 이 시트는 사서가 직접 타이핑하므로 서식이 없으면 Google Sheets가 "0000123"을
  숫자 123으로 바꿔 앞자리 0을 지워 버려 흡수 시 `findCopyByKey_`/회원 조회가 실패한다.
  `formatIdTextColumns_` 자체는 MEMBERS/COPIES만 대상으로 하드코딩돼 있어 이 시트를 모르므로,
  그 함수를 부르거나 고치지 않고 같은 기법을 이 시트 전용으로 한 번 더 적용했다.

- **`apiWebManualEntryPendingCount_`는 `ensureManualEntrySheet_()`를 부르지 않는다** — 시트가
  없으면(=아직 한 번도 안 쓰였으면) 오류 없이 `{pendingCount: 0}`을 돌려준다. 순수 읽기 액션이
  대시보드를 열어 보는 것만으로 시트를 새로 만드는 부작용을 갖는 건 이상하다고 판단했다.

- **`02_사용법` 시트(라이브 스프레드시트 안내 탭) 자체는 이 라운드에서 편집하지 않았다.**
  PATCH_SPEC 원문이 "사용법 시트에 절차 명시"라고 했지만, 그 시트는 `도서관_관리_MVP.xlsx`
  안의 실제 바이너리 셀 데이터이고 이 환경에는 `openpyxl` 등 xlsx 편집 도구가 없다(설치도
  네트워크 필요). 게다가 이 xlsx는 이미 `20_VIZ_CACHE`/`21_BOOK_CACHE` 같은 이후 스키마
  변경과 어긋난 초기 부트스트랩 템플릿이라(`ensureSchema_`가 실행 시점에 누락 시트를 자동
  생성하므로 원래도 매 패치마다 xlsx를 갱신하는 관례가 아니었다), 무리해서 바이너리를 고치기보다
  과제 지시의 대체 경로("사용법 절차가 이미 있는 문서 없으면 README/PATCH_NOTES에 적는다")를
  따랐다 — `school-patch-v1/README.md`에 "수기입력" 절을 새로 추가하고, 그 안에 "이 내용을
  실제 운영 스프레드시트의 `02_사용법` 탭에도 사서/관리자가 직접 옮겨 적으라"는 안내를 남겼다.
  `PATCH_NOTES.md`의 Phase B 체크리스트 6번도 "부분 완료"로 갱신했다.

- **웹앱 대시보드의 "수기입력 미처리" 표시는 새 KPI 카드가 아니라 헤더 메타 줄의 작은 텍스트
  하나로 넣었다**(`dash-header-meta`, 아이콘 + 라벨 + 필요 시 `SampleDataBadge`) — 과제가
  "새 카드가 과하면 안 만들어도 된다"고 위임했고, 이 값은 "GAS가 죽어 있던 동안 쌓인 예외
  상황" 신호라 KPI 그리드의 일상 운영 지표들과 같은 무게로 두기보다 상시 노출되는 가벼운
  텍스트가 알맞다고 판단했다. 다만 이 건수를 바꾸는 사건(`absorbManualEntries_` 실행)은
  스프레드시트 메뉴에서 GAS 쪽에서 일어나 웹앱의 `dataChangeBus`(웹앱 자체 쓰기 후에만 발화)가
  감지하지 못하므로, 기존 대시보드 「새로고침」 버튼 클릭 시 이 값도 함께 다시 가져오도록
  `services/manualEntryData.ts`의 `refresh()`를 연결했다(대시보드 진입 시 1회 로드 + 새로고침
  버튼 + 다른 웹앱 트랜잭션 이후 자동 갱신, 그 사이에는 최신이 아닐 수 있음).

## H3 · iOS 설치형 PWA doPost 응답 수신 실패 (2026-07-15, 긴급 인터럽트)

- **`lookupIsbn`을 GET 허용 목록(읽기 전용)에 그대로 포함했다** — `apiLookupIsbn_`은 캐시 미스일 때
  `upsertBookCache_`(21_BOOK_CACHE에 `appendRecord_`/`updateRecord_`로 직접 씀)를 호출해 엄밀히는
  "부작용 0"이 아니다. 하지만 이건 이 항목에서 새로 생긴 성질이 아니라 `lookupIsbn`이 원래부터
  `executeWrite_`(락·감사로그·되돌리기) 밖에서 동작해 온 기존 설계다 — BOOK_CACHE는 "진위 데이터가
  아닌 조회 결과 재사용 캐시"(Code.gs 자체 주석)이고 락 없이 조회 후 갱신해도 최악의 경우 중복 캐시
  행 하나가 생길 뿐 도메인 상태(TITLES/COPIES 등)는 전혀 안 바뀐다. 버그 보고서 본문도 `lookupIsbn`을
  읽기 후보로 명시했다 — 기존에 없던 보호를 GET 경로가 추가로 깨는 게 아니라, POST에서 이미
  허용됐던 위험 수준 그대로를 GET에도 열어주는 것뿐이라고 판단해 그대로 포함시켰다.

- **`res.json()` 파싱 실패는 `outcome: 'network'`가 아니라 `outcome: 'error'`로 분류하고,
  그래서 GET 자동 재시도 대상에서 제외했다.** 버그 보고서가 재시도 트리거로 명시한 조건은
  "POST가 NETWORK_ERROR로 죽으면"(=fetch() 자체가 던짐)이지 "서버에 닿긴 닿았는데 응답을
  해석 못 함"이 아니다. Response 객체를 이미 얻은 상태(res.status/res.type/res.redirected를 알 수
  있는 상태)라면 그 요청은 서버까지는 도달했다고 볼 수 있어 순수 "네트워크 실패"와 성격이 다르고,
  같은 요청을 GET으로 다시 보내도 파싱 실패의 근본 원인(예: 진짜 비-JSON 응답)이 재현될 뿐 실익이
  없다고 판단했다. `api.ts`의 `performFetch()`가 fetch() 단계와 res.json() 단계를 분리한 것도
  정확히 이 구분을 만들기 위해서다.

- **GET 재시도는 원래 POST 요청이 쓰던 30초 타임아웃 예산을 이어받지 않고 독립적으로 새 30초를
  받는다.** "이미 몇 초를 썼으니 남은 시간만" 같은 예산 승계 로직은 버그 보고서에 명시되지 않았고,
  실패 직후 짧아진 예산으로 재시도를 쏘면 오히려 새 시도가 부당하게 불리해진다(특히 이번 버그
  자체가 "서버는 4~5초 만에 끝나는데 폰이 훨씬 먼저 죽는" 사례라 여유 있는 예산이 더 안전).

- **GET 재시도가 실패해도 원래 POST 실패로 폴백하지 않고 GET 실패 결과를 그대로 반환한다** — 버그
  보고서 원문 지시("GET 재시도도 실패하면 그게 더 최근/관련 있는 진단이니 그걸 반환") 그대로다.

- **헬스체크(`doGet`에서 action도 barcode도 없을 때) 응답도 `runApi_`를 거치게 했다** — 직접
  `{ok:true, data:{version}, error:null}` 객체를 손으로 조립하는 대신 다른 두 분기와 같은
  `runApi_(function(){ return {version: LIBRARY_MVP.VERSION}; })` 패턴을 그대로 재사용했다.
  `runApi_`는 `toClient_`(JSON 왕복)로 감쌀 뿐이라 문자열 필드 하나에는 부작용이 없고, 세 분기가
  전부 같은 응답 조립 경로를 타야 나중에 응답 스키마를 한 곳에서만 관리할 수 있다고 판단했다.

- **`DiagnosticsPanel`에 `transport`/`errName`/`res.type`/`redirected`를 보여주는 줄을 새 CSS
  클래스 없이 기존 `.reg-diagLine2`를 재사용해 추가했다** — 시각적으로 같은 무게의 보조 진단
  텍스트라 새 스타일이 필요 없었다. "진단 로그 복사" 버튼은 `diagLog` 객체 전체를
  `JSON.stringify`하므로 이 필드들은 화면에 렌더링하지 않아도 이미 복사 결과에는 포함됐을
  것이지만(최소 요건), 사람이 화면에서 바로 읽을 수 있어야 진단 로그 강화의 취지에 맞다고 보고
  화면 렌더링도 추가했다.

## todo/22 · 사이드바 한/영 (구 P7) (2026-07-15)

- **PATCH_SPEC.md의 "CODEBOOK label_ko/label_en 활용 — 이미 존재, 추가 작업 없음"은 실제로는
  틀린 진단이었다.** 원문이 맞았던 부분은 "시트 컬럼(`16_CODEBOOK.label_en`, `06_CATEGORIES.name_en`)이
  이미 존재한다"까지다 — 그러나 그 컬럼을 클라이언트로 실어 나르는 배선은 어디에도 없었다:
  `getCodes_()`(Code.gs)는 `label: row.label_ko || row.code`만 만들어 `label_en`을 아예 읽지
  않고, `apiBootstrap`의 categories 매핑도 `row.category_code + ' · ' + row.name_ko`로
  `name_ko`만 쓴다. 즉 지금까지 어떤 서버 함수도 label_en/name_en 값을 사이드바에 전달한 적이
  없었다 — "이미 존재"가 "이미 배선됨"을 뜻하지는 않았다. 과제 지침대로 `getCodes_`·`apiBootstrap`은
  고치지 않고, 새 함수 `apiGetCodeLabels()`(Code.gs)를 추가해 label_en/name_en만 별도로
  내려주는 방식을 택했다 — `Sidebar.html`은 영어 모드일 때만 이 맵으로 이미 그려둔 select/datalist의
  표시 텍스트를 `item.code` 기준으로 다시 씌운다(제출되는 값=code는 그대로라 폼 로직에는 영향 없음).
  라이브 스프레드시트의 `label_en`/`name_en` 셀이 비어 있으면 `row.label_ko || row.code`로
  자동 폴백하므로 아직 영어 라벨을 채워 넣지 않은 학교에서도 빈 텍스트가 뜨지 않는다.

- **`getUserLocale_`/`setUserLocale_`(그리고 이를 감싸는 `apiGetUserLocale`/`apiSetUserLocale`)는
  `getActor_()`를 거치지 않는다** — 언어 설정은 STAFF 시트 등록 여부와 무관하게 항상 동작해야
  한다고 판단했다. 예를 들어 아직 등록되지 않은 계정이 사이드바를 열면 `apiBootstrap`이
  `STAFF_NOT_REGISTERED` 오류로 실패하는데, 그 오류 메시지 자체를 영어로 읽고 싶은 사용자가
  언어 토글을 먼저 눌러야 하는 상황을 막고 싶었다. `PropertiesService.getUserProperties()`는
  이 코드베이스에서 UserProperties를 쓰는 첫 사례다(기존 코드는 전부 `getDocumentProperties()`=
  시트 전체 공유 또는 `getScriptProperties()`=배포 전역만 썼다) — 이메일로 직접 키를 만들
  필요조차 없다, GAS가 이미 (스크립트, 로그인 계정) 쌍으로 저장소를 격리해 주기 때문이다.
  이것이 "두 브라우저에서 동시에 서로 다른 언어"(수용 기준)가 코드 한 줄 추가 없이 성립하는
  이유다.

- **`refreshDashboard_`의 추출은 좌표·서식 100% 동일한 기계적 추출이다.** 기존 15줄 로직을
  `writeDashboardToSheet_(sheet, data)`로 뽑아내고, `refreshDashboard_()`는 이 함수를
  `01_운영센터`(`getRequiredSheet_` — 없으면 기존과 동일하게 예외)에 한 번, 그리고
  `01_Console_EN`이 **존재할 때만**(`getSpreadsheet_().getSheetByName(...)`가 non-null일 때만)
  한 번 더 호출한다. 이 환경은 바이너리 xlsx의 서식·라벨 셀을 새로 그릴 수 없으므로(todo/21이
  `02_사용법`에서 마주친 것과 같은 제약) `01_Console_EN` 탭 자체는 만들 수 없다 — 그래서
  존재하지 않으면 오류 없이 건너뛰어 기존 사용자(아직 이 탭이 없는 모든 학교)를 절대 깨뜨리지
  않게 했다. `refreshDashboard_()`의 반환값(`data`)과 호출부는 전혀 바뀌지 않았다.

- **`01_Console_EN`에 쓰이는 `dueItems[].type` 값도 여전히 한글("연체"/"예정")이다** —
  `getDashboardData_()`(읽기 전용 대상, 수정 금지)가 만드는 원본 데이터를 두 시트에 그대로
  나눠 쓸 뿐이지, 그 데이터 자체를 로케일별로 다시 계산하지 않기 때문이다. 사이드바 쪽에서는
  이 한계를 피할 수 있었다 — `item.type` 문자열을 비교하는 대신 `item.overdueDays`(0 초과 여부)로
  판단해 `t('dashboard.due.overdue'|'upcoming')`를 고르므로 화면에는 항상 올바른 언어가 보인다.
  그러나 시트 셀에 직접 쓰는 값(`writeDashboardToSheet_`가 받는 `data.dueItems[].type`)은
  `getDashboardData_`가 만든 그대로라 `01_Console_EN`의 "구분" 열에도 한글 "연체"/"예정"이
  나타난다 — `getDashboardData_`를 고치지 않기로 한 이상 감수해야 하는 대가로 판단했고, 이후
  라운드에서 `getDashboardData_`를 건드리는 것이 승인되면(이번 라운드에서는 명시적으로 read-only
  대상이었다) 함께 해소될 수 있다.

- **검색 결과(`search_`)의 `secondary`/`details`와 무결성 점검 이슈의 `message`는 이번
  라운드에서 번역하지 않았다** — 둘 다 서버가 이미 완성된 한국어 문장으로 조합해 돌려주는
  값이다(예: "소장 3권 / 대출가능 1권", "2학년 3반 12번", "현재 대출 2권 / 활성 예약 1건" 등).
  `search_`는 PATCH_SPEC의 "건드리지 말 것" 명시 목록에는 없지만, 이 문장들에서 번역 가능한
  부분만 클라이언트가 골라내려면 조합된 한국어 문장을 정규식 등으로 역파싱해야 하는데, 이는
  깨지기 쉽고(문구가 바뀌면 파싱이 조용히 실패) 사실상 그 서버 함수의 출력 계약을 다시 설계하는
  일이라 이번 항목의 "~150키 UI 사전 + 오류 코드 매핑 + CODEBOOK 라벨 + 콘솔 이중화" 범위를
  넘어선다고 판단했다. `item.status`(예: `AVAILABLE`/`ACTIVE`)는 이미 CODEBOOK 코드 그 자체라
  ADR-017의 "데이터는 코드"에 맞게 두 로케일 모두에서 있는 그대로 봐도 무리가 없어 그대로 뒀다.
  README.md "한/영 전환" 절에 이 경계를 사용자에게도 명시했다. 이후 라운드 후보.

- **오류 코드→영어 매핑은 "~70개"가 아니라 Code.gs 전체의 `fail_(` 호출을 grep으로 전수
  조사해 나온 76개 코드 전부를 담았다** — 임의로 상위 70개만 고르는 것보다, 실제 존재하는
  코드 전체를 담아 두는 쪽이 나중에 어떤 오류가 실제로 발생해도 번역 누락이 없다는 걸 보장하기
  쉽다고 판단했다(사이드바에서 절대 도달하지 않는 `doPost`/모바일 등록 전용 코드도 일부
  포함되어 있지만, 포함해도 해가 없고 향후 그 경로들이 사이드바에 노출될 때도 바로 쓸 수 있다).

- **`02_사용법`·`01_Console_EN` 두 시트 모두 todo/21과 같은 이유로 이 환경에서 직접 만들거나
  편집하지 못했다** — `도서관_관리_MVP.xlsx`는 바이너리라 이 코딩 환경에 xlsx 편집 도구가
  없다. todo/21이 세운 대체 경로(사용법 절차를 README.md에 문서화 + 실제 스프레드시트에는
  사서/관리자가 수기로 옮겨 적으라는 안내)를 그대로 따라 `school-patch-v1/README.md`에
  "한/영 전환 (사이드바 언어 설정)" 절을 새로 추가했다 — 영어 사용법 섹션 원문(그대로 복사해
  02_사용법 탭에 붙여 넣을 영문 절차)과 `01_Console_EN` 탭을 만드는 수기 절차(라벨 복제 시
  건드리면 안 되는 값 셀 좌표 명시)를 함께 담았다. `PATCH_NOTES.md`의 Phase B 체크리스트
  5번(한/영 전환)·6번(사용법 갱신)도 갱신했다.

## todo/23 · 연간 리셋 마법사 + 학생 CSV + LOANS 아카이브 (2026-07-15)

이 항목은 이 프로젝트에서 가장 파급력이 큰 변경(대량 진급·졸업·대출 원장 행 삭제)이라 판단 근거를
평소보다 자세히 남긴다. `registerMember_`(722행)·`updateMember_`(782행)·
`assertMemberCanDeactivate_`(834행)·`executeWrite_`(2500행대)·`appendRecord_`/
`transactionAppendRecord_`(2363·2380행)는 전부 무수정으로 재사용했고, 새로 만든 코드는 파일 맨
끝(`checkUnreturnedAll_` ~ `runAnnualArchiveLoans`, 4707행 이후)과 `integrityCheck_`/
`buildLibraryMenu_`/`LIBRARY_MVP.SHEETS`의 순수 추가 지점 세 곳뿐이다.

- **`GRADUATION_GRADE` 설정값은 `getConfig_('GRADUATION_GRADE', 6)`로 조회하며, 기본값 6은
  임의 지정이 아니라 이 저장소가 이미 스스로 "OO초등학교 도서관"(`docs/ASSUMPTIONS.md` todo/05
  참고, `getConfig_('LIBRARY_NAME', ...)` 예시 문구)이라고 밝힌 것에 근거한다** — 한국
  초등학교는 6학년제이므로 6이 합리적 기본값이다. 이 환경은 라이브 바이너리 xlsx 템플릿에 새
  행을 추가할 수 없으므로(todo/17·21·22와 같은 반복된 제약), 실제 학교가 6학년제가 아니거나
  졸업 학년을 다르게 쓰고 싶다면 **사서가 `17_CONFIG` 시트에 `setting_key=GRADUATION_GRADE`,
  `setting_value=<원하는 학년 숫자>` 행을 직접 추가**해야 한다(`value_type`은 다른 숫자형 설정과
  같은 관례로 채우면 된다). 이 행이 없으면 계속 6으로 동작한다. `graduateStudents_`(②)와
  `promoteAllStudents_`(③)가 같은 키를 공유한다 — 졸업 학년과 "승급에서 제외할 학년"은 항상
  같은 값이어야 하므로 설정을 하나로 통일했다.

- **④ 신입생 일괄 등록은 PATCH_SPEC.md P1-e 원문의 `bulkRegisterStudents_(csv)` 시그니처
  대신, `22_MANUAL_ENTRY`(todo/21)가 이미 쓰는 "시트에 적어두고 흡수" 패턴으로 구현**했다
  (`ensureNewStudentImportSheet_`/`absorbNewStudentImports_`/`runAbsorbNewStudentImports`,
  4929~5031행). GAS `ui.prompt`는 한 줄짜리 텍스트박스만 지원해 200행짜리 CSV 텍스트를 통째로
  받을 좋은 입력 수단이 없다 — 반면 시트+흡수 패턴은 이미 이 저장소에서 검증된 방식이고, 사서가
  엑셀/스프레드시트에서 명렬표를 그대로 복사해 붙여넣을 수 있어 실제로 더 쓰기 쉽다. 새 시트
  `23_NEW_STUDENT_IMPORT`는 `MANUAL_ENTRY`와 완전히 같은 이유로 `LIBRARY_MVP.SHEETS`에만
  등록하고 `HEADERS`에는 넣지 않았다(`ensureSchema_`/`protectDatabaseSheets_`가 순회하지
  않으므로 두 함수 모두 무수정으로 유지되고, 이 시트는 영구히 비보호 상태로 남는다 — 사서가
  GAS 없이도 명렬표를 미리 적어 둘 수 있어야 한다는 22번 항목의 논리를 그대로 이어받았다).
  **정확한 열 헤더 순서는 `['학번', '이름', '학년', '반', '번호', '처리상태', '처리결과']`**
  — PATCH_SPEC P1-e가 명시한 "학번·이름·학년·반·번호" 순서를 그대로 따르고, `MANUAL_ENTRY_
  HEADERS_`와 같은 관례로 마지막 두 칸(처리상태·처리결과)을 붙였다. "학번"은
  `resolveManualEntryMember_`(4520행대) 주석이 이미 확인한 대로 `09_MEMBERS.school_no`에
  대응하는 라벨이라(student_no가 아니다) 앞자리 0 손실을 막기 위해 텍스트(@) 서식을 걸었다
  (`ensureManualEntrySheet_`와 같은 기법). 배치 상한은 `NEW_STUDENT_IMPORT_BATCH_LIMIT_ = 200`
  (PATCH_SPEC이 명시한 "200건 배치"), `ENRICH_BIBLIOGRAPHIC_BATCH_LIMIT_`와 이름 관례를
  맞췄다. 등록되는 회원은 항상 `memberType` 기본값(`registerMember_`의 `'STUDENT'`)을 그대로
  쓴다 — 이 시트의 존재 목적 자체가 "신입생(학생) 일괄 등록"이므로 다른 회원유형을 받을 이유가
  없다고 판단했다.

- **③ 전원 진급은 `class_no`/`student_no`(반·번호)를 절대 건드리지 않는다** — `updateMember_`
  호출 payload에 `grade`만 담아 넘긴다. 반 배정(누가 몇 반이 되는지)은 매년 담임 배정과 함께
  결정되는, 이 도서관 시스템이 갖고 있지 않은 학사 정보(학급 편성표)에 의존하는 별도의 수작업
  영역이라고 판단했다 — 시스템이 임의로 반을 유지한 채 학년만 올리면 실제 반 배정이 나온 뒤
  사서가 다시 한 번씩 수정해야 하므로, 아예 손대지 않고 "학년만 올랐고 반·번호는 그대로"라는
  중간 상태를 명확히 하는 편이 더 정직하다고 봤다. `runPromoteAllStudents`의 확인 대화상자에도
  이 사실을 그대로 문구로 남겼다.

- **③ 전원 진급의 승급 대상 필터는 "ACTIVE STUDENT 전체"가 아니라 "ACTIVE STUDENT 중
  졸업 학년(GRADUATION_GRADE)이 아닌 회원"으로 명시적으로 좁혔다.** 단순히 "ACTIVE
  STUDENT 전체"로 했다면, ②에서 미반납 등으로 "차단"되어 아직 졸업하지 못하고 ACTIVE·졸업
  학년 그대로 남아 있는 학생까지 승급 로직에 걸려 존재하지 않는 학년(예: 6학년제에서 7학년)으로
  밀려나는 사고가 난다. 정상 졸업한 학생은 `status_code`가 이미 `GRADUATED`(ACTIVE 아님)라
  자연히 빠지지만, 차단된 학생은 여전히 ACTIVE이므로 별도 배제가 반드시 필요했다.

- **② 졸업 처리는 "차단(blocked)"과 "오류(failed)"를 의도적으로 분리했고, 이 구분이 이
  항목에서 가장 중요한 설계 결정이다.** `graduateStudents_`는 각 후보 회원마다 먼저
  `assertMemberCanDeactivate_`를 **executeWrite_ 밖에서 직접 호출**해 미반납/수령대기예약/
  미납금 여부를 사전 확인한다. 여기서 막히면 그 회원은 `executeWrite_`까지 전혀 보내지 않고
  "차단" 명단에만 올린다. 만약 이 사전 확인 없이 곧바로 `executeWrite_('GRADUATE_MEMBER', ...)`
  를 호출했다면, `assertMemberCanDeactivate_`가 `updateMember_` 내부에서 던지는 예외가
  `18_SYS_OPERATIONS`에 그 회원의 requestId(`GRAD-연도-member_id`)를 **FAILED로 영구
  고정**시켜 버린다 — `executeWrite_`(2513~2522행, 무수정)의 기존 정책상 FAILED 상태의
  requestId는 같은 값으로 재실행하면 무조건 `FAILED_REQUEST_REQUIRES_REVIEW`로 거부되기
  때문이다. 그런데 "미반납 학생이 책을 반납한 뒤 사서가 같은 메뉴를 다시 눌러 그 학생만 마저
  졸업시키는 것"은 이 마법사의 정상적인 실사용 흐름이다 — 사전 확인으로 분리해 두면 차단된
  학생은 애초에 requestId 자체가 생기지 않으므로 언제든 자유롭게 재시도된다. 반대로 사전
  확인을 통과했는데도 실제 쓰기 단계에서 발생하는 오류(예: 데이터 정합성 문제로 인한 예외적
  실패)는 지금까지와 같은 FAILED 정책을 그대로 적용해 사람이 검토하게 뒀다 — 이건 "정상적으로
  반복될 것으로 예상되는 업무 규칙 차단"이 아니라 "뭔가 잘못됐으니 조사가 필요한 상황"이기
  때문이다.

- **"순서 강제(이전 단계 미완료 시 다음 단계 차단)"는 지속되는 상태 플래그(state machine)로
  구현하지 않았다.** PATCH_SPEC.md P1-e 원문이 이 문구를 쓰고 있지만, 실제로 검토해 보니 하드
  블로킹은 오히려 위험하다고 판단했다 — 예를 들어 "②가 완료되어야 ③을 허용"을 "졸업 학년에
  ACTIVE 회원이 하나도 없어야 함"으로 구현하면, 미반납 등으로 정당하게 차단된 학생이 단 한
  명만 남아 있어도 다른 학년 전체의 진급까지 영구히 막혀 버리는 부작용이 생긴다. 대신: (1) ①은
  순수 읽기 전용 검토 게이트로 남겨 사람이 판단해 다음 단계로 넘어가게 했고, (2) 실제로 명시된
  단 하나의 수용 기준("미반납 학생 졸업 시도 → 차단 + 명단")은 `assertMemberCanDeactivate_`
  재사용으로 그대로 충족시켰으며, (3) ②→③ 순서는 코드 레벨 차단 대신 `runPromoteAllStudents`의
  확인 대화상자 문구("② 졸업 처리를 먼저 완료한 뒤 실행하는 것을 권장합니다")로 안내하고, 위
  항목에서 설명한 필터(졸업 학년 제외)로 순서가 뒤바뀌어도 최소한 존재하지 않는 학년으로
  밀려나는 사고는 구조적으로 막았다. 사용자가 이 판단을 뒤집고 싶다면 `promoteAllStudents_`
  시작 부분에 "졸업 학년에 아직 ACTIVE 회원이 남아 있으면 전체를 막는다" 같은 하드 게이트를
  추가하면 된다.

- **`archiveLoans_`의 아카이브 시트 이름 `10_LOANS_YYYY`에서 YYYY는 "그 안에 담긴 대출
  데이터의 연도"가 아니라 "이 아카이브를 실행한 기준 연도(= 함수 인자 `year`)"다.**
  `docs/PATCH_SPEC.md` P2-b 원문("`checked_out_at < 해당연도 시작`인 행 → `10_LOANS_YYYY`
  시트로 이동")을 문자 그대로 구현했다 — `year=2026`으로 실행하면 2026-01-01 이전에 대출된
  반납/분실/취소 건이 `10_LOANS_2026` 시트로 이동한다(그 안에는 2025년 이전 여러 해의 데이터가
  섞여 들어갈 수 있다). 다소 직관에 어긋날 수 있어(시트 이름이 "그 안의 최신 연도"처럼 보일
  위험) `runAnnualArchiveLoans`의 확인 대화상자에 정확한 기준 날짜와 대상 시트 이름을 문장으로
  풀어써 뒀다.

- **`archiveLoans_`는 append-then-delete 순서를 반드시 지킨다 — 이 순서가 뒤바뀌면 데이터
  유실이 가능해진다.** 먼저 후보 전부를 아카이브 시트로 `transactionAppendRecord_`(append 실패
  시 이미 append된 행만 롤백하면 되고, 원본 `10_LOANS`는 아직 전혀 손대지 않은 상태라 안전)
  하고, **전부 성공한 뒤에만** 원본 삭제를 시작한다. 삭제는 반드시 "행번호 내림차순"으로
  한다 — 오름차순으로 지우면 매 삭제마다 그 아래(더 큰 행번호) 후보들의 실제 위치가 하나씩
  당겨져 버려, `_row`로 기억해 둔 좌표가 어긋나 엉뚱한 행을 지우게 된다. 각 삭제 직전에
  `getRange().getValues()/getFormulas()`로 원래 값을 캡처해 `transaction.record(...)`에
  "insertRowBefore + 원래 값 복원" undo를 쌓아 둔다 — `createCompensationContext_`(2570행,
  무수정)의 rollback은 이 undo들을 **LIFO**(마지막에 쌓은 것부터)로 실행하므로, 삭제를
  내림차순으로 하고 그 undo를 순서대로 쌓아 두면 rollback은 자동으로 **오름차순**(낮은 행부터)
  `insertRowBefore`로 복원돼 모든 행이 원래 번호 그대로 되살아난다(작게 손으로 예제를 그려
  검증했다 — 행 5·8·12를 지운 뒤 LIFO로 5→8→12 순서로 되돌리면 각 삽입이 그 아래를 한 칸씩
  밀어내면서 정확히 원래 좌표로 복원된다). 이 삭제는 CLAUDE.md 절대 규칙 6번("행 삭제
  금지")의 유일한 예외로 명시적으로 허용된 경우이며(과제 지시·`docs/PATCH_SPEC.md` P2-b가
  "이 삭제는 행번호 무관 스키마라 안전, ADR-002 폐기 참조"라고 명문화), `10_LOANS`의
  기본키(`loan_id`)가 행번호가 아니라 UUID 기반이라 참조 무결성이 행 위치와 무관하다는 점도
  다시 확인했다.

- **`runAnnualArchiveLoans`의 `executeWrite_` 호출은 연도 기반 고정 `requestId`를 쓰지
  않는다** — payload를 `{ year: year }`로만 넘겨 `executeWrite_`가 매번 새 `requestId`를
  자동 발급하게 뒀다(`reconcileCopyStatuses()`, 1633행이 이미 쓰는 패턴과 동일). 만약
  `'ARCHIVE-LOANS-' + year`처럼 고정 ID를 썼다면, 아카이브가 어떤 이유로 실패해 롤백된 뒤
  "같은 연도로 다시 실행"하는 정상적인 재시도가 `FAILED_REQUEST_REQUIRES_REVIEW`에 영구히
  막혀 버린다. 이게 안전한 이유는 후보 필터 자체가 자연적인 재실행 안전장치이기 때문이다 —
  이미 아카이브된 행은 `10_LOANS`에서 이미 사라졌으므로 다시 실행해도 후보 집합이 비어 있어
  아무 일도 하지 않는 무해한 재실행이 된다(그리고 `withWriteLock_`이 동시 실행 자체를
  막는다). 반면 ②·③의 회원별 requestId(`GRAD-연도-member_id`, `PROMOTE-연도-member_id`)는
  고정으로 유지했다 — 그 이유는 각각 별도로 문서화했다(졸업은 사전 확인으로 FAILED 오염을
  피했고, 승급은 같은 해에 실수로 두 번 실행되면 같은 학생이 두 번 승급되는 진짜 사고를 막아야
  하므로 고정 ID의 idempotent-skip이 반드시 필요하다).

- **`integrityCheck_`에 추가한 아카이브 시트 FK 검사는 `copy_id`/`member_id` 두 개만 본다** —
  `10_LOANS` 자체 검사가 하는 `policy_id`/`checkout_staff_id`/`return_staff_id`/`request_id`
  FK나 `checked_out_at`/`due_at`/`returned_at` 날짜 순서 검사까지 아카이브 시트에 그대로
  복제하지는 않았다. 과제가 명시한 수용 기준("아카이브 후 무결성 점검 0건")과 재사용 지시
  ("copy_id/member_id 검사 재사용")를 문자 그대로 만족시키는 최소 범위로 판단했다 — 필요하면
  나머지 검사도 같은 패턴(정규식으로 찾은 각 아카이브 시트에 대해 `readTable_` 후 검사 반복)으로
  쉽게 넓힐 수 있다. 시트 탐색은 `getSpreadsheet_().getSheets()`를 정규식 `/^10_LOANS_\d{4}$/`
  으로 걸러 동적으로 찾으므로, 매년 새 아카이브 시트가 생겨도 이 함수를 또 고칠 필요가 없다.

- **대량 append 루프의 성능 한계를 인지하고 있다.** `archiveLoans_`가 후보마다
  `transactionAppendRecord_`를 호출하는데, 이 헬퍼(`appendRecord_`, 무수정)는 매 호출마다
  대상 시트를 캐시 무효화 후 다시 전체 스캔한다(`invalidateTableCache_` → 다음 `readTable_`가
  풀스캔). 이는 `absorbManualEntries_`가 `10_LOANS`에 반복 append하는 기존 패턴과 동일한,
  이 코드베이스 전반에 이미 존재하는 특성이라 이번 항목에서 새로 만든 문제는 아니지만, 이
  기능을 처음 실행할 때(그동안 쌓인 모든 과거 연도를 한 번에 아카이브) 후보가 수천 건이면
  6분 실행 제한에 가까워질 수 있다. 첫 실행은 오래된 연도부터 나눠서(예: `year`를 점진적으로
  올려가며 여러 번) 실행하는 것을 권장한다 — `runAnnualArchiveLoans`의 확인 대화상자에는 이
  안내를 넣지 않았지만(이미 대화상자가 길어 가독성을 우선했다) 이 문서에 남긴다. ②·③(진급·
  졸업)은 배치 상한을 두지 않았다 — PATCH_SPEC의 "600명 진급이 6분 제한 내" 수용 기준이 그
  규모에서 배치 없이 완료될 것을 전제하고, 순수 시트 쓰기라 외부 API 호출이 있는
  `enrichBibliographicBatch_`(200건 상한)만큼 느리지 않을 것으로 판단했다.

- **데모 데이터로 5단계를 리허설하는 절차** (이 환경엔 실행 중인 GAS 런타임이 없어 직접 실행할
  수 없다 — 아래는 실제 라이브 스프레드시트에서 사서/관리자가 확인할 절차):
  1. 스프레드시트를 열고 메뉴 `📚 도서관 관리 → 관리 → 연간 리셋`을 확인한다(5개 하위 항목이
     보이면 배선 성공).
  2. `09_MEMBERS`에 STUDENT/ACTIVE 학생을 학년별로 몇 명 준비하고, 그중 한 명에게는 일부러
     `checkout_`으로 OPEN 대출을 하나 만들어 둔다(② 차단 시나리오 검증용).
  3. `① 미반납 전수 조사` 실행 → 방금 만든 OPEN 대출이 목록에 학년-반 순으로 나오는지 확인.
  4. `② 졸업 처리` 실행(대상 학년 = `17_CONFIG`에 넣은 `GRADUATION_GRADE` 또는 기본값 6) →
     OPEN 대출이 있는 학생은 "차단 명단"에 뜨고 `status_code`가 바뀌지 않았는지, 나머지는
     `GRADUATED`로 바뀌고 `graduated_at`이 채워졌는지 `09_MEMBERS`에서 확인.
  5. 차단됐던 학생을 `return_`으로 반납 처리한 뒤 `② 졸업 처리`를 같은 학년으로 재실행 →
     이번엔 그 학생도 졸업 처리되는지 확인(사전 확인 분리 설계가 제대로 동작하는지의 핵심
     검증 지점).
  6. `③ 전원 진급` 실행 → 졸업 학년을 제외한 나머지 학생들의 `grade`가 1씩 올랐는지,
     `class_no`/`student_no`는 그대로인지, 방금 졸업한 학생은 대상에서 빠졌는지 확인.
  7. `23_NEW_STUDENT_IMPORT` 시트를 열어(처음 실행 전까지 시트가 안 보이면 `④`를 한 번
     실행해 시트를 먼저 만든 뒤) 학번·이름·학년·반·번호를 몇 줄 채우고 `④ 신입생 일괄 등록`
     실행 → `09_MEMBERS`에 새 ACTIVE 학생이 생기고 해당 행의 처리상태가 "완료"로 바뀌는지
     확인. 일부러 학년/반을 비운 행을 하나 섞어 "오류"로 표시되고 배치가 멈추지 않는지도
     확인.
  8. `⑤ 대출 연간 아카이브`를 과거 연도로 실행(예: 현재 연도) → `10_LOANS`에 있던 RETURNED/
     LOST/VOID 중 그 연도 시작 이전 대출이 사라지고 `10_LOANS_<연도>` 시트에 나타나는지,
     OPEN 대출은 그대로 `10_LOANS`에 남아 있는지 확인.
  9. `무결성 점검` 실행 → `issueCount: 0` 확인(수용 기준 "아카이브 후 무결성 0건"). 일부러
     아카이브 시트의 `copy_id`를 존재하지 않는 값으로 바꿔 보면 `ORPHAN_FOREIGN_KEY` 이슈가
     새로 잡히는지도 확인해 추가된 FK 검사가 실제로 동작하는지 검증할 수 있다.

---

## todo/24 · 연간 운영 보고서 (2026-07-15)

- **기간 선택의 기본값은 "달력 연도"(payload.year, 생략 시 오늘 연도)**로 임의 지정했다
  (`reportAnnualOperations_`, Code.gs). FEATURES.md는 "연간"이라고만 쓰고 학년도·회계연도 등
  정확한 시작월을 못박지 않았다 — `reportRecallNotice_`(todo/09)가 이미 확인한 것과 같은 근거로
  CONFIG 시트에 학사력 개념이 없다(`getConfig_`로 조회 가능한 키 없음). 대신 호출측이
  `payload.startDate`+`payload.endDate`(반드시 둘 다 지정)로 임의 구간을 완전히 덮어쓸 수 있게
  열어뒀다 — 프론트는 체크박스 하나로 "연도 입력" ↔ "기간 직접 지정" 두 모드를 전환한다
  (`AnnualOperationsReportPanel.tsx`). 잘못된 구간(수십~수백 년)이 들어와 `byMonth` 배열이
  무한정 커지는 걸 막기 위해 최대 10년(`ANNUAL_REPORT_MAX_PERIOD_MONTHS_ = 120`)으로
  `VALIDATION_ERROR`를 낸다.

- **"장서 현황(증감)"은 08_COPIES에 철회 시각(withdrawn_at)이 없어 근사치로 계산**했다.
  스키마(HEADERS 확인됨)에는 `status_code` 현재값만 있고 "언제 WITHDRAWN/LOST로 바뀌었는지"는
  기록되지 않는다 — `updated_at`은 다른 필드 변경에도 갱신되므로 신뢰할 대리 지표가 못 된다.
  그래서 "현재 유통 상태(WITHDRAWN/LOST 제외)인 소장본" 중 `acquired_at`이 기간 시작 전이면
  `startCount`(이미 있던 장서), 기간 중이면 `acquiredInPeriodCount`(신규 입수)로 나누고
  `endCount = startCount + acquiredInPeriodCount`로 정의했다. **한계**: 기간 중에 철회된
  소장본은 이 근사에서 통째로 빠진다(철회 시점을 모르므로 "그때는 있었다"를 재구성할 수
  없음) — 즉 `endCount`는 "그 시점 실제 서가 재고"가 아니라 "현재도 살아있는 소장본 중 그
  시점까지 입수분"에 더 가깝다. 완전히 정확하게 하려면 `08_COPIES`에 `withdrawn_at` 컬럼을
  추가해야 하는데 이번 항목(읽기 전용 리포트 추가)의 스코프 밖이라 하지 않았다.

- **연체 요약의 미납액은 `12_FINES`의 두 유형(OVERDUE·REPLACEMENT) 모두를 합산**한다.
  기존 `apiWebUnpaidFines_`(book-detail·미변상 목록용)는 `fine_type_code === 'REPLACEMENT'`만
  걸러 보여주지만, 그건 "분실 변상 완료 여부"라는 좁은 화면 목적 때문이다. 이 리포트는 예산
  증빙 성격의 총괄 문서라 ADR-017이 실제로 허용하는 두 유형의 미수금을 전부 더하는 게 "학교가
  받아야 할 돈의 총액"에 더 가깝다고 판단했다 — 다만 학교 정책상 `overdue_fee_per_day`가
  보통 0으로 설정돼 있어(ADR-017 "연체 페널티 = 대출 정지, 연체료 아님") 실제로는 OVERDUE
  유형 금액이 대부분 0이거나 존재하지 않을 것으로 예상한다. 반환값에 `unpaidFineCount`(건수)도
  함께 내려 화면/인쇄본에서 "0건"과 "0원"을 구분할 수 있게 했다.

- **"상위 대출"은 상위 10건으로 고정**했다(`ANNUAL_REPORT_TOP_LOANS_LIMIT_ = 10`).
  FEATURES.md는 개수를 명시하지 않았다 — `reportHomeroomClass_`의 popularBooks가 반 단위라
  5건으로 충분했던 것과 달리, 이 리포트는 전교 단위라 10건이 A4 인쇄 밀도상 적절하다고
  판단했다.

- **`budget` 필드는 `computeBudgetViz_`(보호 함수, todo/11/19)의 반환값을 그대로 옮기고
  `periodAcquisitionTotal`(선택 기간에 해당하는 연도들의 `total` 합)만 추가**했다 — 예산
  차트(`BudgetPicture.tsx`, todo/19가 "todo/24가 이 재료를 인쇄에 쓸 것"이라 예고해 둔 그대로)를
  새로 만들지 않고 그대로 재사용한다. 다만 `BudgetPicture`는 `useVizData('budget-picture')`로
  자기 자신의 데이터를 다시 조회한다(20_VIZ_CACHE 일배치 결과) — `reportAnnualOperations_`가
  `computeBudgetViz_`를 직접 호출해 얻은 `budget` 필드와 값 출처는 같지만(둘 다 결국
  `computeBudgetViz_`가 원본) 조회 시점이 서로 다를 수 있다(리포트는 요청 시점 실시간 계산,
  차트는 어제 자정 일배치 캐시). 두 값이 하루 정도 어긋날 수 있다는 뜻이라 완전한 실시간
  일치를 보장하지는 않지만, "예산 증빙 문서에 예산 차트를 삽입"이라는 완료 조건 자체는
  충족한다고 판단했다.

- **REPORT_TYPES의 6번째 카드는 `dashboard.quietSignal.*` 라벨 키 재사용 관례에서 의도적으로
  벗어났다.** 기존 5개 R1 리포트는 대시보드 "조용한 신호" 패널과 아이콘·라벨을 공유하지만,
  이 항목은 FEATURES.md R3(행정 자동화)이고 원칙 문서가 "조용한 신호"의 근거로 든 것은
  R1("로그인 불필요")뿐이다 — R3에는 대시보드 진입점 요구사항이 없다. 그래서 새 전용 키
  (`views.reports.annualOperations.cardLabel`)를 만들고, `dashboard.quietSignal` 네임스페이스는
  건드리지 않았다.

- **인쇄 레이아웃은 새 CSS 클래스를 추가하지 않고 기존 `.print-table`/`.reports-summary-line`만
  재사용**했다. 회수 쪽지(R1-4)처럼 형태가 완전히 다른 레이아웃(절취선 등)이 필요하지 않다고
  판단했다 — 이 리포트는 담임 리포트(R1-2)와 마찬가지로 "표+요약 문단"의 조합으로 충분히
  표현되는 문서라 `styles/print.css`를 건드리지 않았다.

---

## todo/25 · 위생 묶음 (2026-07-15)

세 항목 모두 "기존에 검증된 흐름을 건드리지 않고 안전망만 얹는다"는 같은 원칙을 공유한다 —
각각 판단 근거를 남긴다.

### 항목 1 — operator 서버 강제

`Code.gs`에 새 순수 함수 `ensureOperatorNote_`(3260행대)를 추가하고, 이미 존재하던 11개
`apiWeb*` 쓰기 래퍼(`apiWebCheckout_`·`apiWebReturn_`·`apiWebReserve_`·
`apiWebCancelReservation_`·`apiWebRenew_`·`apiWebMarkLost_`·`apiWebPayFine_`·
`apiWebInventoryScan_`·`apiWebRegisterTitle_`·`apiWebRegisterCopy_`·
`apiWebEnrichBibliographic_`)에 `payload = ensureOperatorNote_(payload || {});` 한 줄씩만
추가했다 — `checkout_`/`return_`/`reserve_`/`cancelReservation_`/`renew_`/`markLoanLost_`/
`payFine_`/`registerTitle_`/`registerCopy_`/`executeWrite_`(VERIFY.md 보호 목록)는 전부
무수정이다. `apiRegisterByIsbn_`(4451행대, `registerByIsbn_` 호출)은 이 11개 목록에 없다 —
`grep -n "executeWrite_("`로 전체 호출부를 확인했고, 그 함수는 이미 `registerByIsbn_` 내부에서
`requiredText_(payload.operator, ...)`로 operator를 필수값으로 강제하는 자기 완결적 경로라
`ensureOperatorNote_`이 손댈 이유도, 이중 주입 위험도 없다. `absorbManualEntries_`(todo/21)·
`graduateStudents_`/`promoteAllStudents_`(todo/23)도 `apiWeb*` 래퍼를 거치지 않고
`executeWrite_`를 직접 부르는 별도 경로라 이번 항목과 무관하다(각자 이미 확립된 note 관례를
그대로 유지).

`ensureOperatorNote_` 자체는 GAS 전용 API를 전혀 참조하지 않는 순수 함수라 통째로 복사해
`node`로 격리 검증했다(입출력 쌍은 커밋 메시지에 남긴다) — `services/choseong.ts` 알고리즘을
`node -e`로 독립 검증했던 것과 같은 방식.

프론트 쪽은 `services/api.ts`의 `apiCall()`(190·206행)이 `useSession`에서 `operator`를 함께
꺼내 `body = { action, token, operator, ...payload }`로 만든다 — `...payload`가 뒤에 오므로
이미 `payload.operator`를 직접 채워 보내는 화면(`views/register/index.tsx`의 `registerByIsbn`
흐름 등)은 기존 값이 그대로 이긴다. `views/loan-return/index.tsx`·`services/operatorNote.ts`의
기존 `operatorNoteFor()`/`operatorNote()` 호출은 전혀 건드리지 않았다 — 이제 "화면이 note에
operator를 깜빡 안 넣어도" 서버(`ensureOperatorNote_`)와 프론트(자동 `body.operator`) 두 겹
안전망이 남는다.

### 항목 2 — React ErrorBoundary

새 컴포넌트 `components/ViewErrorBoundary.tsx`(클래스 컴포넌트 — 에러 바운더리는 훅으로 만들
수 없다)를 추가하고, 뷰 컴포넌트가 실제로 마운트되는 **세 곳** 전부를 이걸로 감쌌다. 사용자가
미리 준 조사는 두 곳(Window.tsx·StackNav.tsx)만 짚었지만, 구현 중 `grep -rn
"VIEW_COMPONENTS\["`로 재확인하니 `shells/mobile/MobileShell.tsx`(267행, 활성 탭 뷰
`ActiveComp`)가 세 번째 마운트 지점이었다 — 탭 화면은 StackNav보다 더 자주 보이는 모바일의
주 화면이라 빠뜨리면 이번 항목의 목표("뷰 크래시가 셸 전체를 못 죽인다")가 모바일 탭에서는
지켜지지 않는다. 그래서 세 곳 모두 감쌌다:

- **`shells/desktop/Window.tsx`(229~243행)**: `<div className="window-body">` 안, `<Suspense>`
  바깥을 `<ViewErrorBoundary onReopen={...}>`로 감쌌다. 렌더 트리는
  `DesktopShell → windows.map(w => <Window key={w.id}>) → 이 바운더리 → Suspense → ViewComponent`
  다. 바운더리가 `ViewComponent`의 자손 트리에서 던진 예외만 잡는다는 게 React 에러 바운더리의
  기본 계약이다 — `getDerivedStateFromError`/`componentDidCatch`는 오직 **자신의 `children`
  서브트리**에서 발생한 예외에만 반응하고, 그 예외는 그 바운더리에서 멈춘다(부모로 다시
  던져지지 않는다). `DesktopShell`은 `windows` 배열을 `.map`으로 순회해 창마다 **독립된**
  `<Window>`·`<ViewErrorBoundary>` 인스턴스를 만들므로, 창 A의 `ViewComponent`가 던진 예외는
  창 A의 바운더리에서 멈추고 창 B의 `<Window>`(다른 React 서브트리, 형제 컴포넌트)에도, 그
  둘의 공통 부모인 `DesktopShell`이 그리는 `<Dock>`에도 전파될 수 없다 — React가 예외를
  부모로 전파하는 유일한 경로는 "이 서브트리를 감싸는 가장 가까운 에러 바운더리를 찾아
  위로 리스로우"뿐인데, 창 A의 트리 안에 바운더리가 이미 있으므로 거기서 잡히고 멈춘다.
  "다시 열기" 버튼(`handleReopen`)은 (1) `onReopen`으로 넘긴 `closeWindow(win.id)` +
  `openWindow(win.viewId, win.params)`를 실행해 이 창을 완전히 새 창으로 교체하고(같은
  `useWindowStore` 메커니즘, 병렬 닫기/열기 경로 신설 없음), (2) 바운더리 자신의 `resetKey`도
  올려 둔다.
- **`shells/mobile/StackNav.tsx`(142~152행)**: `<div className="m-stack-body">` 안을
  `<ViewErrorBoundary key={top.key}>`로 감쌌다. `top.key`는 `push()`가 발급하는 스택 항목별
  고유값(93행대)이라, 스택 최상단이 바뀌면(뒤로가기·새 push) React가 `key`가 바뀐 걸 보고
  이전 `ViewErrorBoundary` 인스턴스를 폐기하고 새로 만든다 — 크래시 상태가 다음 화면으로 새지
  않는다. `StackNav`는 스택 최상단 1개만 렌더하고(`if (stack.length === 0) return null`) 이
  컴포넌트 자체가 `MobileShell`이 그리는 헤더(`m-stack-header`)와 형제가 아니라 그 헤더를
  포함한 `m-stack-overlay` 안에 함께 있으므로, 안(바운더리 안)에서 난 예외가 바깥의
  `m-stack-header`(뒤로가기 버튼)까지 지우지 않는다는 것도 같은 "바운더리는 자신의 children만
  본다"는 계약으로 보장된다.
- **`shells/mobile/MobileShell.tsx`(278~289행, 새로 찾은 세 번째 지점)**: 활성 탭 렌더를
  `<ViewErrorBoundary key={activeTabId}>`로 감쌌다 — StackNav와 같은 논리(탭 전환 시
  `activeTabId`가 바뀌어 바운더리가 통째로 재생성된다). 이 바운더리는 `<main
  className="m-shell-main">` 안에만 있고, `<TabBar>`(하단 탭바)·`<StackNav>`·`<ToastHost>`는
  전부 `m-shell` 트리에서 이 바운더리의 형제이므로 탭 뷰의 크래시가 탭바 자체를 지우지
  않는다(탭바가 살아있어야 다른 탭으로 이동해 벗어날 수 있다).

**수동 검증 절차** (이 환경엔 브라우저가 없어 직접 실행할 수 없다 — 데모 리허설 절차,
todo/23 ASSUMPTIONS 항목과 같은 형식):
  1. `npm run dev`로 개발 서버를 띄운다.
  2. 아무 뷰(예: `views/catalog/index.tsx`) 최상단에 임시로 `if (Math.random() < 2) throw new
     Error('디버그용 강제 크래시');`를 렌더 본문에 넣는다(항상 참이라 렌더마다 던짐).
  3. **데스크톱**: 그 뷰를 창으로 연다 → 그 창 안에만 "이 화면에서 오류가 발생했습니다" +
     "다시 열기" 버튼이 보이고, 도크·이미 열려 있던 다른 창들은 그대로 정상 동작하는지 확인.
     "다시 열기" 클릭 → 창이 닫혔다 같은 뷰로 새 창이 열리는지(그래도 임시 throw가 남아있으면
     다시 같은 폴백이 뜨는 게 정상 — throw를 지우기 전까지는 계속 크래시해야 맞다) 확인.
  4. **모바일 폭**(또는 실제 모바일 UA): 그 뷰가 탭이면 탭을 누르고, push 전용 뷰면 다른
     화면에서 열어(`shell.open`) → 탭바/헤더 뒤로가기 버튼은 그대로 있고 본문에만 폴백이
     보이는지 확인. 탭인 경우 다른 탭으로 전환했다가 되돌아오면(또는 push인 경우 뒤로 갔다
     다시 열면) `key` 교체로 바운더리가 재생성돼 다시 시도되는지 확인.
  5. 임시 throw를 제거하고 원래대로 렌더되는지 확인한 뒤 되돌린다.

### 항목 3 — 오프라인 큐 실전 검증

**죽은 코드 발견(정직하게 기록)**: `services/offlineQueue.ts`가 내보내는
`enqueueAndSend`/`flushQueue`/`getPendingCount`/`getPendingEntries`/`onQueueChange` 중 어느
것도 이 파일 밖에서 호출되지 않는다 — `grep -rn "enqueueAndSend\|flushQueue\|getPendingCount\|
getPendingEntries\|onQueueChange" webapp/src`로 확인했고, 매치는 전부 `offlineQueue.ts` 자기
자신(정의·`window.addEventListener('online', ...)` 내부 호출)뿐이다. 실제 쓰기 화면
(`loan-return/index.tsx` 등)은 `apiCall`/`retryApiCall`을 직접 부르고 UI 상태를
`pushOp`/`patchOp`로 로컬 관리한다 — 이 큐 모듈을 전혀 거치지 않는다. **이 모듈은 고립된
상태로는 맞게 구현돼 있지만(아래 트레이스 참고), 아직 어디에도 배선되지 않았다.** 이 항목의
범위는 "실전 검증"이지 배선이 아니므로(이미 검증된 checkout_/return_ 등 핵심 흐름에 새 경로를
꽂는 건 별도 판단이 필요한 행동 변경 — 회귀 위험), **의도적으로 배선하지 않는다.** 어디에·언제
꽂을지는 향후 별도 todo가 결정할 일로 남긴다.

**모듈 자체의 정합성 트레이스** (실행 중인 브라우저 없이 코드 재독으로 확인):

- **적재가 네트워크 시도보다 먼저 일어난다.** `enqueueAndSend`(63~78행)는
  `await put(entry)`(IndexedDB 쓰기) + `await notify()`를 `apiCall()` 호출보다 먼저 실행한다
  — 그 사이 탭이 죽거나 iOS가 저장소를 비우기 전에 크래시해도, 요청은 이미 IndexedDB에
  영속돼 있다(메모리에만 있다가 유실되는 창이 없다).
- **"적재 즉시 전송을 시도"(파일 상단 3~4행 주석)가 실제로 구현돼 있다.** `put()` 직후 바로
  `apiCall<T>(action, payload)`를 호출한다 — 큐에 넣고 `flushQueue()`(온라인 이벤트)를
  기다리기만 하는 게 아니라, 적재한 그 자리에서 즉시 한 번 보낸다. 이게 iOS의 "미사용 7일 후
  저장소 축출" 위험과 맞물리는 이유: 온라인 상태에서 정상 호출된 요청은 성공하면 바로
  `remove()`돼 큐에 "미사용 채로" 남지 않는다 — 축출 위험에 노출되는 건 오직 그 즉시 전송이
  실패한(오프라인 등) 요청뿐이고, 그 요청들은 정의상 "다음 온라인 복귀까지는 어차피 못 보낸다"는
  본질적 제약이 있어 이 설계가 할 수 있는 최선이다.
- **성공(`result.ok`) 또는 네트워크 이외 사유 실패는 큐에서 제거한다.** `enqueueAndSend`
  71~76행·`flushQueue` 84~85행 둘 다 `if (result.ok || result.error.code !== 'NETWORK_ERROR')
  await remove(entry.id)` — 서버가 실제로 응답했지만 거부한 요청(예: `VALIDATION_ERROR`,
  `MEMBER_SUSPENDED` 등 정상적 업무 규칙 거부)을 무한 재전송하지 않는다(파일 73행 주석 그대로:
  "같은 requestId 무한 재전송은 정책상 금지, 사람이 다시 트리거해야 한다"). 큐에 남는 것은
  오직 `NETWORK_ERROR`(서버에 닿지도 못한 경우)뿐이라 "온라인 복귀 시 재전송"이라는 큐의
  존재 이유와 정확히 일치한다.
- **재전송 시 서버 멱등이 중복을 흡수한다.** `enqueueAndSend`의 `entry.payload`(원본
  `payload.requestId` 포함)를 그대로 IndexedDB에 저장하고, `flushQueue()`도 같은
  `entry.payload`를 그대로 `apiCall()`에 넘긴다 — 적재 시점과 재전송 시점 사이에 `requestId`가
  바뀌지 않는다. 이 requestId 재사용이 `executeWrite_`의 기존 멱등 체계(`payload_hash` 비교 +
  `COMPLETED`면 `idempotent: true` 반환, 2500행대, 무수정)와 만나 "오프라인 중 실제로는 서버에
  닿아 처리됐는데 클라이언트만 실패로 착각한 요청"까지도 중복 실행 없이 안전하게 흡수된다 —
  이 멱등 로직 자체는 이번 항목에서 새로 검증한 게 아니라 기존에 이미 검증된 것을 그대로
  신뢰한다.
- **H3(2026-07-15, api.ts 진단 필드 추가) 이후에도 이 계약이 유지된다.** H3는 POST가
  `fetch()` 단계에서 죽었을 때(`outcome === 'network'`) `READ_ONLY_ACTIONS`(api.ts 81~93행)에
  속한 액션에 한해서만 GET 재시도를 붙였다. `offlineQueue.ts`가 다루는 11개 `apiWeb*` 쓰기
  액션(`checkout`/`return`/`reserve`/`cancelReservation`/`renew`/`markLost`/`payFine`/
  `inventoryScan`/`registerTitle`/`registerCopy`/`enrichBibliographic`)은 전부
  `READ_ONLY_ACTIONS`에 없다(`grep -n` 목록 대조 확인) — 즉 쓰기 액션은 `performFetch`가
  `fetch()` 자체에서 실패한 경우 항상 `resultCode: 'NETWORK_ERROR'`를 그대로 반환하고(GET
  재시도 분기를 절대 타지 않는다), `offlineQueue.ts`의 `result.error.code !== 'NETWORK_ERROR'`
  체크가 H3 이전과 똑같이 동작한다. H3가 새로 나눈 `network`/`timeout`/`error` 세 갈래 중
  `timeout`(`CLIENT_TIMEOUT`, `AbortController` 타임아웃)과 `error`(HTTP는 왔지만
  `ok:false`/파싱 실패)는 둘 다 `NETWORK_ERROR`가 아니므로 큐 쪽에서는 여전히 "제거 대상"으로
  본다 — 이건 H3 이전부터 있던 동작이고, "서버가 어떤 형태로든 응답은 했다(또는 응답이 왔다고
  볼 만한 실패다)면 무한 재전송하지 않는다"는 기존 정책과 일치해 회귀가 아니다.

**수동 검증 절차**(이 큐가 실제로 배선되기 전까지는 브라우저 콘솔에서 이 모듈만 독립적으로
확인하는 절차 — 배선 이후엔 실제 쓰기 화면으로 재현):
  1. 개발자 도구 콘솔에서 `import('/src/services/offlineQueue.ts')`로 모듈을 불러온 뒤(또는
     이미 배선된 화면이 생기면 그 화면에서), Network 탭을 **Offline**으로 전환한다(실제 폰
     비행기 모드가 더 정확하지만 DevTools로도 `fetch()` 실패를 재현할 수 있다).
  2. `enqueueAndSend('checkout', { requestId: crypto.randomUUID(), copyKey: '<테스트
     바코드>', memberKey: '<테스트 회원번호>' })`를 호출 → 반환된 Promise가 `ok:false,
     error.code:'NETWORK_ERROR'`로 resolve되는지, `getPendingCount()`가 1을 반환하는지 확인
     (IndexedDB Application 탭에서 `lib-offline-queue` DB의 `requests` 스토어에 그 항목이
     실제로 있는지도 확인).
  3. Network 탭을 **Online**으로 되돌린다 → `window`의 `online` 이벤트가 발화해
     `flushQueue()`가 자동 호출된다 — 잠시 후 `getPendingCount()`가 0으로 돌아오는지, 시트에
     실제로 그 대출 1건만 생겼는지(중복 2건이 아닌지) 확인.
  4. 같은 `requestId`로 2단계를 한 번 더 실행(수동 멱등 확인) → 서버가
     `{ idempotent: true, ... }`를 반환하고 시트에 새 행이 추가되지 않는지 확인.
  5. (iOS 실기기가 있다면) 오프라인 상태로 2단계를 실행한 뒤 앱을 완전히 종료하고 7일을
     기다리는 대신, iOS 설정의 "저장 공간" 정리 또는 사파리 개발자 도구로 강제 축출을 흉내
     — 축출 전에 상태가 온라인으로 바뀌어 즉시 전송·제거가 이미 끝나 있었는지, 혹은 축출
     시나리오 자체가 "오프라인 상태가 7일 이상 지속"이라는, 이 도서관 앱의 실사용 패턴상 거의
     발생하지 않는 극단값인지를 함께 판단 근거로 남긴다(이 자체가 이번 항목이 배선하지 않기로
     한 이유 중 하나이기도 하다 — 실제 배선 전에 먼저 "언제 큐에 태울지" 정책을 정해야
     한다).

## todo/26 · 설정 뷰 (2026-07-15)

- **"마지막 백업" 표시는 이번 항목에서 뺐다 — 실제 백업 메커니즘이 없고, 대안(DriveApp 최종
  수정 시각)은 새 OAuth 스코프를 요구했기 때문이다.** `grep -ri "backup\|백업"`을 이 코드베이스
  전체에 돌려도 0건이다 — 대출·반납·등록 같은 트랜잭션 로그(15_AUDIT_LOG)는 있지만, 스프레드시트
  자체를 주기적으로 복제·스냅샷하는 절차는 어디에도 구현돼 있지 않다. 초안은
  `DriveApp.getFileById(getSpreadsheet_().getId()).getLastUpdated()`(파일 최종 수정 시각)를
  "최근 수정 시각"이라는 정직한 라벨로 대신 보여주려 했으나, 이 호출에 필요한 Drive API
  OAuth 스코프가 `appsscript.json`의 기존 5개 스코프(`spreadsheets.currentonly` ·
  `script.container.ui` · `script.scriptapp` · `userinfo.email` ·
  `script.external_request`)에 전혀 없었다 — `DriveApp`은 `SpreadsheetApp`과 별개 API 표면이라
  컨테이너 바인딩 스프레드시트라도 별도 스코프 선언 없이는 호출 시 예외가 난다. 새 스코프
  추가(`drive.readonly`, 최소 권한으로 선택)는 다음 Code.gs 재배포 시 스크립트 소유자에게
  추가 권한 재동의 화면을 띄우는, 사용자가 미리 알지 못한 범위 확장이라 판단해 커밋 전에
  AskUserQuestion으로 직접 물었다 — 사용자가 "최근 수정 시각 기능은 빼고 나머지만 커밋"을
  선택했다. 그래서 `apiWebSettingsOverview_`에서 `lastModifiedText` 필드·DriveApp 호출을
  전부 제거하고 `appsscript.json`의 스코프 추가도 되돌렸다 — 이 화면은 이제 POLICIES/CONFIG
  읽기·트리거 설치 여부·무결성 점검·서지 보강 4가지만 제공한다. "마지막 백업"이 정말 필요하면
  향후 별도 todo로 스코프 확장 여부를 다시 논의한다.

- **doPost의 "추가만" 예외를 doGet의 내부 read 디스패치 if-chain에도 똑같이 적용**했다 —
  task 노트는 "`READ_ONLY_ACTIONS`(api.ts)·`GET_ALLOWED_ACTIONS_`(Code.gs) 두 배열에만 추가하면
  된다"고 적었지만, `GET_ALLOWED_ACTIONS_`는 doGet(3117행대)의 진짜 실행 분기가 아니라 그
  앞단의 "이 action이 GET으로 허용되는가" 가드일 뿐이다(3128행: 배열에 없으면
  `METHOD_NOT_ALLOWED`로 즉시 거부) — 가드를 통과한 뒤 실제로 데이터를 반환하는 건 그 아래
  별도의 `if (action === '...') return apiWeb..._(params);` 체인(3133~3144행)이다. 이 체인에
  새 액션 두 줄을 추가하지 않았다면 `settingsOverview`/`runIntegrityCheck`는 GET 가드는
  통과하고도 실제 분기가 없어 `UNKNOWN_ACTION`으로 떨어졌을 것이다 — "GET·POST 두 경로가 항상
  같은 동작을 보장한다"는 이 파일 자신의 주석(3106~3111행)과 어긋나고, api.ts의 H3
  자동 GET 재시도(POST가 네트워크 계층에서 죽었을 때만 발동)가 이 두 액션에 한해서만 조용히
  실패하는 비대칭이 생긴다. 그래서 다른 9개 GET 허용 액션과 완전히 같은 모양으로 실행 분기
  두 줄을 doGet 안에도 추가했다 — "다른 모든 읽기 액션과 일관되게"라는 task 노트의 진짜 의도를
  문자 그대로의 "배열 두 곳만"보다 우선했다. doPost·doGet의 기존 줄은 이 두 줄씩의 순수 추가
  외에는 전혀 바뀌지 않았다(각 함수 끝의 `fail_('UNKNOWN_ACTION', ...)` 직전에만 삽입).

- **POLICIES 매트릭스에서 `created_at`/`created_by`/`row_version` 3개 컬럼은 응답에서 뺐다** —
  `13_POLICIES`의 18개 컬럼 중 나머지 15개(정책 ID·회원/자료 유형·대출/연장/예약/수령 관련
  숫자 5종·연체료·적용 시작/종료일·상태·수정 시각/수정자)만 `apiWebSettingsOverview_`가
  camelCase로 매핑해 내려준다. 이 3개는 "언제 처음 만들어졌는지"·"동시 편집 충돌 감지용
  내부 버전 카운터"라 사서가 정책을 훑어볼 때 의미 있는 "매트릭스" 정보가 아니라고 판단했다 —
  17_CONFIG는 컬럼이 6개뿐이라 전부(설정 키·값·값 유형·설명·수정 시각/수정자) 그대로 내려준다.

- **무결성 점검(`runIntegrityCheck` 액션)은 읽기 전용이라 샘플 폴백 대상, 서지 보강
  (`enrichBibliographic`)은 실제 쓰기라 샘플 폴백 대상이 아니다** — 서로 다른 두 액션을 한
  화면에 같이 두면서 규약이 갈리는 점을 명시적으로 갈랐다(`services/settingsData.ts` 상단
  주석 참고). `integrityCheck_()`는 `13_POLICIES` 등 원장을 읽기만 하고 아무것도 쓰지 않는다
  (사이드바 `apiRunIntegrityCheck()`와 완전히 같은 함수를 재사용) — 그래서 UNKNOWN_ACTION일 때
  `mocks/settings.ts`의 샘플로 폴백해도 "가짜 성공"이 아니다(사이드바 결과와 똑같은 모양의
  아무 문제 없음 상태를 보여줄 뿐). 반면 서지 보강은 `executeWrite_`를 거쳐 `08_COPIES`·
  `03_TITLES.cover_url`을 실제로 바꾸는 todo/17의 기존 쓰기 액션이라, 배포 전(UNKNOWN_ACTION)
  이면 `reservationData.ts`의 createReservation/cancelReservation과 같은 방식으로 오류 토스트만
  띄운다(성공한 척하지 않는다).

- **`views/settings`의 "수정은 시트/사이드바" 안내문은 실제 메뉴 경로를 확인해서 적었다** —
  `Code.gs`의 `onOpen()`(77행대)이 만드는 스프레드시트 메뉴 "📚 도서관 관리 ▸ 사이드바 열기"로
  열리는 `Sidebar.html`을 직접 grep한 결과, "관리" 탭 안에 "기본 대출 정책 변경"
  섹션(507~521행)이 실제로 존재해 `13_POLICIES`의 기본 정책(`DEFAULT_POLICY_ID`)을 그 UI로
  바꿀 수 있다 — 그래서 정책 안내문은 이 경로를 구체적으로 언급한다. 반면 `17_CONFIG`를 편집할
  수 있는 사이드바 UI는 어디에도 없다(`Sidebar.html`에 "CONFIG" 관련 문자열 0건) — 그래서 설정
  값 안내문은 "17_CONFIG 시트를 직접 편집"이라고만 쓰고, 존재하지 않는 사이드바 경로를
  지어내지 않았다. 실제로 존재하는지 확인하지 않은 URL(스프레드시트 링크 등)은 아예 만들지
  않았다(task 노트 지시 그대로).

- **설정 뷰 아이콘은 `SlidersHorizontal`(lucide-react)을 선택**했다 — `MobileShell.tsx`가 이미
  `Settings` 아이콘을 접속 설정(API URL·토큰·operator) 다이얼로그를 여는 기어 버튼
  (`m-shell-settings`, `openSessionSettings`)에 쓰고 있어, 레지스트리 뷰에도 같은 `Settings`를
  쓰면 두 화면이 아이콘만으로 구분되지 않는다(하나는 셸 접속 설정, 하나는 도서관 정책/운영
  설정 — 완전히 다른 개념). 완전히 다른 아이콘을 골라 혼동을 원천 차단했다.

---

## todo/29 · 읽기 API 캐시·중복제거 (2026-07-17)

- **reserve·cancelReservation·renew·markLost·payFine 성공 분기에 `publishDataChange()`를 추가**했다.
  지금까지 이 신호는 대출·반납(loan-return)·등록(registerQueue)·서지보강(settingsData)만 발행했고,
  FRONTEND.md 「갱신 = 트랜잭션 후」가 명시한 원칙에 비추면 위 다섯 쓰기는 발행 누락이었다.
  todo/29의 읽기 캐시는 이 신호로 무효화되므로, 누락을 그대로 두면 "예약 취소 직후 예약 목록이
  TTL(15초) 동안 낡게 보이는" 회귀가 생긴다 — 원칙 부합 + 캐시 전제라 질문 없이 추가했다.
- **inventoryScan에는 추가하지 않았다** — 장서점검 러시아워엔 초당 여러 건이 발행돼 대시보드
  재조회를 오히려 폭증시킨다(할당량 절감이라는 이 항목의 목적에 역행). 점검 세션 종료 화면이
  필요해지면 그때 일괄 1회 발행을 검토.
- **대시보드 트랜잭션-후 재조회에 1.5초 트레일링 디바운스**를 넣었다 — 연속 대출·반납 시
  트랜잭션마다 나가던 dashboard 읽기를 병합한다. "마지막 트랜잭션 후 1.5초 내 갱신"으로 계약
  유지. 실패(ok:false) 응답은 캐시하지 않는다(재시도 버튼이 거짓말이 되지 않게).

---

## todo/30 · 성능 예산 감사 자동화 (2026-07-17)

- **12px 최소 폰트 검사에서 두 맥락을 면제**했다: ① `@media print` 블록(DESIGN.md 「인쇄」 절이
  A4·잉크·1장 원칙으로 별도 규정하는 위계 — 화면 가독성 최소치의 대상이 아님. print.css의
  10~10.5px은 인쇄 관행 범위) ② `fill:`을 선언한 규칙 블록(SVG 텍스트 — viewBox 스케일에서
  font-size는 좌표계 단위라 화면 px과 다름. 정적 검사로 렌더 크기를 판정하면 오탐/누락 둘 다
  생긴다). viz 라벨의 렌더 크기 검토는 todo/30 「발견」에 시각 감사 항목으로 기록.
- **setInterval 규칙은 "금지"가 아니라 "의도 선언 강제"**로 설계했다 — 콜백 안 네트워크 호출을
  정적으로 완전 추적할 수 없어, 마커 없는 setInterval = 빌드 실패로 만들어 새 폴링이 리뷰 없이
  못 들어오게 한다(기존 4곳 전수 확인 후 마커 부여).

---

## todo/34 · viz 라벨 렌더 크기 (2026-07-17)

- DESIGN.md 「12px 미만 금지」를 SVG 라벨에는 **"기본 배치의 실제 렌더 px ≥ 12"**로 해석했다
  (좌표계 px이 아니라 화면 px이 가독성의 실체). 데스크톱 1280 기본 배치에서 실측 미달 5종을
  상향했고, 이미 12px 이상으로 렌더되던 사분면 라벨(9px 좌표, 14.5px 렌더)은 상향 실험이
  축 라벨 충돌을 만들어 원복 — "렌더 기준 충족 + 충돌 없음"을 우선했다.

---

## todo/124~129 · 난민학교 학생 관리 (2026-07-19)

- **birth_year를 HEADERS 말미에 둔 이유** — 의미상 grade 옆이지만, 말미 append면 기존 열이
  한 칸도 안 움직여 마이그레이션이 "헤더 셀 1개 추가"로 끝난다(readTable_은 이름 색인이라
  위치 무관). appendRecord_가 없는 열을 **조용히 버리는** 것을 확인해, 마이그레이션 전
  birthYear 저장은 명시 실패(업그레이드 메뉴 안내)로 승격했다.
- **검증 리스트 교정을 같이 한 이유** — 학교 패치가 코드북에 STUDENT·GRADUATED를 넣고도
  시트 데이터 검증 리스트는 안 고쳐, setAllowInvalid(false) 아래서 UI 편집이 막히고 셀마다
  무효 깃발이 서 있었다(스크립트 쓰기는 검증을 우회하므로 동작은 했지만 시각 소음).
- **memberList는 status:'ALL' 1회 + 로컬 필터** — 전교 수십 명. ADR-024와 같은 원칙.
  관리 화면이라 캐시도 안 쓴다(등록 직후 목록 반영이 신뢰의 전부).
- **일괄 등록에 상주 큐를 안 만든 이유** — registerQueue는 "사서 부재 중 실패를 다음 부팅이
  살린다"용. 일괄 등록은 감독하 일회성(화면을 보며 실행)이라 실패 줄 재시도 버튼이 정답.
  대신 완료 장부를 **내용 키(lineKey)** 로 관리 — 파서 재실행(목록 갱신) 때 requestId가
  재발급돼 완료 줄이 「대기」로 둔갑·재실행=중복 등록이 되는 실결함을 캡처로 잡아 고쳤다.
- **수정 폼의 비고 = 추가 의미** — 서버 updateMember_가 appendNote_(덧붙임)라 라벨을
  「비고 추가」로 명시(덮어쓰기 오해 방지). ensureOperatorNote_는 회원 쓰기에 의도적 미사용
  (회원 note는 원장 데이터 — 반 이동마다 작업자명이 쌓이면 오염, 귀속은 감사 로그).
- **members 뷰 scan:'focus'** — 학생 카드(S: 접두) 스캔 → 1명 핀. 같은 반 유사 이름 실례
  (Aisyah 3인)에서 이름 검색보다 안전한 1차 경로.
- **학년 축 viz는 빈 데이터가 정상**(라벨 학교) — GradeReadingGap·ClassParticipation의 반 축
  전환은 후속 후보로 남긴다(waiting/ 승격 대상 아님, 사용자 지시 대기).

---

## todo/130~132 · 플로팅 윈도우 점검 (2026-07-19)

- **좌표 계약을 스토어 한 곳으로**(clampRectToWorkspace) — 창 rect는 워크스페이스 내부
  좌표라는 사실(todo/108)이 이번에도 사고 원인이었다: 드래그 좌측 클램프가 DOCK_WIDTH를
  이중 가산했고, 우·하는 아예 무제한이라 persist와 결합해 "화면 밖 영구 유실"이 가능했다.
  경계 계산을 컴포넌트에서 걷어 스토어 단일 지점으로 모으고, 열기/드래그/리사이즈/브라우저
  축소 네 경로가 같은 함수를 지나게 했다. ScannerWindow는 **화면 좌표계**(workspace 밖
  직속)라 같은 계약을 자기 좌표계로 별도 구현 — 두 좌표계가 다름을 양쪽 주석에 남겼다.
- **z 재정규화 임계 300** — 도크 z=500이 전제. MAX 6창이라 압축 후 재적립까지 ~300회 여유.
  "창이 도크를 덮는" 증상은 장기 무재시작 세션에서만 나타나는 잠복형이라 e2e 대신 코드
  리뷰·주석으로 방어(포커스 500회를 도는 스펙은 낭비).
- **스냅·최대화는 저장하지 않는다** — localStorage rect는 "사용자가 손으로 잡은 자유 배치"
  전용. 종전엔 스냅이 저장을 덮어 다음 열기가 항상 절반 창이었다. 같은 원칙으로 타이틀바
  클릭·더블클릭(이동 없는 pointerup)도 저장하지 않는다(moved 플래그).
- **도크 클릭 = 가기, shell.open = 새 창** — 비단일 뷰의 의도적 다중 창(도서 상세 비교)은
  뷰 내부 경로로 열리고, 도크는 항상 기존 창 포커스/복원이 먼저다(아이콘 is-open 표시와
  행동 일치).
- **리사이즈 핸들 안쪽 배치** — .window overflow:hidden이 바깥 돌출 핸들의 절반을 클립해
  유효 표적이 3px뿐이었다. 구조 변경(래퍼 도입) 대신 안쪽 배치를 택한 이유: print.css가
  `.window.is-print-target > .window-titlebar` 직계 선택자를 쓰고 있어 래퍼가 인쇄 경로를
  건드린다(검증된 경로 보존 > 스크롤바 5px 겹침 트레이드오프).
- **등장 애니메이션과 e2e** — scale 0.98 등장(120ms) 중 boundingBox는 ~1% 작게 측정된다.
  창을 새로 연 직후 기하 단정은 반드시 정착 대기(250ms) 후에(window-bounds.spec 주석).
