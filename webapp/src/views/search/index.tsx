import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookMarked } from 'lucide-react';
import type { ViewProps } from '../../types';
import { getViewMeta } from '../../registry';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { SampleDataBadge } from '../../components/SampleDataBadge';
import { ScanCameraStart } from '../../components/ScanCameraStart';
import { ensureCatalogSync, useCatalogSync, type CatalogCopyRow } from '../../services/catalog';
import { createReservation } from '../../services/reservationData';
import { getEffectiveScanRoute, subscribeScan } from '../../services/scanBus';
import { toChoseongString, matchesQuery } from '../../services/choseong';
import { t } from '../../i18n';
import './search.css';

// 통합 검색 뷰 — todo/15. 24줄 스텁("완전 구현은 이후 라운드")을 교체한다. 정본은 catalog.ts의
// IndexedDB 미러(todo/08) 그대로다 — 이 뷰는 별도 서버 조회를 추가하지 않는다(ADR-024 "검색은
// 브라우저에서, GAS 0회" — 이 화면이 그 원칙의 실제 소비자).
//
// 검색 파이프라인 설계(docs/ASSUMPTIONS.md `## todo/15`에 근거 기록): components/DataTable는
// 건드리지 않았다 — catalog·recent-ops·reports·reservations·book-detail 5곳이 공유하는 컴포넌트라
// 그 안의 검색 상자를 초성 인식으로 바꾸면 5곳 전부의 회귀 위험을 새로 떠안는다. 대신
// views/reservations/index.tsx가 이미 쓰는 패턴(탭이 `items`를 `filteredRows`로 미리 걸러
// DataTable에 넘기고, DataTable 자신의 검색 상자는 그 안에서 한 번 더 좁히는 보조 역할)을 그대로
// 재사용한다 — 이 뷰의 검색어+필터가 먼저 미러 전체를 걸러 `visibleRows`를 만들고, DataTable의
// 내장 검색 상자(searchPlaceholder를 "표시된 결과 안에서 추가 검색"으로 바꿔 문구로 구분)는 그
// 결과 안에서 정렬·페이지와 함께 그대로 동작한다.
//
// 초성 검색(services/choseong.ts): 행마다 초성 문자열을 한 번만 계산해 두고(useMemo, state.rows
// 참조가 바뀔 때만 재계산) 키 입력마다는 이미 계산된 문자열을 재사용한다 — 완료 조건 "5,000행
// 목데이터에서 입력 후 100ms 내 결과"를 키 입력마다 O(rows) 문자열 변환이 아니라 O(rows) 문자열
// 비교로 만족시킨다.
//
// 예약 버튼(services/reservationData.ts) — book-detail(todo/12)과 완전히 같은 함수
// (createReservation)를 재사용한다. 이 파일은 화면에 묶인 상태가 없는 제네릭 서비스로 설계됐다는
// 그 파일 자신의 헤더 주석 그대로다.
//
// 스캔 연동(registry.ts에서 scan:'none' → 'focus'로 전환) — 검색 뷰가 유효 스캔 라우트일 때 책
// 스캔이 오면 book-detail로 이동한다("해당 도서로" = 그 책 화면으로 이동, catalog 행 클릭·CSV
// 내보내기 대상과 같은 내비게이션 — book-detail 자신의 "제자리 갱신"과 다른 이유: book-detail은
// 이미 그 책 화면 자체라 제자리 갱신이 자연스럽지만, search는 목록 화면이라 "그 책으로 이동"이
// 더 자연스럽다). 예약 대기 중(학생증 스캔을 기다리는 중) 학생 스캔이 오면 그 학생으로 예약을
// 제출한다 — book-detail의 같은 패턴(학생 슬롯 하나만 기다림)을 그대로 따른다.

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

interface SearchIndexEntry {
  row: CatalogCopyRow;
  plainText: string;
  choseongText: string;
}

