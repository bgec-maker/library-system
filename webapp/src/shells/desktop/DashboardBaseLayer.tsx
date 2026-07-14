import { useEffect, useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  BookX,
  CalendarClock,
  ChevronRight,
  Clock,
  FileText,
  Gift,
  Megaphone,
  RefreshCw,
  UserSearch,
  Users
} from 'lucide-react';
import { dashboardData, useDashboardData } from '../../services/dashboardData';
import { SampleDataBadge } from '../../components/SampleDataBadge';
import { intlLocaleTag, t } from '../../i18n';
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
  const openWindow = useWindowStore((s) => s.openWindow);

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
  const refreshedTimeText = refreshedAt ? new Date(refreshedAt).toLocaleTimeString(intlLocaleTag(), { hour12: false }) : '—';

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
          <button
            type="button"
            className="ghost dash-refresh-btn"
            onClick={() => void dashboardData.refresh()}
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
          <h2>{t('dashboard.recentOps.title')}</h2>
          <div className="dash-recent-body">
            <p className="dash-empty">{t('dashboard.recentOps.hint')}</p>
            <button type="button" className="ghost" onClick={() => openWindow('recent-ops')}>
              {t('dashboard.recentOps.openButton')}
            </button>
          </div>
        </section>
      </div>

      <footer className="dash-footer">
        <span>{t('dashboard.lastBackup.label')}</span>
        <span>{t('dashboard.lastBackup.unavailable')}</span>
      </footer>
    </div>
  );
}
