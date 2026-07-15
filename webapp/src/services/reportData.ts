import { apiCall } from './api';
import {
  mockAnnualOperationsReport,
  mockDonorThanksReport,
  mockHomeroomReport,
  mockNoLoanFinderReport,
  mockRecallNoticeReport,
  mockWeedingRecommendReport
} from '../mocks/reports';

// FEATURES.md R1 리포트 허브 데이터 계층 — services/dashboardData.ts와 같은 UNKNOWN_ACTION→샘플
// 폴백 규약을 재사용하지만(SampleDataBadge.tsx 그대로 씀), 대시보드처럼 진입 시 자동 갱신되는
// 싱글턴 스토어가 아니다: 리포트는 "종류+조건을 고른 다음 그때 한 번 조회"하는 온디맨드 액션이라
// 구독자 관리 없이 단순 async 함수 + 호출한 뷰의 로컬 state로 충분하다(과설계 방지).
//
// school-patch-v1/Code.gs의 reportNoLoanFinder_/reportHomeroomClass_가 돌려주는 모양을 그대로
// 옮긴 타입 — 백엔드 함수는 수정하지 않으므로(절대 규칙) 이 타입도 그 반환값에 맞춰져 있다.

export interface NoLoanFinderStudent {
  memberNo: string;
  name: string;
  studentNo: number;
}

export interface NoLoanFinderClassGroup {
  grade: number;
  classNo: number;
  students: NoLoanFinderStudent[];
}

export interface NoLoanFinderReport {
  libraryName: string;
  generatedAt: string;
  /** yyyy-MM-dd — "이 날짜 이후 대출 0회"의 기준일. */
  sinceDate: string;
  totalCount: number;
  classes: NoLoanFinderClassGroup[];
}

export interface HomeroomLoanStatusRow {
  memberNo: string;
  name: string;
  studentNo: number;
  loanCount: number;
}

export interface HomeroomOverdueRow {
  memberNo: string;
  name: string;
  title: string;
  dueAtText: string;
  overdueDays: number;
}

export interface HomeroomPopularBook {
  title: string;
  loanCount: number;
}

export interface HomeroomReport {
  libraryName: string;
  generatedAt: string;
  grade: number;
  classNo: number;
  /** yyyy-MM */
  month: string;
  studentCount: number;
  loanStatus: HomeroomLoanStatusRow[];
  noLoanList: HomeroomLoanStatusRow[];
  overdueList: HomeroomOverdueRow[];
  popularBooks: HomeroomPopularBook[];
}

// R1-3 죽은 장서 / 구매 추천 — reportWeedingRecommend_(Code.gs)의 반환 모양 그대로.
export interface WeedingCandidateRow {
  copyId: string;
  barcode: string;
  title: string;
  author: string;
  shelfCode: string;
  acquiredAtText: string;
}

export interface PurchaseCandidateRow {
  titleId: string;
  title: string;
  queueLength: number;
  copyCount: number;
  ratio: number;
}

export interface WeedingRecommendReport {
  libraryName: string;
  generatedAt: string;
  minAgeYears: number;
  weedingCandidates: WeedingCandidateRow[];
  purchaseCandidates: PurchaseCandidateRow[];
}

// R1-4 회수 쪽지 — reportRecallNotice_(Code.gs)의 반환 모양 그대로. 학급별로 이미 그룹화돼
// 내려온다(프론트가 "한 반 = 한 열" 절취 인쇄 레이아웃을 그대로 그릴 수 있도록).
export interface RecallNoticeItem {
  studentNo: number;
  name: string;
  title: string;
  dueAtText: string;
  overdueDays: number;
}

export interface RecallNoticeClassGroup {
  grade: number;
  classNo: number;
  items: RecallNoticeItem[];
}

export interface RecallNoticeReport {
  libraryName: string;
  generatedAt: string;
  /** yyyy-MM-dd — 이 시각 기준 연체 스냅샷(방학 미반납 개념은 단순화, docs/ASSUMPTIONS.md todo/09). */
  asOfDate: string;
  totalCount: number;
  classes: RecallNoticeClassGroup[];
}

// R1-5 기증 감사장 — reportDonorThanks_(Code.gs)의 반환 모양 그대로. sourceLabel은 실제
// 기증자 이름이 아니라 08_COPIES.acquisition_source 원문 문자열이다(스키마에 기증자 식별
// 필드가 없음 — docs/ASSUMPTIONS.md todo/09 참고).
export interface DonorThanksItem {
  copyId: string;
  title: string;
  price: number;
  acquiredAtText: string;
}

export interface DonorThanksGroup {
  sourceLabel: string;
  items: DonorThanksItem[];
  totalPrice: number;
}

export interface DonorThanksReport {
  libraryName: string;
  generatedAt: string;
  donorGroups: DonorThanksGroup[];
  /** acquisition_source가 비어 있어 어느 그룹에도 넣지 못한 소장본 수(집계에서 제외됨). */
  skippedNoSource: number;
}

// R3 연간 운영 보고서 — reportAnnualOperations_(Code.gs)의 반환 모양 그대로. FEATURES.md가
// 요구하는 5개 항목(대출 통계·장서 현황 증감·입수 단가 합계·상위 대출·연체 요약)이 각각
// loanStats/collection/budget/topLoans/overdueSummary 필드로 나뉘어 내려온다.
export interface AnnualOperationsLoanMonth {
  /** yyyy-MM */
  month: string;
  count: number;
}

export interface AnnualOperationsLoanStats {
  totalCount: number;
  byMonth: AnnualOperationsLoanMonth[];
}

