import { Suspense, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BellRing,
  BookMarked,
  BookOpen,
  BookX,
  CalendarClock,
  ChevronRight,
  Clock,
  FileText,
  Gift,
  Megaphone,
  NotebookPen,
  RefreshCw,
  UserSearch,
  Users
} from 'lucide-react';
import { dashboardData, useDashboardData } from '../../services/dashboardData';
import { fetchRecentOps, type RecentOpRow } from '../../services/recentOpsData';
import { useReadyReservationCount } from '../../services/reservationData';
import { useManualEntryPendingCount } from '../../services/manualEntryData';
import { SampleDataBadge } from '../../components/SampleDataBadge';
import { t } from '../../i18n';
import { formatTimeHM } from '../../i18n/format';
import { LoanHeatmap, LoanTimeOfDay, MonthlyLoanCurve, ReservationPressure, ShelfHeatmap, VizLazyMount } from '../../viz';
import { useWindowStore } from './useWindowStore';
import './dashboard.css';

// ADR-021 「데스크톱 기저층 = 대시보드」. DesktopShell.tsx가 windows.map(...) 보다 먼저(=DOM에서
// 아래, z-index로도 아래) 렌더한다 — 창이 아니므로 useWindowStore의 windows 배열에 들어가지 않고,
// 닫기·이동 대상도 아니다(FRONTEND.md "창이 아니라 기저층이다 — 닫기·이동 불가"). 창을 전부
// 닫으면 자동으로 드러난다(별도 조건부 렌더 불필요, 항상 마운트되어 있고 z-order만으로 충분).
//
// KPI 6칸의 실제 매핑·조용한 신호 report type 문자열·"마지막 백업" 처리 방식은
// docs/ASSUMPTIONS.md "todo/04" 섹션에 근거와 함께 기록했다 — getDashboardData_()가 실제로
// 갖고 있지 않은 필드(오늘 대출/반납 건수, 분실 권수, 백업 시각)를 지어내지 않기 위한 선택들이다.

type KpiAccent = 'deep' | 'brass' | 'pass' | 'wait' | 'ink-2' | 'fail';

interface KpiCard {
  labelKey: string;
  value: number;
  icon: LucideIcon;
  accent: KpiAccent;
}

interface QuietSignalItem {
  reportType: string;
  labelKey: string;
  icon: LucideIcon;
}

// FEATURES.md R1 다섯 리포트 — reportType 문자열은 todo/05가 실제 리포트 종류 코드를 정할 때까지의
// 잠정 식별자다(placeholder reports 뷰가 params.type으로 그대로 받아 표시만 한다).
const QUIET_SIGNALS: QuietSignalItem[] = [
  { reportType: 'no-loan-finder', labelKey: 'dashboard.quietSignal.noLoanFinder', icon: UserSearch },
  { reportType: 'homeroom-report', labelKey: 'dashboard.quietSignal.homeroomReport', icon: FileText },
  { reportType: 'weeding-recommend', labelKey: 'dashboard.quietSignal.weedingRecommend', icon: BookX },
  { reportType: 'recall-notice', labelKey: 'dashboard.quietSignal.recallNotice', icon: Megaphone },
  { reportType: 'donor-thanks', labelKey: 'dashboard.quietSignal.donorThanks', icon: Gift }
];

