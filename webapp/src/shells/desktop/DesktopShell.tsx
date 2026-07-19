import { useEffect } from 'react';
// todo/60 — 부팅 자동 재개(BUSY류 실패)·미전송 잔여 펌프가 "등록 창을 열어야" 도는 게 아니라
// 셸 부팅 즉시 돌게 하는 사이드이펙트 임포트. 모바일 셸은 TabBar(배지, todo/53)가 이미 이
// 모듈을 부팅 시 적재한다 — 두 셸의 재개 시점을 같게 맞춘다.
import '../../services/registerQueue';
import { ToastHost } from '../../components/ToastHost';
import { ScanFlashOverlay } from '../../components/ScanFlashOverlay';
import { getViewMeta } from '../../registry';
import { subscribeScan } from '../../services/scanBus';
import { currentWindowDeepLink, subscribeWindowDeepLink } from '../../deepLink';
import { useLocale } from '../../i18n';
import DashboardBaseLayer from './DashboardBaseLayer';
import { Dock } from './Dock';
import { Window } from './Window';
import { ScannerDockWidget } from './ScannerDockWidget';
import { ScannerWindow } from './ScannerWindow';
import { toggleScannerWindow } from '../../services/scannerWindowStore';
import { checkNewNoticesOnBoot } from '../../services/noticeData';
import { pushToast } from '../../services/toastBus';
import { t } from '../../i18n';
import { DOCK_WIDTH, useWindowStore } from './useWindowStore';
import './desktop.css';

// FRONTEND.md "데스크톱 셸 — 창 관리자"의 루트. boot.tsx가 lazy(()=>import(...))로 불러온다.
let noticeBootChecked = false; // todo/137 — 세션당 1회 공지 확인(StrictMode 이중 마운트 가드)

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

  // ADR-026 "단축키 S" — 이제 카메라를 직접 켜고 끄는 게 아니라 ScannerWindow를 열고 닫는다
  // (그 창을 여는 것 자체가 카메라 시작이다 — scannerWindowStore.ts). 입력 요소에 포커스가
  // 있을 때는 타이핑 중 'S'를 가로채면 안 되므로 무시한다. 토글 의미는 이전과 동일: 닫혀
  // 있으면 열고, 열려 있으면(최소화 포함) 닫는다.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 's' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      toggleScannerWindow();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // todo/137 — 부팅 시 새 공지 1회 안내(타이머 없음). 모듈 플래그로 StrictMode 이중 마운트·
  // 셸 재마운트에도 세션당 1회만. lastSeen 갱신은 도움말 열람 시(noticeData 주석).
  useEffect(() => {
    if (noticeBootChecked) return;
    noticeBootChecked = true;
    void checkNewNoticesOnBoot().then((notice) => {
      if (notice) pushToast(t('shell.noticeToast', { title: notice.title }), 'info');
    });
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
      <ScannerWindow />
      <ToastHost />
      <ScanFlashOverlay />
    </div>
  );
}
