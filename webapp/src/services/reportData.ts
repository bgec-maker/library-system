import { apiCall } from './api';
import { mockHomeroomReport, mockNoLoanFinderReport } from '../mocks/reports';

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
