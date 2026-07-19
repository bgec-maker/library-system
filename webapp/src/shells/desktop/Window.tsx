import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Minus, PanelLeft, PanelRight, Pin, X } from 'lucide-react';
import type { ShellContext, ViewId } from '../../types';
import { getViewMeta } from '../../registry';
import { VIEW_COMPONENTS } from '../../viewResolver';
import { ViewErrorBoundary } from '../../components/ViewErrorBoundary';
import { pushToast } from '../../services/toastBus';
import { subscribeLocale, t } from '../../i18n';
import {
  getEffectiveScanRoute,
  isScanRoutePinned,
  pinScanRoute,
  setScanRoute,
  subscribeScanRoute,
  unpinScanRoute
} from '../../services/scanBus';
import { useWindowStore, type WindowState } from './useWindowStore';

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const RESIZE_DIRS: ResizeDir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const TITLEBAR_ICON_SIZE = 14;
// todo/130 — 드래그·리사이즈 경계는 스토어(clampRectToWorkspace)가 단일 원천이다. 이 파일은
// 원시 포인터 델타만 넘긴다(종전의 좌·상 2방향 부분 클램프 + DOCK_WIDTH 이중 가산 제거).

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
  // todo/10 — 로케일 토글 시 이미 열린 창의 타이틀바도 즉시 갱신하기 위한 판별 플래그.
  // 거의 모든 뷰가 마운트 시 `shell.setTitle(getViewMeta(id)?.title ?? t(...))`로 레지스트리
  // 기본값을 "그대로" 재확인만 하므로(커스텀 제목을 쓰는 뷰가 아직 없음, book-detail은 todo/11
  // 몫), setTitle에 넘어온 값이 그 시점의 레지스트리 기본값과 같으면 "기본 제목"으로 간주해
  // 로케일이 바뀔 때 새 기본값으로 계속 따라가게 하고, 다르면 "커스텀 제목"으로 간주해 로케일
  // 토글이 건드리지 않는다 — docs/ASSUMPTIONS.md `## todo/10`에 이 트레이드오프를 문서화했다.
  const isCustomTitleRef = useRef(false);
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

  // todo/10 — 알려진 한계 해소: 로케일이 바뀌면 registry.ts의 subscribeLocale 콜백이 이미
  // VIEW_REGISTRY[i].title을 새 언어로 mutate해 두므로, 여기서는 "커스텀 제목이 아닐 때만"
  // 그 새 값을 다시 읽어와 이 창의 title state에 반영한다. 뷰가 마운트 시 1회만 호출하는
  // shell.setTitle(...)이 재실행되길 기다리지 않아도(그 effect의 deps=[shell]은 로케일과
  // 무관해 재실행되지 않는다) 창이 열려 있는 동안 즉시 갱신된다.
  useEffect(
    () =>
      subscribeLocale(() => {
        if (isCustomTitleRef.current) return;
        setTitleState(getViewMeta(win.viewId)?.title ?? win.viewId);
      }),
    [win.viewId]
  );

  const shell: ShellContext = useMemo<ShellContext>(
    () => ({
      setTitle: (next: string) => {
        // 이 창의 뷰가 지금 이 순간의 레지스트리 기본 제목과 다른 값을 넣으면 "커스텀 제목"으로
        // 표시해 둔다 — 아래 로케일 구독 effect가 커스텀 제목을 덮어쓰지 않도록.
        isCustomTitleRef.current = next !== (getViewMeta(win.viewId)?.title ?? win.viewId);
        setTitleState(next);
      },
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
    [win.id, win.viewId, closeWindow, openWindow]
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
    moveWindow(win.id, d.winX + (e.clientX - d.startX), d.winY + (e.clientY - d.startY));
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
    const [minW, minH] = meta?.desktop.min ?? [280, 200];
    let { x, y, w, h } = r.rect;
    if (r.dir.includes('e')) w = r.rect.w + dx;
    if (r.dir.includes('s')) h = r.rect.h + dy;
    // todo/130 — 서/북 앵커 교정: 최소 크기를 여기서 먼저 확정하고 반대 변(우/하)을 고정한다.
    // 종전엔 x·y가 포인터를 그대로 따라가고 스토어가 w·h만 최소로 되돌려, 최소 크기에 닿는
    // 순간 창이 통째로 미끄러졌다(변은 그대로여야 한다는 리사이즈의 기본 계약 위반).
    if (r.dir.includes('w')) {
      w = Math.max(minW, r.rect.w - dx);
      x = r.rect.x + r.rect.w - w;
    }
    if (r.dir.includes('n')) {
      h = Math.max(minH, r.rect.h - dy);
      y = r.rect.y + r.rect.h - h;
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
        {/* todo/25 — 뷰 크래시가 이 창 하나만 죽이고 도크·다른 창은 살아남게 격리한다. "다시
            열기"는 closeWindow/openWindow(이미 이 파일이 쓰는 useWindowStore 메커니즘 그대로)로
            같은 뷰·params의 새 창을 연다 — 병렬 닫기/열기 경로를 새로 만들지 않는다. */}
        <ViewErrorBoundary
          onReopen={() => {
            closeWindow(win.id);
            openWindow(win.viewId, win.params);
          }}
        >
          <Suspense fallback={<div className="window-loading">{t('common.loading')}</div>}>
            <ViewComponent shell={shell} params={win.params} />
          </Suspense>
        </ViewErrorBoundary>
      </div>
      {RESIZE_DIRS.map((dir) => (
        <div key={dir} className={`window-resize window-resize--${dir}`} onPointerDown={onResizePointerDown(dir)} />
      ))}
    </div>
  );
}
