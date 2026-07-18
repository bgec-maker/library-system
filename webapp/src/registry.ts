import { ArrowLeftRight, BellRing, BookOpen, BookPlus, ClipboardCheck, FileText, History, Library, Search, SlidersHorizontal } from 'lucide-react';
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
  catalog: 'registry.catalog.title',
  'book-detail': 'registry.bookDetail.title',
  'recent-ops': 'registry.recentOps.title',
  reports: 'registry.reports.title',
  reservations: 'registry.reservations.title',
  settings: 'registry.settings.title'
};

export const VIEW_REGISTRY: ViewMeta[] = [
  {
    id: 'loan-return',
    title: t(TITLE_KEYS['loan-return']),
    icon: ArrowLeftRight,
    roles: ['LIBRARIAN', 'STATION'],
    scan: 'focus',
    // todo/49(디자인 연구 P3-1): 기본 크기=min이므로 콘텐츠 실측에 맞춰 620→520(하단 여백 절반 제거).
    desktop: { min: [420, 520], single: true },
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
    // todo/15 — 이전엔 scan:'none'이라 검색 뷰가 포커스/핀 상태여도 스캔 이벤트를 못 받았다.
    // book-detail(todo/11)과 같은 이유로 'focus'로 전환: "검색 뷰 포커스 중 스캔 → 해당 도서로"
    // 완료 조건 때문이다(뷰 안 scanBus 구독, views/search/index.tsx) — 유효 책 스캔이 오면
    // book-detail로 이동한다(카탈로그 행 클릭과 같은 내비게이션, 목록 화면이라 book-detail처럼
    // "제자리 갱신"이 아니라 "이동"을 택했다 — docs/ASSUMPTIONS.md `## todo/15` 참고).
    id: 'search',
    title: t(TITLE_KEYS.search),
    icon: Search,
    roles: ['LIBRARIAN'],
    scan: 'focus',
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
    // FRONTEND.md 「catalog(장서 대장) 뷰」(ADR-024) — 정본은 IndexedDB 미러, 서버는 catalogSync
    // 청크 동기화만. 데이터 밀도가 높은 표라 desktop.min을 다른 뷰보다 넉넉히 준다. 모바일
    // 탭 슬롯 없음 — inventory·recent-ops·reports와 같은 「더보기」 경로로 도달한다.
    id: 'catalog',
    title: t(TITLE_KEYS.catalog),
    icon: Library,
    roles: ['LIBRARIAN'],
    scan: 'none',
    desktop: { min: [720, 560] },
    mobile: {}
  },
  {
    // todo/11 — 이전엔 scan:'none'이라 이 창이 스캔 이벤트를 아예 못 받았다(Window.tsx의 핀
    // 버튼도 meta?.scan === 'focus'에서만 렌더돼 book-detail은 핀조차 불가능했다). FRONTEND.md
    // "진입: catalog 행·검색 결과·스캔(핀 시)" 완료 조건 때문에 'focus'로 전환 — 포커스/핀
    // 상태일 때 다른 책을 스캔하면 이 창 자체가 그 책으로 갱신된다(뷰 안 scanBus 구독, index.tsx).
    id: 'book-detail',
    title: t(TITLE_KEYS['book-detail']),
    icon: BookOpen,
    roles: ['LIBRARIAN'],
    scan: 'focus',
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
  },
  {
    // FEATURES.md R1 "리포트 허브" — 대시보드 「조용한 신호」의 각 줄이 여기로 직행한다
    // (params.type으로 어떤 리포트인지 전달). todo/05가 실제 종류 선택→미리보기→인쇄를 채운다 —
    // 지금은 레지스트리/라우팅만 마련해 신호 버튼이 죽은 버튼이 되지 않게 한다.
    id: 'reports',
    title: t(TITLE_KEYS.reports),
    icon: FileText,
    roles: ['LIBRARIAN'],
    scan: 'none',
    desktop: { min: [560, 520] },
    mobile: {}
  },
  {
    // 예약 관리(reservations, todo/12) — 걸기(book-detail의 「예약」 버튼)·자동배정(반납 시
    // reserve_/checkout_/return_ 안에서 이미 처리됨, 이 뷰는 새 쓰기 로직이 아니라 그 결과를
    // 보여주는 관리 뷰다)의 대기/도착 현황을 DataTable로 본다. catalog·recent-ops·reports와
    // 같은 「더보기」 경로(모바일 탭 슬롯 없음).
    id: 'reservations',
    title: t(TITLE_KEYS.reservations),
    icon: BellRing,
    roles: ['LIBRARIAN'],
    scan: 'none',
    desktop: { min: [640, 520] },
    mobile: {}
  },
  {
    // 설정(settings, todo/26) — POLICIES/CONFIG 읽기 전용 열람 + 무결성 점검·서지 보강 실행
    // 버튼. LIBRARIAN 전용(STATION 세션엔 아예 노출되지 않음, viewsForRole()의 roles 필터가
    // 유일한 접근 통제 지점 — 별도 가드를 새로 만들지 않는다). 아이콘은 SlidersHorizontal —
    // MobileShell.tsx의 기어(Settings, 접속 설정 다이얼로그를 여는 셸 버튼)와 혼동되지 않도록
    // 의도적으로 다른 아이콘을 골랐다(docs/ASSUMPTIONS.md `## todo/26` 참고).
    id: 'settings',
    title: t(TITLE_KEYS.settings),
    icon: SlidersHorizontal,
    roles: ['LIBRARIAN'],
    scan: 'none',
    desktop: { min: [560, 560] },
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