export default function SearchView({ shell }: ViewProps) {
  const state = useCatalogSync();

  useEffect(() => {
    shell.setTitle(getViewMeta('search')?.title ?? t('registry.search.title'));
  }, [shell]);

  useEffect(() => {
    ensureCatalogSync();
  }, []);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('');
  const [shelfFilter, setShelfFilter] = useState('');

  // 예약 대기(학생증 스캔을 기다리는 중) — book-detail의 reserving/reserveBusy와 같은 개념이지만
  // 이 화면은 여러 서지가 한 목록에 있으므로 "지금 어느 서지를 예약 중인가"를 titleId로 갖는다.
  const [reservingTitleId, setReservingTitleId] = useState<string | null>(null);
  const [reserveBusy, setReserveBusy] = useState(false);

  // 필터 옵션 — 하드코딩하지 않고 지금 로드된 미러 행에서 실제로 등장하는 값만 뽑는다(미러가
  // 소스 오브 트루스, catalog 뷰가 정렬·필터를 전부 로컬 rows에서 하는 것과 같은 원칙).
  const filterOptions = useMemo(() => {
    const statuses = new Set<string>();
    const classifications = new Set<string>();
    const shelves = new Set<string>();
    for (const row of state.rows) {
      if (row.statusCode) statuses.add(row.statusCode);
      if (row.classification) classifications.add(row.classification);
      if (row.shelfCode) shelves.add(row.shelfCode);
    }
    return {
      statuses: Array.from(statuses).sort(),
      classifications: Array.from(classifications).sort((a, b) => a.localeCompare(b, 'ko')),
      shelves: Array.from(shelves).sort((a, b) => a.localeCompare(b, 'ko'))
    };
  }, [state.rows]);

  // 성능 핵심 — 행마다 부분 문자열 대상(서명·저자·등록번호)과 초성 변환 문자열을 한 번만 만들어
  // 둔다. 이 useMemo의 키는 state.rows(배열 참조) 하나뿐이라, 아래 visibleRows처럼 query가 바뀔
  // 때마다는 다시 계산되지 않는다 — 동기화로 실제 행 데이터가 바뀔 때만 다시 돈다.
  const searchIndex = useMemo<SearchIndexEntry[]>(
    () =>
      state.rows.map((row) => ({
        row,
        plainText: `${row.title} ${row.authors} ${row.barcode}`,
        choseongText: toChoseongString(`${row.title} ${row.authors}`)
      })),
    [state.rows]
  );

  const visibleRows = useMemo(() => {
    return searchIndex
      .filter((entry) => {
        if (statusFilter && entry.row.statusCode !== statusFilter) return false;
        if (classificationFilter && entry.row.classification !== classificationFilter) return false;
        if (shelfFilter && entry.row.shelfCode !== shelfFilter) return false;
        return matchesQuery(entry.plainText, entry.choseongText, query);
      })
      .map((entry) => entry.row);
  }, [searchIndex, query, statusFilter, classificationFilter, shelfFilter]);

  const hasActiveFilter = Boolean(query || statusFilter || classificationFilter || shelfFilter);

  const handleResetFilters = useCallback(() => {
    setQuery('');
    setStatusFilter('');
    setClassificationFilter('');
    setShelfFilter('');
  }, []);

  // 예약 제출 — book-detail/index.tsx의 submitReservation과 동일한 호출(createReservation)이다.
  const submitReservation = useCallback(
    async (memberKey: string) => {
      if (!reservingTitleId) return;
      setReserveBusy(true);
      const res = await createReservation(memberKey, reservingTitleId);
      setReserveBusy(false);
      setReservingTitleId(null);
      if (res.ok) {
        const message =
          res.data.status === 'READY'
            ? t('views.bookDetail.reserveDoneReady', { title: res.data.title, barcode: res.data.assignedBarcode })
            : t('views.bookDetail.reserveDoneWaiting', { title: res.data.title, queue: res.data.queueSeq });
        shell.toast(message, 'success');
      } else {
        console.error('[search] reserve 실패', { code: res.code, message: res.message, memberKey, titleId: reservingTitleId });
        shell.toast(t('views.bookDetail.reserveFailed', { message: res.message }), 'error');
      }
    },
    [reservingTitleId, shell]
  );

  // 이 창이 유효 스캔 라우트(포커스 또는 핀)일 때: 책 스캔 → book-detail로 이동, 학생 스캔(예약
  // 대기 중일 때만) → 예약 제출. book-detail/index.tsx의 같은 구독 패턴을 그대로 따른다.
  useEffect(
    () =>
      subscribeScan((evt) => {
        if (getEffectiveScanRoute() !== 'search') return;
        const target = evt.target;
        if (target.kind === 'book' || target.kind === 'book-url') {
          setReservingTitleId(null); // 새 스캔이 화면을 옮긴다 — 남아 있던 예약 대기는 접는다
          shell.toast(t('views.search.scanNavigatingHint'), 'info');
          shell.open('book-detail', { barcode: target.barcode });
          return;
        }
        if (target.kind === 'student' && reservingTitleId && !reserveBusy) {
          void submitReservation(target.studentCode);
        }
        // isbn/unknown → 무시. ISBN은 미러(CatalogCopyRow)에 필드 자체가 없어(docs/ASSUMPTIONS.md
        // `## todo/15`) 로컬로 매칭할 수 없다 — 등록 도구(register 뷰)의 몫으로 남긴다.
      }),
    [reservingTitleId, reserveBusy, submitReservation, shell]
  );

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
        nowrap: true, // todo/108 재캡처가 적발 — 반폭 창에서 "대출가/능" 꺾임(카탈로그와 동일 계약)
        render: (row) => statusLabel(row.statusCode),
        filterValue: (row) => `${row.statusCode} ${statusLabel(row.statusCode)}`,
        csvValue: (row) => statusLabel(row.statusCode)
      },
      { key: 'shelfCode', header: t('views.catalog.col.shelf'), sortable: true, nowrap: true },
      {
        key: 'rowActions',
        header: t('views.reservations.col.actions'),
        filterValue: false,
        csvValue: () => '',
        render: (row) => (
          <button
            type="button"
            className="ghost"
            onClick={(e) => {
              // 행 클릭(book-detail 이동)까지 함께 실행되지 않게 버블링을 막는다(마우스 클릭 경로).
              e.stopPropagation();
              setReservingTitleId(row.titleId);
            }}
            onKeyDown={(e) => {
              // DataTable의 <tr>은 onRowClick이 있으면 Enter/Space keydown도 행 전체에 대해
              // onRowClick을 실행한다(components/DataTable/index.tsx) — 이 버튼에 포커스가 있는
              // 채로 Enter/Space를 누르면 버튼 자신의 클릭(예약 열기)과 행 이동(book-detail)이
              // 동시에 실행되는 것을 막기 위해 키보드 경로에서도 버블링을 막는다.
              e.stopPropagation();
            }}
            disabled={reservingTitleId !== null || reserveBusy}
          >
            <BookMarked size={14} aria-hidden /> {t('views.bookDetail.actionReserve')}
          </button>
        )
      }
    ],
    [reservingTitleId, reserveBusy]
  );

  const toolbarExtra = (state.sample || state.syncing) && (
    <span className="search-sync-badge">
      {state.sample && <SampleDataBadge />}
      {state.syncing && (
        <span className="search-sync-progress">
          {t('views.catalog.syncing', { count: state.syncedCount, total: state.totalHint ?? '?' })}
        </span>
      )}
    </span>
  );

  return (
    <div className="search-view">
      <ScanCameraStart viewId="search" platform={shell.platform} variant="compact" />

      <div className="panel search-toolbar">
        <input
          type="search"
          className="search-query-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('views.search.queryPlaceholder')}
          aria-label={t('views.search.queryPlaceholder')}
        />

        <div className="search-filter-row">
          <div className="search-filter-field">
            <label htmlFor="search-filter-status">{t('views.catalog.col.status')}</label>
            <select id="search-filter-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t('views.search.filterAll')}</option>
              {filterOptions.statuses.map((code) => (
                <option key={code} value={code}>
                  {statusLabel(code)}
                </option>
              ))}
            </select>
          </div>

          <div className="search-filter-field">
            <label htmlFor="search-filter-classification">{t('views.catalog.col.classification')}</label>
            <select
              id="search-filter-classification"
              value={classificationFilter}
              onChange={(e) => setClassificationFilter(e.target.value)}
            >
              <option value="">{t('views.search.filterAll')}</option>
              {filterOptions.classifications.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="search-filter-field">
            <label htmlFor="search-filter-shelf">{t('views.catalog.col.shelf')}</label>
            <select id="search-filter-shelf" value={shelfFilter} onChange={(e) => setShelfFilter(e.target.value)}>
              <option value="">{t('views.search.filterAll')}</option>
              {filterOptions.shelves.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilter && (
            <button type="button" className="ghost" onClick={handleResetFilters}>
              {t('views.search.resetFilters')}
            </button>
          )}
        </div>

        {/* todo/70 — 활성 필터 칩: 접힌 셀렉트 상태를 항상 보이게. "결과가 이상하게 적은" 순간의
            원인(걸려 있는 필터)이 한 줄로 드러나고, X 한 번으로 개별 해제. */}
        {(statusFilter || classificationFilter || shelfFilter) && (
          <div className="search-active-chips" role="group" aria-label={t('views.search.activeFiltersLabel')}>
            {statusFilter && (
              <button
                type="button"
                className="search-chip"
                aria-label={t('views.search.filterChipRemove', { label: `${t('views.catalog.col.status')} ${statusLabel(statusFilter)}` })}
                onClick={() => setStatusFilter('')}
              >
                {t('views.catalog.col.status')}: {statusLabel(statusFilter)} <span aria-hidden>×</span>
              </button>
            )}
            {classificationFilter && (
              <button
                type="button"
                className="search-chip"
                aria-label={t('views.search.filterChipRemove', { label: `${t('views.catalog.col.classification')} ${classificationFilter}` })}
                onClick={() => setClassificationFilter('')}
              >
                {t('views.catalog.col.classification')}: {classificationFilter} <span aria-hidden>×</span>
              </button>
            )}
            {shelfFilter && (
              <button
                type="button"
                className="search-chip"
                aria-label={t('views.search.filterChipRemove', { label: `${t('views.catalog.col.shelf')} ${shelfFilter}` })}
                onClick={() => setShelfFilter('')}
              >
                {t('views.catalog.col.shelf')}: {shelfFilter} <span aria-hidden>×</span>
              </button>
            )}
          </div>
        )}

        <p className="search-hint">{t('views.search.choseongHint')}</p>
      </div>

      {reservingTitleId && (
        <p className="panel search-reserve-waiting" role="status">
          <span>{reserveBusy ? t('common.loading') : t('views.bookDetail.reserveWaitingScan')}</span>
          {!reserveBusy && (
            <button type="button" className="ghost" onClick={() => setReservingTitleId(null)}>
              {t('common.cancel')}
            </button>
          )}
        </p>
      )}

      <DataTable<CatalogCopyRow>
        columns={columns}
        rows={visibleRows}
        rowKey={(row) => row.copyId}
        onRowClick={(row) => shell.open('book-detail', { titleId: row.titleId, barcode: row.barcode })}
        platform={shell.platform}
        loading={state.syncing && state.rows.length === 0}
        error={state.error}
        emptyHint={t('views.search.empty')}
        csvFileName="search-results.csv"
        searchPlaceholder={t('views.search.refineSearchPlaceholder')}
        toolbarExtra={toolbarExtra}
        defaultPageSize={50}
      />
    </div>
  );
}
