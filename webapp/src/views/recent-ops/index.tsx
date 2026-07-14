import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { ViewProps } from '../../types';
import { getViewMeta } from '../../registry';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { SampleDataBadge } from '../../components/SampleDataBadge';
import { fetchRecentOps, type RecentOpRow } from '../../services/recentOpsData';
import { t } from '../../i18n';

// 최근 처리 뷰 — FRONTEND.md "recent-ops... 목록을 DataTable로 이관"(todo/08). 15_AUDIT_LOG를
// 읽기 전용으로 조회하는 recentOps 액션(school-patch-v1/Code.gs apiWebRecentOps_) 결과를 공용
// DataTable로 그린다 — dashboardData.ts/reportData.ts와 같은 UNKNOWN_ACTION→샘플 폴백 규약.

const ACTION_LABEL_KEYS: Record<string, string> = {
  CHECKOUT: 'views.recentOps.action.checkout',
  RETURN: 'views.recentOps.action.return',
  RENEW: 'views.recentOps.action.renew',
  RESERVE: 'views.recentOps.action.reserve',
  CANCEL_RESERVATION: 'views.recentOps.action.cancelReservation',
  REGISTER_MEMBER: 'views.recentOps.action.registerMember',
  UPDATE_MEMBER: 'views.recentOps.action.updateMember',
  REGISTER_TITLE: 'views.recentOps.action.registerTitle',
  REGISTER_COPY: 'views.recentOps.action.registerCopy',
  REGISTER_BY_ISBN: 'views.recentOps.action.registerByIsbn',
  MARK_LOAN_LOST: 'views.recentOps.action.markLoanLost',
  PAY_FINE: 'views.recentOps.action.payFine',
  UPDATE_COPY_STATUS: 'views.recentOps.action.updateCopyStatus',
  RECONCILE_COPY_STATUS: 'views.recentOps.action.reconcileCopyStatus',
  UPSERT_STAFF: 'views.recentOps.action.upsertStaff',
  UPDATE_POLICY: 'views.recentOps.action.updatePolicy',
  DAILY_MAINTENANCE: 'views.recentOps.action.dailyMaintenance'
};

function actionLabel(code: string): string {
  const key = ACTION_LABEL_KEYS[code];
  return key ? t(key) : code;
}

const RECENT_OPS_LIMIT = 100;

export default function RecentOpsView({ shell }: ViewProps) {
  const [rows, setRows] = useState<RecentOpRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sample, setSample] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    shell.setTitle(getViewMeta('recent-ops')?.title ?? t('registry.recentOps.title'));
  }, [shell]);

  async function load() {
    setLoading(true);
    setError(null);
    const outcome = await fetchRecentOps(RECENT_OPS_LIMIT);
    setLoading(false);
    if (outcome.ok) {
      setRows(outcome.rows);
      setSample(outcome.sample);
    } else {
      setError(outcome.message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const columns: DataTableColumn<RecentOpRow>[] = [
    { key: 'occurredAt', header: t('views.recentOps.col.occurredAt'), sortable: true, mono: true, mobilePrimary: true },
    {
      key: 'actionCode',
      header: t('views.recentOps.col.action'),
      sortable: true,
      render: (row) => actionLabel(row.actionCode),
      filterValue: (row) => `${row.actionCode} ${actionLabel(row.actionCode)}`,
      mobileSecondary: true
    },
    { key: 'summary', header: t('views.recentOps.col.summary'), sortable: true },
    { key: 'entityType', header: t('views.recentOps.col.entityType'), sortable: true },
    { key: 'entityId', header: t('views.recentOps.col.entityId'), sortable: true, mono: true },
    { key: 'actorId', header: t('views.recentOps.col.actor'), sortable: true, mono: true }
  ];

  const toolbarExtra = sample ? <SampleDataBadge /> : null;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="ghost" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} aria-hidden /> {loading ? t('common.loading') : t('views.recentOps.refresh')}
        </button>
      </div>
      <DataTable<RecentOpRow>
        columns={columns}
        rows={rows}
        rowKey={(row) => row.logId}
        platform={shell.platform}
        loading={loading}
        error={error}
        emptyHint={t('views.recentOps.empty')}
        csvFileName="recent-ops.csv"
        searchPlaceholder={t('views.recentOps.searchPlaceholder')}
        toolbarExtra={toolbarExtra}
        defaultPageSize={50}
      />
    </div>
  );
}
