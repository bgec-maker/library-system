import type { ToastKind } from '../types';

// ShellContext.toast()의 실제 구현이 여기로 모인다 — 데스크톱·모바일 셸이 각자
// 토스트 스택 UI를 새로 만들지 않고 <ToastHost/> 하나를 공유한다.
export interface ToastMessage {
  id: string;
  message: string;
  kind: ToastKind;
}

type Listener = (toast: ToastMessage) => void;
const listeners = new Set<Listener>();

export function pushToast(message: string, kind: ToastKind = 'info'): void {
  const toast: ToastMessage = { id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, message, kind };
  listeners.forEach((fn) => fn(toast));
}

export function subscribeToast(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
