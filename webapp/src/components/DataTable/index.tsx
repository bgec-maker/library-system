import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Download, Inbox } from 'lucide-react';
import { t } from '../../i18n';
import { Paginator } from './Paginator';
import { toCsvBlob, downloadBlob } from './csv';
import type { DataTableColumn, SortState } from './types';
import './DataTable.css';

export type { DataTableColumn, SortDirection, SortState } from './types';

// FRONTEND.md 「공용 DataTable + Paginator」의 단일 구현체 — catalog(todo/08)·recent-ops·
// reports 온스크린 미리보기가 전부 이 컴포넌트 하나를 소비한다("표 UI 중복 금지"). 이 파일은
// 특정 도메인(장서·리포트 등)을 전혀 알지 못한다 — column.header는 호출측이 이미 t()로
// 번역해서 넘긴다.
//
// 성능(FRONTEND.md "성능 예산", 완료 조건 "5,000행에서 정렬/페이지 즉답"): 필터·정렬은 rows가
// 바뀌거나 검색어·정렬 상태가 바뀔 때만 useMemo로 다시 계산하고(키 입력마다 5,000행을 다시
// 렌더하지 않음), 실제 DOM에 그리는 건 마지막에 pageRows(현재 페이지 몫)로 슬라이스한 배열뿐이다
// — Paginator는 "숨김"이 아니라 "잘라내기"를 한다.
const DEFAULT_PAGE_SIZE_OPTIONS = [25, 50, 100];

function cellRaw<T>(row: T, column: DataTableColumn<T>): unknown {
  return (row as Record<string, unknown>)[column.key];
}

function sortValueOf<T>(row: T, column: DataTableColumn<T>): string | number {
  if (column.sortAccessor) return column.sortAccessor(row);
  const raw = cellRaw(row, column);
  return typeof raw === 'number' ? raw : String(raw ?? '');
}

function filterValueOf<T>(row: T, column: DataTableColumn<T>): string {
  if (column.filterValue === false) return '';
  if (column.filterValue) return column.filterValue(row);
  const raw = cellRaw(row, column);
  return raw === null || raw === undefined ? '' : String(raw);
}

// todo/31 실측(5,000행 더미): 비교마다 localeCompare(undefined, {numeric:true})를 부르면 V8이
// 호출마다 Collator를 만들어 정렬이 284ms — 기준기(4GB 구형 PC)에선 초 단위가 된다. Collator를
// 한 번만 생성해 재사용하면 13.2ms(×21.5). 의미는 동일(같은 로케일·numeric 옵션).
const SORT_COLLATOR = new Intl.Collator(undefined, { numeric: true });

function csvValueOf<T>(row: T, column: DataTableColumn<T>): string | number {
  if (column.csvValue) return column.csvValue(row);
  if (column.sortAccessor) return column.sortAccessor(row);
  const raw = cellRaw(row, column);
  return raw === null || raw === undefined ? '' : (raw as string | number);
}

