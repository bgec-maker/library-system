import type { ScanEvent, ScanTarget, ViewId } from '../types';

// FRONTEND.md 스캔 라우팅: 숫자(+Luhn)=책 · 'S'접두=학생 · URL '/b/'=책 · (등록 도구용) 978/979 ISBN.
export function isValidEan13(thirteenDigits: string): boolean {
  if (!/^\d{13}$/.test(thirteenDigits)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(thirteenDigits[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(thirteenDigits[12]);
}

// school-patch-v1/Code.gs의 luhnCheckDigit_()과 동일한 가중치로 검증한다(6자리 base + 체크 1자리).
export function isValidCopyBarcode(sevenDigits: string): boolean {
  if (!/^\d{7}$/.test(sevenDigits)) return false;
  const base = sevenDigits.slice(0, 6);
  const check = sevenDigits.slice(6);
  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    const d = Number(base[base.length - 1 - i]);
    let doubled = d;
    if (i % 2 === 0) {
      doubled = d * 2;
      if (doubled > 9) doubled -= 9;
    }
    sum += doubled;
  }
  return String((10 - (sum % 10)) % 10) === check;
}

export function parseScan(raw: string): ScanTarget {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'unknown', raw: trimmed };

  // 책 QR = URL (ADR-004): https://<도메인>/b/0001234
  const urlMatch = trimmed.match(/\/b\/(\d{7})(?:[/?#]|$)/);
  if (urlMatch) return { kind: 'book-url', barcode: urlMatch[1], rawUrl: trimmed };

  // 학생 QR = 불투명 ID, 'S:' 접두 (ADR-004) — URL이 아님에 주의
  if (/^S:/i.test(trimmed)) return { kind: 'student', studentCode: trimmed.slice(2) };

  const digitsOnly = trimmed.replace(/[^0-9]/g, '');

  if (digitsOnly.length === 13 && (digitsOnly.startsWith('978') || digitsOnly.startsWith('979')) && isValidEan13(digitsOnly)) {
    return { kind: 'isbn', isbn: digitsOnly };
  }

  if (digitsOnly.length === 7 && isValidCopyBarcode(digitsOnly)) {
    return { kind: 'book', barcode: digitsOnly };
  }

  return { kind: 'unknown', raw: trimmed };
}

type ScanListener = (event: ScanEvent) => void;
const listeners = new Set<ScanListener>();

export function publishScan(raw: string): ScanEvent {
  const event: ScanEvent = { target: parseScan(raw), raw, at: Date.now() };
  listeners.forEach((fn) => fn(event));
  return event;
}

export function subscribeScan(fn: ScanListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── 라우팅 힌트 ──────────────────────────────────────────────────────────
// "관심 창이 하나도 없으면 loan-return 자동 오픈", "포커스 창 전환 시 스캔이 새
// 포커스 창으로 감(핀 시 핀 창)" — 이 판단 자체는 셸(포커스·활성탭을 아는 쪽)이 하고,
// 결과만 여기(서비스 계층)에 기록한다. 뷰는 이 힌트를 읽어 "지금 내가 스캔 수신자인지"만
// 스스로 판정한다 — shells/**를 직접 import하지 않고도 라우팅에 참여할 수 있는 유일한 통로.
type RouteListener = (viewId: ViewId | null) => void;
const routeListeners = new Set<RouteListener>();
let currentRoute: ViewId | null = null;
let pinnedRoute: ViewId | null = null;

export function setScanRoute(viewId: ViewId | null): void {
  currentRoute = viewId;
  routeListeners.forEach((fn) => fn(getEffectiveScanRoute()));
}

export function pinScanRoute(viewId: ViewId): void {
  pinnedRoute = viewId;
  routeListeners.forEach((fn) => fn(getEffectiveScanRoute()));
}

export function unpinScanRoute(): void {
  pinnedRoute = null;
  routeListeners.forEach((fn) => fn(getEffectiveScanRoute()));
}

export function isScanRoutePinned(): boolean {
  return pinnedRoute !== null;
}

export function getEffectiveScanRoute(): ViewId | null {
  return pinnedRoute ?? currentRoute;
}

export function subscribeScanRoute(fn: RouteListener): () => void {
  routeListeners.add(fn);
  return () => routeListeners.delete(fn);
}
