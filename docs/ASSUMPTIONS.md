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
