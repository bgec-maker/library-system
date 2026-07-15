import { apiCall } from './api';
import { mockRecentOps } from '../mocks/recentOps';

// FRONTEND.md 「최근 처리」(recent-ops) 뷰의 데이터 계층 — services/reportData.ts와 같은
// UNKNOWN_ACTION→샘플 폴백 규약(SampleDataBadge.tsx 재사용)을 따르지만, 대시보드처럼 자동
// 갱신되는 싱글턴 스토어는 아니다: 이 뷰는 "열 때 한 번 조회 + 수동 새로고침 버튼"으로 충분한
// 온디맨드 목록이라 구독자 관리 없이 단순 async 함수 + 호출한 뷰의 로컬 state로 둔다
// (dashboardData.ts처럼 5분 자동 갱신·트랜잭션 후 구독을 걸 만큼 실시간성이 중요하지 않다 —
// 과설계 방지, docs/ASSUMPTIONS.md todo/08 참고).
//
// school-patch-v1/Code.gs의 apiWebRecentOps_()가 15_AUDIT_LOG를 그대로 옮겨 돌려주는 모양 —
// 백엔드 함수는 추가만 하고 기존 함수는 수정하지 않으므로(절대 규칙) 이 타입도 그 반환값에
// 맞춰져 있다.
export interface RecentOpRow {
  logId: string;
  occurredAt: string;
  actionCode: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorId: string;
}

export type RecentOpsFetchOutcome = { ok: true; rows: RecentOpRow[]; sample: boolean } | { ok: false; message: string };

// todo/11 — 두 번째 인자 entityId는 apiWebRecentOps_에 추가된 선택 파라미터(하위호환 추가,
// entityId 생략 시 기존 동작과 완전히 동일)를 그대로 실어 보낸다. book-detail이 "이 소장본의
// 최근 이력"을 좁혀 볼 때 쓴다(entity_id 직접 일치 + CHECKOUT의 copy_id JSON 매칭까지만 —
// RETURN/RENEW/MARK_LOST는 못 잡는 알려진 한계, services/titleDetail.ts의 loanHistory가
// 정확한 대출 이력을 보완한다. Code.gs apiWebRecentOps_ 주석·docs/ASSUMPTIONS.md todo/11 참고).
export async function fetchRecentOps(limit = 100, entityId?: string): Promise<RecentOpsFetchOutcome> {
  const res = await apiCall<{ rows: RecentOpRow[] }>('recentOps', entityId ? { limit, entityId } : { limit });
  if (res.ok) return { ok: true, rows: res.data.rows, sample: false };
  if (res.error.code === 'UNKNOWN_ACTION') {
    // 아직 recentOps 액션이 없는 배포(재배포 전) — dashboardData.ts와 같은 정상 상태, 샘플로 폴백.
    // entityId가 주어졌으면 목데이터도 같은 방식(entity_id 일치)으로 좁혀서 보여준다 — 실제
    // 배포 후 필터 결과가 "전체 목록"으로 보이는 오해를 방지한다.
    const rows = entityId ? mockRecentOps.filter((row) => row.entityId === entityId) : mockRecentOps;
    return { ok: true, rows, sample: true };
  }
  return { ok: false, message: res.error.message || res.error.code };
}
