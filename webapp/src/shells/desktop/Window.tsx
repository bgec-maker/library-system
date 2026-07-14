import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Minus, PanelLeft, PanelRight, Pin, X } from 'lucide-react';
import type { ShellContext, ViewId } from '../../types';
import { getViewMeta } from '../../registry';
import { VIEW_COMPONENTS } from '../../viewResolver';
import { pushToast } from '../../services/toastBus';
import { t } from '../../i18n';
import {
  getEffectiveScanRoute,
  isScanRoutePinned,
  pinScanRoute,
  setScanRoute,
  subscribeScanRoute,
  unpinScanRoute
} from '../../services/scanBus';
import { DOCK_WIDTH, useWindowStore, type WindowState } from './useWindowStore';

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const RESIZE_DIRS: ResizeDir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const MIN_VISIBLE = 120; // 드래그해도 타이틀바 일부는 항상 화면에 남도록
const TITLEBAR_ICON_SIZE = 14;

interface WindowProps {
  win: WindowState;
}

export function Window({ win }: WindowProps) {
  const meta = getViewMeta(win.viewId);
  const windows = useWindowStore((s) => s.windows);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const moveWindow = useWindowStore((s) => s.moveWindow);
  const resizeWindow = useWindowStore((s) => s.resizeWindow);
  const snapWindow = useWindowStore((s) => s.snapWindow);
  const persistWindowRect = useWindowStore((s) => s.persistWindowRect);
  const openWindow = useWindowStore((s) => s.openWindow);

  const [title, setTitleState] = useState(meta?.title ?? win.viewId);
  const [scanRoute, setScanRouteState] = useState(getEffectiveScanRoute());

  const dragRef = useRef<{ startX: number; startY: number; winX: number; winY: number } | null>(null);
  const resizeRef = useRef<{ dir: ResizeDir; startX: number; startY: number; rect: { x: number; y: number; w: number; h: number } } | null>(
    null
  );
  const rootRef = useRef<HTMLDivElement | null>(null);

  const isFocused = useMemo(() => {
    const visible = windows.filter((w) => !w.minimized);
    if (!visible.length) return false;
    const top = visible.reduce((a, b) => (b.z > a.z ? b : a));
    return top.id === win.id;
  }, [windows, win.id]);

  // 핀/포커스 라우팅이 바뀔 때마다 "스캔 수신" 뱃지를 갱신한다(전역 1개 핀만 존재).
  useEffect(() => subscribeScanRoute(setScanRouteState), []);

  // FRONTEND.md: "포커스된 창이면서 scan==='focus'인 뷰가 열려 있으면 클릭/생성 시 setScanRoute" —
  // 생성 직후에도 새 창은 최상단(z 최대)이라 isFocused가 바로 true가 되어 여기로 잡힌다.
  useEffect(() => {
    if (isFocused && meta?.scan === 'focus') setScanRoute(win.viewId);
  }, [isFocused, meta?.scan, win.viewId]);

  const shell: ShellContext = useMemo<ShellContext>(
    () => ({
      setTitle: (t: string) => setTitleState(t),
      requestClose: () => closeWindow(win.id),
      open: (viewId: ViewId, params?: Record<string, unknown>) => openWindow(viewId, params),
      toast: (message: string, kind) => pushToast(message, kind),
      platform: 'desktop',
      print: () => {
        // FRONTEND.md·types.ts "뷰는 셸을 모른다" — views/**는 window.print()를 직접 못 부르니
        // ShellContext를 통해서만 연다. 데스크톱은 최대 MAX_WINDOWS(6)개 창이 동시에 열려
        // 있을 수 있어(useWindowStore.ts), styles/print.css가 "인쇄할 창만" 골라 조상 체인의
        // 고정 크기·overflow:hidden을 풀어야 한다(안 그러면 리포트가 창 한 칸 크기로 잘림) —
        // 그 구분자가 이 표식 클래스다. afterprint에서 지워 다음 인쇄와 상태가 섞이지 않게 한다.
        const node = rootRef.current;
        node?.classList.add('is-print-target');
        const cleanup = () => {
          node?.classList.remove('is-print-target');
          window.removeEventListener('afterprint', cleanup);
        };
        window.addEventListener('afterprint', cleanup);
        window.print();
      }
    }),
    [win.id, closeWindow, openWindow]
  );

  function bringToFront() {
    if (!isFocused) focusWindow(win.id);
  }

  function onTitlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return;
    bringToFront();
    dragRef.current = { startX: e.clientX, startY: e.clientY, winX: win.x, winY: win.y };
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
  }

  function onDragMove(e: PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const nx = Math.max(DOCK_WIDTH - win.w + MIN_VISIBLE, d.winX + (e.clientX - d.startX));
    const ny = Math.max(0, d.winY + (e.clientY - d.startY));
    moveWindow(win.id, nx, ny);
  }

  function onDragEnd() {
    dragRef.current = null;
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    persistWindowRect(win.id);
  }

  function onResizePointerDown(dir: ResizeDir) {
    return (e: ReactPointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      bringToFront();
      resizeRef.current = { dir, startX: e.clientX, startY: e.clientY, rect: { x: win.x, y: win.y, w: win.w, h: win.h } };
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', onResizeMove);
      window.addEventListener('pointerup', onResizeEnd);
    };
  }

  function onResizeMove(e: PointerEvent) {
    const r = resizeRef.current;
    if (!r) return;
    const dx = e.clientX - r.startX;
    const dy = e.clientY - r.startY;
    let { x, y, w, h } = r.rect;
    if (r.dir.includes('e')) w = r.rect.w + dx;
    if (r.dir.includes('s')) h = r.rect.h + dy;
    if (r.dir.includes('w')) {
      w = r.rect.w - dx;
      x = r.rect.x + dx;
    }
    if (r.dir.includes('n')) {
      h = r.rect.h - dy;
      y = r.rect.y + dy;
    }
    resizeWindow(win.id, { x, y, w, h });
  }

  function onResizeEnd() {
    resizeRef.current = null;
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', onResizeEnd);
    persistWindowRect(win.id);
  }

  const showsScanBadge = scanRoute === win.viewId;
  const isPinned = isScanRoutePinned() && showsScanBadge;
  const ViewComponent = VIEW_COMPONENTS[win.viewId];

  return (
    <div
      ref={rootRef}
      className={`window${isFocused ? ' is-focused' : ''}`}
      style={{
        left: win.x,
        top: win.y,
        width: win.w,
        height: win.h,
        zIndex: win.z,
        display: win.minimized ? 'none' : undefined
      }}
      onMouseDownCapture={bringToFront}
    >
      <div className="window-titlebar" onPointerDown={onTitlePointerDown}>
        {meta?.scan === 'focus' && (
          <button
            type="button"
            className={`window-pin${isPinned ? ' is-pinned' : ''}`}
            title={isPinned ? t('shell.desktop.pinUnpin') : t('shell.desktop.pinPin')}
            onClick={() => (isPinned ? unpinScanRoute() : pinScanRoute(win.viewId))}
          >
            <Pin size={TITLEBAR_ICON_SIZE} aria-hidden />
          </button>
        )}
        <span className="window-titlebar__title">{title}</span>
        {showsScanBadge && <span className="window-badge">{t('shell.desktop.scanReceiving')}</span>}
        <button type="button" className="window-btn" title={t('shell.desktop.snapLeft')} onClick={() => snapWindow(win.id, 'left')}>
          <PanelLeft size={TITLEBAR_ICON_SIZE} aria-hidden />
        </button>
        <button type="button" className="window-btn" title={t('shell.desktop.snapRight')} onClick={() => snapWindow(win.id, 'right')}>
          <PanelRight size={TITLEBAR_ICON_SIZE} aria-hidden />
        </button>
        <button type="button" className="window-btn" title={t('shell.desktop.minimize')} onClick={() => minimizeWindow(win.id)}>
          <Minus size={TITLEBAR_ICON_SIZE} aria-hidden />
        </button>
        <button type="button" className="window-btn window-btn--close" title={t('common.close')} onClick={() => closeWindow(win.id)}>
          <X size={TITLEBAR_ICON_SIZE} aria-hidden />
        </button>
      </div>
      <div className="window-body">
        <Suspense fallback={<div className="window-loading">{t('common.loading')}</div>}>
          <ViewComponent shell={shell} params={win.params} />
        </Suspense>
      </div>
      {RESIZE_DIRS.map((dir) => (
        <div key={dir} className={`window-resize window-resize--${dir}`} onPointerDown={onResizePointerDown(dir)} />
      ))}
    </div>
  );
}
