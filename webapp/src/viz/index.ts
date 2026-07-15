import { lazy } from 'react';

// src/viz/ 계층 단일 진입점 — docs/VIZ.md 구현 노트("views가 아니라 별도 계층, 셸·뷰 어디서든
// 재사용") + 완료 조건 "지연 로딩". viewResolver.ts의 VIEW_COMPONENTS와 같은 패턴: 각 차트를
// React.lazy()로 감싸 JS 청크를 메인 번들에서 분리한다(work 번들 예산 보호). 소비자(셸의
// DashboardBaseLayer.tsx, 뷰의 views/reports/index.tsx)는 이 lazy 컴포넌트를 <Suspense>로
// 감싸 렌더하면 된다 — VizLazyMount가 뷰포트 진입 전까지는 그 마운트 자체를 미룬다.
export const LoanHeatmap = lazy(() => import('./LoanHeatmap'));
export const CategoryTreemap = lazy(() => import('./CategoryTreemap'));
export const TurnoverQuadrant = lazy(() => import('./TurnoverQuadrant'));
export const ReservationPressure = lazy(() => import('./ReservationPressure'));

// todo/18 — VIZ.md V1 2·8·10·12번(하루의 파도·연체 흐름·반 참여 링·열두 달 곡선). 위 4종과
// 같은 패턴 그대로(React.lazy() 청크 분리).
export const LoanTimeOfDay = lazy(() => import('./LoanTimeOfDay'));
export const OverdueFlow = lazy(() => import('./OverdueFlow'));
export const ClassParticipation = lazy(() => import('./ClassParticipation'));
export const MonthlyLoanCurve = lazy(() => import('./MonthlyLoanCurve'));

export { VizLazyMount } from './VizLazyMount';
