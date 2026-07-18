import { useEffect, useState } from 'react';
import { cachedApiCall } from './readCache';
import {
  mockBudgetPicture,
  mockCategoryTreemap,
  mockClassParticipation,
  mockCollectionAge,
  mockGradeReadingGap,
  mockLoanHeatmap,
  mockLoanTimeOfDay,
  mockMonthlyLoanCurve,
  mockOverdueFlow,
  mockReservationPressure,
  mockShelfHeatmap,
  mockTurnoverQuadrant
} from '../mocks/viz';

// FEATURES.md/VIZ.md 시각화 V1(todo/06) 데이터 계층 — services/reportData.ts와 같은
// UNKNOWN_ACTION→샘플 폴백 규약을 재사용한다(SampleDataBadge.tsx 그대로 씀). 리포트처럼
// 온디맨드가 아니라 "차트가 화면에 뜰 때 그 차트 하나만 조회"하는 패턴이라 useVizData 훅
// 하나로 4종 모두를 커버한다(과설계 방지 — 대시보드처럼 5분 인터벌 자동 갱신은 두지 않는다:
// VIZ_CACHE는 서버 일배치(dailyVizBatch)로만 하루 한 번 바뀌므로 폴링할 이유가 없다).
//
// school-patch-v1/Code.gs apiWebViz_()가 돌려주는 모양({type, computedAt, data})을 그대로
// 옮긴 타입 — 백엔드 함수는 수정하지 않으므로(절대 규칙) data의 4가지 하위 타입도 그
// 반환값(computeLoanHeatmapViz_/computeCategoryTreemapViz_/computeTurnoverQuadrantViz_/
// computeReservationPressureViz_)에 맞춰져 있다.

// todo/18 — 4종 추가: 하루의 파도·연체 흐름·반 참여 링·열두 달 곡선(VIZ.md V1 2·8·10·12번).
// 앞 4종(todo/06)과 같은 계약 모양(useVizData 훅 하나로 8종 전부 커버) — apiWebViz_가 돌려주는
// {type, computedAt, data} 모양을 그대로 옮긴 타입이며 school-patch-v1/Code.gs의
// computeLoanTimeOfDayViz_/computeOverdueFlowViz_/computeClassParticipationViz_/
// computeMonthlyLoanCurveViz_ 반환값에 맞춰져 있다.
//
// todo/19 — 마지막 4종 추가: 서가 온도·장서 나이·학년 독서 격차·예산 그림(VIZ.md V1 4·5·9·11번).
// 이걸로 V1 12종 전체가 이 계약에 다 모였다 — school-patch-v1/Code.gs의
// computeShelfHeatmapViz_/computeCollectionAgeViz_/computeGradeReadingGapViz_/
// computeBudgetViz_ 반환값에 맞춰져 있다.
export type VizType =
  | 'loan-heatmap'
  | 'category-treemap'
  | 'turnover-quadrant'
  | 'reservation-pressure'
  | 'loan-time-of-day'
  | 'overdue-flow'
  | 'class-participation'
  | 'monthly-loan-curve'
  | 'shelf-heatmap'
  | 'collection-age'
  | 'grade-reading-gap'
  | 'budget-picture';

export interface VizDay {
  /** yyyy-MM-dd */
  date: string;
  count: number;
}

export interface LoanHeatmapData {
  days: VizDay[];
}

export interface CategoryTreemapEntry {
  categoryCode: string;
  categoryLabel: string;
  copyCount: number;
  loanCount: number;
}

export interface CategoryTreemapData {
  categories: CategoryTreemapEntry[];
}

export interface TurnoverCell {
  loanBucketIndex: number;
  ageBucketIndex: number;
  count: number;
}

export interface TurnoverQuadrantData {
  /** 버킷 라벨 6단 — computeTurnoverQuadrantViz_ 그대로(예: '0회'…'11회+'). */
  loanBuckets: string[];
  /** 버킷 라벨 5단 — computeTurnoverQuadrantViz_ 그대로(예: '90일 미만'…'4년 이상'). */
  ageBuckets: string[];
  cells: TurnoverCell[];
  totalCopies: number;
  skippedNoAcquiredDate: number;
}

export interface ReservationPressureTitle {
  titleId: string;
  title: string;
  queueLength: number;
  /** 최근 6주 · 7일 창 단위 신규 예약 건수(오래된 순) — 스파크라인 원재료. */
  trend: number[];
}

export interface ReservationPressureData {
  titles: ReservationPressureTitle[];
}

