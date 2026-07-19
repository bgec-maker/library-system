import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Settings } from 'lucide-react';
import type { ShellContext, ToastKind, ViewId, ViewMeta } from '../../types';
import { getViewMeta, mobileTabViews, moreMenuViews } from '../../registry';
import { VIEW_COMPONENTS } from '../../viewResolver';
import { ViewErrorBoundary } from '../../components/ViewErrorBoundary';
import { useSession } from '../../services/session';
import { cameraSession, type CameraSessionStatus } from '../../services/cameraSession';
import { setScanRoute, subscribeScan } from '../../services/scanBus';
import { pushToast } from '../../services/toastBus';
import { currentWindowDeepLink, subscribeWindowDeepLink } from '../../deepLink';
import { dashboardData, useDashboardData } from '../../services/dashboardData';
import { checkNewNoticesOnBoot } from '../../services/noticeData';
import { ToastHost } from '../../components/ToastHost';
import { ScanFlashOverlay } from '../../components/ScanFlashOverlay';
import { SampleDataBadge } from '../../components/SampleDataBadge';
import { openSessionSettings } from '../../services/sessionSettingsUi';
import { setLocale, subscribeLocale, t, useLocale, type Locale } from '../../i18n';
import TabBar, { type TabSelection } from './TabBar';
import StackNav, { type StackNavHandle } from './StackNav';
import './mobile.css';

// FRONTEND.md '모바일 셸 — 탭 + 스택'의 기본 export. boot.tsx가
// lazy(() => import('./shells/mobile/MobileShell'))로 불러온다.
// 레이아웃: [헤더+활성 탭 뷰 (+ 그 위를 덮는 StackNav push 오버레이)] 위에 하단 탭바 고정.
// ToastHost·ScanFlashOverlay는 셸 루트에서 이 파일 한 곳에서만 마운트한다.

function tabHeaderTitle(id: TabSelection): string {
  if (id === 'more') return t('common.more');
  const meta = getViewMeta(id);
  if (!meta) return id;
  // TabBar의 labelFor와 동일 규칙(loan-return→"스캔") — 헤더 타이틀 기본값에도 그대로 적용.
  return meta.id === 'loan-return' ? t('shell.mobile.scanTabLabel') : meta.title;
}

interface MoreMenuScreenProps {
  items: ViewMeta[];
  onOpen: (viewId: ViewId) => void;
}

// 언어 토글 — FRONTEND.md "전환 UI: 설정·더보기". 데스크톱 Dock.tsx의 LocaleSwitch와 같은
// 이유로 언어 이름은 사전 키가 아니라 ASCII 로케일 코드로 표시한다.
function LocaleRow() {
  const locale = useLocale();

  function pick(next: Locale) {
    if (next !== locale) void setLocale(next);
  }

  return (
    <div className="m-more-locale" role="group" aria-label={t('common.language')}>
      <span className="m-more-locale-label">{t('common.language')}</span>
      <div className="m-more-locale-btns">
        <button type="button" className={`m-more-locale-btn${locale === 'ko' ? ' is-active' : ''}`} onClick={() => pick('ko')}>
          KO
        </button>
        <button type="button" className={`m-more-locale-btn${locale === 'en' ? ' is-active' : ''}`} onClick={() => pick('en')}>
          EN
        </button>
      </div>
    </div>
  );
}

// 연속 모드 핀 — FRONTEND.md "연속 모드... 모바일에서도 접근 가능해야". 데스크톱 위젯의 체크박스와
// 같은 cameraSession.setContinuous()를 호출한다. 더보기 화면에 언어 토글과 나란히 둔다.
function CameraContinuousRow() {
  const [session, setSession] = useState<CameraSessionStatus>(() => cameraSession.getStatus());

  useEffect(() => cameraSession.onStatus(setSession), []);

  return (
    <div className="m-more-locale" role="group" aria-label={t('camera.continuousMode')}>
      <span className="m-more-locale-label">{t('camera.continuousMode')}</span>
      <label className="m-more-continuous-toggle" title={t('camera.continuousModeHint')}>
        <input type="checkbox" checked={session.continuous} onChange={(e) => cameraSession.setContinuous(e.target.checked)} />
      </label>
    </div>
  );
}

