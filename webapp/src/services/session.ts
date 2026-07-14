import { create } from 'zustand';
import type { Role } from '../types';

// register.html의 '최초 1회 URL·토큰·이름 입력 → localStorage' 방식을 그대로 계승·일반화.
// 로그인 방식은 CLAUDE.md 🟡 미결 — 이 값들이 그 자리를 임시로 메꾼다.
const STORAGE_KEYS = {
  apiUrl: 'lib.session.apiUrl',
  token: 'lib.session.token',
  operator: 'lib.session.operator',
  role: 'lib.session.role'
} as const;

export interface SessionConfig {
  apiUrl: string;
  token: string;
  operator: string;
  role: Role;
}

function readInitialConfig(): SessionConfig {
  const storedRole = localStorage.getItem(STORAGE_KEYS.role);
  return {
    apiUrl: localStorage.getItem(STORAGE_KEYS.apiUrl) ?? '',
    token: localStorage.getItem(STORAGE_KEYS.token) ?? '',
    operator: localStorage.getItem(STORAGE_KEYS.operator) ?? '',
    role: storedRole === 'STATION' ? 'STATION' : 'LIBRARIAN'
  };
}

interface SessionState extends SessionConfig {
  setConfig(patch: Partial<SessionConfig>): void;
  clear(): void;
}

export const useSession = create<SessionState>((set) => ({
  ...readInitialConfig(),
  setConfig(patch) {
    (Object.keys(patch) as (keyof SessionConfig)[]).forEach((key) => {
      const value = patch[key];
      if (value !== undefined) localStorage.setItem(STORAGE_KEYS[key], value);
    });
    set(patch);
  },
  clear() {
    (Object.values(STORAGE_KEYS) as string[]).forEach((key) => localStorage.removeItem(key));
    set({ apiUrl: '', token: '', operator: '', role: 'LIBRARIAN' });
  }
}));

export function isSessionComplete(cfg: Pick<SessionConfig, 'apiUrl' | 'token' | 'operator'>): boolean {
  return Boolean(cfg.apiUrl && cfg.token && cfg.operator);
}