export default function DashboardBaseLayer() {
  const { data, sample, loading, error, refreshedAt } = useDashboardData();

  // todo/48(P2-1) — 「최근 처리」 카드 내용: 대시보드 갱신 주기(refreshedAt)에 올라타 재조회.
  // fetchRecentOps는 readCache(15s TTL·쓰기 신호 무효화) 경유라 추가 호출 비용이 거의 없다.
  const [recentRows, setRecentRows] = useState<RecentOpRow[]>([]);
  const [recentSample, setRecentSample] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void fetchRecentOps(5).then((outcome) => {
      if (cancelled || !outcome.ok) return;
      setRecentRows(outcome.rows);
      setRecentSample(outcome.sample);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshedAt]);
  const openWindow = useWindowStore((s) => s.openWindow);
  // 「예약 도착」 카드(todo/12) — 기존 "예약대기" KPI(dashboard.kpi.activeReservations)는
  // getDashboardData_() stats.activeReservations 그대로라 WAITING+READY 합산값이다(수정 금지
  // 대상). READY(수령 준비 완료)만 따로 보여주려면 그 필드 하나로는 부족해서(도착 여부가 안
  // 갈라짐) reservations 액션에서 별도로 가져온다 — services/reservationData.ts 주석 참고.
  const readyPickup = useReadyReservationCount();
  // 수기입력 미처리(todo/21, 구 PATCH_SPEC P3) — GAS 장애 대비 비상 경로(22_MANUAL_ENTRY)가
  // 아직 흡수되지 않은 행이 쌓이고 있는지 사서가 대시보드에서 바로 확인한다. readyPickup과
  // 같은 이유(대시보드 자체 데이터 변경 감지 불가)로 새로고침 버튼에 refresh()를 함께 연결한다
  // (아래 dash-header-meta 참고).
  const manualEntryPending = useManualEntryPendingCount();

  // "진입 시" 갱신(FRONTEND.md 4트리거 중 하나) — 이 컴포넌트는 셸 부팅 시 1회만 마운트되므로
  // 이 effect도 1회만 실행된다. ensureAutoRefresh()가 5분 인터벌·트랜잭션-후 구독도 함께 건다.
  useEffect(() => {
    dashboardData.ensureAutoRefresh();
  }, []);

  const stats = data?.stats;
  const kpiCards = useMemo<KpiCard[]>(
    () => [
      { labelKey: 'dashboard.kpi.openLoans', value: stats?.openLoans ?? 0, icon: BookOpen, accent: 'deep' },
      { labelKey: 'dashboard.kpi.dueToday', value: stats?.dueToday ?? 0, icon: CalendarClock, accent: 'brass' },
      { labelKey: 'dashboard.kpi.availableCopies', value: stats?.availableCopies ?? 0, icon: BookMarked, accent: 'pass' },
      { labelKey: 'dashboard.kpi.activeReservations', value: stats?.activeReservations ?? 0, icon: Clock, accent: 'wait' },
      { labelKey: 'dashboard.kpi.activeMembers', value: stats?.activeMembers ?? 0, icon: Users, accent: 'ink-2' },
      { labelKey: 'dashboard.kpi.overdue', value: stats?.overdue ?? 0, icon: AlertTriangle, accent: 'fail' }
    ],
    [stats]
  );

  const dueItems = data?.dueItems ?? [];
  const hasData = data !== null;
  const refreshedTimeText = refreshedAt ? formatTimeHM(refreshedAt) : '—';

  return (
    <div className="dashboard-base">
      <header className="dash-header">
        <div className="dash-header-main">
          <h1>{data?.libraryName || t('dashboard.title')}</h1>
          {sample && <SampleDataBadge />}
        </div>
        <div className="dash-header-meta">
          {data?.actorLabel && <span>{data.actorLabel}</span>}
          <span>{t('dashboard.lastRefreshed', { time: refreshedTimeText })}</span>
          <span className="dash-manual-entry-pending" title={t('dashboard.manualEntryPending.hint')}>
            <NotebookPen size={14} aria-hidden />
            {t('dashboard.manualEntryPending.label', { count: manualEntryPending.loading ? '—' : manualEntryPending.count })}
            {manualEntryPending.sample && <SampleDataBadge />}
          </span>
          <button
            type="button"
            className="ghost dash-refresh-btn"
            onClick={() => {
              void dashboardData.refresh();
              manualEntryPending.refresh();
            }}
            disabled={loading}
          >
            <RefreshCw size={14} aria-hidden /> {loading ? t('common.loading') : t('dashboard.refreshButton')}
          </button>
        </div>
      </header>

      {error && (
        <div className="dash-error" role="alert">
          {t('dashboard.errorBanner', { message: error })}
        </div>
      )}

      <div className="dash-kpi-grid">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.labelKey} className={`dash-kpi dash-kpi--${card.accent}`}>
              <Icon size={18} aria-hidden />
              <span className="dash-kpi-value">{!hasData && loading ? '—' : card.value}</span>
              <span className="dash-kpi-label">{t(card.labelKey)}</span>
            </div>
          );
        })}
      </div>

      <div className="dash-columns">
        <section className="dash-panel panel">
          <h2>{t('dashboard.quietSignal.title')}</h2>
          <ul className="dash-signal-list">
            {QUIET_SIGNALS.map((sig) => {
              const Icon = sig.icon;
              return (
                <li key={sig.reportType}>
                  <button type="button" className="dash-signal-btn" onClick={() => openWindow('reports', { type: sig.reportType })}>
                    <Icon size={16} aria-hidden />
                    <span>{t(sig.labelKey)}</span>
                    <ChevronRight size={16} aria-hidden className="dash-signal-chevron" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="dash-panel panel">
          <h2>{t('dashboard.overdueTop.title')}</h2>
          {dueItems.length === 0 ? (
            <p className="dash-empty">{t('dashboard.overdueTop.empty')}</p>
          ) : (
            <ul className="dash-due-list">
              {dueItems.map((item, i) => (
                <li key={`${item.barcode}-${i}`} className={`dash-due-item${item.overdueDays > 0 ? ' is-overdue' : ''}`}>
                  <span className="dash-due-title">{item.title}</span>
                  <span className="dash-due-member">{item.memberName || item.memberNo}</span>
                  <span className="dash-due-status">
                    {item.overdueDays > 0
                      ? t('dashboard.overdueTop.overdueDays', { days: item.overdueDays })
                      : t('dashboard.overdueTop.dueTodayLabel')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dash-panel panel">
          <h2>
            {t('dashboard.recentOps.title')}
            {recentSample && <SampleDataBadge />}
          </h2>
          <div className="dash-recent-body">
            {/* todo/48(디자인 연구 P2-1): 유일하게 내용 없던 카드 — 최근 3건을 직접 보여준다.
                recentOps 읽기는 readCache(15s) 경유라 추가 비용이 거의 없고, 갱신 신호에도
                올라탄다. 폴백(빈 목록·미배포)은 기존 안내문 유지. */}
            {recentRows.length > 0 ? (
              <ul className="dash-recent-list">
                {recentRows.slice(0, 3).map((row) => (
                  <li key={row.logId}>
                    <span className="dash-recent-time mono">
                      {formatTimeHM(row.occurredAt)}
                    </span>
                    <span className="dash-recent-summary">{row.summary}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dash-empty">{t('dashboard.recentOps.hint')}</p>
            )}
            <button type="button" className="ghost" onClick={() => openWindow('recent-ops')}>
              {t('dashboard.recentOps.openButton')}
            </button>
          </div>
        </section>

        {/* 예약 도착(todo/12) — 기존 "예약대기" KPI(WAITING+READY 합산)와 별개로 READY(수령
            준비 완료) 건수만 보여주는 클릭형 카드. reservations 뷰(도착알림 탭)로 직행한다. */}
        <section className="dash-panel panel dash-arrivals">
          <h2>
            {t('dashboard.readyPickup.title')}
            {readyPickup.sample && <SampleDataBadge />}
          </h2>
          <button type="button" className="dash-arrivals-btn" onClick={() => openWindow('reservations', { filter: 'READY' })}>
            <BellRing size={20} aria-hidden />
            <span className="dash-arrivals-value">{readyPickup.loading ? '—' : readyPickup.count}</span>
            <span className="dash-arrivals-label">{t('dashboard.readyPickup.label')}</span>
            <ChevronRight size={16} aria-hidden className="dash-signal-chevron" />
          </button>
        </section>
      </div>

      {/* todo/06 시각화 V1 — 대출 잔디·예약 압력(캘린더/사분면 트리맵은 리포트 허브 쪽,
          views/reports/index.tsx 「장서 시각화」 6번째 카드). 각 차트는 VizLazyMount로
          뷰포트에 들어오기 전까지 마운트되지 않고(fetch도 그때 처음 실행), Suspense는
          viz/index.ts의 React.lazy() JS 청크 로딩만 담당한다(완료 조건 "지연 로딩").
          todo/18 — 하루의 파도·열두 달 곡선을 여기 더했다: 둘 다 "요즘 도서관이 어떻게
          돌아가나"를 매일 훑어보는 관찰용 시계열이라(연체 흐름·반 참여 링처럼 반/정책
          단위 의사결정 자료가 아니다) 대출 잔디·예약 압력과 같은 성격이라고 판단했다
          (docs/ASSUMPTIONS.md todo/18 착륙 지점 근거).
          todo/19 — 서가 온도를 여기 더했다(V1 12종 중 나머지 3종은 reports 쪽,
          views/reports/index.tsx VizInsightsPanel 참고): 장서 나이·학년 독서 격차·예산
          그림은 트리맵·회전율 사분면처럼 "가끔 들여다보는 의사결정 자료"에 가깝지만, 서가
          온도는 "지금 서가가 어떤 상태인가"를 훑어보는 공간적 스냅샷이라 대출 잔디·예약
          압력과 같은 성격의 일상 점검 신호로 판단했다(docs/ASSUMPTIONS.md todo/19). */}
      <section className="dash-viz-section">
        <h2>{t('dashboard.vizRow.heading')}</h2>
        <div className="dash-viz-grid">
          <Suspense fallback={<div className="dash-viz-loading">{t('common.loading')}</div>}>
            <VizLazyMount>
              <LoanHeatmap />
            </VizLazyMount>
          </Suspense>
          <Suspense fallback={<div className="dash-viz-loading">{t('common.loading')}</div>}>
            <VizLazyMount>
              <ReservationPressure onNavigate={openWindow} />
            </VizLazyMount>
          </Suspense>
          <Suspense fallback={<div className="dash-viz-loading">{t('common.loading')}</div>}>
            <VizLazyMount>
              <LoanTimeOfDay />
            </VizLazyMount>
          </Suspense>
          <Suspense fallback={<div className="dash-viz-loading">{t('common.loading')}</div>}>
            <VizLazyMount>
              <MonthlyLoanCurve />
            </VizLazyMount>
          </Suspense>
          <Suspense fallback={<div className="dash-viz-loading">{t('common.loading')}</div>}>
            <VizLazyMount>
              <ShelfHeatmap onNavigate={openWindow} />
            </VizLazyMount>
          </Suspense>
        </div>
      </section>

      <footer className="dash-footer">
        <span>{t('dashboard.lastBackup.label')}</span>
        <span>{t('dashboard.lastBackup.unavailable')}</span>
      </footer>
    </div>
  );
}
