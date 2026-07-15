import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, BookMarked, BookOpen, RefreshCw } from 'lucide-react';
import type { ViewProps } from '../../types';
import { getViewMeta } from '../../registry';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { SampleDataBadge } from '../../components/SampleDataBadge';
import { ScanCameraStart } from '../../components/ScanCameraStart';
import {
  fetchTitleDetail,
  type TitleDetail,
  type TitleDetailCopy,
  type TitleDetailLoanHistoryRow,
  type TitleDetailReservationItem
} from '../../services/titleDetail';
import { fetchRecentOps, type RecentOpRow } from '../../services/recentOpsData';
import { getEffectiveScanRoute, subscribeScan } from '../../services/scanBus';
import { t } from '../../i18n';
import './book-detail.css';

// 도서 상세 뷰 — todo/11. 28줄 스텁("params를 그대로 보여주기만")을 완전 구현으로 교체한다.
//
// 데이터 원천 둘:
// - services/titleDetail.ts(신규 titleDetail 액션) — 서지(cover_url·description 등 catalog
//   미러엔 없는 TITLES 전용 필드) + 소장본별 실시간 상태(대출자·반납예정) + 대출 이력(10_LOANS
//   직접 조회) + 예약 현황을 한 번에. catalog IndexedDB 미러(ADR-024)는 "목록" 전용이라 한 건
//   상세엔 쓰지 않았다 — docs/ASSUMPTIONS.md `## todo/11`에 (a) 미러 확장 vs (b) 신규 액션 중
//   (b)를 고른 이유를 적었다.
// - services/recentOpsData.ts(entityId 필터가 이번 항목에서 추가된 recentOps) — "운영 기록"
//   보조 피드(등록·상태변경·CHECKOUT). 반납/연장/분실 처리 감사 로그는 entity_id가 loan_id라
//   소장본으로 못 좁혀진다는 걸 Code.gs writeAudit_ 호출부에서 확인했다 — 그래서 정확한 "대출
//   이력"은 titleDetail의 loanHistory(10_LOANS)가 1차 소스이고, 이 운영 기록은 보조 표시다.
//
// 조작 버튼(예약·연장·분실·변상)은 todo/12·13 몫 — 여기서는 죽은 버튼을 만들지 않기 위해
// 명확히 비활성 상태로만 자리를 마련한다(아래 「처리」 절).

interface BookQuery {
  copyKey?: string;
  titleId?: string;
}

function computeInitialQuery(params: Record<string, unknown>): BookQuery {
  // catalog 행 클릭(views/catalog/index.tsx)은 {titleId, barcode}를 보낸다. 딥링크
  // #/w/book-detail?copy=등록번호(deepLink.ts)는 {copy}를 보낸다 — 등록번호는 곧 barcode라
  // 같은 의미로 취급한다(findCopyByKey_가 barcode/copy_id 둘 다 받으므로 copyKey로 그대로 전달).
  const copyKey = typeof params.copy === 'string' ? params.copy : typeof params.barcode === 'string' ? params.barcode : undefined;
  const titleId = typeof params.titleId === 'string' ? params.titleId : undefined;
  return { copyKey, titleId };
}

// views/catalog/index.tsx의 STATUS_LABEL_KEYS와 같은 코드→키 매핑(같은 08_COPIES.status_code
// 어휘) — 두 화면 다 이 작은 맵을 각자 갖는 편이 기존 관례(reports.tsx도 카탈로그 열 "키"만
// 재사용하고 매핑 함수는 각자 갖는다)와 일치한다.
const COPY_STATUS_LABEL_KEYS: Record<string, string> = {
  AVAILABLE: 'views.catalog.status.available',
  ON_LOAN: 'views.catalog.status.onLoan',
  HOLD_READY: 'views.catalog.status.holdReady',
  REPAIR: 'views.catalog.status.repair',
  LOST: 'views.catalog.status.lost',
  WITHDRAWN: 'views.catalog.status.withdrawn'
};
function copyStatusLabel(code: string): string {
  const key = COPY_STATUS_LABEL_KEYS[code];
  return key ? t(key) : code;
}

// 10_LOANS.status_code 어휘(OPEN/RETURNED/LOST) — 소장본 status_code와는 다른 값 집합이라
// 별도 매핑.
const LOAN_STATUS_LABEL_KEYS: Record<string, string> = {
  OPEN: 'views.bookDetail.loanStatus.open',
  RETURNED: 'views.bookDetail.loanStatus.returned',
  LOST: 'views.bookDetail.loanStatus.lost'
};
function loanStatusLabel(code: string): string {
  const key = LOAN_STATUS_LABEL_KEYS[code];
  return key ? t(key) : code;
}

