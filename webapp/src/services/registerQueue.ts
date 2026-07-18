import { apiCall, type ApiResult } from './api';
import { publishDataChange } from './dataChangeBus';

// todo/28 「등록 순차 제출 큐」 — 등록 저장을 백그라운드 파이프라인으로 옮긴다: 뷰는 적재만
// 하고 즉시 scan 화면으로 돌아가며, 이 서비스가 한 건씩(동시 1건) 순차 전송한다.
//
// 왜 동시 1건인가: 서버(school-patch-v1/Code.gs) executeWrite_ 안 withWriteLock_이
// tryLock(10초)으로 모든 쓰기를 전역 직렬화한다 — 클라이언트가 병렬로 쏘면 서버 처리량은
// 늘지 않고 락 대기 10초 초과분만 BUSY_RETRY로 튕긴다. 파이프라인의 이득은 병렬 전송이
// 아니라 "사람의 스캔·확인 시간과 네트워크+서버 시간이 겹쳐지는 것"이므로 순차로 충분하다.
//
// 왜 같은 requestId 백오프 재전송이 안전한가: executeWrite_가 OPERATIONS 시트로 멱등을
// 보장한다 — COMPLETED면 {idempotent:true} 재확인 응답, STARTED(10분 내)면 DUPLICATE_REQUEST.
// 따라서 BUSY_RETRY(락 경합)·NETWORK_ERROR·CLIENT_TIMEOUT(전송됐는지 불명)·DUPLICATE_REQUEST
// (이전 시도가 아직 서버에서 처리 중)는 전부 "잠시 후 같은 ID로 다시 물어봐도 중복 저장이
// 생길 수 없는" 코드다. 그 외(검증 오류 등)는 재전송해도 같은 이유로 실패하므로 즉시 실패
// 목록으로 보낸다 — api.ts의 "무한 재시도 금지" 관례는 유지하되, 위 네 코드에 한한 유한
// 백오프(최대 5회)는 todo/28이 명시적으로 추가한 예외다.
//
// FRONTEND.md 플랫폼 주의(iOS 저장소 축출)와의 관계: 적재 즉시
// 전송을 시도하고 오래 묵히지 않는다. 진실은 항상 시트. localStorage 영속은 (1) 새로고침
// 직전에 적재된 미전송분의 유실 방지, (2) 완료 항목의 등록번호를 연필로 옮겨 적기 전에
// 화면이 닫혀도 다시 볼 수 있게 하는 짧은 완충일 뿐이다(완료분 최근 30건 유지).
//
// (구 services/offlineQueue.ts는 todo/39에서 제거 — import 0건의 죽은 코드였고, 존치 시
// 'online' flush와 이 큐가 같은 requestId를 두 경로로 쏘는 이중 발사 위험만 남긴다. 등록
// 쓰기는 이 큐가 전담하고, 대출·반납 오프라인 적재는 todo/waiting/offline-loans 게이트.)

export type RegisterQueueAction = 'registerByIsbn' | 'registerTitle';

export type RegisterQueueStatus = 'queued' | 'sending' | 'retryWait' | 'done';

export interface RegisterQueueEntry {
  requestId: string;
  action: RegisterQueueAction;
  payload: Record<string, unknown> & { requestId: string };
  // 표시용 필드는 평평하게(FailedEntry와 같은 관례) — payload는 액션별 모양이 달라
  // 트레이가 unknown을 꺼내게 하지 않는다.
  title: string;
  isbn: string;
  copyCount: number;
  enqueuedAt: number;
  status: RegisterQueueStatus;
  attempts: number;
  nextRetryAt?: number;
  lastErrorCode?: string;
  // 완료 시 채워지는 결과 — 멱등 재확인 응답(barcodes 없음)이면 idempotentReplay로 구분.
  barcodes?: string[];
  titleId?: string;
  resultTitle?: string;
  created?: boolean;
  idempotentReplay?: boolean;
  completedAt?: number;
  /** todo/60 — 부팅 자동 재개로 큐에 돌아온 횟수(실패로 되돌아갈 때 FailedEntry로 이월). */
  autoResumes?: number;
}

