import { useEffect, useState } from 'react';
import { apiCall, newRequestId } from './api';
import { cachedApiCall } from './readCache';
import { publishDataChange, subscribeDataChange } from './dataChangeBus';
import { mockReservationsList } from '../mocks/reservations';

// 예약 프론트(todo/12) 데이터 계층 — school-patch-v1/Code.gs의 신규 액션 3개(전부 기존
// reserve_/cancelReservation_ 그대로 감싼 것뿐, 새 업무 로직 없음)를 소비한다:
//   apiWebReserve_/apiWebCancelReservation_ — 쓰기(걸기·취소). UNKNOWN_ACTION이어도 샘플로
//     "성공한 척"하지 않는다(loan-return의 checkout/return과 같은 원칙 — 쓰기는 흉내 낼 수 없다,
//     CLAUDE.md 검증 원칙 "가짜 성공 금지"). 재배포 전이면 그냥 오류 토스트로 알린다.
//   apiWebReservations_ — 읽기(관리 뷰 목록). dashboardData.ts/reportData.ts와 같은
//     UNKNOWN_ACTION→샘플 폴백 규약(SampleDataBadge)을 따른다 — "걸기→반납 시 자동배정→도착
//     목록 표시" 완료 조건은 이 목록의 mocks/reservations.ts가 WAITING/READY/만료임박 3버킷을
//     전부 갖춰 재배포 전에도 시연 가능하게 한다(docs/ASSUMPTIONS.md todo/12).
//
// 제네릭하게 유지 — book-detail(todo/12)뿐 아니라 search(todo/15)도 그대로 재사용할 수 있도록
// createReservation/cancelReservation은 특정 화면에 묶인 상태를 전혀 갖지 않는 순수 함수다.

export interface ReservationRow {
  reservationId: string;
  titleId: string;
  title: string;
  memberId: string;
  memberNo: string;
  memberName: string;
  statusCode: 'WAITING' | 'READY';
  queueSeq: number;
  assignedCopyId: string;
  assignedBarcode: string;
  requestedAt: string;
  readyAt: string;
  pickupExpiresAt: string;
  /** pickup_expires_at을 epoch ms로 — "만료임박" 판정은 서버가 아니라 프론트가 now와 비교해서
   *  한다(todo 본문 지시, 서버는 urgency 개념을 갖지 않는다). READY가 아니면 0. */
  pickupExpiresAtMs: number;
}

export interface ReservationsListResult {
  items: ReservationRow[];
  /** status 필터와 무관하게 항상 전체(WAITING+READY) 기준 — 탭 배지 숫자용. */
  waitingCount: number;
  readyCount: number;
}

export type ReservationStatusFilter = 'WAITING' | 'READY';

export type ReservationsFetchOutcome =
  | { ok: true; data: ReservationsListResult; sample: boolean }
  | { ok: false; message: string };

/** 관리 뷰(views/reservations) 목록 조회 — status 생략 시 WAITING+READY 전체. */
export async function fetchReservations(status?: ReservationStatusFilter): Promise<ReservationsFetchOutcome> {
  const res = await cachedApiCall<ReservationsListResult>('reservations', status ? { status } : {}, 15000);
  if (res.ok) return { ok: true, data: res.data, sample: false };
  if (res.error.code === 'UNKNOWN_ACTION') {
    // 아직 reservations 액션이 없는 배포(재배포 전) — 다른 읽기 화면과 같은 정상 상태, 샘플로 폴백.
    return { ok: true, data: mockReservationsList(status), sample: true };
  }
  return { ok: false, message: res.error.message || res.error.code };
}

export interface CreateReservationResult {
  targetType: string;
  targetId: string;
  reservationId: string;
  memberNo: string;
  title: string;
  queueSeq: number;
  status: 'WAITING' | 'READY';
  /** status==='READY'일 때만(즉시 배정된 소장본 등록번호) — WAITING이면 빈 문자열. */
  assignedBarcode: string;
  /** status==='READY'일 때만 채워짐 — reserve_ 원본 반환값 그대로(ISO 문자열, 로컬 포맷 아님). */
  pickupExpiresAt: string;
}

export type CreateReservationOutcome =
  | { ok: true; data: CreateReservationResult }
  | { ok: false; code: string; message: string };

/** 예약 걸기 — reserve_(Code.gs)가 기대하는 페이로드 키(memberKey·titleKey) 그대로. */
export async function createReservation(memberKey: string, titleKey: string): Promise<CreateReservationOutcome> {
  const res = await apiCall<CreateReservationResult>('reserve', { memberKey, titleKey, requestId: newRequestId() });
  if (res.ok) {
    // todo/29: 쓰기 성공 = 데이터 변경 신호(FRONTEND.md 「트랜잭션 후」) — 읽기 캐시 무효화와
    // 대시보드 재조회가 이 한 줄에 걸려 있다(그동안 대출·반납만 발행하고 있었다).
    publishDataChange();
    return { ok: true, data: res.data };
  }
  return { ok: false, code: res.error.code, message: res.error.message || res.error.code };
}

export interface CancelReservationResult {
  targetType: string;
  targetId: string;
  reservationId: string;
  status: string;
}

export type CancelReservationOutcome =
  | { ok: true; data: CancelReservationResult }
  | { ok: false; code: string; message: string };

/** 예약 취소 — cancelReservation_(Code.gs)이 기대하는 페이로드 키(reservationId) 그대로. */
export async function cancelReservation(reservationId: string): Promise<CancelReservationOutcome> {
  const res = await apiCall<CancelReservationResult>('cancelReservation', { reservationId, requestId: newRequestId() });
  if (res.ok) {
    publishDataChange();
    return { ok: true, data: res.data };
  }
  return { ok: false, code: res.error.code, message: res.error.message || res.error.code };
}

export interface ReadyReservationCountState {
  count: number;
  sample: boolean;
  loading: boolean;
}

/**
 * 대시보드 「예약 도착」 카드(shells/desktop/DashboardBaseLayer.tsx)용 — READY(수령 준비 완료)
 * 건수만 필요하다. getDashboardData_()의 readyItems는 최대 7건까지만 잘라 내려주므로(대시보드
 * "연체 상위"류 상위 N 미리보기 목적, todo/04) 실제 READY 총건수 배지로 쓰면 8건째부터
 * undercount된다 — 그래서 대시보드의 기존 dashboard 액션 응답을 재사용하지 않고, 상한 없이
 * 정확한 readyCount를 돌려주는 이 reservations 액션에서 별도로 가져온다(docs/ASSUMPTIONS.md
 * todo/12에 두 방식 중 이걸 고른 근거를 남겼다). dataChangeBus 구독으로 트랜잭션 후 자동 갱신.
 */
export function useReadyReservationCount(): ReadyReservationCountState {
  const [state, setState] = useState<ReadyReservationCountState>({ count: 0, sample: false, loading: true });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetchReservations('READY');
      if (cancelled) return;
      if (res.ok) setState({ count: res.data.readyCount, sample: res.sample, loading: false });
      else setState((prev) => ({ ...prev, loading: false }));
    }
    void load();
    const unsubscribe = subscribeDataChange(() => void load());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return state;
}
