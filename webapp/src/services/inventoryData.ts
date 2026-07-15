import { apiCall, newRequestId } from './api';

// 장서 점검(inventory, todo/14) 데이터 계층 — school-patch-v1/Code.gs의 신규 액션 하나를
// 소비한다: apiWebInventoryScan_(쓰기지만 last_inventory_at 하나만 갱신하는 단순 갱신 —
// loanActionsData.ts의 renewLoan/markLoanLost/payFine과 정확히 같은 패턴으로 executeWrite_·
// inventoryScan_을 그대로 감싼 것뿐, 새 업무 로직 없음). loan-return의 checkout/return과 같은
// 원칙으로 UNKNOWN_ACTION이어도 샘플로 "성공한 척"하지 않는다(CLAUDE.md 검증 원칙 "가짜 성공
// 금지") — 재배포 전이면 오류를 그대로 돌려주고, 호출측(views/inventory/index.tsx)이 토스트로
// 알린다. 세션 중 연속 스캔(최대 100+권)에서 응답을 기다리며 다음 스캔을 막지 않아야 하므로
// (raf 디코드 루프·scanBus와 무관한 별도 네트워크 호출) 호출측은 이 함수를 fire-and-forget으로
// 쓴다 — 이 서비스 자체는 그냥 평범한 async 함수일 뿐, 큐잉/재시도는 하지 않는다(실패하면
// 호출측이 토스트로만 알리고 세션 로컬 카운트는 그대로 둔다 — 문서화: docs/ASSUMPTIONS.md
// `## todo/14`).
export interface InventoryScanResult {
  copyId: string;
  barcode: string;
  lastInventoryAt: string;
}
export type InventoryScanOutcome = { ok: true; data: InventoryScanResult } | { ok: false; code: string; message: string };

/** 장서 점검 스캔 1건 — inventoryScan_(Code.gs)이 기대하는 페이로드 키(copyKey) 그대로.
 *  copyKey에는 소장본 바코드든 copy_id든 넘길 수 있다(findCopyByKey_이 둘 다 시도해서 찾는다). */
export async function inventoryScan(copyKey: string): Promise<InventoryScanOutcome> {
  const res = await apiCall<InventoryScanResult>('inventoryScan', { copyKey, requestId: newRequestId() });
  if (res.ok) return { ok: true, data: res.data };
  return { ok: false, code: res.error.code, message: res.error.message || res.error.code };
}