// 실패 목록 — register 뷰가 쓰던 localStorage 관례를 그대로 계승하되, 쓰기 주체를 이
// 서비스로 일원화한다(뷰와 큐가 각자 쓰면 마지막 쓰기가 이긴다).
export interface RegisterFailedEntry {
  requestId: string;
  action: RegisterQueueAction;
  title: string;
  isbn: string;
  payload: Record<string, unknown>;
  reason: string;
  /** todo/60 — 실패 시점의 오류 코드. 부팅 자동 재개가 "서버 일시 장애류(BUSY 등)"만
   *  골라내는 근거. 없으면(구버전 저장분) 분류 불가 → 자동 재개 대상에서 제외(보수적). */
  lastErrorCode?: string;
  /** todo/60 — 부팅 자동 재개 횟수. 상한(AUTO_RESUME_MAX) 도달 후엔 수동 재시도만 —
   *  서버가 영구히 아픈 경우의 무한 되살림 방지. */
  autoResumes?: number;
}

interface RegisterByIsbnLikeResult {
  titleId?: string;
  barcodes?: string[];
  barcode?: string;
  title?: string;
  created?: boolean;
  copyCount?: number;
  idempotent?: boolean;
}

const QUEUE_KEY = 'lib.register.queue.v1';
const FAILED_KEY = 'lib.register.failed';
const DONE_KEEP = 30;

const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [2000, 4000, 8000, 15000];
const RETRYABLE_CODES = new Set(['BUSY_RETRY', 'NETWORK_ERROR', 'CLIENT_TIMEOUT', 'DUPLICATE_REQUEST']);

function todayKey(): string {
  return `lib.register.today.${new Date().toISOString().slice(0, 10)}`;
}

export function readTodayCount(): number {
  const n = Number(localStorage.getItem(todayKey()) ?? '0');
  return Number.isFinite(n) ? n : 0;
}

function addTodayCount(delta: number): void {
  localStorage.setItem(todayKey(), String(readTodayCount() + delta));
}

export function readFailedList(): RegisterFailedEntry[] {
  try {
    const raw = localStorage.getItem(FAILED_KEY);
    return raw ? (JSON.parse(raw) as RegisterFailedEntry[]) : [];
  } catch {
    return [];
  }
}

function writeFailedList(list: RegisterFailedEntry[]): void {
  localStorage.setItem(FAILED_KEY, JSON.stringify(list));
}

// ── 큐 상태 (모듈 싱글턴 — 뷰가 닫혀도 전송은 계속된다) ──────────────────────

let entries: RegisterQueueEntry[] = loadEntries();
let pumping = false;
let wakeTimer: ReturnType<typeof setTimeout> | null = null;

function loadEntries(): RegisterQueueEntry[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RegisterQueueEntry[];
    // 새로고침 복원: 'sending' 중이었다면 응답을 못 받은 채 죽은 것 — CLIENT_TIMEOUT과 같은
    // "전송됐는지 불명" 부류이므로 queued로 되돌려 같은 requestId로 재개한다(멱등이 흡수).
    return parsed.map((e) => (e.status === 'sending' || e.status === 'retryWait' ? { ...e, status: 'queued' as const } : e));
  } catch {
    return [];
  }
}

