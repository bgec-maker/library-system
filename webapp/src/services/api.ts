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
  // H3(2026-07-15, 긴급 인터럽트 — iOS 설치형 PWA doPost 응답 수신 실패) 진단 필드.
  // transport: 이 로그 항목이 POST(기본 경로)인지 GET(읽기 전용 액션 자동 재시도, 아래 참고)인지.
  // errName: fetch() 자체가 던졌을 때의 err.name(예: 'TypeError') — 이전엔 NETWORK_ERROR로만
  //   뭉뚱그려져 사라지던 값.
  // responseType/redirected: fetch()가 Response 객체까지는 얻었을 때(res.json() 파싱이 그 다음
  //   단계에서 실패하더라도) res.type/res.redirected를 기록한다 — "요청이 서버에 닿긴 했는지"를
  //   NETWORK_ERROR 하나로는 구분할 수 없었던 문제를 해소한다.
  transport?: 'POST' | 'GET';
  errName?: string;
  responseType?: string;
  redirected?: boolean;
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

// H3 — school-patch-v1/Code.gs의 GET_ALLOWED_ACTIONS_와 정확히 같은 11개(서버가 doGet에서
// 인증된 GET 쿼리 경로로 허용하는 읽기 전용 action 목록). POST가 fetch() 단계에서 네트워크
// 오류로 죽었을 때 이 목록에 있는 action에 한해서만 GET으로 자동 재시도한다 — 쓰기 액션은
// 이 목록에 없으므로 구조적으로 재시도 대상이 될 수 없다(GET 쿼리스트링으로 쓰기를 재전송하는
// 건 이 수정이 의도적으로 만들지 않는 별도의, 더 위험한 경로다).
export const READ_ONLY_ACTIONS: readonly string[] = [
  'lookupIsbn',
  'copyStatus',
  'reservations',
  'dashboard',
  'manualEntryPendingCount',
  'report',
  'viz',
  'catalogSync',
  'recentOps',
  'titleDetail',
  'unpaidFines',
  // todo/26 — settingsOverview·runIntegrityCheck 둘 다 읽기 전용(Code.gs GET_ALLOWED_ACTIONS_에도
  // 같은 이름으로 추가됨) — 위 11개는 그대로.
  'settingsOverview',
  'runIntegrityCheck'
];

interface FetchAttemptContext {
  action: string;
  requestId?: string;
  payloadPreview: string;
  startedAt: number;
}

interface FetchAttempt<T> {
  outcome: ApiLogOutcome;
  result: ApiResult<T>;
}

// H3 — fetch() 단계와 res.json() 파싱 단계를 분리한다. 이전엔 이 둘이 같은 try 블록에 있어서
// fetch()가 실제로는 성공했는데(Response 객체를 얻었는데) 그 다음 res.json()이 실패한 경우까지
// 전부 "NETWORK_ERROR"로 뭉뚱그려졌다 — 그러면 res.status/res.type/res.redirected 같은, "서버에
// 닿긴 닿았다"는 걸 보여줄 수 있는 정보가 전부 사라진다. 여기서는 res가 존재하는 한 그 값들을
// 항상 로그에 남기고, fetch() 자체가 던진 경우에만 err.name을 남긴다(res가 아예 없으므로).
async function performFetch<T>(
  transport: 'POST' | 'GET',
  url: string,
  init: RequestInit,
  ctx: FetchAttemptContext
): Promise<FetchAttempt<T>> {
  const { action, requestId, payloadPreview, startedAt } = ctx;

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    const errName = err instanceof Error ? err.name : undefined;
    const outcome: ApiLogOutcome = aborted ? 'timeout' : 'network';
    const resultCode = aborted ? 'CLIENT_TIMEOUT' : 'NETWORK_ERROR';
    const resultMessage = aborted ? '30초 내에 응답이 없었습니다.' : String((err as Error)?.message ?? err);
    emitLog({
      at: startedAt,
      action,
      requestId,
      payloadPreview,
      outcome,
      resultCode,
      resultMessage,
      durationMs: Date.now() - startedAt,
      transport,
      errName
    });
    return { outcome, result: { ok: false, data: null, error: { code: resultCode, message: resultMessage } } };
  }

  // 이 지점부턴 Response 객체를 얻었다 — res.json()이 실패해도 아래 진단 필드는 항상 남는다.
  let json: ApiResult<T>;
  try {
    json = (await res.json()) as ApiResult<T>;
  } catch (parseErr) {
    const errName = parseErr instanceof Error ? parseErr.name : undefined;
    const resultMessage = `응답 본문 파싱 실패(HTTP ${res.status}, type=${res.type}): ${String((parseErr as Error)?.message ?? parseErr)}`;
    emitLog({
      at: startedAt,
      action,
      requestId,
      payloadPreview,
      outcome: 'error',
      httpStatus: res.status,
      resultCode: 'PARSE_ERROR',
      resultMessage,
      durationMs: Date.now() - startedAt,
      transport,
      errName,
      responseType: res.type,
      redirected: res.redirected
    });
    return { outcome: 'error', result: { ok: false, data: null, error: { code: 'PARSE_ERROR', message: resultMessage } } };
  }

  emitLog({
    at: startedAt,
    action,
    requestId,
    payloadPreview,
    outcome: json.ok ? 'ok' : 'error',
    httpStatus: res.status,
    resultCode: json.ok ? undefined : json.error.code,
    resultMessage: json.ok ? undefined : json.error.message,
    durationMs: Date.now() - startedAt,
    transport,
    responseType: res.type,
    redirected: res.redirected
  });
  return { outcome: json.ok ? 'ok' : 'error', result: json };
}