// ADR-021 데스크톱 기저층의 모바일 대응 — FRONTEND.md "모바일 셸엔 기저층 없음 — 카드 요약은
// 「더보기」 상단에 축약 배치". 데스크톱 6칸 전부가 아니라 가장 실무적인 3개(대출중·연체·예약
// 대기)만 압축 표시한다 — 이 화면은 진입할 때마다 새로 마운트되므로(MobileShell의 탭 전환은
// 조건부 렌더) ensureAutoRefresh() 호출이 곧 "더보기 진입 = 갱신"을 만족시킨다.
function DashboardSummaryStrip({ onOpenReservations }: { onOpenReservations: () => void }) {
  const { data, sample } = useDashboardData();

  useEffect(() => {
    dashboardData.ensureAutoRefresh();
  }, []);

  const stats = data?.stats;

  return (
    <div className="m-dash-summary">
      <div className="m-dash-summary-head">
        <span className="m-dash-summary-title">{t('dashboard.mobileSummary.heading')}</span>
        {sample && <SampleDataBadge />}
      </div>
      <div className="m-dash-summary-grid">
        <div className="m-dash-summary-item">
          <span className="m-dash-summary-value">{stats?.openLoans ?? 0}</span>
          <span className="m-dash-summary-label">{t('dashboard.kpi.openLoans')}</span>
        </div>
        <div className="m-dash-summary-item is-alert">
          <span className="m-dash-summary-value">{stats?.overdue ?? 0}</span>
          <span className="m-dash-summary-label">{t('dashboard.kpi.overdue')}</span>
        </div>
        {/* todo/72 — 대응 화면이 있는 타일만 탭 가능(예약 대기→예약 관리, 데스크톱 예약 도착
            카드와 패리티). 대출중·연체는 1:1 화면이 없어 정적 유지 — 가짜 어포던스 금지. */}
        <button type="button" className="m-dash-summary-item m-dash-summary-link" onClick={onOpenReservations}>
          <span className="m-dash-summary-value">{stats?.activeReservations ?? 0}</span>
          <span className="m-dash-summary-label">{t('dashboard.kpi.activeReservations')}</span>
        </button>
      </div>
    </div>
  );
}

