import { apiCall } from './api';

// "검색은 브라우저에서, GAS 0회" — 카탈로그를 IndexedDB에 미러링해두고 검색 자체는
// 네트워크 없이 처리한다. v1의 search 뷰는 스텁이라 이 서비스도 최소 골격만 갖춘다.
//
// ⚠️ 알려진 공백: 미러를 채울 서버 액션(예: syncCatalog)이 아직 doPost에 없다
// (school-patch-v1/Code.gs doPost는 lookupIsbn/registerByIsbn만 처리 — 백엔드 수정은 이 작업 범위 밖).
// syncFromServer()는 그 공백을 감추지 않고 UNKNOWN_ACTION을 그대로 드러낸다.
export interface CatalogEntry {
  titleId: string;
  isbn: string;
  title: string;
  authors: string;
  publisher: string;
  copies: { copyId: string; barcode: string; statusCode: string }[];
  syncedAt: number;
}

const DB_NAME = 'lib-catalog-mirror';
const STORE = 'titles';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'titleId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllCached(): Promise<CatalogEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll() as IDBRequest<CatalogEntry[]>;
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function searchCached(query: string): Promise<CatalogEntry[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const all = await getAllCached();
  return all.filter(
    (entry) =>
      entry.title.toLowerCase().includes(q) ||
      entry.authors.toLowerCase().includes(q) ||
      entry.isbn.includes(q) ||
      entry.copies.some((c) => c.barcode.includes(q))
  );
}

/** 서버 syncCatalog 액션이 추가되면 이 함수가 자연히 동작한다 — 지금은 UNKNOWN_ACTION을 그대로 반환. */
export async function syncFromServer(): Promise<{ ok: boolean; count: number; errorCode?: string }> {
  const res = await apiCall<{ entries: CatalogEntry[] }>('syncCatalog', {});
  if (!res.ok) return { ok: false, count: 0, errorCode: res.error.code };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    res.data.entries.forEach((entry) => store.put(entry));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return { ok: true, count: res.data.entries.length };
}
