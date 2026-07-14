// SessionGate.tsx가 열림/닫힘 상태를 구독하는 아주 작은 외부 스토어.
// 컴포넌트 파일(SessionGate.tsx)이 컴포넌트만 export하도록 분리했다(react-refresh 규칙).
let settingsOpen = false;
const listeners = new Set<() => void>();

export function openSessionSettings(): void {
  settingsOpen = true;
  listeners.forEach((fn) => fn());
}

export function closeSessionSettings(): void {
  settingsOpen = false;
  listeners.forEach((fn) => fn());
}

export function subscribeSessionSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSessionSettingsOpen(): boolean {
  return settingsOpen;
}
