import { useSyncExternalStore } from 'react';
import { cameraSession } from './cameraSession';
import { t } from '../i18n';

// ADR-026 「데스크톱 스캐너 = 창」 — shells/desktop/ScannerWindow.tsx(렌더링 전용)과 분리한
// 상태/트리거 모듈. components/camera/aimRect.ts가 ScanAimFrame.tsx에서 분리된 것과 같은
// 이유다: react-refresh/only-export-components 린트(컴포넌트 파일은 컴포넌트만 export)를
// 지키면서, 이 창을 "여는/닫는" 세 지점 — ScannerDockWidget.tsx 클릭 · DesktopShell.tsx 단축키
// S · components/ScanCameraStart.tsx의 데스크톱 시작 버튼 — 이 ScannerWindow.tsx의 렌더링
// 세부사항을 몰라도 상태만으로 트리거할 수 있게 한다. cameraSession.ts 자신의 "싱글턴 인스턴스 +
// 리스너 집합" 패턴을 그대로 반복한다.
//
// services/에 두는 이유(shells/desktop/가 아니라): components/ScanCameraStart.tsx가 이 모듈을
// import하고, 그 컴포넌트는 scan:'focus' 뷰 4개(loan-return·register·inventory·book-detail)
// 안에 직접 박혀 두 셸 모두의 지연 청크에서 공유된다 — "뷰는 셸을 모른다"(FRONTEND.md 제1원칙)
// 자체는 src/views/**에만 강제되지만, 이 파일처럼 뷰에 내장되는 공용 컴포넌트가 참조하는
// 상태 모듈은 cameraSession.ts·scanBus.ts와 같은 층위(services/)에 있는 게 디렉터리 계약과
// 맞다 — shells/desktop/는 데스크톱 셸 자신만 쓰는 코드가 있는 곳이라는 원래 뜻을 지킨다.
//
// 의도적으로 useWindowStore.ts(zustand)는 여기서 import하지 않는다 — 위와 같은 이유로, 그 청크가
// 모바일·데스크톱 양쪽에서 재사용되는데 zustand 창 관리자까지 끌어오면 모바일이 절대 안 쓰는
// 데스크톱 창 관리자 코드가 공용 청크에 섞여 들어간다. 그래서 z-순서는 아래처럼 "항상 고정된
// 높은 z-index"로 단순화해 이 의존을 원천적으로 피했다 — DOCK_WIDTH 등 useWindowStore 쪽 상수는
// shells/desktop/ScannerWindow.tsx(그 셸 안에서만 쓰이는 렌더링 파일) 쪽에서만 참조한다.

export interface ScannerWindowRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ScannerWindowSnapshot {
  /** 창이 존재하는지(보이거나 최소화됨) — false면 완전히 닫힌 상태(카메라도 꺼짐). */
  open: boolean;
  /** true면 챙(타이틀바 이하)을 숨긴다 — 카메라는 계속 돈다("최소화=유지", ADR-026). */
  minimized: boolean;
  rect: ScannerWindowRect;
}

/**
 * 일반 창(useWindowStore의 zCounter, 1부터 세션 내내 증가)보다 항상 위에 오도록 고정한 상수다 —
 * 위 주석대로 zCounter와 상호작용시키지 않는 대신 택한 단순화(todo가 명시적으로 허용한 선택지).
 * 토스트(9999)·인식 플래시(9998)·좌측 도크(500)보다는 아래, 일반 업무 창들보다는 위.
 * 트레이드오프: 한 세션에서 일반 창 포커스/열기 조작이 수백 회를 넘으면 이론적으로 역전될 수
 * 있으나(zCounter가 이 값을 넘어서면), 실사용 세션에서 도달할 가능성이 극히 낮다고 판단해
 * docs/ASSUMPTIONS.md에 그대로 기록해 두었다.
 */
export const SCANNER_WINDOW_Z = 800;

const STORAGE_KEY = 'scanner-window:rect';
const DEFAULT_W = 320;
const DEFAULT_H = 300;
const MARGIN_X = 16;
// 도크 위젯(우하단, desktop.css `.scanner-dock`) 위에 여유를 두고 기본 배치되도록.
const MARGIN_BOTTOM = 68;

