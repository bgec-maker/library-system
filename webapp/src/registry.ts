import { ArrowLeftRight, BookOpen, BookPlus, ClipboardCheck, History, Search } from 'lucide-react';
import type { ViewId, ViewMeta } from './types';
import { subscribeLocale, t } from './i18n';

// ★ 단일 원천 — 셸(도크 아이콘·탭·창 목록)은 전부 이 배열을 읽어 렌더링한다.
// 뷰 추가 = 여기 한 줄 + src/views/<id>/ 폴더 하나. (FRONTEND.md #ViewRegistry)
//
// 다국어(ADR-023): ViewMeta.title 타입 계약(types.ts: "이 파일은 셸·뷰·서비스 모두가 참조하는
// 계약이므로 함부로 넓히지 않는다")은 그대로 `string`으로 유지한다 — 대신 로케일이 바뀔 때마다
// 아래 subscribeLocale 콜백이 이미 존재하는 객체들의 title 필드를 제자리에서(mutate) 갱신한다.
// 배열·객체 참조가 그대로라 useMemo로 캐싱한 소비자(MobileShell 등)도 다음 렌더에서 새 값을
// 그대로 읽는다 — 타입을 함수로 넓히거나 소비자들을 고치지 않고도 토글이 즉시 반영된다.
const TITLE_KEYS: Record<ViewId, string> = {
  'loan-return': 'registry.loanReturn.title',
  register: 'registry.register.title',
  search: 'registry.search.title',
  inventory: 'registry.inventory.title',
  'book-detail': 'registry.bookDetail.title',
  'recent-ops': 'registry.recentOps.title'
};

export const VIEW_REGISTRY: ViewMeta[] = [
  {
    id: 'loan-return',
    title: t(TITLE_KEYS['loan-return']),
    icon: ArrowLeftRight,
    roles: ['LIBRARIAN', 'STATION'],
    scan: 'focus',
    desktop: { min: [420, 620], single: true },
    mobile: { tab: 0 }
  },
  {
    id: 'register',
    title: t(TITLE_KEYS.register),
    icon: BookPlus,
    roles: ['LIBRARIAN'],
    scan: 'focus',
    desktop: { min: [420, 680], single: true },
    mobile: { tab: 1 }
  },
  {
    id: 'search',
    title: t(TITLE_KEYS.search),
    icon: Search,
    roles: ['LIBRARIAN'],
    scan: 'none',
    desktop: { min: [480, 560] },
    mobile: { tab: 2 }
  },
  {
    id: 'inventory',
    title: t(TITLE_KEYS.inventory),
    icon: ClipboardCheck,
    roles: ['LIBRARIAN'],
    scan: 'focus',
    desktop: { min: [560, 480], single: true },
    mobile: {}
  },
  {
    id: 'book-detail',
    title: t(TITLE_KEYS['book-detail']),
    icon: BookOpen,
    roles: ['LIBRARIAN'],
    scan: 'none',
    desktop: { min: [420, 560] },
    mobile: {}
  },
  {
    id: 'recent-ops',
    title: t(TITLE_KEYS['recent-ops']),
    icon: History,
    roles: ['LIBRARIAN'],
    scan: 'none',
    desktop: { min: [460, 420] },
    mobile: {}
  }
];

subscribeLocale(() => {
  for (const meta of VIEW_REGISTRY) {
    meta.title = t(TITLE_KEYS[meta.id]);
  }
});

export function getViewMeta(id: string): ViewMeta | undefined {
  return VIEW_REGISTRY.find((v) => v.id === id);
}

export function viewsForRole(role: 'LIBRARIAN' | 'STATION'): ViewMeta[] {
  return VIEW_REGISTRY.filter((v) => v.roles.includes(role));
}

export function mobileTabViews(role: 'LIBRARIAN' | 'STATION'): ViewMeta[] {
  return viewsForRole(role)
    .filter((v) => v.mobile.tab !== undefined)
    .sort((a, b) => (a.mobile.tab ?? 0) - (b.mobile.tab ?? 0));
}

export function moreMenuViews(role: 'LIBRARIAN' | 'STATION'): ViewMeta[] {
  return viewsForRole(role).filter((v) => v.mobile.tab === undefined && v.id !== 'book-detail');
}
