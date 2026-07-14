// "쓰기 트랜잭션이 방금 성공했다 — 대시보드 등 파생 화면은 다시 조회해야 한다"는 신호를
// 흘려보내는 아주 작은 이벤트 버스. toastBus.ts와 같은 최소 pub/sub 패턴을 그대로 따른다.
// FRONTEND.md 대시보드 절 "갱신 = 진입 시 + 트랜잭션 후 + 수동 버튼 + 5분 자동" 중
// "트랜잭션 후"를 담당 — views/loan-return·views/register의 성공 분기(res.ok)가 발행하고,
// services/dashboardData.ts가 구독해 재조회한다. 범용/최소로 유지 — 이후 항목(리포트 등)도
// 같은 신호를 재사용할 수 있다.
type Listener = () => void;
const listeners = new Set<Listener>();

export function publishDataChange(): void {
  listeners.forEach((fn) => fn());
}

export function subscribeDataChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
