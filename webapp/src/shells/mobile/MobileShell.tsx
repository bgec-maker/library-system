import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Settings } from 'lucide-react';
import type { ShellContext, ToastKind, ViewId, ViewMeta } from '../../types';
import { getViewMeta, mobileTabViews, moreMenuViews } from '../../registry';
import { VIEW_COMPONENTS } from '../../viewResolver';
import { useSession } from '../../services/session';
import { cameraService } from '../../services/camera';
import { setScanRoute, subscribeScan } from '../../services/scanBus';
import { pushToast } from '../../services/toastBus';
import { ToastHost } from '../../components/ToastHost';
import { ScanFlashOverlay } from '../../components/ScanFlashOverlay';
import { openSessionSettings } from '../../services/sessionSettingsUi';
import TabBar, { type TabSelection } from './TabBar';
import StackNav, { type StackNavHandle } from './StackNav';
import './mobile.css';

// FRONTEND.md '모바일 셸 — 탭 + 스택'의 기본 export. boot.tsx가
// lazy(() => import('./shells/mobile/MobileShell'))로 불러온다.
// 레이아웃: [헤더+활성 탭 뷰 (+ 그 위를 덮는 StackNav push 오버레이)] 위에 하단 탭바 고정.
// ToastHost·ScanFlashOverlay는 셸 루트에서 이 파일 한 곳에서만 마운트한다.

function tabHeaderTitle(id: TabSelection): string {
  if (id === 'more') return '더보기';
  const meta = getViewMeta(id);
  if (!meta) return id;
  // TabBar의 labelFor와 동일 규칙(loan-return→"스캔") — 헤더 타이틀 기본값에도 그대로 적용.
  return meta.id === 'loan-return' ? '스캔' : meta.title;
}

interface MoreMenuScreenProps {
  items: ViewMeta[];
  onOpen: (viewId: ViewId) => void;
}

function MoreMenuScreen({ items, onOpen }: MoreMenuScreenProps) {
  if (items.length === 0) {
    return <p className="m-more-empty">표시할 항목이 없습니다.</p>;
  }
  return (
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
  );
}

export default function MobileShell() {
  const role = useSession((s) => s.role);
  const tabs = useMemo(() => mobileTabViews(role), [role]);
  const moreList = useMemo(() => moreMenuViews(role), [role]);

  const [activeTabId, setActiveTabId] = useState<TabSelection>(() => tabs[0]?.id ?? 'more');
  const [activeTabParams, setActiveTabParams] = useState<Record<string, unknown>>({});
  const [tabTitle, setTabTitle] = useState<string>(() => tabHeaderTitle(tabs[0]?.id ?? 'more'));
  const [stackTop, setStackTop] = useState<ViewId | null>(null);
  const stackNavRef = useRef<StackNavHandle>(null);

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

  const setTitleFn = useCallback((title: string) => setTabTitle(title), []);
  // 탭 루트에는 "닫을 대상"이 없다 — no-op. (push 화면의 requestClose는 StackNav 안에서 pop으로 구현됨)
  const requestCloseFn = useCallback(() => {}, []);
  const toastFn = useCallback((message: string, kind?: ToastKind) => pushToast(message, kind), []);

  // 탭 화면에 내려주는 ShellContext — 모든 필드가 안정적인 참조라 객체 자체도 앱 수명 동안 하나만 만든다.
  const tabShell: ShellContext = useMemo(
    () => ({
      setTitle: setTitleFn,
      requestClose: requestCloseFn,
      open: openFn,
      toast: toastFn,
      platform: 'mobile'
    }),
    [setTitleFn, requestCloseFn, openFn, toastFn]
  );

  const handleTabSelect = useCallback((id: TabSelection) => selectTab(id), [selectTab]);
  const handleMoreOpen = useCallback((viewId: ViewId) => openFn(viewId), [openFn]);
  const handleStackDepthChange = useCallback((_depth: number, topViewId: ViewId | null) => setStackTop(topViewId), []);

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
    // 모바일은 배터리·발열 고려해 스캔 관심 화면일 때만 카메라를 켠다(데스크톱처럼 상시 가동 아님).
    if (!scanFocusActive) return;
    cameraService.acquire();
    return () => cameraService.release();
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
          <button type="button" className="m-shell-settings" aria-label="설정" onClick={openSessionSettings}>
            <Settings size={20} aria-hidden />
          </button>
        </header>
        <main className="m-shell-main">
          {activeTabId === 'more' ? (
            <MoreMenuScreen items={moreList} onOpen={handleMoreOpen} />
          ) : (
            <Suspense fallback={<div className="m-shell-loading">불러오는 중…</div>}>
              {ActiveComp && <ActiveComp shell={tabShell} params={activeTabParams} />}
            </Suspense>
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
