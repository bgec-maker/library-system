import { useEffect, useMemo } from 'react';
import type { ViewProps } from '../../types';
import { getViewMeta } from '../../registry';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { SampleDataBadge } from '../../components/SampleDataBadge';
import { ensureCatalogSync, useCatalogSync, type CatalogCopyRow } from '../../services/catalog';
import { t } from '../../i18n';
import './catalog.css';

// catalog(장서 대장) 뷰 — FRONTEND.md 「catalog(장서 대장) 뷰」 + ADR-024. 정본은
// services/catalog.ts의 IndexedDB 미러다 — 이 뷰는 그 미러를 DataTable로 그리기만 한다.
// 🔴 서버 페이지네이션 없음: 정렬·필터·페이지는 전부 로컬(state.rows, 이미 동기화된 전체
// 배열)에서 처리하고, 마운트 시 ensureCatalogSync()로 백그라운드 델타 동기화만 트리거한다.
// 인라인 편집·대량 작업은 v2 범위(FRONTEND.md) — 이 뷰는 조회 + book-detail 진입점까지만.

const STATUS_LABEL_KEYS: Record<string, string> = {
  AVAILABLE: 'views.catalog.status.available',
  ON_LOAN: 'views.catalog.status.onLoan',
  HOLD_READY: 'views.catalog.status.holdReady',
  REPAIR: 'views.catalog.status.repair',
  LOST: 'views.catalog.status.lost',
  WITHDRAWN: 'views.catalog.status.withdrawn'
};

function statusLabel(code: string): string {
  const key = STATUS_LABEL_KEYS[code];
  return key ? t(key) : code;
}

export default function CatalogView({ shell }: ViewProps) {
  const state = useCatalogSync();

  useEffect(() => {
    shell.setTitle(getViewMeta('catalog')?.title ?? t('registry.catalog.title'));
  }, [shell]);

  useEffect(() => {
    ensureCatalogSync();
  }, []);

  const columns = useMemo<DataTableColumn<CatalogCopyRow>[]>(
    () => [
      { key: 'barcode', header: t('views.catalog.col.barcode'), sortable: true, mono: true, mobilePrimary: true },
      { key: 'title', header: t('views.catalog.col.title'), sortable: true, mobileSecondary: true },
      { key: 'authors', header: t('views.catalog.col.authors'), sortable: true },
      { key: 'classification', header: t('views.catalog.col.classification'), sortable: true },
      {
        key: 'statusCode',
        header: t('views.catalog.col.status'),
        sortable: true,
        render: (row) => statusLabel(row.statusCode),
        filterValue: (row) => `${row.statusCode} ${statusLabel(row.statusCode)}`,
        csvValue: (row) => statusLabel(row.statusCode)
      },
      { key: 'loanCount', header: t('views.catalog.col.loanCount'), sortable: true, numeric: true },
      { key: 'lastLoanAt', header: t('views.catalog.col.lastLoanAt'), sortable: true, mono: true },
      { key: 'shelfCode', header: t('views.catalog.col.shelf'), sortable: true },
      { key: 'acquiredAt', header: t('views.catalog.col.acquiredAt'), sortable: true, mono: true }
    ],
    []
  );

  const toolbarExtra = (state.sample || state.syncing) && (
    <span className="catalog-sync-badge">
      {state.sample && <SampleDataBadge />}
      {state.syncing && (
        <span className="catalog-sync-progress">
          {t('views.catalog.syncing', { count: state.syncedCount, total: state.totalHint ?? '?' })}
        </span>
      )}
    </span>
  );

  return (
    <div className="catalog-view">
      <DataTable<CatalogCopyRow>
        columns={columns}
        rows={state.rows}
        rowKey={(row) => row.copyId}
        onRowClick={(row) => shell.open('book-detail', { titleId: row.titleId, barcode: row.barcode })}
        platform={shell.platform}
        loading={state.syncing && state.rows.length === 0}
        error={state.error}
        emptyHint={t('views.catalog.empty')}
        csvFileName="catalog.csv"
        searchPlaceholder={t('views.catalog.searchPlaceholder')}
        toolbarExtra={toolbarExtra}
        defaultPageSize={50}
      />
    </div>
  );
}
