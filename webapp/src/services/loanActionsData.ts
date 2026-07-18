import { apiCall, newRequestId } from './api';
import { cachedApiCall } from './readCache';
import { publishDataChange } from './dataChangeBus';
import { mockUnpaidFines } from '../mocks/fines';

// 연장·분실·변상(todo/13) 데이터 계층 — school-patch-v1/Code.gs의 신규 액션 4개를 소비한다:
//   apiWebRenew_/apiWebMarkLost_/apiWebPayFine_ — 쓰기(사이드바 apiRenew/apiMarkLoanLost/
//     apiPayFine과 정확히 같은 패턴으로 renew_/markLoanLost_/payFine_을 그대로 감싼 것뿐, 새 업무
//     로직 없음). loan-return의 checkout/return과 같은 원칙으로 UNKNOWN_ACTION이어도 샘플로
//     "성공한 척"하지 않는다(CLAUDE.md 검증 원칙 "가짜 성공 금지") — 재배포 전이면 오류 토스트로
//     그대로 알린다.
//   apiWebUnpaidFines_ — 읽기(book-detail의 "이 소장본에 변상 버튼을 보여줄지" 판단 + reports
//     허브 「미변상 목록」). dashboardData.ts/reportData.ts와 같은 UNKNOWN_ACTION→샘플 폴백
//     규약(SampleDataBadge)을 따른다.

export interface RenewResult {
  loanId: string;
  barcode: string;
  title: string;
  /** renew_(Code.gs)가 그대로 돌려주는 값 — 정책의 renewal_days(빈 값이면 loan_days)만큼
   *  연장된 새 반납예정일. 서버 원문(로컬 포맷 아님)이라 화면은 그대로 문자열로 보여준다. */
  newDueAt: string;
  renewCount: number;
}
export type RenewOutcome = { ok: true; data: RenewResult } | { ok: false; code: string; message: string };

/** 연장 — renew_(Code.gs)가 기대하는 페이로드 키(loanOrCopyKey) 그대로. loanOrCopyKey에는
 *  loan_id든 소장본 바코드든 넘길 수 있다(renew_이 둘 다 시도해서 찾는다). */
export async function renewLoan(loanOrCopyKey: string, note: string): Promise<RenewOutcome> {
  const res = await apiCall<RenewResult>('renew', { loanOrCopyKey, note, requestId: newRequestId() });
  if (res.ok) {
    // todo/29: 쓰기 성공 = publishDataChange (reservationData와 같은 사유 — 캐시 무효화 전제).
    publishDataChange();
    return { ok: true, data: res.data };
  }
  return { ok: false, code: res.error.code, message: res.error.message || res.error.code };
}

export interface MarkLostResult {
  loanId: string;
  copyId: string;
  barcode: string;
  title: string;
  memberNo: string;
  memberName: string;
  status: string;
  replacementFineId: string;
  /** > 0이면 markLoanLost_가 REPLACEMENT 벌금을 만들었다는 뜻 — checkout_의 기존
   *  unpaidReplacement 체크(936~941행)가 이 회원의 다음 신규 대출을 막는다("분실→학생 정지
   *  연동"은 새 정지 로직이 아니라 이 기존 검사다, docs/ASSUMPTIONS.md `## todo/13`). */
  replacementFineAmount: number;
}
export type MarkLostOutcome = { ok: true; data: MarkLostResult } | { ok: false; code: string; message: string };

/** 분실 처리 — markLoanLost_(Code.gs)가 기대하는 페이로드 키(loanOrCopyKey·fineAmount) 그대로.
 *  fineAmount는 필수(서버가 nonNegativeInteger_로 검증) — 08_COPIES에 원가 컬럼이 있지만
 *  apiWebTitleDetail_(수정 금지 대상)이 내려주지 않으므로 화면이 자동으로 채우지 못하고 사서가
 *  직접 입력한다. */
export async function markLoanLost(loanOrCopyKey: string, fineAmount: number, note: string): Promise<MarkLostOutcome> {
  const res = await apiCall<MarkLostResult>('markLost', { loanOrCopyKey, fineAmount, note, requestId: newRequestId() });
  if (res.ok) {
    publishDataChange();
    return { ok: true, data: res.data };
  }
  return { ok: false, code: res.error.code, message: res.error.message || res.error.code };
}

export interface PayFineResult {
  fineId: string;
  paidAmount: number;
  remainingAmount: number;
  status: string;
}
export type PayFineOutcome = { ok: true; data: PayFineResult } | { ok: false; code: string; message: string };

/** 변상 완료 — payFine_(Code.gs)가 기대하는 페이로드 키(fineId·amount) 그대로. "완료"의 기본
 *  동작은 잔액 전액(amount)을 한 번에 납부하는 것이다(호출측 — book-detail/reports — 가
 *  remainingAmount를 그대로 넘긴다) — payFine_ 자체는 부분 납부(status PARTIAL)도 지원하지만
 *  이 헬퍼는 그 판단을 강제하지 않고 호출측이 넘긴 amount를 그대로 전달한다. payFine_ 본문에는
 *  note 필드가 없어(appendNote_를 호출하지 않음) 여기서도 note를 받지 않는다 — 없는 걸 관통시킬
 *  수는 없다(docs/ASSUMPTIONS.md `## todo/13` 참고). */
export async function payFine(fineId: string, amount: number): Promise<PayFineOutcome> {
  const res = await apiCall<PayFineResult>('payFine', { fineId, amount, requestId: newRequestId() });
  if (res.ok) {
    publishDataChange();
    return { ok: true, data: res.data };
  }
  return { ok: false, code: res.error.code, message: res.error.message || res.error.code };
}

// apiWebUnpaidFines_(Code.gs, 신규 읽기 전용)가 돌려주는 모양 그대로 — FINES(REPLACEMENT ·
// UNPAID/PARTIAL)를 MEMBERS/LOANS/COPIES/TITLES와 조인한 화면 표시용 행.
export interface UnpaidFineRow {
  fineId: string;
  memberId: string;
  memberNo: string;
  memberName: string;
  loanId: string;
  copyId: string;
  barcode: string;
  titleId: string;
  title: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  statusCode: 'UNPAID' | 'PARTIAL';
  assessedAt: string;
}

export type UnpaidFinesOutcome = { ok: true; data: UnpaidFineRow[]; sample: boolean } | { ok: false; message: string };

/** 미변상(REPLACEMENT) 목록 — reports 허브 「미변상 목록」 + book-detail 「변상」 버튼 판단(이
 *  소장본에 연결된 미변상 건이 있는지) 둘 다 이 하나의 읽기를 공유한다. */
export async function fetchUnpaidFines(): Promise<UnpaidFinesOutcome> {
  const res = await cachedApiCall<{ rows: UnpaidFineRow[] }>('unpaidFines', {}, 15000);
  if (res.ok) return { ok: true, data: res.data.rows, sample: false };
  if (res.error.code === 'UNKNOWN_ACTION') {
    // 아직 unpaidFines 액션이 없는 배포(재배포 전) — 다른 읽기 화면과 같은 정상 상태, 샘플로 폴백.
    return { ok: true, data: mockUnpaidFines(), sample: true };
  }
  return { ok: false, message: res.error.message || res.error.code };
}
