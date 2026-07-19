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
/** 창이 어느 방향으로 밀려도 화면에 남아야 하는 최소 가시 폭(잡을 곳 보장) — Window.tsx 드래그와 단일 원천 */
export const MIN_VISIBLE = 120;
/** 타이틀바 실측 높이(패딩 8+8 + 콘텐츠 ~20~22) — 하단 클램프가 "잡을 수 있는 줄"을 남기는 기준 */
export const TITLEBAR_H = 36;

interface WindowRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// todo/130 — 창 좌표 격리의 단일 원천. 창 rect는 .desktop-workspace(margin-left: DOCK_WIDTH)
// **내부** 좌표다(todo/108 참고 — 화면 좌표로 착각해 DOCK_WIDTH를 더하면 안 된다). 계약:
//   · w,h는 워크스페이스를 넘지 않는다(모니터 교체·브라우저 축소 대응)
//   · x는 [MIN_VISIBLE − w, availW − MIN_VISIBLE] — 좌우 어느 쪽으로 밀려도 창의 120px는 남는다
//   · y는 [0, availH − TITLEBAR_H] — 타이틀바(잡을 곳)가 항상 화면 안이다
// 종전엔 드래그가 좌·상 2방향만 막고 persistWindowRect가 화면 밖 좌표를 저장해, 우·하로
// 던진 창이 재열기해도 화면 밖에서 열리는 영구 유실이 가능했다(복구 = localStorage 삭제뿐).
export function clampRectToWorkspace(rect: WindowRect): WindowRect {
  const availW = Math.max(320, window.innerWidth - DOCK_WIDTH);
  const availH = Math.max(240, window.innerHeight);
  const w = Math.min(rect.w, availW);
  const h = Math.min(rect.h, availH);
  const x = Math.min(Math.max(rect.x, MIN_VISIBLE - w), availW - MIN_VISIBLE);
  const y = Math.min(Math.max(rect.y, 0), availH - TITLEBAR_H);
  return { x, y, w, h };
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
    // todo/130 — 저장 좌표는 "그때 그 화면" 기준이라 지금 화면에선 밖일 수 있다(작은 노트북,
    // 축소된 브라우저, 과거 버전이 저장한 화면 밖 좌표). 열기 시점에 반드시 클램프.
    const { x, y, w, h } = clampRectToWorkspace({
      x: stored ? stored.x : 40 + cascade * 26,
      y: stored ? stored.y : 40 + cascade * 26,
      w: Math.max(minW, stored?.w ?? minW),
      h: Math.max(minH, stored?.h ?? minH)
    });

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
    // todo/130 — 드래그 경계는 여기 한 곳(Window.tsx는 원시 좌표만 넘긴다). 종전 컴포넌트 쪽
    // 클램프는 좌·상뿐이었고 좌측은 DOCK_WIDTH 이중 가산(워크스페이스 좌표에 화면 좌표 상수)
    // 으로 의도보다 76px 일찍 멈추는 버그였다.
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== id) return w;
        const c = clampRectToWorkspace({ x, y, w: w.w, h: w.h });
        return { ...w, x: c.x, y: c.y };
      })
    }));
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
        // todo/130 — 리사이즈 결과도 워크스페이스 계약 안으로(과대 크기·경계 탈출 방지).
        // 화면이 meta.min보다 작은 극단에선 화면이 이긴다(안 보이는 720px짜리 창보다 낫다).
        const c = clampRectToWorkspace({ x: x2, y: y2, w: w2, h: h2 });
        return { ...w, ...c };
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

// todo/130 — 브라우저 창 축소·모니터 전환 시 열린 창 전부를 새 워크스페이스 안으로 재클램프.
// 디바운스는 setTimeout(성능 예산의 setInterval 금지와 무관 — 이벤트 유발 1회성). 위치만
// 바로잡고 저장(persist)은 하지 않는다 — 사용자가 창을 직접 만질 때만 저장한다는 기존 계약
// 유지(일시적 축소가 저장 배치를 파괴하지 않게).
if (typeof window !== 'undefined') {
  let resizeClampTimer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener('resize', () => {
    if (resizeClampTimer !== undefined) clearTimeout(resizeClampTimer);
    resizeClampTimer = setTimeout(() => {
      useWindowStore.setState((s) => ({
        windows: s.windows.map((w) => ({ ...w, ...clampRectToWorkspace(w) }))
      }));
    }, 150);
  });
}