function MoreMenuScreen({ items, onOpen }: MoreMenuScreenProps) {
  return (
    <>
      <DashboardSummaryStrip onOpenReservations={() => onOpen('reservations')} />
      <LocaleRow />
      <CameraContinuousRow />
      {items.length === 0 ? (
        <p className="m-more-empty">{t('shell.mobile.moreEmpty')}</p>
      ) : (
        <ul className="m-more-list">
          {items.map((meta) => {
            const Icon = meta.icon;
            return (
              <li key={meta.id}>
                <button type="button" className="m-more-item" onClick={() => onOpen(meta.id)}>
                  <span className="m-more-icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <span className="m-more-label">{meta.title}</span>
                  <span className="m-more-chevron" aria-hidden="true">
                    <ChevronRight size={20} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

let noticeBootChecked = false; // todo/137 — 세션당 1회 공지 확인(DesktopShell과 동일 가드)

export default function MobileShell() {
  // 언어 토글이 눌리면 이 컴포넌트가 재렌더되고, 활성 탭 뷰·StackNav도 함께 재렌더돼 t()를
  // 다시 평가한다(DesktopShell.tsx의 동일 패턴 참고).
  useLocale();

  // todo/137 — 부팅 시 새 공지 1회 안내(DesktopShell과 동일, 타이머 없음).
  useEffect(() => {
    if (noticeBootChecked) return;
    noticeBootChecked = true;
    void checkNewNoticesOnBoot().then((notice) => {
      if (notice) pushToast(t('shell.noticeToast', { title: notice.title }), 'info');
    });
  }, []);

  // todo/44(현장 제보 2 — 설치형 PWA 콜드 스타트에서 탭바 아래 죽은 띠): iOS standalone은
  // 첫 레이아웃을 낡은 뷰포트 높이로 잡고 정정 resize를 첫 상호작용 전까지 안 쏘는 경우가
  // 있다 — dvh(todo/43)도 그 낡은 값 기준이라 CSS만으론 못 잡는다. visualViewport 실측을
  // --app-vh로 주입하고(mobile.css .m-shell이 소비), 상호작용 없이도 수렴하도록 초기 두 번
  // 재측정한다. 여기는 셸 계층이라 window 사용이 허용된다(제1원칙 — 뷰만 금지).
  // 부작용 검토: 키보드가 열리면 visualViewport가 줄어 탭바가 키보드 위로 따라온다 —
  // 안드로이드 크롬 기본 동작과 같은 계열이라 수용(불편 제보 시 후속 조정, todo/done/44).
  useEffect(() => {
    const root = document.documentElement;
    // todo/45: 이 버그에선 visualViewport·innerHeight 둘 다 첫 제스처 전까지 낡은 값을 준다
    // (todo/44의 시간 지연 재측정으로 부족했던 이유 — 현장 스크린샷 2건). standalone에선
    // 하드웨어 화면 크기(screen.*)가 이 버그의 영향을 받지 않는 유일한 소스이고,
    // black-translucent 전체화면이라 화면 높이가 곧 진짜 뷰포트다. 입력 포커스 중(키보드)엔
    // 줄어든 visualViewport가 정답이므로 하한을 적용하지 않는다.
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const apply = () => {
      const vv = window.visualViewport?.height ?? window.innerHeight;
      let h = vv;
      if (standalone) {
        const tag = document.activeElement?.tagName ?? '';
        const editing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
        if (!editing) {
          // iOS는 screen.width/height를 세로 고정으로 주는 버전이 있어 방향으로 장·단변을 고른다.
          const longer = Math.max(window.screen.width, window.screen.height);
          const shorter = Math.min(window.screen.width, window.screen.height);
          const screenH = window.matchMedia('(orientation: portrait)').matches ? longer : shorter;
          h = Math.max(vv, screenH);
        }
      }
      if (h > 0) root.style.setProperty('--app-vh', `${Math.round(h)}px`);
    };
    apply();
    // 합성 스크롤 넛지 — WebKit이 첫 제스처까지 미루는 뷰포트 재계산을 앞당긴다(무해: body는
    // 스크롤 컨테이너가 아니라 시각적 이동 없음).
    requestAnimationFrame(() => {
      window.scrollTo(0, 1);
      window.scrollTo(0, 0);
      apply();
    });
    const t1 = setTimeout(apply, 250);
    const t2 = setTimeout(apply, 1000);
    window.visualViewport?.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    window.addEventListener('pageshow', apply);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.visualViewport?.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
      window.removeEventListener('pageshow', apply);
      root.style.removeProperty('--app-vh');
    };
  }, []);

  const role = useSession((s) => s.role);
  const tabs = useMemo(() => mobileTabViews(role), [role]);
  const moreList = useMemo(() => moreMenuViews(role), [role]);

  const [activeTabId, setActiveTabId] = useState<TabSelection>(() => tabs[0]?.id ?? 'more');
  const [activeTabParams, setActiveTabParams] = useState<Record<string, unknown>>({});
  const [tabTitle, setTabTitle] = useState<string>(() => tabHeaderTitle(tabs[0]?.id ?? 'more'));
  const [stackTop, setStackTop] = useState<ViewId | null>(null);
  const stackNavRef = useRef<StackNavHandle>(null);

  // todo/97 — 헤더 제목의 로케일 생동성(데스크톱 Window의 todo/10과 동일 패턴). tabTitle은
  // "설정 시점 문자열"이라 언어 토글이 손대지 못했다 — 지금 값이 어떤 기본값(meta 제목/탭
  // 라벨)에서 왔는지 종류를 기억해 두고, 로케일 알림 때 비커스텀만 새 언어로 재파생한다.
  // (도서 상세의 책 제목처럼 뷰가 넣은 커스텀 문자열은 언어와 무관 — 보존.)
  const activeTabIdRef = useRef<TabSelection>(activeTabId);
  const tabTitleKindRef = useRef<'meta' | 'tab' | 'custom'>('tab');
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);
  useEffect(
    () =>
      subscribeLocale(() => {
        const id = activeTabIdRef.current;
        if (tabTitleKindRef.current === 'tab') setTabTitle(tabHeaderTitle(id));
        else if (tabTitleKindRef.current === 'meta' && id !== 'more') setTabTitle(getViewMeta(id)?.title ?? id);
      }),
    []
  );

  // 역할이 바뀌어(세션 재설정 등) 지금 탭이 더 이상 유효하지 않으면 첫 탭으로 되돌린다.
  useEffect(() => {
    if (activeTabId !== 'more' && !tabs.some((t) => t.id === activeTabId)) {
      setActiveTabId(tabs[0]?.id ?? 'more');
      setActiveTabParams({});
      setTabTitle(tabHeaderTitle(tabs[0]?.id ?? 'more'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs]);

  const selectTab = useCallback((id: TabSelection, params: Record<string, unknown> = {}) => {
    // 탭을 바꿀 때는 이전 탭 위에 떠 있던 push 화면(StackNav)을 정리한다 — 탭은 항상 루트로 보인다.
    stackNavRef.current?.reset();
    setActiveTabId(id);
    setActiveTabParams(params);
    setTabTitle(tabHeaderTitle(id));
    tabTitleKindRef.current = 'tab'; // todo/97 — 탭 기본 제목 상태로 복귀
  }, []);

  // ShellContext.open — book-detail처럼 mobile.tab이 없는 뷰는 StackNav push, tab 매핑이 있는
  // 뷰(예: search)면 해당 탭으로 전환. 탭 화면·스택 화면 어느 쪽 shell에서 호출돼도 이 한 곳으로 모인다.
  const openFn = useCallback(
    (viewId: ViewId, params?: Record<string, unknown>) => {
      const meta = getViewMeta(viewId);
      if (meta?.mobile.tab !== undefined) {
        selectTab(viewId, params ?? {});
      } else {
        stackNavRef.current?.push(viewId, params ?? {});
      }
    },
    [selectTab]
  );

  const setTitleFn = useCallback((title: string) => {
    // todo/97 — 이 값이 어떤 기본값과 일치하는지 분류(로케일 알림 때 재파생 가능 여부 판단).
    const id = activeTabIdRef.current;
    const metaTitle = id !== 'more' ? getViewMeta(id)?.title : undefined;
    tabTitleKindRef.current = title === metaTitle ? 'meta' : title === tabHeaderTitle(id) ? 'tab' : 'custom';
    setTabTitle(title);
  }, []);
  // 탭 루트에는 "닫을 대상"이 없다 — no-op. (push 화면의 requestClose는 StackNav 안에서 pop으로 구현됨)
  const requestCloseFn = useCallback(() => {}, []);
  const toastFn = useCallback((message: string, kind?: ToastKind) => pushToast(message, kind), []);
  // 모바일은 활성 탭 화면이 한 번에 하나만 마운트되므로(데스크톱처럼 여러 창이 동시에 있는 경우가
  // 없다) StackNav.tsx의 print와 달리 표식 클래스가 필요 없다 — styles/print.css가 셸 조상
  // (.m-shell 등)을 표식 없이 그냥 항상 풀어준다.
  const printFn = useCallback(() => window.print(), []);

  // 탭 화면에 내려주는 ShellContext — 모든 필드가 안정적인 참조라 객체 자체도 앱 수명 동안 하나만 만든다.
  const tabShell: ShellContext = useMemo(
    () => ({
      setTitle: setTitleFn,
      requestClose: requestCloseFn,
      open: openFn,
      toast: toastFn,
      platform: 'mobile',
      print: printFn
    }),
    [setTitleFn, requestCloseFn, openFn, toastFn, printFn]
  );

  const handleTabSelect = useCallback((id: TabSelection) => selectTab(id), [selectTab]);
  const handleMoreOpen = useCallback((viewId: ViewId) => openFn(viewId), [openFn]);
  const handleStackDepthChange = useCallback((_depth: number, topViewId: ViewId | null) => setStackTop(topViewId), []);

  // todo/11 딥링크 — "#/w/book-detail?copy=…"로 앱에 직접 들어오면 그 화면을 자동으로 연다.
  // 파싱은 셸 공용 모듈(src/deepLink.ts, DesktopShell.tsx와 동일)이 담당하고, 여기서는 이 셸의
  // 오픈 메커니즘(openFn — tab 매핑 있으면 탭 전환, 없으면 StackNav.push)에 연결만 한다.
  useEffect(() => {
    const initial = currentWindowDeepLink();
    if (initial) openFn(initial.viewId, initial.params);
    return subscribeWindowDeepLink((target) => openFn(target.viewId, target.params));
  }, [openFn]);

  // ── 스캔 라우팅 + 카메라 on/off ──────────────────────────────────────
  // "관심 창"은 데스크톱=포커스 창, 모바일=지금 화면에 보이는 화면(스택이 열려 있으면 그 최상단,
  // 아니면 활성 탭). 예: '더보기'로 들어간 장서 점검(inventory, scan:'focus')도 push 화면이지만
  // 화면에 떠 있는 동안엔 스캔을 받아야 하므로 탭뿐 아니라 스택 최상단까지 함께 본다.
  const effectiveViewId: ViewId | null = stackTop ?? (activeTabId === 'more' ? null : activeTabId);
  const scanFocusActive = effectiveViewId ? getViewMeta(effectiveViewId)?.scan === 'focus' : false;

  useEffect(() => {
    setScanRoute(scanFocusActive ? effectiveViewId : null);
    // effectiveViewId가 바뀌지 않고 scanFocusActive만 바뀌는 경우는 없으므로(둘 다 같은 값에서 파생) 이걸로 충분.
  }, [effectiveViewId, scanFocusActive]);

  useEffect(() => {
    // ADR-020: 모바일도 이제 자동 시작하지 않는다 — 시작은 뷰 자체가 심어 둔 "카메라 시작" 버튼
    // (components/ScanCameraStart.tsx, 뷰가 scan:'focus' + 유효 라우트일 때 렌더)이
    // cameraSession.start()를 호출해서 이뤄진다. 이 effect가 남겨서 하는 일은 "이탈 시 즉시
    // 종료" 하나뿐: scanFocusActive가 true였다가 false로 바뀌는 순간(탭 전환·뒤로가기) cleanup이
    // 실행되어, 그 화면에서 카메라가 켜져 있었다면 유휴 유예 없이 바로 끈다(배터리·발열, 연속
    // 모드 핀과도 무관 — cameraSession.stop()은 항상 무조건 끈다).
    if (!scanFocusActive) return;
    return () => cameraSession.stop();
  }, [scanFocusActive]);

  useEffect(
    () =>
      // FRONTEND.md 스캔 라우팅 공통 규칙(데스크톱 DesktopShell과 동일 정책): "관심 창이 하나도
      // 없으면 loan-return 자동 오픈 후 전달". 모바일은 화면이 한 번에 하나뿐이라 "관심 없음" =
      // 지금 보이는 화면(스택 최상단 또는 활성 탭)이 scan:'focus'가 아님을 뜻한다. 카메라가 이미
      // scan:'focus' 화면에서만 돌아가므로 보통은 발생하지 않지만(예: 향후 하드웨어 스캐너 등
      // 카메라 외 scanBus 발행원이 생기는 경우) 공통 규칙을 그대로 지킨다.
      subscribeScan(() => {
        if (!scanFocusActive) selectTab('loan-return');
      }),
    [scanFocusActive, selectTab]
  );

  const ActiveComp = activeTabId !== 'more' ? VIEW_COMPONENTS[activeTabId] : null;

  return (
    <div className="m-shell">
      <div className="m-shell-content">
        <header className="m-shell-header">
          <h1 className="m-shell-title">{tabTitle}</h1>
          <button type="button" className="m-shell-settings" aria-label={t('common.settings')} onClick={openSessionSettings}>
            <Settings size={20} aria-hidden />
          </button>
        </header>
        <main className="m-shell-main">
          {activeTabId === 'more' ? (
            <MoreMenuScreen items={moreList} onOpen={handleMoreOpen} />
          ) : (
            // todo/25 — StackNav.tsx와 같은 이유로 활성 탭 뷰도 격리한다: 탭 전환 시 activeTabId가
            // 바뀌므로 key={activeTabId}만으로 이전 탭의 크래시 상태가 다음 탭으로 새지 않는다
            // (StackNav의 key={top.key}와 같은 결 — "창" 개념이 없어 onReopen 불필요).
            <ViewErrorBoundary key={activeTabId}>
              <Suspense fallback={<div className="m-shell-loading">{t('common.loading')}</div>}>
                {ActiveComp && <ActiveComp shell={tabShell} params={activeTabParams} />}
              </Suspense>
            </ViewErrorBoundary>
          )}
        </main>
        <StackNav ref={stackNavRef} onOpen={openFn} toast={toastFn} onDepthChange={handleStackDepthChange} />
      </div>
      <TabBar tabs={tabs} activeId={activeTabId} onSelect={handleTabSelect} />
      <ToastHost />
      <ScanFlashOverlay />
    </div>
  );
}
