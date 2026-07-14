import { useSession } from './session';

// register.html의 apiCall()을 그대로 이식 — doPost 계약은 수정하지 않고 그대로 소비한다.
// (school-patch-v1/Code.gs doPost: action, token, ...payload → {ok,data|error})
export interface ApiOk<T> {
  ok: true;
  data: T;
  error: null;
}
export interface ApiErr {
  ok: false;
  data: null;
  error: { code: string; message: string; details?: unknown };
}
export type ApiResult<T> = ApiOk<T> | ApiErr;

const TIMEOUT_MS = 30000;

export type ApiLogOutcome = 'ok' | 'error' | 'network' | 'timeout';

export interface ApiCallLogEntry {
  at: number;
  action: string;
  requestId?: string;
  payloadPreview: string;
  outcome: ApiLogOutcome;
  httpStatus?: number;
  resultCode?: string;
  resultMessage?: string;
  durationMs: number;
}

// 진단 로그 이벤트 버스 — "스캔·저장까지 갔는데 시트에 안 보임" 스모크 버그 추적용.
// 프론트가 실제로 요청을 보냈는지, 서버가 뭐라 답했는지를 뷰가 화면에 그대로 보여줄 수 있게
// 서비스 계층에서 모든 apiCall을 가로채 기록한다 (개별 뷰가 각자 로깅하지 않는다).
type LogListener = (entry: ApiCallLogEntry) => void;
const logListeners = new Set<LogListener>();
export function onApiLog(fn: LogListener): () => void {
  logListeners.add(fn);
  return () => logListeners.delete(fn);
}
function emitLog(entry: ApiCallLogEntry) {
  logListeners.forEach((fn) => fn(entry));
}

const recentLog: ApiCallLogEntry[] = [];
const RECENT_LOG_MAX = 50;
export function getRecentApiLog(): readonly ApiCallLogEntry[] {
  return recentLog;
}
onApiLog((entry) => {
  recentLog.unshift(entry);
  if (recentLog.length > RECENT_LOG_MAX) recentLog.length = RECENT_LOG_MAX;
});

function redactedPreview(payload: Record<string, unknown>): string {
  const { token: _token, ...rest } = payload;
  try {
    return JSON.stringify(rest).slice(0, 300);
  } catch {
    return '[미리보기 실패]';
  }
}

export async function apiCall<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<ApiResult<T>> {
  const { apiUrl, token } = useSession.getState();
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : undefined;
  const payloadPreview = redactedPreview(payload);
  const startedAt = Date.now();

  if (!apiUrl) {
    const message = 'GAS Web App URL이 설정되지 않았습니다. 설정에서 입력하세요.';
    emitLog({ at: startedAt, action, requestId, payloadPreview, outcome: 'error', resultCode: 'NO_API_URL', resultMessage: message, durationMs: 0 });
    return { ok: false, data: null, error: { code: 'NO_API_URL', message } };
  }

  const body = { action, token, ...payload };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // fetch 기본 Content-Type(text/plain)을 유지 — application/json으로 지정하면
    // CORS 프리플라이트(OPTIONS)가 뜨는데 GAS Web App은 OPTIONS를 처리하지 않는다.
    const res = await fetch(apiUrl, { method: 'POST', body: JSON.stringify(body), signal: controller.signal });
    const json = (await res.json()) as ApiResult<T>;
    emitLog({
      at: startedAt,
      action,
      requestId,
      payloadPreview,
      outcome: json.ok ? 'ok' : 'error',
      httpStatus: res.status,
      resultCode: json.ok ? undefined : json.error.code,
      resultMessage: json.ok ? undefined : json.error.message,
      durationMs: Date.now() - startedAt
    });
    return json;
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    const resultCode = aborted ? 'CLIENT_TIMEOUT' : 'NETWORK_ERROR';
    const resultMessage = aborted ? '30초 내에 응답이 없었습니다.' : String((err as Error)?.message ?? err);
    emitLog({
      at: startedAt,
      action,
      requestId,
      payloadPreview,
      outcome: aborted ? 'timeout' : 'network',
      resultCode,
      resultMessage,
      durationMs: Date.now() - startedAt
    });
    return { ok: false, data: null, error: { code: resultCode, message: resultMessage } };
  } finally {
    clearTimeout(timer);
  }
}

export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// 실패한 쓰기 요청 재시도 규약: 같은 requestId로만 재시도(서버 멱등이 중복을 흡수).
// 무한 재시도 금지 — 호출자가 명시적으로 다시 호출해야 한다(자동 백오프 루프 없음).
export async function retryApiCall<T = unknown>(
  action: string,
  payload: Record<string, unknown> & { requestId: string }
): Promise<ApiResult<T>> {
  return apiCall<T>(action, payload);
}
