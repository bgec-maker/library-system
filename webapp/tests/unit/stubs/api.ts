// 단위 테스트 전용 api 스텁 — scripts/run-unit-tests.mjs의 esbuild 플러그인이
// src/services/** 안에서의 './api' 임포트를 이 모듈로 치환한다(소스 무수정 주입).
// 테스트 파일과 피검 모듈이 같은 인스턴스를 공유하므로 호출 계측·응답 계획이 가능하다.
export interface ApiOk<T> { ok: true; data: T; error: null }
export interface ApiErr { ok: false; data: null; error: { code: string; message: string } }
export type ApiResult<T> = ApiOk<T> | ApiErr;

export const calls: string[] = [];
let plan: Array<string | { data: unknown }> = [];
let delayMs = 0;

/** 응답 계획: 'ok' | 오류코드 문자열 | {data} — 소진되면 이후는 전부 ok({}). */
export function setPlan(next: Array<string | { data: unknown }>): void {
  plan = [...next];
}
export function setDelay(ms: number): void {
  delayMs = ms;
}
export function resetStub(): void {
  calls.length = 0;
  plan = [];
  delayMs = 0;
}

export async function apiCall<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<ApiResult<T>> {
  calls.push(action + '|' + JSON.stringify(payload));
  if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  const mode = plan.shift() ?? 'ok';
  if (typeof mode === 'object') return { ok: true, data: mode.data as T, error: null };
  if (mode === 'ok') return { ok: true, data: {} as T, error: null };
  return { ok: false, data: null, error: { code: mode, message: mode } };
}

export function newRequestId(): string {
  return 'test-req-' + calls.length;
}
