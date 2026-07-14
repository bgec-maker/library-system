import { useEffect, useState } from 'react';
import { apiCall } from './api';
import { subscribeDataChange } from './dataChangeBus';
import { mockDashboardData } from '../mocks/dashboard';

// FRONTEND.md 「데스크톱 셸 — 창 관리자 + 대시보드 기저층」(ADR-021) 데이터 계층.
// school-patch-v1/Code.gs의 getDashboardData_()가 돌려주는 모양을 그대로 옮긴 타입 —
// 백엔드 함수는 수정하지 않으므로(절대 규칙) 이 타입도 그 반환값에 맞춰져 있다.
export interface DashboardStats {
  activeTitles: number;
  availableCopies: number;
  openLoans: number;
  dueToday: number;
  overdue: number;
  activeReservations: number;
  activeMembers: number;
}

export interface DashboardDueItem {
  /** '연체' | '예정' — 서버가 이미 한글 라벨 문자열로 내려준다(getDashboardData_ 그대로). */
  type: string;
  memberNo: string;
  memberName: string;
  title: string;
  barcode: string;
  dueAt: number;
  dueAtText: string;
  overdueDays: number;
}

export interface DashboardReadyItem {
  memberNo: string;
  memberName: string;
  title: string;
  pickupExpires: number;
  pickupExpiresText: string;
}

export interface DashboardData {
  libraryName: string;
  actorLabel: string;
  stats: DashboardStats;
  dueItems: DashboardDueItem[];
  readyItems: DashboardReadyItem[];
  refreshedAt: string;
}

export interface DashboardStoreState {
  data: DashboardData | null;
  /** true = 서버가 아직 dashboard 액션을 모름(UNKNOWN_ACTION) → mocks/dashboard.ts로 폴백 중. */
  sample: boolean;
  loading: boolean;
  /** UNKNOWN_ACTION이 아닌 실제 오류(네트워크·타임아웃 등)의 원문 — 마지막 성공 데이터는 유지한 채 별도로 표시한다. */
  error: string | null;
  /** 이 상태가 마지막으로 갱신된 클라이언트 시각(Date.now()) — 표시는 Intl로(ADR-023, 사전에 넣지 않음). */
  refreshedAt: number;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5분 자동 — FRONTEND.md "초 단위 폴링 금지"

class DashboardDataService {
  private state: DashboardStoreState = {
    data: null,
    sample: false,
    loading: false,
    error: null,
    refreshedAt: 0
  };
  private listeners = new Set<(s: DashboardStoreState) => void>();
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private dataChangeUnsub: (() => void) | null = null;
  private inFlight: Promise<void> | null = null;

  getState(): DashboardStoreState {
    return this.state;
  }

  onState(fn: (s: DashboardStoreState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setState(patch: Partial<DashboardStoreState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }

  /**
   * 갱신 트리거 4종(FRONTEND.md) 중 "진입 시" + 전역 싱글턴 설정을 한 번에 처리한다.
   * 데스크톱 기저층은 셸 부팅 시 1회만 마운트되므로 이 호출도 1회뿐이고, 모바일 「더보기」
   * 화면은 진입할 때마다 새로 마운트되므로(MobileShell.tsx 탭 전환) 그때마다 재호출된다 —
   * 아래에서 매 호출마다 refresh()를 실행해 "모바일도 더보기 진입마다 갱신"을 만족시키되,
   * 5분 인터벌 타이머와 트랜잭션-후 구독은 최초 1회만 등록해 중복 타이머가 쌓이지 않게 한다.
   */
  ensureAutoRefresh(): void {
    if (this.intervalTimer === null) {
      this.intervalTimer = setInterval(() => void this.refresh(), REFRESH_INTERVAL_MS);
    }
    if (this.dataChangeUnsub === null) {
      this.dataChangeUnsub = subscribeDataChange(() => void this.refresh());
    }
    void this.refresh();
  }

  /** 이미 진행 중인 조회가 있으면 그 결과에 합류한다 — 버튼 연타·동시 마운트로 중복 요청을 만들지 않는다. */
  async refresh(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.setState({ loading: true, error: null });
    const promise = (async () => {
      const res = await apiCall<DashboardData>('dashboard', {});
      if (res.ok) {
        this.setState({ data: res.data, sample: false, loading: false, error: null, refreshedAt: Date.now() });
        return;
      }
      if (res.error.code === 'UNKNOWN_ACTION') {
        // 아직 dashboard 액션이 없는 배포(재배포 전) — 버그가 아니라 예상된 현재 상태.
        // 샘플 데이터로 폴백하고 화면이 배지로 알린다(todo/04 「샘플 폴백」).
        this.setState({ data: mockDashboardData, sample: true, loading: false, error: null, refreshedAt: Date.now() });
        return;
      }
      // 그 외(네트워크·타임아웃 등)는 진짜 오류 — "백엔드에 액션이 없음"과 혼동하지 않는다.
      // 마지막으로 성공했던 데이터(실데이터든 샘플이든)는 그대로 둔 채 오류만 얹는다.
      this.setState({ loading: false, error: res.error.message || res.error.code });
    })();
    this.inFlight = promise;
    try {
      await promise;
    } finally {
      this.inFlight = null;
    }
  }
}

export const dashboardData = new DashboardDataService();

/** cameraSession.onStatus 소비 패턴(useState+useEffect)과 동일 — 셸 컴포넌트가 이 훅 하나로 구독한다. */
export function useDashboardData(): DashboardStoreState {
  const [state, setState] = useState<DashboardStoreState>(() => dashboardData.getState());
  useEffect(() => dashboardData.onState(setState), []);
  return state;
}