function cellDisplay<T>(row: T, column: DataTableColumn<T>): ReactNode {
  if (column.render) return column.render(row);
  const raw = cellRaw(row, column);
  return raw === null || raw === undefined ? '' : String(raw);
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  /** 이미 로딩된 전체 데이터셋 — 서버 페이지네이션 금지(ADR-024): 정렬·필터·페이지는 전부 이
   *  배열에서 로컬로 처리한다. */
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** ShellContext.platform — views/**는 matchMedia/innerWidth를 직접 쓸 수 없으므로(린트 강제)
   *  호출측 뷰가 셸에서 받은 값을 그대로 넘긴다. 'mobile'이면 표 대신 카드 리스트로 렌더한다. */
  platform: 'desktop' | 'mobile';
  /** true면 초기 로딩 상태(데이터 0건)로 취급 — 이미 캐시된 rows가 있으면(예: catalog의
   *  progressive 동기화) 배경 동기화 중이어도 이 값과 무관하게 표를 그대로 보여준다.
   *  진행 표시는 toolbarExtra 슬롯으로 별도 전달한다. */
  loading?: boolean;
  error?: string | null;
  emptyHint?: string;
  /** todo/54(레퍼런스 점검 2-2, NN/g 빈 상태 가이드라인 3) — 빈 상태에서 바로 이어갈 다음 행동.
   *  라벨은 호출측이 t()로 번역해 넘긴다(이 컴포넌트는 도메인 무지 원칙 유지). 행동이
   *  자연스러운 화면에만 달 것 — "행동 없음이 정상"인 목록(미변상 등)엔 달지 않는다. */
  emptyAction?: { label: string; onClick: () => void };
  /** todo/76 — CSV 전체 컬럼 정의(백업·엑셀 후처리용). 주어지면 내보내기 옆에 범위 셀렉트
   *  (표시 컬럼/전체 컬럼)가 생긴다. 전체 컬럼도 같은 toCsvBlob 경로 — 수식 방어(defuse)가
   *  모든 셀에 동일 적용된다. 호출측이 원값(코드) 충실도를 결정한다. */
  csvFullColumns?: DataTableColumn<T>[];
  csvFileName?: string;
  defaultSort?: SortState;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  searchPlaceholder?: string;
  /** 툴바 우측에 끼워 넣을 도메인 슬롯(예: SampleDataBadge, 동기화 진행률) — DataTable 자체는
   *  이 내용의 의미를 모른다. */
  toolbarExtra?: ReactNode;
  ariaLabel?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  platform,
  loading = false,
  error = null,
  emptyHint,
  emptyAction,
  csvFullColumns,
  csvFileName = 'export.csv',
  defaultSort,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  defaultPageSize = 50,
  searchPlaceholder,
  toolbarExtra,
  ariaLabel,
  className
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState | null>(defaultSort ?? null);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [page, setPage] = useState(1);
  // todo/76 — CSV 범위(표시/전체). csvFullColumns 없는 표에선 UI 자체가 안 뜬다.
  const [csvScope, setCsvScope] = useState<'visible' | 'full'>('visible');

  const filterColumns = useMemo(() => columns.filter((c) => c.filterValue !== false), [columns]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => filterColumns.some((col) => filterValueOf(row, col).toLowerCase().includes(q)));
  }, [rows, query, filterColumns]);

  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filteredRows;
    const dir = sort.direction === 'asc' ? 1 : -1;
    // slice() 후 정렬 — 원본 rows·filteredRows 배열은 그대로 둔다(파생 뷰, 원본 불변).
    return [...filteredRows].sort((a, b) => {
      const av = sortValueOf(a, col);
      const bv = sortValueOf(b, col);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return SORT_COLLATOR.compare(String(av), String(bv)) * dir;
    });
  }, [filteredRows, sort, columns]);

  // 검색어·정렬·페이지 크기가 바뀌면 1페이지로 되돌린다(이전 페이지 번호가 새 결과 범위를
  // 벗어날 수 있으므로).
  useEffect(() => {
    setPage(1);
  }, [query, sort, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageStart = (clampedPage - 1) * pageSize;
  const pageRows = useMemo(() => sortedRows.slice(pageStart, pageStart + pageSize), [sortedRows, pageStart, pageSize]);

  function toggleSort(col: DataTableColumn<T>) {
    if (!col.sortable) return;
    setSort((prev) => {
      if (!prev || prev.key !== col.key) return { key: col.key, direction: 'asc' };
      if (prev.direction === 'asc') return { key: col.key, direction: 'desc' };
      return null;
    });
  }

  function ariaSortOf(col: DataTableColumn<T>): 'ascending' | 'descending' | 'none' {
    if (!sort || sort.key !== col.key) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  function handleExportCsv() {
    // "currently loaded (not just currently-visible-page) dataset" — 현재 필터·정렬이 적용된
    // 전체(sortedRows)를 내보낸다. 현재 페이지 몫(pageRows)이 아니다.
    const exportColumns = csvScope === 'full' && csvFullColumns ? csvFullColumns : columns;
    const blob = toCsvBlob(exportColumns, sortedRows, csvValueOf);
    downloadBlob(blob, csvFileName);
  }

  const hasRows = rows.length > 0;
  const hasVisibleRows = pageRows.length > 0;
  const primaryCol = columns.find((c) => c.mobilePrimary);
  const secondaryCol = columns.find((c) => c.mobileSecondary);
  const restCols = columns.filter((c) => c !== primaryCol && c !== secondaryCol);

  return (
    <div className={`data-table${className ? ` ${className}` : ''}`}>
      <div className="data-table-toolbar">
        <input
          type="search"
          className="data-table-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder ?? t('components.dataTable.searchPlaceholder')}
          aria-label={searchPlaceholder ?? t('components.dataTable.searchPlaceholder')}
        />
        <div className="data-table-toolbar-actions">
          {toolbarExtra}
          {csvFullColumns && (
            <select
              className="data-table-csv-scope"
              aria-label={t('components.dataTable.csvScopeLabel')}
              value={csvScope}
              onChange={(e) => setCsvScope(e.target.value === 'full' ? 'full' : 'visible')}
            >
              <option value="visible">{t('components.dataTable.csvScopeVisible')}</option>
              <option value="full">{t('components.dataTable.csvScopeFull')}</option>
            </select>
          )}
          <button type="button" className="ghost data-table-csv-btn" onClick={handleExportCsv} disabled={sortedRows.length === 0}>
            <Download size={16} aria-hidden /> {t('components.dataTable.exportCsv')}
          </button>
        </div>
      </div>

      {error && (
        <div className="data-table-error" role="alert">
          {t('components.dataTable.errorPrefix', { message: error })}
        </div>
      )}

      {loading && !hasRows && (
        /* todo/58(인터랙션 표준 — 스켈레톤) — 첫 로딩(캐시 0건)만. 빈 화면+텍스트는 "고장?"으로,
           형태 있는 자리표시는 "곧 온다"로 읽힌다. 배경 동기화는 기존 행 유지 + toolbarExtra가
           담당(이 분기 자체가 !hasRows). 펄스는 opacity만(성능 예산). */
        <div className="data-table-skeleton" aria-busy="true">
          <span className="sr-only">{t('common.loading')}</span>
          {platform === 'mobile'
            ? Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="data-table-skel-card" aria-hidden="true">
                  <div className="skel-bar skel-w-40" />
                  <div className="skel-bar skel-w-70" />
                  <div className="skel-bar skel-w-55" />
                </div>
              ))
            : /* todo/87 — 막대 3개 고정 대신 실제 표와 같은 골격: 진짜 thead(헤더는 이미
                 아는 정보다 — 로딩 중인 건 행뿐) + 실제 열 수만큼의 셀. 도착할 표와 닮을수록
                 자리표시가 "곧 온다"로 읽힌다. 폭 변주는 (행+열)%3 — 결정론(랜덤 금지). */
              (() => {
                const widths = ['skel-w-70', 'skel-w-40', 'skel-w-55'];
                return (
                  <div className="data-table-scroll" aria-hidden="true">
                    <table className="data-table-grid data-table-skel-table">
                      <thead>
                        <tr>
                          {columns.map((col) => (
                            <th key={col.key} scope="col" className={col.numeric ? 'is-numeric' : ''}>
                              {col.header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 5 }, (_, r) => (
                          <tr key={r}>
                            {columns.map((col, c) => (
                              <td key={col.key}>
                                <div className={`skel-bar ${widths[(r + c) % widths.length]}`} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
        </div>
      )}

      {!loading && !hasRows && (
        <div className="data-table-empty">
          <Inbox size={28} aria-hidden />
          <p>{emptyHint ?? t('components.dataTable.emptyDefault')}</p>
          {emptyAction && (
            <button type="button" className="ghost data-table-empty-action" onClick={emptyAction.onClick}>
              {emptyAction.label}
            </button>
          )}
        </div>
      )}

      {hasRows && platform === 'desktop' && (
        <div className="data-table-scroll">
          <table className="data-table-grid" aria-label={ariaLabel}>
            <thead>
              <tr>
                {columns.map((col) => {
                  const isActive = sort?.key === col.key;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={col.sortable ? ariaSortOf(col) : undefined}
                      className={[col.numeric ? 'is-numeric' : '', isActive ? 'is-sorted' : ''].filter(Boolean).join(' ')}
                    >
                      {col.sortable ? (
                        <button type="button" className="data-table-sort-btn" onClick={() => toggleSort(col)}>
                          <span>{col.header}</span>
                          {isActive &&
                            (sort?.direction === 'asc' ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {hasVisibleRows ? (
                pageRows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className={onRowClick ? 'is-clickable' : ''}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    role={onRowClick ? 'button' : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={[col.numeric ? 'is-numeric' : '', col.mono ? 'mono' : '', col.nowrap ? 'is-nowrap' : '']
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {cellDisplay(row, col)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr className="data-table-no-match">
                  <td colSpan={columns.length}>{t('components.dataTable.noMatch')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {hasRows && platform === 'mobile' && (
        <ul className="data-table-cards">
          {hasVisibleRows ? (
            pageRows.map((row) => (
              <li
                key={rowKey(row)}
                className={`data-table-card${onRowClick ? ' is-clickable' : ''}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
                {primaryCol && <div className="data-table-card-primary">{cellDisplay(row, primaryCol)}</div>}
                {secondaryCol && <div className="data-table-card-secondary">{cellDisplay(row, secondaryCol)}</div>}
                <dl className="data-table-card-rest">
                  {restCols.map((col) => (
                    <div key={col.key} className="data-table-card-row">
                      <dt>{col.header}</dt>
                      <dd className={col.mono ? 'mono' : ''}>{cellDisplay(row, col)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))
          ) : (
            <li className="data-table-card-no-match">{t('components.dataTable.noMatch')}</li>
          )}
        </ul>
      )}

      {hasRows && (
        <Paginator
          page={clampedPage}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          totalRows={sortedRows.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  );
}
