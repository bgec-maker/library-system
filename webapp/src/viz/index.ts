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

// todo/19 — VIZ.md V1 4·5·9·11번(서가 온도·장서 나이·학년 독서 격차·예산 그림). 이걸로 V1
// 12종 전체가 이 지연 로딩 계약 아래 모였다 — 위 8종과 같은 패턴 그대로.
export const ShelfHeatmap = lazy(() => import('./ShelfHeatmap'));
export const CollectionAge = lazy(() => import('./CollectionAge'));
export const GradeReadingGap = lazy(() => import('./GradeReadingGap'));
export const BudgetPicture = lazy(() => import('./BudgetPicture'));

export { VizLazyMount } from './VizLazyMount';