// #2 하루의 파도 — computeLoanTimeOfDayViz_ 그대로(hour 0~23).
export interface LoanTimeOfDayHour {
  hour: number;
  count: number;
}

export interface LoanTimeOfDayData {
  hours: LoanTimeOfDayHour[];
}

// #8 연체 흐름 — computeOverdueFlowViz_ 그대로. occurredCount/resolvedCount의 정확한 정의는
// Code.gs computeOverdueFlowViz_ 주석 참고(요약: 발생=그 주에 처음 연체로 넘어간 대출 수 —
// due_at 기준, 해소=그 주에 연체 상태로 반납된 대출 수 — returned_at 기준).
export interface OverdueFlowWeek {
  /** yyyy-MM-dd(그 주의 시작일). */
  weekStart: string;
  occurredCount: number;
  resolvedCount: number;
}

export interface OverdueFlowData {
  weeks: OverdueFlowWeek[];
}

// #10 반 참여 링 — computeClassParticipationViz_ 그대로. noLoanRatio는 "미대출 비율"
// (높을수록 참여가 낮다) — 프론트가 링을 채울 때만 1 - noLoanRatio로 뒤집어 쓴다.
export interface ClassParticipationClass {
  grade: number;
  classNo: number;
  studentCount: number;
  noLoanCount: number;
  /** 0~1, 미대출 학생 비율 — 높을수록 참여가 낮다(VIZ.md "반별 미대출 비율" 그대로). */
  noLoanRatio: number;
}

export interface ClassParticipationData {
  /** yyyy-MM-dd — 무대출 판정 기준 시작일(최근 90일). */
  sinceDate: string;
  classes: ClassParticipationClass[];
}

// #12 열두 달 곡선 — computeMonthlyLoanCurveViz_ 그대로. months는 항상 12칸(1월=index0).
export interface MonthlyLoanCurveYear {
  year: number;
  months: number[];
}

export interface MonthlyLoanCurveData {
  years: MonthlyLoanCurveYear[];
}

// #4 서가 온도 — computeShelfHeatmapViz_ 그대로. avgLoansPerCopy는 서버가 미리 나눈 값이라
// 프론트는 0으로 나누는 경우를 신경 쓰지 않아도 된다.
export interface ShelfHeatmapShelf {
  shelfCode: string;
  copyCount: number;
  totalLoanCount: number;
  avgLoansPerCopy: number;
}

export interface ShelfHeatmapData {
  shelves: ShelfHeatmapShelf[];
  /** shelf_code가 빈 소장본 수 — 각주 표시용(회전율 사분면의 skippedNoAcquiredDate와 같은 관례). */
  skippedNoShelf: number;
}

// #5 장서 나이 — computeCollectionAgeViz_ 그대로. statusOrder는 08_COPIES status_code 검증
// 배열과 같은 순서(AVAILABLE·ON_LOAN·HOLD_READY·REPAIR·LOST·WITHDRAWN) — DESIGN.md 범주(≤6)
// 고정 팔레트에 정확히 맞는 6종이다.
export interface CollectionAgeYear {
  year: number;
  statusCounts: Record<string, number>;
}

export interface CollectionAgeData {
  statusOrder: string[];
  years: CollectionAgeYear[];
  skippedNoAcquiredDate: number;
  /** "미점검" 재점검 임계 일수(서버 VIZ_COLLECTION_AGE_STALE_INSPECTION_DAYS_ 그대로). */
  staleInspectionDays: number;
  /** 현재 유통 중인 소장본 중 그 임계일보다 오래 미점검된 개수 — 색 계열이 아니라 요약 숫자로만. */
  staleUncheckedCount: number;
}

// #9 학년 독서 격차 — computeGradeReadingGapViz_ 그대로. buckets는 서버가 이미 만든 4단
// 라벨(예: '0회'…'11회+') — vizBucketIndex_와 같은 순서라 bucketCounts[i]가 buckets[i]에 대응.
export interface GradeReadingGapGrade {
  grade: number;
  studentCount: number;
  bucketCounts: number[];
}

export interface GradeReadingGapData {
  sinceDate: string;
  windowDays: number;
  buckets: string[];
  grades: GradeReadingGapGrade[];
}

// #11 예산 그림 — computeBudgetViz_ 그대로. sourceOrder는 누적 금액 상위 5개 + (있다면) "그 외
// 출처" 순서로 고정돼 있어(≤6, DESIGN.md 범주 고정 팔레트 한도) 프론트는 이 순서 그대로 색을
// 배정하면 된다. sources[i].sourceLabel은 항상 sourceOrder[i]와 같다.
export interface BudgetPictureSourceAmount {
  sourceLabel: string;
  amount: number;
}

