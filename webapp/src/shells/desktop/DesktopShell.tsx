import { useEffect } from 'react';
import { ToastHost } from '../../components/ToastHost';
import { ScanFlashOverlay } from '../../components/ScanFlashOverlay';
import { getViewMeta } from '../../registry';
import { subscribeScan } from '../../services/scanBus';
import { cameraSession } from '../../services/cameraSession';
import { currentWindowDeepLink, subscribeWindowDeepLink } from '../../deepLink';
import { useLocale } from '../../i18n';
import DashboardBaseLayer from './DashboardBaseLayer';
import { Dock } from './Dock';
import { Window } from './Window';
import { ScannerDockWidget } from './ScannerDockWidget';
import { DOCK_WIDTH, useWindowStore } from './useWindowStore';
import './desktop.css';

// FRONTEND.md "데스크톱 셸 — 창 관리자"의 루트. boot.tsx가 lazy(()=>import(...))로 불러온다.
export default function DesktopShell() {
  // 언어 토글이 눌리면 이 컴포넌트가 재렌더되고, 그 아래 Dock·Window(→각 뷰)도 함께 재렌더돼
  // t()를 다시 평가한다 — 뷰/셸 어디도 로케일 구독을 따로 두지 않아도 되는 지점.
  useLocale();
  const windows = useWindowStore((s) => s.windows);
  const openWindow = useWindowStore((s) => s.openWindow);

  // "관심 창이 하나도 없으면 loan-return 자동 오픈 후 전달" — scan:focus 창이 하나도
  // 열려 있지 않은 상태에서 스캔이 들어오면 loan-return을 열어 다음 스캔부터 받게 한다.
  useEffect(
    () =>
      subscribeScan(() => {
        const hasFocusWindow = useWindowStore.getState().windows.some((w) => getViewMeta(w.viewId)?.scan === 'focus');
        if (!hasFocusWindow) openWindow('loan-return');
      }),
    [openWindow]
  );

  // todo/11 딥링크 — "#/w/book-detail?copy=…"로 앱에 직접 들어오면 그 창을 자동으로 연다.
  // 파싱은 셸 공용 모듈(src/deepLink.ts)이 담당하고, 여기서는 이 셸의 오픈 메커니즘
  // (useWindowStore.openWindow)에 연결만 한다 — MobileShell.tsx도 같은 모듈을 각자의
  // 오픈 메커니즘(StackNav.push/탭 전환)에 연결한다(파싱 로직 중복 없음).
  useEffect(() => {
    const initial = currentWindowDeepLink();
    if (initial) openWindow(initial.viewId, initial.params);
    return subscribeWindowDeepLink((target) => openWindow(target.viewId, target.params));
  }, [openWindow]);

  // ADR-020 "단축키 S" 시작 트리거 — 셸 계층에서만(뷰가 아니라) 전역으로 건다. 입력 요소에
  // 포커스가 있을 때는 타이핑 중 'S'를 가로채면 안 되므로 무시한다. 이미 켜져 있으면 끄고,
  // 꺼져 있으면 켠다(위젯의 종료 버튼과 같은 cameraSession.stop()/start() 호출).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 's' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (cameraSession.getStatus().running) cameraSession.stop();
      else cameraSession.start('shortcut');
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="desktop-shell">
      <Dock />
      <div className="desktop-workspace" style={{ marginLeft: DOCK_WIDTH }}>
        {/* ADR-021: 대시보드는 창이 아니라 기저층 — windows.map보다 먼저 마운트해 항상 바닥에
            깔아 둔다. 조건부 렌더 없음(창을 다 닫아도 언마운트되지 않고 그냥 드러날 뿐). */}
        <DashboardBaseLayer />
        {windows.map((w) => (
          <Window key={w.id} win={w} />
        ))}
      </div>
      <ScannerDockWidget />
      <ToastHost />
      <ScanFlashOverlay />
    </div>
  );
}
