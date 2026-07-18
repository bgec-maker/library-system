import { useEffect, useState } from 'react';
import { apiCall } from './api';
import { generateMockCatalog } from '../mocks/catalog';

// catalog(장서 대장) 뷰의 정본 캐시 — ADR-024 「장서 테이블 = 미러 기반 클라이언트
// 페이지네이션」: 정렬·필터·페이지는 전부 이 IndexedDB 미러에서 로컬로 처리하고, GAS는
// catalogSync 청크 동기화(최대 1,000행/호출)에만 쓰인다. 🔴 서버 페이지네이션이 아니다 —
// GAS엔 부분 읽기가 없어 페이지 전환마다 전체 스캔이 되기 때문에 ADR-024가 명시적으로 금지한다.
//
// v1 스텁(title 중심 + copies 중첩 배열)에서 이 라운드에 재설계했다: FRONTEND.md의 catalog 열
// 목록(등록번호·서명·저자·분류·상태·대출횟수·최근대출·서가·입수일)이 barcode/상태/서가/입수일처럼
// **소장본(copy) 단위** 값을 요구하므로, 미러도 COPY 1행 = 미러 1행으로 저장한다(제목 정보는
// 조인해서 이미 각 행에 펼쳐 넣은 채로 서버가 내려준다 — 클라이언트에서 다시 조인하지 않는다).
//
// 델타 커서: 서버 응답의 serverTime을 다음 호출의 afterUpdatedAt으로 그대로 돌려보낸다(클라이언트
// 시계가 아니라 서버 시계 기준 — 클럭 스큐로 인한 델타 누락 방지, Code.gs apiWebCatalogSync_
// 주석 참고). 이 커서는 IndexedDB의 별도 meta 스토어에 저장한다 — 앱을 다시 열어도 전량
// 재동기화가 아니라 그 이후의 델타만 받는다. iOS 저장소 축출(FRONTEND.md "플랫폼 주의")로 미러가
// 지워져도 다음 실행이 afterUpdatedAt 없이 처음부터 다시 받아오는 것뿐 — 진실은 항상 시트라는
// 원칙 그대로, 이 미러는 지워져도 안전한 캐시다.

export interface CatalogCopyRow {
  copyId: string;
  barcode: string;
  titleId: string;
  title: string;
  authors: string;
  classification: string;
  statusCode: string;
  loanCount: number;
  lastLoanAt: string;
  shelfCode: string;
  acquiredAt: string;
  /** max(copy.updated_at, title.updated_at) — 표시·디버그용. 델타 커서 자체는 이 필드가 아니라
   *  서버가 응답마다 함께 내려주는 serverTime을 쓴다(아래 CatalogSyncResponse 참고). */
  updatedAt: string;
}

interface CatalogSyncResponse {
  rows: CatalogCopyRow[];
  hasMore: boolean;
  serverTime: string;
  totalCopies: number;
}

const DB_NAME = 'lib-catalog-mirror';
// v1 스텁의 title 중심 스토어(titles)에서 copy 중심(copies)으로 스키마가 바뀌어 버전을 올린다.
const DB_VERSION = 2;
const STORE_COPIES = 'copies';
const STORE_META = 'meta';
const CURSOR_KEY = 'cursor';
// 서버 apiWebCatalogSync_의 캡(CATALOG_SYNC_MAX_LIMIT_)과 동일하게 맞춘 청크 크기.
const SYNC_CHUNK_LIMIT = 1000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      // 구버전 title 중심 스토어는 스키마가 달라 재사용하지 않는다 — 재동기화로 복구되는
      // 캐시일 뿐이므로 지워도 안전하다(FRONTEND.md).
      if (event.oldVersion > 0 && event.oldVersion < 2 && db.objectStoreNames.contains('titles')) {
        db.deleteObjectStore('titles');
      }
      if (!db.objectStoreNames.contains(STORE_COPIES)) db.createObjectStore(STORE_COPIES, { keyPath: 'copyId' });
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllCached(): Promise<CatalogCopyRow[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_COPIES, 'readonly').objectStore(STORE_COPIES).getAll() as IDBRequest<CatalogCopyRow[]>;
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putRows(rows: CatalogCopyRow[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_COPIES, 'readwrite');
    const store = tx.objectStore(STORE_COPIES);
    rows.forEach((row) => store.put(row));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getCursor(): Promise<string | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_META, 'readonly').objectStore(STORE_META).get(CURSOR_KEY) as IDBRequest<
      { key: string; afterUpdatedAt: string } | undefined
    >;
    req.onsuccess = () => resolve(req.result?.afterUpdatedAt);
    req.onerror = () => reject(req.error);
  });
}

