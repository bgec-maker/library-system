import { apiCall } from './api';

// 공지 데이터 서비스 — todo/137. 서버 계약: apiWebNotices_(Code.gs, todo/136).
// 저장은 23_NOTICES 시트(관리자가 행 추가 = 즉시 게시), 표시는 도움말 뷰.

export interface NoticeItem {
  noticeId: string;
  title: string;
  body: string;
  level: 'INFO' | 'WARN';
  pinned: boolean;
  /** 서버가 formatDateTime_로 포맷한 문자열('yyyy-MM-dd HH:mm') — 정렬·lastSeen 비교에도 그대로 사용 */
  createdAt: string;
}

export type NoticesOutcome =
  | { ok: true; notices: NoticeItem[]; sheetReady: boolean }
  | { ok: false; unavailable: true }
  | { ok: false; unavailable?: false; message: string };

/** 재배포 전(UNKNOWN_ACTION) → unavailable: 도움말 뷰는 공지 섹션에 안내 한 줄만 남기고
 *  사용법 가이드는 정상 표시한다(탭의 가치가 배포에 볼모잡히지 않게). 샘플 공지 폴백 금지 —
 *  가짜 공지는 실제 공지보다 해롭다. */
export async function fetchNotices(): Promise<NoticesOutcome> {
  const res = await apiCall<{ notices: NoticeItem[]; sheetReady: boolean }>('notices', {});
  if (res.ok) return { ok: true, notices: res.data.notices, sheetReady: res.data.sheetReady };
  if (res.error.code === 'UNKNOWN_ACTION') return { ok: false, unavailable: true };
  return { ok: false, message: res.error.message || res.error.code };
}

const LAST_SEEN_KEY = 'notices:lastSeen';

export function getNoticesLastSeen(): string {
  try {
    return localStorage.getItem(LAST_SEEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function markNoticesSeen(notices: NoticeItem[]): void {
  const latest = notices.reduce((max, n) => (n.createdAt > max ? n.createdAt : max), '');
  if (!latest) return;
  try {
    localStorage.setItem(LAST_SEEN_KEY, latest);
  } catch {
    /* 사생활 모드 등 — 다음 부팅에 토스트가 한 번 더 뜰 뿐 */
  }
}

/** 부팅 시 새 공지 확인 — 셸이 1회 호출(타이머 없음). 새 공지가 있으면 가장 최신 제목을
 *  돌려준다(토스트 문구는 호출측 i18n 몫). lastSeen 갱신은 도움말 열람 시에만 — 토스트를
 *  본 것과 공지를 읽은 것은 다르다. */
export async function checkNewNoticesOnBoot(): Promise<NoticeItem | null> {
  const res = await fetchNotices();
  if (!res.ok || res.notices.length === 0) return null;
  const lastSeen = getNoticesLastSeen();
  const fresh = res.notices.filter((n) => n.createdAt && n.createdAt > lastSeen);
  if (fresh.length === 0) return null;
  return fresh.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
}
