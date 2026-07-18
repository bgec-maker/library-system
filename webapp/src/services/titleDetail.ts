import { cachedApiCall } from './readCache';
import { mockTitleDetail } from '../mocks/titleDetail';

// book-detail(todo/11) 데이터 계층 — school-patch-v1/Code.gs의 신규 읽기 전용 액션
// apiWebTitleDetail_()이 돌려주는 모양을 그대로 옮긴 타입이다.
//
// ADR-024 "미러는 목록 전용"의 정신을 한 건 상세 조회에도 적용해, catalog IndexedDB 미러
// (services/catalog.ts)를 거치지 않고 이 액션으로 매번 살아있는 값을 직접 읽는다 — 서명 1개·
// 소장본 몇 권 규모의 조회라 서버 왕복 1회가 미러에 title 단위 서지 필드를 중복 저장하는 것보다
// 낫다고 판단했다(docs/ASSUMPTIONS.md todo/11, catalogSync 대신 신규 액션을 택한 이유).
export interface TitleDetailCopy {
  copyId: string;
  barcode: string;
  statusCode: string;
  shelfCode: string;
  conditionCode: string;
  acquiredAt: string;
  onLoan: boolean;
  dueAt: string;
  memberNo: string;
  memberName: string;
}

// "최근 이력" 1차 소스 — apiWebRecentOps_(15_AUDIT_LOG)가 아니라 10_LOANS을 직접 조회한 값
// (Code.gs apiWebTitleDetail_ 주석 참고: LOAN 감사 로그는 RETURN/RENEW/MARK_LOST에 copy_id를
// 남기지 않아 entityId로 재구성이 안 된다 — LOANS는 copy_id 컬럼을 항상 갖고 있어 정확하다).
export interface TitleDetailLoanHistoryRow {
  loanId: string;
  barcode: string;
  memberNo: string;
  memberName: string;
  checkedOutAt: string;
  dueAt: string;
  returnedAt: string;
  statusCode: string;
}

export interface TitleDetailReservationItem {
  reservationId: string;
  memberNo: string;
  memberName: string;
  statusCode: string;
  queueSeq: number;
  requestedAt: string;
  readyAt: string;
  pickupExpiresAt: string;
}

export interface TitleDetailReservations {
  waitingCount: number;
  readyCount: number;
  items: TitleDetailReservationItem[];
}

export interface TitleDetail {
  titleId: string;
  isbn13: string;
  title: string;
  subtitle: string;
  authors: string;
  publisher: string;
  /** 03_TITLES.published_year — 빈 문자열이면 정보 없음. */
  publishedYear: number | string;
  languageCode: string;
  materialTypeCode: string;
  classification: string;
  description: string;
  coverUrl: string;
  /** 03_TITLES엔 페이지수 컬럼이 없다 — 21_BOOK_CACHE(ISBN 조회 부가 캐시)에서 최선노력으로
   *  곁들인 값이라 자주 비어 있을 수 있다(빈 문자열 = "정보 없음", 지어내지 않는다). */
  pageCount: number | string;
  titleStatusCode: string;
  /** copyKey로 조회했을 때만 채워진다 — 딥링크/카탈로그 행 클릭처럼 특정 소장본을 보고 있다는 뜻. */
  focusCopyId: string;
  copies: TitleDetailCopy[];
  loanHistory: TitleDetailLoanHistoryRow[];
  reservations: TitleDetailReservations;
}

export interface TitleDetailQuery {
  copyKey?: string;
  titleId?: string;
}

export type TitleDetailFetchOutcome =
  | { ok: true; data: TitleDetail; sample: boolean }
  | { ok: false; code: string; message: string };

export async function fetchTitleDetail(query: TitleDetailQuery): Promise<TitleDetailFetchOutcome> {
  const payload: Record<string, unknown> = {};
  if (query.copyKey) payload.copyKey = query.copyKey;
  if (query.titleId) payload.titleId = query.titleId;

  // todo/29: 같은 책을 짧은 간격으로 다시 열 때(검색↔상세 왕복) 중복 조회 억제.
  const res = await cachedApiCall<TitleDetail>('titleDetail', payload, 30000);
  if (res.ok) return { ok: true, data: res.data, sample: false };
  if (res.error.code === 'UNKNOWN_ACTION') {
    // titleDetail 액션이 아직 없는 배포(재배포 전) — 다른 화면과 같은 정상 상태, 샘플로 폴백.
    return { ok: true, data: mockTitleDetail(query), sample: true };
  }
  return { ok: false, code: res.error.code, message: res.error.message || res.error.code };
}