const RESERVATION_STATUS_LABEL_KEYS: Record<string, string> = {
  WAITING: 'views.bookDetail.reservationStatus.waiting',
  READY: 'views.bookDetail.reservationStatus.ready'
};
function reservationStatusLabel(code: string): string {
  const key = RESERVATION_STATUS_LABEL_KEYS[code];
  return key ? t(key) : code;
}

// views/recent-ops/index.tsx의 ACTION_LABEL_KEYS와 같은 개념(entity_type 무관, action_code
// 어휘 자체는 감사 로그 전역 공통) — "운영 기록" 서브섹션에서 실제로 나올 법한 것만 옮겼다.
const OPS_ACTION_LABEL_KEYS: Record<string, string> = {
  CHECKOUT: 'views.recentOps.action.checkout',
  RETURN: 'views.recentOps.action.return',
  RENEW: 'views.recentOps.action.renew',
  REGISTER_COPY: 'views.recentOps.action.registerCopy',
  REGISTER_TITLE: 'views.recentOps.action.registerTitle',
  REGISTER_BY_ISBN: 'views.recentOps.action.registerByIsbn',
  UPDATE_COPY_STATUS: 'views.recentOps.action.updateCopyStatus',
  MARK_LOAN_LOST: 'views.recentOps.action.markLoanLost',
  RECONCILE_COPY_STATUS: 'views.recentOps.action.reconcileCopyStatus'
};
function opsActionLabel(code: string): string {
  const key = OPS_ACTION_LABEL_KEYS[code];
  return key ? t(key) : code;
}

