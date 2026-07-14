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
