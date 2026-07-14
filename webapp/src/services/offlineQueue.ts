import { apiCall, type ApiResult } from './api';

// FRONTEND.md 플랫폼 주의: iOS는 미사용 7일 후 사이트 저장소를 지울 수 있다 →
// 여기 쌓아두고 오래 묵히지 않는다. 적재 즉시 전송을 시도하고, 실패한 것만 남는다.
// 진실은 항상 시트(GAS)에 있다 — 이 큐는 "아직 서버에 못 보낸 요청"의 임시 보관함일 뿐이다.
interface QueuedRequest {
  id: string;
  action: string;
  payload: Record<string, unknown> & { requestId: string };
  enqueuedAt: number;
}

const DB_NAME = 'lib-offline-queue';
const STORE = 'requests';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAll(): Promise<QueuedRequest[]> {
  return withStore('readonly', (s) => s.getAll() as IDBRequest<QueuedRequest[]>);
}

async function put(entry: QueuedRequest): Promise<void> {
  await withStore('readwrite', (s) => s.put(entry));
}

async function remove(id: string): Promise<void> {
  await withStore('readwrite', (s) => s.delete(id));
}

type QueueListener = (pendingCount: number) => void;
const listeners = new Set<QueueListener>();
export function onQueueChange(fn: QueueListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
async function notify(): Promise<void> {
  const count = (await getAll()).length;
  listeners.forEach((fn) => fn(count));
}

/** 요청을 큐에 적재하고 즉시 전송을 시도한다. 실패하면 큐에 남아 flush()를 기다린다. */
export async function enqueueAndSend<T>(
  action: string,
  payload: Record<string, unknown> & { requestId: string }
): Promise<ApiResult<T>> {
  const entry: QueuedRequest = { id: payload.requestId, action, payload, enqueuedAt: Date.now() };
  await put(entry);
  await notify();
  const result = await apiCall<T>(action, payload);
  if (result.ok || result.error.code !== 'NETWORK_ERROR') {
    // 서버가 응답은 했으나 실패(ok:false, 네트워크 이외 사유)한 경우도 큐에서 뺀다 —
    // 같은 requestId 무한 재전송은 정책상 금지, 사람이 다시 트리거해야 한다.
    await remove(entry.id);
    await notify();
  }
  return result;
}

/** 온라인 복귀 시 순차 재전송. 서버 멱등(requestId)이 중복을 흡수한다. */
export async function flushQueue(): Promise<void> {
  const pending = await getAll();
  for (const entry of pending) {
    const result = await apiCall(entry.action, entry.payload);
    if (result.ok || result.error.code !== 'NETWORK_ERROR') await remove(entry.id);
  }
  await notify();
}

export async function getPendingCount(): Promise<number> {
  return (await getAll()).length;
}

export async function getPendingEntries(): Promise<QueuedRequest[]> {
  return getAll();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushQueue();
  });
}