function persist(): void {
  const done = entries.filter((e) => e.status === 'done').slice(-DONE_KEEP);
  const active = entries.filter((e) => e.status !== 'done');
  entries = [...done, ...active].sort((a, b) => a.enqueuedAt - b.enqueuedAt);
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
  } catch {
    // 저장 실패(용량 등)해도 메모리 큐로 동작은 계속한다 — 진실은 시트.
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function onRegisterQueueChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notify(): void {
  persist();
  listeners.forEach((fn) => fn());
}

export function getRegisterQueueEntries(): readonly RegisterQueueEntry[] {
  return entries;
}

export function getRegisterQueuePendingCount(): number {
  return entries.filter((e) => e.status !== 'done').length;
}

/** 완료(트레이) 항목 비우기 — 미전송·전송 중 항목은 건드리지 않는다. */
export function clearDoneEntries(): void {
  entries = entries.filter((e) => e.status !== 'done');
  notify();
}

/** 복본 일괄 발급(BulkCopyPanel) 등 큐 밖 성공분의 오늘 카운터·대시보드 갱신 합류점. */
export function recordExtraIssued(count: number): void {
  if (count <= 0) return;
  addTodayCount(count);
  publishDataChange();
  notify();
}

export interface EnqueueRegisterInput {
  requestId: string;
  action: RegisterQueueAction;
  payload: Record<string, unknown> & { requestId: string };
  title: string;
  isbn: string;
  copyCount: number;
}

/** 등록 요청을 큐에 적재하고 즉시 반환한다 — 전송·재시도·완료는 백그라운드 펌프가 맡는다. */
export function enqueueRegister(input: EnqueueRegisterInput): void {
  // 실패 목록에서 재시도로 돌아온 같은 requestId가 이미 큐에 있으면 중복 적재하지 않는다.
  if (entries.some((e) => e.requestId === input.requestId && e.status !== 'done')) return;
  entries.push({
    ...input,
    enqueuedAt: Date.now(),
    status: 'queued',
    attempts: 0
  });
  // 재시도 경로: 같은 requestId가 실패 목록에 남아 있으면 큐 재적재와 동시에 걷어낸다.
  const failed = readFailedList();
  if (failed.some((f) => f.requestId === input.requestId)) {
    writeFailedList(failed.filter((f) => f.requestId !== input.requestId));
  }
  notify();
  void pump();
}

function moveToFailed(entry: RegisterQueueEntry, reason: string): void {
  entries = entries.filter((e) => e.requestId !== entry.requestId);
  const failed = readFailedList().filter((f) => f.requestId !== entry.requestId);
  failed.push({
    requestId: entry.requestId,
    action: entry.action,
    title: entry.title,
    isbn: entry.isbn,
    payload: entry.payload,
    reason,
    // todo/60 — 자동 재개 판단 근거와 재개 이력을 함께 보존.
    lastErrorCode: entry.lastErrorCode,
    autoResumes: entry.autoResumes
  });
  writeFailedList(failed);
}

function completeEntry(entry: RegisterQueueEntry, data: RegisterByIsbnLikeResult): void {
  const barcodes = data.barcodes ?? (data.barcode ? [data.barcode] : []);
  const idempotentReplay = Boolean(data.idempotent) && barcodes.length === 0;
  entry.status = 'done';
  entry.completedAt = Date.now();
  entry.barcodes = barcodes;
  entry.titleId = data.titleId;
  entry.resultTitle = data.title || entry.title;
  entry.created = data.created;
  entry.idempotentReplay = idempotentReplay;
  // 멱등 재확인이어도 카운터는 올린다 — 그 요청의 실제 커밋(첫 시도)은 응답 유실로 여기서
  // 한 번도 집계되지 못했다. copyCount가 응답에 없으면 적재 시점 의도값으로 집계한다.
  addTodayCount(data.copyCount ?? entry.copyCount);
  publishDataChange();
}

function nextSendable(now: number): RegisterQueueEntry | undefined {
  // FIFO: 완료 아닌 항목 중 가장 오래된 것. retryWait는 시각이 되기 전엔 건너뛰지 않고
  // 기다린다 — 순서를 앞지르면 "무조건 순서대로"가 깨진다.
  const head = entries.find((e) => e.status === 'queued' || e.status === 'retryWait');
  if (!head) return undefined;
  if (head.status === 'retryWait' && (head.nextRetryAt ?? 0) > now) return undefined;
  return head;
}

function scheduleWake(): void {
  const head = entries.find((e) => e.status === 'retryWait');
  if (!head || head.nextRetryAt === undefined) return;
  const delay = Math.max(0, head.nextRetryAt - Date.now());
  if (wakeTimer) clearTimeout(wakeTimer);
  wakeTimer = setTimeout(() => {
    wakeTimer = null;
    void pump();
  }, delay + 50);
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    for (;;) {
      const entry = nextSendable(Date.now());
      if (!entry) break;
      entry.status = 'sending';
      entry.attempts += 1;
      notify();

      const res: ApiResult<RegisterByIsbnLikeResult> = await apiCall<RegisterByIsbnLikeResult>(entry.action, entry.payload);

      if (res.ok) {
        completeEntry(entry, res.data);
        notify();
        continue;
      }

      entry.lastErrorCode = res.error.code;
      if (RETRYABLE_CODES.has(res.error.code) && entry.attempts < MAX_ATTEMPTS) {
        entry.status = 'retryWait';
        entry.nextRetryAt = Date.now() + BACKOFF_MS[Math.min(entry.attempts - 1, BACKOFF_MS.length - 1)];
        notify();
        scheduleWake();
        // 순서 보장: 뒤 항목을 앞지르지 않고 펌프를 내려놓는다 — 깨우기 타이머가 재개한다.
        break;
      }

      moveToFailed(entry, res.error.message || res.error.code);
      notify();
    }
  } finally {
    pumping = false;
  }
}

