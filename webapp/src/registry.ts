import { ArrowLeftRight, BookOpen, BookPlus, ClipboardCheck, History, Search } from 'lucide-react';
import type { ViewMeta } from './types';

// ★ 단일 원천 — 셸(도크 아이콘·탭·창 목록)은 전부 이 배열을 읽어 렌더링한다.
// 뷰 추가 = 여기 한 줄 + src/views/<id>/ 폴더 하나. (FRONTEND.md #ViewRegistry)
export const VIEW_REGISTRY: ViewMeta[] = [
  {
    id: 'loan-return',
    title: '대출·반납',
    icon: ArrowLeftRight,
    roles: ['LIBRARIAN', 'STATION'],
    scan: 'focus',
    desktop: { min: [420, 620], single: true },
    mobile: { tab: 0 }
  },
  {
    id: 'register',
    title: '도서 등록',
    icon: BookPlus,
    roles: ['LIBRARIAN'],
    scan: 'focus',
    desktop: { min: [420, 680], single: true },
    mobile: { tab: 1 }
  },
  {
    id: 'search',
    title: '통합 검색',
    icon: Search,
    roles: ['LIBRARIAN'],
    scan: 'none',
    desktop: { min: [480, 560] },
    mobile: { tab: 2 }
  },
  {
    id: 'inventory',
    title: '장서 점검',
    icon: ClipboardCheck,
    roles: ['LIBRARIAN'],
    scan: 'focus',
    desktop: { min: [560, 480], single: true },
    mobile: {}
  },
  {
    id: 'book-detail',
    title: '도서 상세',
    icon: BookOpen,
    roles: ['LIBRARIAN'],
    scan: 'none',
    desktop: { min: [420, 560] },
    mobile: {}
  },
  {
    id: 'recent-ops',
    title: '최근 처리',
    icon: History,
    roles: ['LIBRARIAN'],
    scan: 'none',
    desktop: { min: [460, 420] },
    mobile: {}
  }
];

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
