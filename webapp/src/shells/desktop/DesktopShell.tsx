import { useEffect } from 'react';
import { ToastHost } from '../../components/ToastHost';
import { ScanFlashOverlay } from '../../components/ScanFlashOverlay';
import { getViewMeta } from '../../registry';
import { subscribeScan } from '../../services/scanBus';
import { useLocale } from '../../i18n';
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

  return (
    <div className="desktop-shell">
      <Dock />
      <div className="desktop-workspace" style={{ marginLeft: DOCK_WIDTH }}>
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
