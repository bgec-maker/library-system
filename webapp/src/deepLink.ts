import type { ViewId } from './types';
import { getViewMeta } from './registry';

// FRONTEND.md 「라우팅」: "hash 라우터... 딥링크: #/b/0001234(학생 책 페이지), #/w/loan-return
// (뷰 직행)". #/b/는 boot.tsx(isStudentRoute)가 이미 처리하지만 #/w/<뷰id>?<쿼리> 쪽은 todo/11
// 전까지 파싱 코드가 전혀 없었다 — book-detail의 완료 조건("등록번호로 딥링크
// #/w/book-detail?copy=… 동작")이 이걸 실제로 요구한다.
//
// 이 모듈은 셸이 공유하는 순수 파싱 유틸이다. src/views/** 안이 아니므로 check-view-boundary.mjs
// 대상이 아니고(뷰는 셸을 모른다 원칙은 "뷰가 셸에 접근"을 막는 것이지 셸 계층 유틸의 존재를
// 막지 않는다), window.location.hash를 직접 읽어도 무방하다. boot.tsx가 데스크톱/모바일 셸 중
// 하나만 골라 마운트하므로(FRONTEND.md "셸은 부팅 시 하나만 선택"), 파싱 로직은 여기 한 곳에
// 두고 DesktopShell·MobileShell 양쪽이 각자 마운트 시 호출해 자신의 오픈 메커니즘
// (useWindowStore.openWindow / StackNav.push)으로 연다 — DRY, 셸별 중복 구현 없음.
export interface WindowDeepLinkTarget {
  viewId: ViewId;
  params: Record<string, string>;
}

const HASH_PATTERN = /^#\/w\/([a-zA-Z0-9-]+)(?:\?(.*))?$/;

/** "#/w/book-detail?copy=0001234" → { viewId:'book-detail', params:{copy:'0001234'} }.
 *  레지스트리에 없는 viewId(오타·구버전 링크)나 패턴 자체가 안 맞으면 null — 셸이 조용히 무시한다. */
export function parseWindowDeepLinkHash(hash: string): WindowDeepLinkTarget | null {
  const match = HASH_PATTERN.exec(hash);
  if (!match) return null;
  const viewId = match[1];
  if (!getViewMeta(viewId)) return null;
  const params: Record<string, string> = {};
  if (match[2]) {
    new URLSearchParams(match[2]).forEach((value, key) => {
      params[key] = value;
    });
  }
  return { viewId: viewId as ViewId, params };
}

/** 현재 주소창 해시가 가리키는 딥링크(있으면) — 부작용 없음. 해시를 지우지 않는다: 새로고침해도
 *  같은 창이 다시 열리는 편이 "링크를 열었더니 다음 새로고침에 사라진다"보다 덜 놀랍다. */
export function currentWindowDeepLink(): WindowDeepLinkTarget | null {
  return parseWindowDeepLinkHash(window.location.hash);
}

/** 마운트 이후 hashchange로 들어오는 딥링크까지 계속 반영하고 싶을 때 구독
 *  (예: 앱이 이미 떠 있는 탭에서 주소창에 새 #/w/... 값을 붙여넣는 드문 경우). */
export function subscribeWindowDeepLink(handler: (target: WindowDeepLinkTarget) => void): () => void {
  function onHashChange() {
    const target = parseWindowDeepLinkHash(window.location.hash);
    if (target) handler(target);
  }
  window.addEventListener('hashchange', onHashChange);
  return () => window.removeEventListener('hashchange', onHashChange);
}