export interface BudgetPictureYear {
  year: number;
  total: number;
  sources: BudgetPictureSourceAmount[];
}

export interface BudgetPictureData {
  sourceOrder: string[];
  years: BudgetPictureYear[];
  skippedNoSource: number;
  skippedNoAcquiredDate: number;
}

export type VizDataMap = {
  'loan-heatmap': LoanHeatmapData;
  'category-treemap': CategoryTreemapData;
  'turnover-quadrant': TurnoverQuadrantData;
  'reservation-pressure': ReservationPressureData;
  'loan-time-of-day': LoanTimeOfDayData;
  'overdue-flow': OverdueFlowData;
  'class-participation': ClassParticipationData;
  'monthly-loan-curve': MonthlyLoanCurveData;
  'shelf-heatmap': ShelfHeatmapData;
  'collection-age': CollectionAgeData;
  'grade-reading-gap': GradeReadingGapData;
  'budget-picture': BudgetPictureData;
};

interface VizApiResponse<T> {
  type: string;
  computedAt: string;
  data: T;
}

async function fetchViz<K extends VizType>(
  type: K,
  sampleData: VizDataMap[K]
): Promise<{ data: VizDataMap[K]; sample: boolean; computedAt: string } | { error: string }> {
  // todo/29: 시각화는 계산 비용이 큰 읽기 — 60초 캐시(쓰기 신호가 오면 즉시 무효화).
  const res = await cachedApiCall<VizApiResponse<VizDataMap[K]>>('viz', { type }, 60000);
  if (res.ok) return { data: res.data.data, sample: false, computedAt: res.data.computedAt };
  if (res.error.code === 'UNKNOWN_ACTION' || res.error.code === 'VIZ_NOT_READY') {
    // 둘 다 "지금 보여줄 진짜 데이터가 없다"는 뜻이라 프론트는 폴백 목적으로 같이 다룬다 —
    // UNKNOWN_ACTION(재배포 전) · VIZ_NOT_READY(일배치 미실행)는 서버 쪽 원인이 다르므로
    // apiWebViz_ 자체는 코드를 합치지 않는다(school-patch-v1/Code.gs 주석 참고).
    return { data: sampleData, sample: true, computedAt: '' };
  }
  return { error: res.error.message || res.error.code };
}

const SAMPLE_BY_TYPE: { [K in VizType]: VizDataMap[K] } = {
  'loan-heatmap': mockLoanHeatmap,
  'category-treemap': mockCategoryTreemap,
  'turnover-quadrant': mockTurnoverQuadrant,
  'reservation-pressure': mockReservationPressure,
  'loan-time-of-day': mockLoanTimeOfDay,
  'overdue-flow': mockOverdueFlow,
  'class-participation': mockClassParticipation,
  'monthly-loan-curve': mockMonthlyLoanCurve,
  'shelf-heatmap': mockShelfHeatmap,
  'collection-age': mockCollectionAge,
  'grade-reading-gap': mockGradeReadingGap,
  'budget-picture': mockBudgetPicture
};

export interface VizFetchState<T> {
  loading: boolean;
  data: T | null;
  sample: boolean;
  computedAt: string;
  error: string | null;
}

/**
 * 차트 하나(type)의 데이터를 마운트 시 1회 조회한다 — src/viz/의 각 차트 컴포넌트가
 * VizLazyMount로 실제로 뷰포트에 들어올 때만 마운트되므로, 이 훅의 fetch도 자연히 그때
 * 한 번만 실행된다("지연 로딩" 완료 조건의 후반부: fetch도 지연).
 */
export function useVizData<K extends VizType>(type: K): VizFetchState<VizDataMap[K]> {
  const [state, setState] = useState<VizFetchState<VizDataMap[K]>>({
    loading: true,
    data: null,
    sample: false,
    computedAt: '',
    error: null
  });

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    void fetchViz(type, SAMPLE_BY_TYPE[type]).then((outcome) => {
      if (!alive) return;
      if ('error' in outcome) {
        setState({ loading: false, data: null, sample: false, computedAt: '', error: outcome.error });
      } else {
        setState({ loading: false, data: outcome.data, sample: outcome.sample, computedAt: outcome.computedAt, error: null });
      }
    });
    return () => {
      alive = false;
    };
  }, [type]);

  return state;
}
