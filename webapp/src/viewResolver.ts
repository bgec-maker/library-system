import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { ViewId, ViewProps } from './types';

// 셸(desktop/mobile) 공통 뷰 로더 — "같은 뷰 파일이 두 셸에서 렌더"를 보장하는 지점.
// 각 src/views/<id>/index.tsx는 반드시 `export default function X({ shell, params }: ViewProps)`
// 형태로 기본 export해야 한다.
export const VIEW_COMPONENTS: Record<ViewId, LazyExoticComponent<ComponentType<ViewProps>>> = {
  'loan-return': lazy(() => import('./views/loan-return')),
  register: lazy(() => import('./views/register')),
  search: lazy(() => import('./views/search')),
  inventory: lazy(() => import('./views/inventory')),
  'book-detail': lazy(() => import('./views/book-detail')),
  'recent-ops': lazy(() => import('./views/recent-ops')),
  reports: lazy(() => import('./views/reports'))
};
