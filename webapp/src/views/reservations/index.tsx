import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { ViewProps } from '../../types';
import { getViewMeta } from '../../registry';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { SampleDataBadge } from '../../components/SampleDataBadge';
import {
  cancelReservation,
  fetchReservations,
  type ReservationRow,
  type ReservationsListResult
} from '../../services/reservationData';
import { subscribeDataChange } from '../../services/dataChangeBus';
import { t } from '../../i18n';
import './reservations.css';

// 예약 관리 뷰 — todo/12. book-detail의 「예약」 버튼(걸기)과 반납 시 자동배정(reserve_/checkout_/
// return_ 안에서 이미 처리됨, checkout_의 HOLD_READY 검증부 재확인함 — 이 뷰는 그 결과를 보여줄
// 뿐 새 쓰기 로직을 추가하지 않는다)의 관리 화면.
//
// 3버킷: 대기(WAITING) / 도착알림(READY) / 만료임박(READY 중 pickupExpiresAt이 임박한 것) —
// 서버(apiWebReservations_)는 WAITING/READY만 구분해서 내려주고, "임박" 여부는 이 파일이
// URGENT_WINDOW_MS(24시간, FEATURES.md/VIZ.md가 값을 못박지 않아 임의 지정 — docs/ASSUMPTIONS.md
// todo/12 참고) 안쪽인지를 pickupExpiresAtMs와 Date.now()를 비교해 클라이언트에서 판정한다(todo
// 본문 지시 — "no server-side urgency concept, frontend filters client-side").
//
// 「도착 처리」는 새 쓰기 액션이 아니다 — checkout_ 본문 확인 결과 "예약 완료(FULFILLED)"는 배정된
// 회원이 해당 소장본을 정상 대출(체크아웃)하는 순간 checkout_ 내부에서 부수효과로 처리된다(전용
// "수령 확인" API가 없다). 그래서 이 버튼은 loan-return 화면을 여는 내비게이션 단축키일 뿐이다.
// loan-return은 desktop.single 창이라 이미 열려 있으면 shell.open의 새 params가 기존 창에
// 반영되지 않는다(useWindowStore.openWindow가 이미 열린 single 창은 포커스/복원만 하고 params를
// 갱신하지 않음) — 그래서 파라미터로 소장본/회원을 미리 채우는 대신(신뢰할 수 없는 경로) 토스트로
// 어떤 바코드·회원을 스캔해야 하는지 안내한다(docs/ASSUMPTIONS.md todo/12에 두 방식 중 이걸 고른
// 근거를 남겼다).

const URGENT_WINDOW_MS = 24 * 60 * 60 * 1000;

type Bucket = 'WAITING' | 'READY' | 'URGENT';

function initialBucket(params: Record<string, unknown>): Bucket {
  const raw = typeof params.filter === 'string' ? params.filter : '';
  if (raw === 'WAITING' || raw === 'READY' || raw === 'URGENT') return raw;
  return 'WAITING';
}

// book-detail/index.tsx의 RESERVATION_STATUS_LABEL_KEYS와 같은 개념(같은 i18n 키를 가리키는
// 작은 맵을 각 화면이 따로 갖는다 — catalog/book-detail의 COPY_STATUS_LABEL_KEYS 선례와 동일 관례).
const STATUS_LABEL_KEYS: Record<string, string> = {
  WAITING: 'views.bookDetail.reservationStatus.waiting',
  READY: 'views.bookDetail.reservationStatus.ready'
};
function statusLabel(code: string): string {
  const key = STATUS_LABEL_KEYS[code];
  return key ? t(key) : code;
}