// 08_COPIES에 철회 시각(withdrawn_at)이 없어(school-patch-v1/Code.gs reportAnnualOperations_
// 주석 참고) "기간 시작 전 입수 vs 기간 중 입수"로 근사한다 — 기간 중 철회분은 이 수치에서
// 빠진다(docs/ASSUMPTIONS.md todo/24).
export interface AnnualOperationsCollection {
  startCount: number;
  endCount: number;
  acquiredInPeriodCount: number;
  netChange: number;
  skippedNoAcquiredDate: number;
}

// computeBudgetViz_(예산 그림, todo/19)가 이미 계산한 연도×출처 표를 그대로 담고,
// periodAcquisitionTotal만 reportAnnualOperations_가 선택 기간에 맞춰 추가로 더한 값이다.
export interface AnnualOperationsBudgetSource {
  sourceLabel: string;
  amount: number;
}

export interface AnnualOperationsBudgetYear {
  year: number;
  total: number;
  sources: AnnualOperationsBudgetSource[];
}

export interface AnnualOperationsBudget {
  sourceOrder: string[];
  years: AnnualOperationsBudgetYear[];
  skippedNoSource: number;
  skippedNoAcquiredDate: number;
  periodAcquisitionTotal: number;
}

export interface AnnualOperationsTopLoan {
  title: string;
  loanCount: number;
}

export interface AnnualOperationsOverdueSummary {
  openOverdueCount: number;
  unpaidFineAmount: number;
  unpaidFineCount: number;
}

export interface AnnualOperationsReport {
  libraryName: string;
  generatedAt: string;
  /** 달력 연도 모드일 때만 값이 있음 — startDate/endDate로 임의 구간을 준 경우 null. */
  year: number | null;
  /** yyyy-MM-dd */
  periodStartText: string;
  /** yyyy-MM-dd */
  periodEndText: string;
  loanStats: AnnualOperationsLoanStats;
  collection: AnnualOperationsCollection;
  budget: AnnualOperationsBudget;
  topLoans: AnnualOperationsTopLoan[];
  overdueSummary: AnnualOperationsOverdueSummary;
}

export type ReportFetchOutcome<T> = { ok: true; data: T; sample: boolean } | { ok: false; message: string };

async function fetchReport<T>(type: string, params: Record<string, unknown>, sampleData: T): Promise<ReportFetchOutcome<T>> {
  const res = await apiCall<T>('report', { type, ...params });
  if (res.ok) return { ok: true, data: res.data, sample: false };
  if (res.error.code === 'UNKNOWN_ACTION') {
    // 아직 report 액션이 없는 배포(재배포 전) — dashboardData.ts와 같은 정상 상태, 샘플로 폴백.
    return { ok: true, data: sampleData, sample: true };
  }
  // VALIDATION_ERROR(예: 잘못된 grade/month)를 포함한 그 외 오류는 진짜 실패로 그대로 알린다.
  return { ok: false, message: res.error.message || res.error.code };
}

/** R1-1 미대출 학생 발굴. sinceDate 생략 시 서버 기본값(최근 3개월, docs/ASSUMPTIONS.md todo/05). */
export function fetchNoLoanFinderReport(sinceDate?: string): Promise<ReportFetchOutcome<NoLoanFinderReport>> {
  return fetchReport('no-loan-finder', sinceDate ? { sinceDate } : {}, mockNoLoanFinderReport);
}

/** R1-2 담임 리포트(월간·반별). month는 'yyyy-MM'. */
export function fetchHomeroomReport(grade: number, classNo: number, month: string): Promise<ReportFetchOutcome<HomeroomReport>> {
  return fetchReport('homeroom-report', { grade, classNo, month }, mockHomeroomReport);
}

/** R1-3 죽은 장서 / 구매 추천 — 파라미터 없음(전체 장서 대상 1회 조회). */
export function fetchWeedingRecommendReport(): Promise<ReportFetchOutcome<WeedingRecommendReport>> {
  return fetchReport('weeding-recommend', {}, mockWeedingRecommendReport);
}

/** R1-4 회수 쪽지 — 파라미터 없음(전교 연체 전체를 학급별로 그룹화해 받는다). */
export function fetchRecallNoticeReport(): Promise<ReportFetchOutcome<RecallNoticeReport>> {
  return fetchReport('recall-notice', {}, mockRecallNoticeReport);
}

/** R1-5 기증 감사장 — 파라미터 없음(acquisition_source별 그룹 전체를 받는다). */
export function fetchDonorThanksReport(): Promise<ReportFetchOutcome<DonorThanksReport>> {
  return fetchReport('donor-thanks', {}, mockDonorThanksReport);
}

/**
 * R3 연간 운영 보고서. 기본은 달력 연도(`year`, 생략 시 서버가 오늘 연도로 처리) — 학년도 같은
 * 학사력 개념이 CONFIG에 없어(docs/ASSUMPTIONS.md todo/24) `startDate`+`endDate`(둘 다 줘야
 * 함, yyyy-MM-dd)로 임의 구간을 완전히 덮어쓸 수도 있다.
 */
export function fetchAnnualOperationsReport(params: {
  year?: number;
  startDate?: string;
  endDate?: string;
}): Promise<ReportFetchOutcome<AnnualOperationsReport>> {
  const payload: Record<string, unknown> = {};
  if (params.startDate && params.endDate) {
    payload.startDate = params.startDate;
    payload.endDate = params.endDate;
  } else if (params.year !== undefined) {
    payload.year = params.year;
  }
  return fetchReport('annual-operations-report', payload, mockAnnualOperationsReport);
}
