import type { ReservationRow, ReservationsListResult, ReservationStatusFilter } from '../services/reservationData';

// 예약 관리(todo/12) 목데이터 — dashboardData.ts/titleDetail.ts와 같은 UNKNOWN_ACTION 폴백 규약
// (reservations 액션 배포 전에만 보인다). 완료 조건("걸기→반납 시 자동배정→도착 목록 표시 흐름이
// 샘플 폴백으로도 시연됨")을 재배포 없이 그대로 보여주기 위해 관리 뷰의 3버킷(대기·도착알림·
// 만료임박)을 전부 채운다 — mocks/titleDetail.ts가 쓰는 "아몬드" 서명과 mocks/dashboard.ts의
// 회원 이름을 이어서 재사용한다(여러 목데이터를 넘나들며 봐도 낯설지 않도록, 의도적 재사용).
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function fmt(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 3600000);
}
function daysFromNow(days: number, hour = 15, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

// 대기(WAITING) — 아직 배정된 소장본 없음(assignedCopyId/assignedBarcode 빈 값).
const waitingRow: ReservationRow = {
  reservationId: 'RSV-000101',
  titleId: 'T000231',
  title: '아몬드',
  memberId: 'M-000412',
  memberNo: 'M-000412',
  memberName: '정유나',
  statusCode: 'WAITING',
  queueSeq: 1,
  assignedCopyId: '',
  assignedBarcode: '',
  requestedAt: fmt(daysFromNow(-2)),
  readyAt: '',
  pickupExpiresAt: '',
  pickupExpiresAtMs: 0
};

// 도착알림(READY) — 여유 있는 만료(사흘 뒤). "반납 → 자동배정 → READY 전환" 결과를 흉내낸다.
const readyCalmRow: ReservationRow = {
  reservationId: 'RSV-000097',
  titleId: 'T000455',
  title: '완득이',
  memberId: 'M-000203',
  memberNo: 'M-000203',
  memberName: '김서연',
  statusCode: 'READY',
  queueSeq: 1,
  assignedCopyId: 'C000512',
  assignedBarcode: '0004512',
  requestedAt: fmt(daysFromNow(-5)),
  readyAt: fmt(daysFromNow(-1)),
  pickupExpiresAt: fmt(daysFromNow(2)),
  pickupExpiresAtMs: daysFromNow(2).getTime()
};

// 만료임박(READY, ≤24시간) — views/reservations/index.tsx의 URGENT_WINDOW_MS(24시간) 안쪽.
const readyUrgentRow: ReservationRow = {
  reservationId: 'RSV-000088',
  titleId: 'T000980',
  title: '해리 포터와 마법사의 돌',
  memberId: 'M-000305',
  memberNo: 'M-000305',
  memberName: '이하늘',
  statusCode: 'READY',
  queueSeq: 1,
  assignedCopyId: 'C000901',
  assignedBarcode: '0009011',
  requestedAt: fmt(daysFromNow(-6)),
  readyAt: fmt(daysFromNow(-2)),
  pickupExpiresAt: fmt(hoursFromNow(6)),
  pickupExpiresAtMs: hoursFromNow(6).getTime()
};

export const mockReservations: ReservationRow[] = [readyUrgentRow, readyCalmRow, waitingRow];

/** services/reservationData.ts의 fetchReservations()가 UNKNOWN_ACTION일 때 쓰는 폴백 —
 *  apiWebReservations_(Code.gs)와 같은 응답 모양(waitingCount/readyCount는 필터와 무관하게 전체 기준). */
export function mockReservationsList(status?: ReservationStatusFilter): ReservationsListResult {
  const items = status ? mockReservations.filter((r) => r.statusCode === status) : mockReservations;
  return {
    items,
    waitingCount: mockReservations.filter((r) => r.statusCode === 'WAITING').length,
    readyCount: mockReservations.filter((r) => r.statusCode === 'READY').length
  };
}