// 온라인 복귀 = 대기 중이던 백오프를 기다릴 이유가 없어진 시점 — 즉시 재개를 시도한다.
// (등록 요청의 재전송 주체는 이 큐 하나뿐이다 — 이중 발사 없음, todo/39 참고.)
// todo/60 — BUSY류 소진 실패의 부팅 자동 재개. 사용자 실사례(서버 락 혼잡 지속 → 5회
// 소진 → 실패 2건, 수동 재시도 필요)에서 승인된 결정으로, todo/28의 "자동 재시도 없음"
// 원칙을 **서버 일시 장애류에 한해** 개정한다: VALIDATION 같은 내용 문제는 여전히 수동
// (다시 보내도 같은 이유로 실패 — 사람이 고쳐야 함), 재시도형 코드만 같은 requestId로
// 재큐(서버 멱등이 중복 저장 흡수). 부팅당 1회 · 항목당 생애 상한 AUTO_RESUME_MAX회 —
// 서버가 영구히 아픈 경우 무한 되살림을 막고 실패 목록(+탭 배지)으로 수렴시킨다.
const AUTO_RESUME_MAX = 3;

function resumeRetryableFailuresAtBoot_(): void {
  const failed = readFailedList();
  const toResume = failed.filter(
    (f) =>
      f.lastErrorCode !== undefined &&
      RETRYABLE_CODES.has(f.lastErrorCode) &&
      (f.autoResumes ?? 0) < AUTO_RESUME_MAX &&
      !entries.some((e) => e.requestId === f.requestId && e.status !== 'done')
  );
  if (toResume.length === 0) return;
  toResume.forEach((f) => {
    entries.push({
      requestId: f.requestId,
      action: f.action,
      payload: f.payload as Record<string, unknown> & { requestId: string },
      title: f.title,
      isbn: f.isbn,
      copyCount: Math.max(1, Number((f.payload as { copyCount?: unknown }).copyCount) || 1),
      enqueuedAt: Date.now(),
      status: 'queued',
      attempts: 0,
      autoResumes: (f.autoResumes ?? 0) + 1
    });
  });
  writeFailedList(failed.filter((f) => !toResume.some((r) => r.requestId === f.requestId)));
  persist();
  notify();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    entries.forEach((e) => {
      if (e.status === 'retryWait') e.nextRetryAt = Date.now();
    });
    void pump();
  });
  resumeRetryableFailuresAtBoot_();
  // 새로고침 복원분(미전송 잔여) 또는 방금 자동 재개분이 있으면 부팅 직후 재개한다.
  if (entries.some((e) => e.status !== 'done')) void pump();
}