export default function BookDetailView({ shell, params }: ViewProps) {
  const [query, setQuery] = useState<BookQuery>(() => computeInitialQuery(params));
  const hasQuery = Boolean(query.copyKey || query.titleId);

  const [detail, setDetail] = useState<TitleDetail | null>(null);
  const [detailSample, setDetailSample] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ops, setOps] = useState<RecentOpRow[]>([]);
  const [opsSample, setOpsSample] = useState(false);
  const [opsLoading, setOpsLoading] = useState(false);

  useEffect(() => {
    shell.setTitle(detail?.title || (getViewMeta('book-detail')?.title ?? t('registry.bookDetail.title')));
  }, [shell, detail?.title]);

  // 이 창이 유효 스캔 라우트(포커스 또는 핀)일 때 책 스캔이 들어오면 같은 창을 그 책으로 갱신
  // 한다 — FRONTEND.md 스캔 라우팅 계약("포커스 창 전환 시 스캔이 새 포커스 창으로 감, 핀 시
  // 핀 창")을 book-detail도 이제 따른다(registry.ts에서 scan:'focus'로 전환, todo/11). 새 창을
  // shell.open으로 여는 대신 이 컴포넌트의 내부 state를 바꿔 "같은 창이 갱신"되게 한다 —
  // book-detail은 desktop.single이 아니라서 shell.open을 쓰면 스캔마다 창이 늘어난다.
  useEffect(
    () =>
      subscribeScan((evt) => {
        if (getEffectiveScanRoute() !== 'book-detail') return;
        const target = evt.target;
        if (target.kind === 'book' || target.kind === 'book-url') {
          setQuery({ copyKey: target.barcode, titleId: undefined });
        }
        // isbn/student/unknown → 무시(이 화면은 등록번호 스캔만 의미가 있다).
      }),
    []
  );

  useEffect(() => {
    if (!hasQuery) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchTitleDetail({ copyKey: query.copyKey, titleId: query.titleId }).then((outcome) => {
      if (cancelled) return;
      setLoading(false);
      if (outcome.ok) {
        setDetail(outcome.data);
        setDetailSample(outcome.sample);
      } else {
        setDetail(null);
        setError(outcome.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hasQuery, query.copyKey, query.titleId]);

  // "운영 기록" 보조 피드 — 서지가 로드된 뒤에야 정확한 entity_id(copy_id)를 알 수 있다(위 헤더
  // 주석 참고: barcode로는 entity_id와 매칭되지 않는다). 포커스된 소장본이 없으면(titleId로만
  // 조회한 경우) titleId로 대체 — 도서 서지 등록 이벤트 정도만 잡힌다.
  const opsEntityId = detail?.focusCopyId || detail?.titleId;

  useEffect(() => {
    if (!opsEntityId) {
      setOps([]);
      return;
    }
    let cancelled = false;
    setOpsLoading(true);
    void fetchRecentOps(20, opsEntityId).then((outcome) => {
      if (cancelled) return;
      setOpsLoading(false);
      if (outcome.ok) {
        setOps(outcome.rows);
        setOpsSample(outcome.sample);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [opsEntityId]);

  const copyColumns = useMemo<DataTableColumn<TitleDetailCopy>[]>(
    () => [
      { key: 'barcode', header: t('views.catalog.col.barcode'), sortable: true, mono: true, mobilePrimary: true },
      {
        key: 'statusCode',
        header: t('views.catalog.col.status'),
        sortable: true,
        render: (row) => copyStatusLabel(row.statusCode),
        filterValue: (row) => `${row.statusCode} ${copyStatusLabel(row.statusCode)}`,
        mobileSecondary: true
      },
      {
        key: 'memberName',
        header: t('views.bookDetail.col.borrower'),
        render: (row) => (row.onLoan ? `${row.memberName} (${row.memberNo})` : t('common.none'))
      },
      {
        key: 'dueAt',
        header: t('views.bookDetail.col.dueDate'),
        mono: true,
        render: (row) => (row.onLoan ? row.dueAt : t('common.none'))
      },
      { key: 'shelfCode', header: t('views.catalog.col.shelf'), sortable: true },
      { key: 'acquiredAt', header: t('views.catalog.col.acquiredAt'), sortable: true, mono: true }
    ],
    []
  );

  const loanHistoryColumns = useMemo<DataTableColumn<TitleDetailLoanHistoryRow>[]>(
    () => [
      { key: 'barcode', header: t('views.catalog.col.barcode'), sortable: true, mono: true, mobilePrimary: true },
      { key: 'memberName', header: t('views.bookDetail.col.borrower'), sortable: true, mobileSecondary: true },
      { key: 'checkedOutAt', header: t('views.bookDetail.col.checkedOutAt'), sortable: true, mono: true },
      { key: 'dueAt', header: t('views.bookDetail.col.dueAt'), sortable: true, mono: true },
      {
        key: 'returnedAt',
        header: t('views.bookDetail.col.returnedAt'),
        sortable: true,
        mono: true,
        render: (row) => row.returnedAt || t('common.none')
      },
      { key: 'statusCode', header: t('views.catalog.col.status'), sortable: true, render: (row) => loanStatusLabel(row.statusCode) }
    ],
    []
  );

  const opsColumns = useMemo<DataTableColumn<RecentOpRow>[]>(
    () => [
      { key: 'occurredAt', header: t('views.recentOps.col.occurredAt'), sortable: true, mono: true, mobilePrimary: true },
      {
        key: 'actionCode',
        header: t('views.recentOps.col.action'),
        sortable: true,
        render: (row) => opsActionLabel(row.actionCode),
        mobileSecondary: true
      },
      { key: 'summary', header: t('views.recentOps.col.summary'), sortable: true }
    ],
    []
  );

  const reservationColumns = useMemo<DataTableColumn<TitleDetailReservationItem>[]>(
    () => [
      { key: 'memberName', header: t('views.bookDetail.col.applicant'), sortable: true, mobilePrimary: true },
      { key: 'queueSeq', header: t('views.bookDetail.col.queueSeq'), sortable: true, numeric: true, mobileSecondary: true },
      {
        key: 'statusCode',
        header: t('views.catalog.col.status'),
        sortable: true,
        render: (row) => reservationStatusLabel(row.statusCode)
      },
      { key: 'requestedAt', header: t('views.bookDetail.col.requestedAt'), sortable: true, mono: true }
    ],
    []
  );

  return (
    <div className="bd-view">
      <ScanCameraStart viewId="book-detail" platform={shell.platform} />

      {!hasQuery && <div className="panel bd-empty">{t('views.bookDetail.invalidQuery')}</div>}

      {hasQuery && loading && !detail && <div className="bd-loading">{t('common.loading')}</div>}

      {hasQuery && error && (
        <div className="bd-error" role="alert">
          {t('components.dataTable.errorPrefix', { message: error })}
        </div>
      )}

      {detail && (
        <>
          <section className="panel bd-bib">
            <div className="bd-cover">
              {detail.coverUrl ? (
                <img
                  src={detail.coverUrl}
                  alt={t('views.bookDetail.coverAlt', { title: detail.title })}
                  loading="lazy"
                  width={120}
                  height={168}
                  className="bd-cover-img"
                />
              ) : (
                <div className="bd-cover-placeholder" role="img" aria-label={t('views.bookDetail.noCover')}>
                  <BookOpen size={32} aria-hidden />
                  <span>{t('views.bookDetail.noCover')}</span>
                </div>
              )}
            </div>
            <div className="bd-bib-fields">
              <div className="bd-bib-head">
                <h1 className="bd-title">{detail.title}</h1>
                {detailSample && <SampleDataBadge />}
              </div>
              {detail.subtitle && <p className="bd-subtitle">{detail.subtitle}</p>}
              <p className="bd-authors">{detail.authors || t('common.none')}</p>
              <dl className="bd-meta-grid">
                <div>
                  <dt>{t('views.bookDetail.fieldClassification')}</dt>
                  <dd>{detail.classification || t('common.none')}</dd>
                </div>
                <div>
                  <dt>{t('views.bookDetail.fieldPublisher')}</dt>
                  <dd>{detail.publisher || t('common.none')}</dd>
                </div>
                <div>
                  <dt>{t('views.bookDetail.fieldPublishedYear')}</dt>
                  <dd>{detail.publishedYear || t('common.none')}</dd>
                </div>
                <div>
                  <dt>{t('views.bookDetail.fieldPageCount')}</dt>
                  <dd>{detail.pageCount || t('common.none')}</dd>
                </div>
                <div>
                  <dt>{t('views.bookDetail.fieldIsbn')}</dt>
                  <dd className="mono">{detail.isbn13 || t('common.none')}</dd>
                </div>
              </dl>
              <p className="bd-description">{detail.description || t('views.bookDetail.descriptionEmpty')}</p>
            </div>
          </section>

          <section className="bd-section">
            <h2>{t('views.bookDetail.sectionCopies')}</h2>
            <DataTable<TitleDetailCopy>
              columns={copyColumns}
              rows={detail.copies}
              rowKey={(row) => row.copyId}
              platform={shell.platform}
              emptyHint={t('views.bookDetail.copiesEmpty')}
              csvFileName="book-copies.csv"
              defaultPageSize={25}
            />
          </section>

          <section className="bd-section">
            <h2>{t('views.bookDetail.sectionReservations')}</h2>
            <p className="bd-reservation-summary">
              {t('views.bookDetail.reservationSummary', {
                waiting: detail.reservations.waitingCount,
                ready: detail.reservations.readyCount
              })}
            </p>
            <DataTable<TitleDetailReservationItem>
              columns={reservationColumns}
              rows={detail.reservations.items}
              rowKey={(row) => row.reservationId}
              platform={shell.platform}
              emptyHint={t('views.bookDetail.reservationsEmpty')}
              csvFileName="book-reservations.csv"
              defaultPageSize={25}
            />
          </section>

          <section className="bd-section">
            <h2>{t('views.bookDetail.sectionHistory')}</h2>
            <DataTable<TitleDetailLoanHistoryRow>
              columns={loanHistoryColumns}
              rows={detail.loanHistory}
              rowKey={(row) => row.loanId}
              platform={shell.platform}
              emptyHint={t('views.bookDetail.historyEmpty')}
              csvFileName="book-loan-history.csv"
              defaultPageSize={25}
            />

            <h3 className="bd-ops-heading">
              {t('views.bookDetail.sectionOps')}
              {opsSample && <SampleDataBadge />}
            </h3>
            <DataTable<RecentOpRow>
              columns={opsColumns}
              rows={ops}
              rowKey={(row) => row.logId}
              platform={shell.platform}
              loading={opsLoading && ops.length === 0}
              emptyHint={t('views.bookDetail.opsEmpty')}
              csvFileName="book-ops.csv"
              defaultPageSize={10}
              pageSizeOptions={[10, 25, 50]}
            />
          </section>

          {/* 조작 버튼 자리 — todo/12(예약)·todo/13(연장·분실·변상)가 실제 동작을 연결한다.
              가짜/죽은 버튼을 만들지 않기 위해 지금은 명확히 비활성 상태로만 자리를 잡아둔다. */}
          <section className="bd-section bd-actions">
            <h2>{t('views.bookDetail.sectionActions')}</h2>
            <p className="bd-actions-hint">{t('views.bookDetail.actionsHint')}</p>
            <div className="bd-actions-row">
              <button type="button" disabled>
                <BookMarked size={16} aria-hidden /> {t('views.bookDetail.actionReserve')}
              </button>
              <button type="button" disabled>
                <RefreshCw size={16} aria-hidden /> {t('views.bookDetail.actionRenew')}
              </button>
              <button type="button" disabled>
                <AlertTriangle size={16} aria-hidden /> {t('views.bookDetail.actionMarkLost')}
              </button>
              <button type="button" disabled>
                <Banknote size={16} aria-hidden /> {t('views.bookDetail.actionCompensate')}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
