import { useCallback, useEffect, useRef, useState } from 'react';
import { apiCall } from './api';
import { subscribeDataChange } from './dataChangeBus';
import { mockManualEntryPendingCount } from '../mocks/manualEntry';

// 대시보드 「수기입력 미처리」 표시(todo/21, 구 PATCH_SPEC P3)용 — services/reservationData.ts의
// useReadyReservationCount()와 같은 패턴(전용 읽기 액션 + UNKNOWN_ACTION 샘플 폴백 +
// dataChangeBus 구독, todo/04 관례 재사용)이다. school-patch-v1/Code.gs의
// apiWebManualEntryPendingCount_(신규, 순수 읽기 — 20/22_MANUAL_ENTRY의 처리상태가 빈 행 수)를
// 그대로 소비한다.
//
// 한 가지 차이 — 이 건수를 바꾸는 실제 사건(absorbManualEntries_ 실행)은 스프레드시트 메뉴에서
// GAS 쪽에서 일어나는 조작이라(웹앱이 트리거하는 쓰기가 아니다) dataChangeBus(웹앱 자체 쓰기
// 후에만 발화)가 그 갱신 신호가 되지 못한다. 그래서 refresh()를 export해 DashboardBaseLayer.tsx의
// 기존 「새로고침」 버튼(dashboardData.refresh()를 부르는 바로 그 버튼)이 이 값도 함께 새로
// 가져오도록 연결했다 — 그 전까지는 대시보드 진입(셸 부팅) 시점의 값을 보여준다.
export interface ManualEntryPendingState {
  count: number;
  sample: boolean;
  loading: boolean;
}

async function fetchManualEntryPendingCount(): Promise<{ count: number; sample: boolean } | null> {
  const res = await apiCall<{ pendingCount: number }>('manualEntryPendingCount', {});
  if (res.ok) return { count: res.data.pendingCount, sample: false };
  if (res.error.code === 'UNKNOWN_ACTION') {
    // 아직 이 액션이 없는 배포(재배포 전) — 다른 읽기 화면과 같은 정상 상태, 샘플로 폴백.
    return { count: mockManualEntryPendingCount, sample: true };
  }
  // 그 외(네트워크·타임아웃 등)는 진짜 오류 — 마지막으로 봤던 값을 그대로 둔다(호출부에서 처리).
  return null;
}

export function useManualEntryPendingCount(): ManualEntryPendingState & { refresh: () => void } {
  const [state, setState] = useState<ManualEntryPendingState>({ count: 0, sample: false, loading: true });
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    const result = await fetchManualEntryPendingCount();
    if (cancelledRef.current) return;
    if (result) setState({ count: result.count, sample: result.sample, loading: false });
    else setState((prev) => ({ ...prev, loading: false }));
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    void load();
    const unsubscribe = subscribeDataChange(() => void load());
    return () => {
      cancelledRef.current = true;
      unsubscribe();
    };
  }, [load]);

  return { ...state, refresh: () => void load() };
}