export default function ReservationsView({ shell, params }: ViewProps) {
  const [bucket, setBucket] = useState<Bucket>(() => initialBucket(params));
  const [items, setItems] = useState<ReservationRow[]>([]);
  const [waitingCount, setWaitingCount] = useState(0);
  const [readyCount, setReadyCount] = useState(0);
  const [sample, setSample] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    shell.setTitle(getViewMeta('reservations')?.title ?? t('registry.reservations.title'));
  }, [shell]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const outcome = await fetchReservations();
    setLoading(false);
    if (outcome.ok) {
      const data: ReservationsListResult = outcome.data;
      setItems(data.items);
      setWaitingCount(data.waitingCount);
      setReadyCount(data.readyCount);
      setSample(outcome.sample);
    } else {
      setError(outcome.message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 트랜잭션 후 갱신(FRONTEND.md 대시보드 갱신 트리거와 같은 신호) — 반납 시 자동배정으로 다른
  // 예약이 READY로 바뀌는 등, 이 화면 밖에서 일어난 변화도 반영되게 한다.
  useEffect(() => subscribeDataChange(() => void load()), [load]);

  const urgentCount = useMemo(() => {
    const now = Date.now();
    return items.filter((row) => row.statusCode === 'READY' && row.pickupExpiresAtMs - now <= URGENT_WINDOW_MS).length;
  }, [items]);

  const filteredRows = useMemo(() => {
    const now = Date.now();
    if (bucket === 'WAITING') return items.filter((row) => row.statusCode === 'WAITING');
    if (bucket === 'READY') return items.filter((row) => row.statusCode === 'READY');
    return items.filter((row) => row.statusCode === 'READY' && row.pickupExpiresAtMs - now <= URGENT_WINDOW_MS);
  }, [items, bucket]);

  const handleCancel = useCallback(
    async (row: ReservationRow) => {
      setCancellingId(row.reservationId);
      const res = await cancelReservation(row.reservationId);
      setCancellingId(null);
      if (res.ok) {
        shell.toast(t('views.reservations.cancelDone', { title: row.title }), 'success');
        void load();
      } else {
        console.error('[reservations] cancelReservation 실패', { code: res.code, message: res.message, reservationId: row.reservationId });
        shell.toast(t('views.reservations.cancelFailed', { message: res.message }), 'error');
      }
    },
    [load, shell]
  );

  const handleArrival = useCallback(
    (row: ReservationRow) => {
      shell.open('loan-return');
      shell.toast(
        t('views.reservations.arrivalHint', { barcode: row.assignedBarcode || t('common.none'), member: row.memberName || row.memberNo }),
        'info'
      );
    },
    [shell]
  );

  const columns = useMemo<DataTableColumn<ReservationRow>[]>(
    () => [
      { key: 'title', header: t('views.reservations.col.title'), sortable: true, mobilePrimary: true },
      {
        key: 'memberName',
        header: t('views.reservations.col.member'),
        sortable: true,
        render: (row) => row.memberName || row.memberNo,
        mobileSecondary: true
      },
      {
        key: 'statusCode',
        header: t('views.reservations.col.status'),
        sortable: true,
        render: (row) => statusLabel(row.statusCode),
        filterValue: (row) => `${row.statusCode} ${statusLabel(row.statusCode)}`
      },
      {
        key: 'queueSeq',
        header: t('views.reservations.col.queueOrExpiry'),
        sortable: true,
        mono: true,
        sortAccessor: (row) => (row.statusCode === 'WAITING' ? row.queueSeq : row.pickupExpiresAtMs),
        render: (row) => (row.statusCode === 'WAITING' ? t('views.reservations.queuePosition', { seq: row.queueSeq }) : row.pickupExpiresAt || t('common.none'))
      },
      // todo/93 — nowrap: 타임스탬프가 카드(모바일) 반폭에서 "2026-07-" 뒤로 꺾이던 실측 결함 방지.
      { key: 'requestedAt', header: t('views.reservations.col.requestedAt'), sortable: true, mono: true, nowrap: true },
      {
        key: 'actions',
        header: t('views.reservations.col.actions'),
        filterValue: false,
        csvValue: () => '',
        render: (row) => (
          <div className="rsv-row-actions">
            <button type="button" className="ghost" onClick={() => void handleCancel(row)} disabled={cancellingId === row.reservationId}>
              {t('common.cancel')}
            </button>
            {row.statusCode === 'READY' && (
              <button type="button" className="warn" onClick={() => handleArrival(row)}>
                {t('views.reservations.actionArrival')}
              </button>
            )}
          </div>
        )
      }
    ],
    [cancellingId, handleArrival, handleCancel]
  );

  const toolbarExtra = sample ? <SampleDataBadge /> : null;

  // todo/76 — 전체 컬럼 CSV(백업 충실도: 원값·시트 컬럼명). 표시 컬럼 내보내기와 구분.
  const csvFullColumns = useMemo<DataTableColumn<ReservationRow>[]>(
    () => [
      { key: 'reservationId', header: 'reservation_id' },
      { key: 'titleId', header: 'title_id' },
      { key: 'title', header: 'title' },
      { key: 'memberId', header: 'member_id' },
      { key: 'memberNo', header: 'member_no' },
      { key: 'memberName', header: 'member_name' },
      { key: 'statusCode', header: 'status_code' },
      { key: 'queueSeq', header: 'queue_seq' },
      { key: 'assignedCopyId', header: 'assigned_copy_id' },
      { key: 'assignedBarcode', header: 'assigned_barcode' },
      { key: 'requestedAt', header: 'requested_at' },
      { key: 'readyAt', header: 'ready_at' },
      { key: 'pickupExpiresAt', header: 'pickup_expires_at' }
    ],
    []
  );

  return (
    <div className="rsv-view">
      <div className="rsv-toolbar">
        <div className="rsv-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={bucket === 'WAITING'} className={bucket === 'WAITING' ? 'is-active' : 'ghost'} onClick={() => setBucket('WAITING')}>
            {t('views.reservations.bucketWaiting', { count: waitingCount })}
          </button>
          <button type="button" role="tab" aria-selected={bucket === 'READY'} className={bucket === 'READY' ? 'is-active' : 'ghost'} onClick={() => setBucket('READY')}>
            {t('views.reservations.bucketReady', { count: readyCount })}
          </button>
          <button type="button" role="tab" aria-selected={bucket === 'URGENT'} className={bucket === 'URGENT' ? 'is-active' : 'ghost'} onClick={() => setBucket('URGENT')}>
            {t('views.reservations.bucketUrgent', { count: urgentCount })}
          </button>
        </div>
        <button type="button" className="ghost" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} aria-hidden /> {loading ? t('common.loading') : t('views.reservations.refresh')}
        </button>
      </div>

      <DataTable<ReservationRow>
        columns={columns}
        csvFullColumns={csvFullColumns}
        rows={filteredRows}
        rowKey={(row) => row.reservationId}
        platform={shell.platform}
        cardMetaColumns={1}
        loading={loading && items.length === 0}
        error={error}
        emptyHint={t('views.reservations.empty')}
        emptyAction={{ label: t('views.reservations.emptyAction'), onClick: () => shell.open('search') }}
        csvFileName="reservations.csv"
        searchPlaceholder={t('views.reservations.searchPlaceholder')}
        toolbarExtra={toolbarExtra}
        defaultPageSize={25}
      />
    </div>
  );
}