function defaultRect(): ScannerWindowRect {
  const w = DEFAULT_W;
  const h = DEFAULT_H;
  const x = Math.max(0, window.innerWidth - w - MARGIN_X);
  const y = Math.max(0, window.innerHeight - h - MARGIN_BOTTOM);
  return { x, y, w, h };
}

function loadRect(): ScannerWindowRect {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ScannerWindowRect>;
      if (
        typeof parsed.x === 'number' &&
        typeof parsed.y === 'number' &&
        typeof parsed.w === 'number' &&
        typeof parsed.h === 'number'
      ) {
        return { x: parsed.x, y: parsed.y, w: parsed.w, h: parsed.h };
      }
    }
  } catch {
    /* 손상된 값 — 기본 위치로 폴백 */
  }
  return defaultRect();
}

function saveRect(rect: ScannerWindowRect): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rect));
  } catch {
    /* 사생활 모드 등 저장 실패 — 다음 세션엔 기본 위치로 열릴 뿐, 치명적이지 않다 */
  }
}

let state: ScannerWindowSnapshot = { open: false, minimized: false, rect: loadRect() };
const listeners = new Set<(s: ScannerWindowSnapshot) => void>();

function setState(patch: Partial<ScannerWindowSnapshot>): void {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
}

export function getScannerWindowState(): ScannerWindowSnapshot {
  return state;
}

export function subscribeScannerWindow(fn: (s: ScannerWindowSnapshot) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** ScannerWindow.tsx·ScannerDockWidget.tsx가 함께 구독하는 훅. */
export function useScannerWindowState(): ScannerWindowSnapshot {
  return useSyncExternalStore(subscribeScannerWindow, getScannerWindowState, getScannerWindowState);
}

export function setScannerWindowRect(rect: ScannerWindowRect): void {
  setState({ rect });
}

export function persistScannerWindowRect(): void {
  saveRect(state.rect);
}

/**
 * 창을 연다 = 카메라를 켠다(ADR-026 "창 열기=카메라 시작"). 세 트리거 지점(도크 위젯 클릭·
 * 단축키 S·ScanCameraStart의 데스크톱 시작 버튼)이 전부 이 함수 하나로 모인다 —
 * cameraSession.start()의 reason 트리거 통합과 같은 패턴. 이미 열려 있으면(최소화 포함)
 * 카메라를 다시 시작하지 않고 그냥 펼치기만 한다.
 */
export function openScannerWindow(): void {
  if (!state.open) {
    cameraSession.start('scanner-window');
  }
  setState({ open: true, minimized: false });
}

export function minimizeScannerWindow(): void {
  setState({ minimized: true });
}

/** 최소화 해제(이미 펼쳐져 있으면 무해한 no-op) — 도크 위젯이 "이미 열려 있으면 복원" 트리거로 쓴다. */
export function restoreScannerWindow(): void {
  setState({ minimized: false });
}

/**
 * 닫는다 = 카메라를 끈다(ADR-026 "닫기=카메라 off"). 연속 모드 핀 중이면 확인 1회
 * (`window.confirm` — 이 파일은 shells/desktop/ 소속이라 뷰 경계 린트 대상이 아니다,
 * check-view-boundary.mjs는 src/views/**만 훑는다). 확인 후 닫으면 연속 모드 핀도 함께
 * 해제한다 — 카메라가 꺼진 채 "연속 모드"만 켜져 있는 건 의미 없는 조합이라 판단했다
 * (docs/ASSUMPTIONS.md "H2" 절 참고).
 */
export function closeScannerWindow(): void {
  if (cameraSession.getStatus().continuous) {
    const confirmed = window.confirm(t('shell.desktop.scannerWindow.confirmCloseContinuous'));
    if (!confirmed) return;
  }
  cameraSession.stop();
  cameraSession.setContinuous(false);
  setState({ open: false, minimized: false });
}

/** 단축키 S — 닫혀 있으면 열고, 열려 있으면(최소화 포함) 닫는다(기존 토글 의미 그대로 계승). */
export function toggleScannerWindow(): void {
  if (state.open) closeScannerWindow();
  else openScannerWindow();
}