async function setCursor(afterUpdatedAt: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({ key: CURSOR_KEY, afterUpdatedAt });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export interface CatalogSyncState {
  /** 미러 전체(필터·정렬 전) — DataTable이 이 배열을 그대로 받아 로컬에서 처리한다. */
  rows: CatalogCopyRow[];
  /** 배경 동기화 진행 중 여부 — true여도 rows는 이미 캐시된 값을 즉시 보여준다(progressive). */
  syncing: boolean;
  syncedCount: number;
  /** 전체 소장본 수 힌트("동기화 중 N/전체") — 서버가 매 응답에 함께 내려주는 totalCopies. */
  totalHint: number | null;
  /** true = catalogSync가 아직 UNKNOWN_ACTION(재배포 전)이라 목데이터로 표시 중. */
  sample: boolean;
  error: string | null;
}

const rowsById = new Map<string, CatalogCopyRow>();
let state: CatalogSyncState = { rows: [], syncing: false, syncedCount: 0, totalHint: null, sample: false, error: null };
const listeners = new Set<(s: CatalogSyncState) => void>();
let initialized = false;
let syncInFlight: Promise<void> | null = null;

function setState(patch: Partial<CatalogSyncState>): void {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
}

function applyRows(rows: CatalogCopyRow[]): void {
  rows.forEach((row) => rowsById.set(row.copyId, row));
  setState({ rows: Array.from(rowsById.values()) });
}

export function getCatalogState(): CatalogSyncState {
  return state;
}

export function onCatalogState(fn: (s: CatalogSyncState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function backgroundSync(): Promise<void> {
  if (syncInFlight) return syncInFlight;
  const promise = (async () => {
    setState({ syncing: true, error: null });
    // todo/38: putRows/setCursor(IndexedDB)가 쿼터 초과 등으로 reject되면 이전에는 catch가
    // 없어 syncing:true로 영구 고착 + 오류 배너도 없었다(catalog·search·inventory가 "동기화
    // 중"에 멈춘 것처럼 보임). 실패를 화면 오류로 노출하고 syncing은 반드시 해제한다 —
    // 다음 진입(ensureCatalogSync)이 자연 재시도. 미러는 재동기화로 복구되는 캐시일 뿐이라
    // (FRONTEND.md) 부분 실패가 데이터 유실이 되진 않는다(커서 미전진 → 같은 청크 재요청).
    try {
    let hasMore = true;
    let cursor = await getCursor();
    let syncedCount = 0;
    while (hasMore) {
      const res = await apiCall<CatalogSyncResponse>('catalogSync', {
        afterUpdatedAt: cursor,
        limit: SYNC_CHUNK_LIMIT
      });
      if (!res.ok) {
        if (res.error.code === 'UNKNOWN_ACTION') {
          // 배포 전(재배포 전 정상 상태 — todo/04 「샘플 폴백」과 같은 규약). 미러가 이미 실제
          // 동기화로 채워져 있으면 그 값을 그대로 두고(진짜 데이터를 가짜로 덮지 않는다), 완전히
          // 비어 있을 때만 목데이터로 표시한다. 완료 조건("5,000행에서 정렬/페이지 즉답")을 개발
          // 중에도 확인할 수 있도록 목데이터 규모를 5,000행으로 맞춘다(mocks/catalog.ts).
          if (rowsById.size === 0) {
            const mock = generateMockCatalog(5000);
            mock.forEach((row) => rowsById.set(row.copyId, row));
            setState({ rows: Array.from(rowsById.values()), sample: true });
          }
        } else {
          setState({ error: res.error.message || res.error.code });
        }
        hasMore = false;
        break;
      }
      applyRows(res.data.rows);
      syncedCount += res.data.rows.length;
      setState({ syncedCount, totalHint: res.data.totalCopies });
      // 순서 중요: 행을 먼저 영속화한 뒤에야 커서를 전진시킨다. 반대로 하면(커서 먼저) 중간에
      // 탭이 닫히는 등으로 putRows가 못 끝났을 때 "이미 다 받은 걸로 착각한 커서"가 남아 —
      // 다음 실행이 이 청크를 다시 요청하지 않아 그 행들이 영구 유실된다(재동기화로 복구되는
      // 캐시라는 전제가 깨짐). put()은 copyId 키로 덮어쓰기라 같은 청크를 다시 받아도 안전
      // (멱등) — 그러니 실패 시 손해를 보는 쪽은 항상 "커서 미전진 + 재요청"이어야 한다.
      await putRows(res.data.rows);
      cursor = res.data.serverTime;
      await setCursor(cursor);
      hasMore = res.data.hasMore;
    }
    } catch (err) {
      setState({ error: String((err as Error)?.message ?? err) });
    } finally {
      setState({ syncing: false });
    }
  })();
  syncInFlight = promise;
  try {
    await promise;
  } finally {
    syncInFlight = null;
  }
}

/** catalog 뷰 마운트 시 호출 — 캐시를 즉시 보여주고(progressive), 백그라운드에서 델타 동기화한다.
 *  여러 번 불러도 안전(이미 초기화됐으면 배경 동기화만 다시 트리거). */
export function ensureCatalogSync(): void {
  if (initialized) {
    if (!syncInFlight) void backgroundSync();
    return;
  }
  initialized = true;
  void (async () => {
    const cached = await getAllCached();
    if (cached.length > 0) applyRows(cached);
    await backgroundSync();
  })();
}

/** dashboardData.ts의 useDashboardData()와 같은 구독 훅 패턴. */
export function useCatalogSync(): CatalogSyncState {
  const [snapshot, setSnapshot] = useState<CatalogSyncState>(() => getCatalogState());
  useEffect(() => onCatalogState(setSnapshot), []);
  return snapshot;
}
