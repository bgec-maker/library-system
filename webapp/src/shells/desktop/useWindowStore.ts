import { create } from 'zustand';
import type { ViewId } from '../../types';
import { getViewMeta } from '../../registry';
import { pushToast } from '../../services/toastBus';
import { t } from '../../i18n';
import {
  getEffectiveScanRoute,
  isScanRoutePinned,
  setScanRoute,
  subscribeScanRoute,
  unpinScanRoute
} from '../../services/scanBus';

// FRONTEND.md 데스크톱 셸 절 — 창 관리자 상태의 단일 원천.
// "뷰는 셸을 모른다": 이 스토어는 shells/desktop/** 안에서만 쓰인다(뷰는 import 자체가 린트로 막혀 있다).

export const DOCK_WIDTH = 76;
export const MAX_WINDOWS = 6;

interface WindowRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WindowState extends WindowRect {
  id: string;
  viewId: ViewId;
  params: Record<string, unknown>;
  z: number;
  minimized: boolean;
  /** scanBus 핀 상태의 거울 — Window.tsx가 이 필드만 보고도 뱃지를 그릴 수 있게 동기화해 둔다. */
  pinned: boolean;
}

let zCounter = 1;
let idCounter = 0;

function storageKey(viewId: ViewId): string {
  return `win:${viewId}`;
}

function loadRect(viewId: ViewId): WindowRect | null {
  try {
    const raw = localStorage.getItem(storageKey(viewId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WindowRect>;
    if (
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number' &&
      typeof parsed.w === 'number' &&
      typeof parsed.h === 'number'
    ) {
      return { x: parsed.x, y: parsed.y, w: parsed.w, h: parsed.h };
    }
  } catch {
    /* 손상된 값 — 기본값으로 폴백 */
  }
  return null;
}

function saveRect(viewId: ViewId, rect: WindowRect): void {
  try {
    localStorage.setItem(storageKey(viewId), JSON.stringify(rect));
  } catch {
    /* 사생활 모드 등 저장 실패 — 다음 세션엔 기본 위치로 열릴 뿐, 치명적이지 않다 */
  }
}

function currentPinned(viewId: ViewId): boolean {
  return isScanRoutePinned() && getEffectiveScanRoute() === viewId;
}

interface WindowStore {
  windows: WindowState[];
  openWindow(viewId: ViewId, params?: Record<string, unknown>): void;
  closeWindow(id: string): void;
  focusWindow(id: string): void;
  moveWindow(id: string, x: number, y: number): void;
  resizeWindow(id: string, rect: Partial<WindowRect>): void;
  minimizeWindow(id: string): void;
  restoreWindow(id: string): void;
  snapWindow(id: string, side: 'left' | 'right'): void;
  persistWindowRect(id: string): void;
}

export const useWindowStore = create<WindowStore>((set, get) => ({
  windows: [],

  openWindow(viewId, params = {}) {
    const meta = getViewMeta(viewId);
    if (!meta) return;

    if (meta.desktop.single) {
      const existing = get().windows.find((w) => w.viewId === viewId);
      if (existing) {
        if (existing.minimized) get().restoreWindow(existing.id);
        else get().focusWindow(existing.id);
        return;
      }
    }

    if (get().windows.length >= MAX_WINDOWS) {
      pushToast(t('shell.desktop.maxWindows', { max: MAX_WINDOWS }), 'error');
      return;
    }

    const stored = loadRect(viewId);
    const [minW, minH] = meta.desktop.min;
    const cascade = get().windows.length % 8;
    const x = stored ? Math.max(0, stored.x) : DOCK_WIDTH + 40 + cascade * 26;
    const y = stored ? Math.max(0, stored.y) : 40 + cascade * 26;
    const w = Math.max(minW, stored?.w ?? minW);
    const h = Math.max(minH, stored?.h ?? minH);

    idCounter += 1;
    zCounter += 1;
    const next: WindowState = {
      id: `win-${viewId}-${idCounter}`,
      viewId,
      params,
      x,
      y,
      w,
      h,
      z: zCounter,
      minimized: false,
      pinned: currentPinned(viewId)
    };
    set((s) => ({ windows: [...s.windows, next] }));
  },

  closeWindow(id) {
    const win = get().windows.find((w) => w.id === id);
    set((s) => ({ windows: s.windows.filter((w) => w.id !== id) }));
    if (!win) return;
    const stillOpen = get().windows.some((w) => w.viewId === win.viewId);
    if (!stillOpen && getEffectiveScanRoute() === win.viewId) {
      if (isScanRoutePinned()) unpinScanRoute();
      setScanRoute(null);
    }
  },

  focusWindow(id) {
    set((s) => {
      if (!s.windows.some((w) => w.id === id)) return s;
      zCounter += 1;
      const z = zCounter;
      return { windows: s.windows.map((w) => (w.id === id ? { ...w, z } : w)) };
    });
  },

  moveWindow(id, x, y) {
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, x, y } : w)) }));
  },

  resizeWindow(id, rect) {
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== id) return w;
        const meta = getViewMeta(w.viewId);
        const [minW, minH] = meta?.desktop.min ?? [280, 200];
        const w2 = rect.w !== undefined ? Math.max(minW, rect.w) : w.w;
        const h2 = rect.h !== undefined ? Math.max(minH, rect.h) : w.h;
        const x2 = rect.x !== undefined ? rect.x : w.x;
        const y2 = rect.y !== undefined ? rect.y : w.y;
        return { ...w, x: x2, y: y2, w: w2, h: h2 };
      })
    }));
  },

  minimizeWindow(id) {
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)) }));
  },

  restoreWindow(id) {
    zCounter += 1;
    const z = zCounter;
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: false, z } : w)) }));
  },

  snapWindow(id, side) {
    const availW = Math.max(320, window.innerWidth - DOCK_WIDTH);
    const availH = window.innerHeight;
    const half = Math.floor(availW / 2);
    // todo/108 — 창 left는 .desktop-workspace(margin-left: DOCK_WIDTH) **내부** 좌표다.
    // 구 코드는 화면 좌표 의도로 DOCK_WIDTH를 또 더해 좌스냅 76px 갭·우스냅 76px 화면 밖
    // (닫기 버튼 소실)이었다 — 워크스페이스 원점 기준으로 좌=0, 우=half.
    const x = side === 'right' ? half : 0;
    get().resizeWindow(id, { x, y: 0, w: half, h: availH });
    get().focusWindow(id);
    get().persistWindowRect(id);
  },

  persistWindowRect(id) {
    const win = get().windows.find((w) => w.id === id);
    if (!win) return;
    saveRect(win.viewId, { x: win.x, y: win.y, w: win.w, h: win.h });
  }
}));

// 핀 상태(전역 1개)가 바뀔 때마다 모든 창의 pinned 거울 필드를 갱신한다.
// Window.tsx가 scanBus를 직접 다시 구독하지 않고도 win.pinned만 읽을 수 있게 하기 위함.
subscribeScanRoute((effectiveRoute) => {
  useWindowStore.setState((s) => ({
    windows: s.windows.map((w) => ({
      ...w,
      pinned: isScanRoutePinned() && effectiveRoute === w.viewId
    }))
  }));
});