export async function apiCall<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<ApiResult<T>> {
  const { apiUrl, token, operator } = useSession.getState();
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : undefined;
  const payloadPreview = redactedPreview(payload);
  const startedAt = Date.now();

  if (!apiUrl) {
    const message = 'GAS Web App URL이 설정되지 않았습니다. 설정에서 입력하세요.';
    emitLog({ at: startedAt, action, requestId, payloadPreview, outcome: 'error', resultCode: 'NO_API_URL', resultMessage: message, durationMs: 0 });
    return { ok: false, data: null, error: { code: 'NO_API_URL', message } };
  }

  // todo/25 위생 항목 1 — Code.gs ensureOperatorNote_(3260행대 신규 추가, 순수 함수)의 프론트
  // 짝: 모든 쓰기 요청 body에 operator를 자동으로 실어 보낸다. 이미 payload.operator를 직접
  // 채워 보내는 화면(register/index.tsx의 registerByIsbn 등, requiredText_로 서버가 필수
  // 요구)은 스프레드가 뒤에 와서 그 값이 그대로 이긴다 — 이 줄은 "깜빡한 화면"을 위한 안전망일
  // 뿐, 이미 명시적으로 보내는 값을 덮어쓰지 않는다.
  const body = { action, token, operator, ...payload };
  const postController = new AbortController();
  const postTimer = setTimeout(() => postController.abort(), TIMEOUT_MS);
  let postAttempt: FetchAttempt<T>;
  try {
    // fetch 기본 Content-Type(text/plain)을 유지 — application/json으로 지정하면
    // CORS 프리플라이트(OPTIONS)가 뜨는데 GAS Web App은 OPTIONS를 처리하지 않는다.
    postAttempt = await performFetch<T>(
      'POST',
      apiUrl,
      { method: 'POST', body: JSON.stringify(body), signal: postController.signal },
      { action, requestId, payloadPreview, startedAt }
    );
  } finally {
    clearTimeout(postTimer);
  }

  // H3 — POST가 fetch() 단계에서 죽었을 때만(outcome==='network': 타임아웃도, 서버가 실제로 응답한
  // 오류도 아닌, 순수 네트워크 실패 — iOS 설치형 PWA의 WKWebView가 TypeError "Load failed"를
  // 던지는 바로 그 사례) 그리고 이 action이 읽기 전용일 때만 GET으로 딱 한 번 자동 재시도한다.
  // 같은 requestId를 그대로 써서 진단 패널에 "POST 실패 → GET 재시도" 쌍으로 보이게 한다.
  // 실패 응답(서버가 {ok:false}를 정상적으로 반환한 경우)이나 타임아웃은 재시도 대상이 아니다 —
  // 재시도해도 같은 이유로 다시 실패할 뿐이다. 쓰기 액션은 READ_ONLY_ACTIONS에 없으므로 항상
  // 여기서 그대로 반환된다(retryApiCall의 수동·동일 requestId POST 재시도 관례와는 별개의,
  // 자동으로 한 번만 도는 경로).
  if (postAttempt.outcome !== 'network' || !READ_ONLY_ACTIONS.includes(action)) {
    return postAttempt.result;
  }

  const flatQuery: Record<string, string> = { action, token: String(token ?? '') };
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    flatQuery[key] = String(value);
  });
  const getUrl = `${apiUrl}?${new URLSearchParams(flatQuery).toString()}`;

  const getController = new AbortController();
  const getTimer = setTimeout(() => getController.abort(), TIMEOUT_MS);
  let getAttempt: FetchAttempt<T>;
  try {
    getAttempt = await performFetch<T>(
      'GET',
      getUrl,
      { method: 'GET', signal: getController.signal },
      { action, requestId, payloadPreview, startedAt: Date.now() }
    );
  } finally {
    clearTimeout(getTimer);
  }
  // GET 재시도도 실패하면 그 실패(더 최근·더 관련 있는 진단)를 그대로 반환한다.
  return getAttempt.result;
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
