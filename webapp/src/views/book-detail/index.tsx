import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Banknote, BookMarked, RefreshCw } from 'lucide-react';
import type { ViewProps } from '../../types';
import { getViewMeta } from '../../registry';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { SampleDataBadge } from '../../components/SampleDataBadge';
import { ScanCameraStart } from '../../components/ScanCameraStart';
import { CoverThumb } from '../../components/CoverThumb';
import {
  fetchTitleDetail,
  type TitleDetail,
  type TitleDetailCopy,
  type TitleDetailLoanHistoryRow,
  type TitleDetailReservationItem
} from '../../services/titleDetail';
import { fetchRecentOps, type RecentOpRow } from '../../services/recentOpsData';
import { createReservation } from '../../services/reservationData';
import { renewLoan, markLoanLost, payFine, fetchUnpaidFines, type UnpaidFineRow } from '../../services/loanActionsData';
import { operatorNoteFor } from '../../services/operatorNote';
import { useSession } from '../../services/session';
import { getEffectiveScanRoute, subscribeScan } from '../../services/scanBus';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { t } from '../../i18n';
import { formatKRW } from '../../i18n/format';
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
// 조작 버튼 — 「예약」은 todo/12가 서지 단위 버튼(아래 「처리」 절)으로 연결했다. 「연장」「분실
// 처리」는 todo/13이 소장본 목록(copyColumns의 rowActions 열)의 행 단위 액션으로 연결한다(어느
// 소장본인지가 필요해 서지 전체에 걸린 단일 버튼으로는 표현할 수 없다). 「변상 완료」도 마찬가지로
// LOST 소장본 행에 걸린 미변상(REPLACEMENT) 건이 있을 때만 그 행에 나타난다(services/
// loanActionsData.ts의 fetchUnpaidFines를 titleId로 좁혀 판단). 셋 다 되돌릴 수 없는 작업이라
// components/ConfirmDialog.tsx 확인을 거친 뒤에만 실행된다(loan-return의 체크아웃/반납
// 즉시실행+실행취소 정책의 예외 — docs/ASSUMPTIONS.md `## todo/13` 참고).
//
// 예약 흐름(FRONTEND.md loan-return의 "누가 빌리나요?" 대기 패턴을 그대로 빌림): 「예약」 클릭 →
// 학생증 스캔 대기 → apiWebReserve_(reserve_ 그대로) 호출 → 결과(대기 순번 또는 즉시 대출가능)를
// shell.toast로 안내 + 예약 현황 재조회. book-detail은 scan:'focus'라 포커스/핀 상태면 이 화면이
// 스캔을 받는다(registry.ts, todo/11) — 기존 「책 스캔 → 갱신」 구독에 「학생 스캔 → 예약 제출」
// 분기만 추가했다(별도 구독을 새로 만들지 않음).

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
  // markLoanLost_/payFine_(Code.gs)이 실제로 남기는 action_code는 'MARK_LOST'/'PAY'다(같은 수정을
  // views/recent-ops/index.tsx에도 함께 적용했다 — todo/13 참고, 이전 키 'MARK_LOAN_LOST'는
  // 절대 매칭되지 않는 죽은 키였다).
  MARK_LOST: 'views.recentOps.action.markLoanLost',
  PAY: 'views.recentOps.action.payFine',
  RECONCILE_COPY_STATUS: 'views.recentOps.action.reconcileCopyStatus',
  // inventoryScan_(Code.gs, todo/14) — 위 recent-ops/index.tsx의 ACTION_LABEL_KEYS와 동일 항목.
  INVENTORY_SCAN: 'views.recentOps.action.inventoryScan'
};
function opsActionLabel(code: string): string {
  const key = OPS_ACTION_LABEL_KEYS[code];
  return key ? t(key) : code;
}

// views/reports/index.tsx의 DonorThanksPanel과 같은 관례(ADR-023 "금액은 사전에 넣지 않고
// Intl.NumberFormat(locale)") — 각 화면이 이 한 줄짜리 헬퍼를 각자 갖는다(공유 유틸로 뽑을 만큼
// 무겁지 않다).

// 분실 처리 확인 다이얼로그의 대체비 입력값 검증 — markLoanLost_(Code.gs)가 nonNegativeInteger_로
// 요구하는 것과 같은 조건(0 이상의 유한수, 공란 불가)을 프론트에서 먼저 걸러 확인 버튼을 막는다.
function isValidFineAmountInput(value: string): boolean {
  if (value.trim() === '') return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

// 소장본 행 액션(연장·분실 처리) + 미변상 행(변상 완료) 중 지금 확인 대기 중인 것 — 셋 다
// ConfirmDialog 하나를 공유한다(todo/13 "전부 실행취소 불가 명시 — 확인 다이얼로그").
type PendingRowAction =
  | { kind: 'renew'; copy: TitleDetailCopy }
  | { kind: 'markLost'; copy: TitleDetailCopy }
  | { kind: 'compensate'; fine: UnpaidFineRow };

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
  // todo/40: 실패가 조용히 빈 표로 보이던 것 — DataTable error prop으로 노출(오류 상태 내장).
  const [opsError, setOpsError] = useState<string | null>(null);

  // 예약 걸기 대기 상태 — loan-return의 "누가 빌리나요?" 대기 슬롯과 같은 개념(학생증 스캔을
  // 기다린다). reserveBusy는 apiWebReserve_ 왕복 중 버튼 연타/중복 스캔을 막는다.
  const [reserving, setReserving] = useState(false);
  const [reserveBusy, setReserveBusy] = useState(false);

  // 연장·분실 처리·변상(todo/13) — operator는 loan-return의 operatorNote() 관례와 같은 note
  // 접두사("웹앱 · {operator}")를 만드는 데 쓴다(services/operatorNote.ts).
  const operator = useSession((s) => s.operator);
  // 이 서지(titleId)에 걸린 미변상(REPLACEMENT) 건 — LOST 소장본 행에 「변상 완료」 버튼을 보여줄지
  // 판단한다. apiWebUnpaidFines_는 전교 목록을 내려주므로 titleId로 클라이언트에서 좁힌다(전교
  // 미변상 건수가 O(n²)을 걱정할 규모가 아니다 — reports 허브의 전체 목록과 같은 읽기 하나 공유).
  const [unpaidFines, setUnpaidFines] = useState<UnpaidFineRow[]>([]);
  // 소장본 행 액션(연장·분실 처리)·미변상 행(변상 완료) 공통 확인 다이얼로그 상태.
  const [pendingAction, setPendingAction] = useState<PendingRowAction | null>(null);
  const [lostFineInput, setLostFineInput] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  useEffect(() => {
    shell.setTitle(detail?.title || (getViewMeta('book-detail')?.title ?? t('registry.bookDetail.title')));
  }, [shell, detail?.title]);

  // 서지 재조회 — 최초 진입뿐 아니라 예약 성공 후에도 이 함수를 다시 호출해 예약 현황
  // (waitingCount/readyCount/items)을 갱신한다(refetch, 아래 submitReservation 참고).
  const refreshDetail = useCallback(async () => {
    if (!hasQuery) return;
    setLoading(true);
    setError(null);
    const outcome = await fetchTitleDetail({ copyKey: query.copyKey, titleId: query.titleId });
    if (!mountedRef.current) return;
    setLoading(false);
    if (outcome.ok) {
      setDetail(outcome.data);
      setDetailSample(outcome.sample);
    } else {
      setDetail(null);
      setError(outcome.message);
    }
  }, [hasQuery, query.copyKey, query.titleId]);

  useEffect(() => {
    void refreshDetail();
  }, [refreshDetail]);

  // 보고 있는 책이 바뀌면(새 스캔·딥링크) 이전 책에 걸려 있던 예약 대기 상태를 함께 접는다 —
  // "학생증을 스캔하세요" 안내가 이미 화면을 벗어난 책에 남아 있으면 혼란스럽다.
  useEffect(() => {
    setReserving(false);
  }, [query.copyKey, query.titleId]);

  // 미변상 목록 재조회 — titleId가 바뀔 때(새 책) + 분실 처리/변상 완료 성공 직후(아래
  // handlePendingConfirm)에 명시적으로 호출한다. detail 객체 전체가 아니라 titleId 문자열에만
  // 의존해 예약 현황 갱신 같은 무관한 refreshDetail 재호출에 덩달아 다시 불리지 않게 했다.
  const refreshUnpaidFines = useCallback(async (titleId: string) => {
    const outcome = await fetchUnpaidFines();
    if (!mountedRef.current) return;
    if (outcome.ok) setUnpaidFines(outcome.data.filter((f) => f.titleId === titleId));
  }, []);

  useEffect(() => {
    if (!detail?.titleId) {
      setUnpaidFines([]);
      return;
    }
    void refreshUnpaidFines(detail.titleId);
  }, [detail?.titleId, refreshUnpaidFines]);

  // 연장·분실 처리·변상 확인 실행 — 셋 다 "즉시실행+실행취소" 예외(loan-return의 checkout/return과
  // 다르게, 확인 다이얼로그를 반드시 거친다) — ConfirmDialog의 onConfirm이 이 함수를 부른다.
  const handlePendingConfirm = useCallback(async () => {
    if (!pendingAction || !detail) return;
    const note = operatorNoteFor(operator);
    setActionBusy(true);

    if (pendingAction.kind === 'renew') {
      const copy = pendingAction.copy;
      const res = await renewLoan(copy.barcode, note);
      setActionBusy(false);
      setPendingAction(null);
      if (res.ok) {
        shell.toast(t('views.bookDetail.renewDone', { barcode: copy.barcode, dueAt: res.data.newDueAt }), 'success');
        void refreshDetail();
      } else {
        console.error('[book-detail] renew 실패', { code: res.code, message: res.message, barcode: copy.barcode });
        shell.toast(t('views.bookDetail.renewFailed', { message: res.message }), 'error');
      }
      return;
    }

    if (pendingAction.kind === 'markLost') {
      const copy = pendingAction.copy;
      if (!isValidFineAmountInput(lostFineInput)) {
        setActionBusy(false);
        return;
      }
      const fineAmount = Number(lostFineInput);
      const res = await markLoanLost(copy.barcode, fineAmount, note);
      setActionBusy(false);
      setPendingAction(null);
      if (res.ok) {
        // "분실→학생 정지 연동"은 새 정지 로직이 아니라 checkout_의 기존 unpaidReplacement
        // 체크(936~941행)다 — 이 회원의 다음 신규 대출이 완납 전까지 막힌다는 사실을 여기서
        // 토스트로 설명해 그 기존 결과를 화면에 드러낸다(docs/ASSUMPTIONS.md `## todo/13`).
        shell.toast(
          res.data.replacementFineAmount > 0
            ? t('views.bookDetail.markLostDoneWithFine', {
                barcode: copy.barcode,
                member: res.data.memberName || res.data.memberNo,
                amount: formatKRW(res.data.replacementFineAmount)
              })
            : t('views.bookDetail.markLostDone', { barcode: copy.barcode }),
          'success'
        );
        void refreshDetail();
        void refreshUnpaidFines(detail.titleId);
      } else {
        console.error('[book-detail] markLost 실패', { code: res.code, message: res.message, barcode: copy.barcode });
        shell.toast(t('views.bookDetail.markLostFailed', { message: res.message }), 'error');
      }
      return;
    }

    // kind === 'compensate' — "변상 완료"는 잔액 전액을 한 번에 납부한다(docs/ASSUMPTIONS.md
    // `## todo/13`).
    const fine = pendingAction.fine;
    const res = await payFine(fine.fineId, fine.remainingAmount);
    setActionBusy(false);
    setPendingAction(null);
    if (res.ok) {
      shell.toast(t('views.bookDetail.compensateDone', { member: fine.memberName || fine.memberNo }), 'success');
      void refreshDetail();
      void refreshUnpaidFines(detail.titleId);
    } else {
      console.error('[book-detail] payFine 실패', { code: res.code, message: res.message, fineId: fine.fineId });
      shell.toast(t('views.bookDetail.compensateFailed', { message: res.message }), 'error');
    }
  }, [pendingAction, detail, operator, lostFineInput, shell, refreshDetail, refreshUnpaidFines]);

  const closePendingAction = useCallback(() => {
    if (actionBusy) return;
    setPendingAction(null);
  }, [actionBusy]);

  // 예약 제출 — apiWebReserve_(reserve_ 그대로) 호출. 성공하면 대기 순번(WAITING) 또는 즉시
  // 대출가능(READY, 배정 등록번호 포함)을 토스트로 안내하고 서지를 재조회한다.
  const submitReservation = useCallback(
    async (memberKey: string) => {
      if (!detail) return;
      setReserveBusy(true);
      const res = await createReservation(memberKey, detail.titleId);
      if (!mountedRef.current) return;
      setReserveBusy(false);
      setReserving(false);
      if (res.ok) {
        const message =
          res.data.status === 'READY'
            ? t('views.bookDetail.reserveDoneReady', { title: detail.title, barcode: res.data.assignedBarcode })
            : t('views.bookDetail.reserveDoneWaiting', { title: detail.title, queue: res.data.queueSeq });
        shell.toast(message, 'success');
        void refreshDetail();
      } else {
        console.error('[book-detail] reserve 실패', { code: res.code, message: res.message, memberKey, titleId: detail.titleId });
        shell.toast(t('views.bookDetail.reserveFailed', { message: res.message }), 'error');
      }
    },
    [detail, refreshDetail, shell]
  );

  const handleReserveClick = useCallback(() => {
    setReserving(true);
  }, []);

  const handleReserveCancel = useCallback(() => {
    setReserving(false);
  }, []);

  // 이 창이 유효 스캔 라우트(포커스 또는 핀)일 때 책 스캔이 들어오면 같은 창을 그 책으로 갱신
  // 한다 — FRONTEND.md 스캔 라우팅 계약("포커스 창 전환 시 스캔이 새 포커스 창으로 감, 핀 시
  // 핀 창")을 book-detail도 이제 따른다(registry.ts에서 scan:'focus'로 전환, todo/11). 새 창을
  // shell.open으로 여는 대신 이 컴포넌트의 내부 state를 바꿔 "같은 창이 갱신"되게 한다 —
  // book-detail은 desktop.single이 아니라서 shell.open을 쓰면 스캔마다 창이 늘어난다.
  // todo/12 — 「예약」 대기 중(reserving)에 학생 스캔이 들어오면 그 학생으로 예약을 제출한다
  // (loan-return의 book/student 두 슬롯 패턴과 달리 이 화면은 책이 이미 고정돼 있으므로 학생
  // 슬롯 하나만 기다리면 된다).
  useEffect(
    () =>
      subscribeScan((evt) => {
        if (getEffectiveScanRoute() !== 'book-detail') return;
        const target = evt.target;
        if (target.kind === 'book' || target.kind === 'book-url') {
          setQuery({ copyKey: target.barcode, titleId: undefined });
          return;
        }
        if (target.kind === 'student' && reserving && !reserveBusy) {
          void submitReservation(target.studentCode);
        }
        // isbn/unknown → 무시(이 화면은 등록번호·[예약 대기 중]학생증 스캔만 의미가 있다).
      }),
    [reserving, reserveBusy, submitReservation]
  );

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
    setOpsError(null);
    void fetchRecentOps(20, opsEntityId).then((outcome) => {
      if (cancelled) return;
      setOpsLoading(false);
      if (outcome.ok) {
        setOps(outcome.rows);
        setOpsSample(outcome.sample);
      } else {
        // todo/40: 보조 피드라도 실패는 실패로 보인다 — 빈 표로 위장하지 않는다.
        setOpsError(outcome.message);
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
      { key: 'acquiredAt', header: t('views.catalog.col.acquiredAt'), sortable: true, mono: true },
      // todo/13 — 「연장」「분실 처리」는 대출 중인 소장본 행에서만, 「변상 완료」는 분실 상태이면서
      // 미변상(REPLACEMENT) 건이 남아 있는 행에서만 보여준다(죽은 버튼을 만들지 않는다 —
      // docs/ASSUMPTIONS.md todo/11 「조작 버튼」 절과 같은 원칙). 셋 다 확인 다이얼로그를 거친다 —
      // book-detail은 loan-return의 즉시실행+실행취소(checkout/return) 정책의 예외다.
      {
        key: 'rowActions',
        header: t('views.bookDetail.col.actions'),
        filterValue: false,
        csvValue: () => '',
        render: (row) => {
          if (row.onLoan) {
            return (
              <div className="bd-row-actions">
                <button type="button" className="ghost" onClick={() => setPendingAction({ kind: 'renew', copy: row })}>
                  <RefreshCw size={14} aria-hidden /> {t('views.bookDetail.actionRenew')}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setLostFineInput('');
                    setPendingAction({ kind: 'markLost', copy: row });
                  }}
                >
                  <AlertTriangle size={14} aria-hidden /> {t('views.bookDetail.actionMarkLost')}
                </button>
              </div>
            );
          }
          if (row.statusCode === 'LOST') {
            const fine = unpaidFines.find((f) => f.copyId === row.copyId);
            if (fine) {
              return (
                <button type="button" className="warn" onClick={() => setPendingAction({ kind: 'compensate', fine })}>
                  <Banknote size={14} aria-hidden /> {t('views.bookDetail.actionCompensate')}
                </button>
              );
            }
          }
          return null;
        }
      }
    ],
    [unpaidFines]
  );

  const loanHistoryColumns = useMemo<DataTableColumn<TitleDetailLoanHistoryRow>[]>(
    () => [
      { key: 'barcode', header: t('views.catalog.col.barcode'), sortable: true, mono: true, mobilePrimary: true },
      { key: 'memberName', header: t('views.bookDetail.col.borrower'), sortable: true, mobileSecondary: true },
      // todo/93 — 타임스탬프류 nowrap: 카드 반폭 중간 꺾임 방지(예약 관리 실측과 동일 결).
      { key: 'checkedOutAt', header: t('views.bookDetail.col.checkedOutAt'), sortable: true, mono: true, nowrap: true },
      { key: 'dueAt', header: t('views.bookDetail.col.dueAt'), sortable: true, mono: true, nowrap: true },
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
      { key: 'requestedAt', header: t('views.bookDetail.col.requestedAt'), sortable: true, mono: true, nowrap: true }
    ],
    []
  );

  return (
    <div className="bd-view">
      <ScanCameraStart viewId="book-detail" platform={shell.platform} variant="compact" />

      {!hasQuery && <div className="panel bd-empty">{t('views.bookDetail.invalidQuery')}</div>}

      {hasQuery && loading && !detail && (
        /* todo/94(시각 감사 1R) — 첫 로딩 텍스트 한 줄 → 도착할 화면의 골격(인터랙션 표준
           「스켈레톤」): 표지 상자(실제 CoverThumb 치수 120×168) + 제목/저자 막대 + 섹션 스텁.
           재조회(detail 보유)에는 미적용 — 이 분기 자체가 !detail. 펄스는 opacity만(성능 예산). */
        <div className="bd-skeleton" aria-busy="true">
          <span className="sr-only">{t('common.loading')}</span>
          <section className="panel bd-bib" aria-hidden="true">
            <div className="bd-skel-cover" />
            <div className="bd-bib-fields">
              <div className="skel-bar bd-skel-title" />
              <div className="skel-bar skel-w-40" />
              <div className="bd-skel-meta">
                <div className="skel-bar skel-w-70" />
                <div className="skel-bar skel-w-55" />
                <div className="skel-bar skel-w-70" />
                <div className="skel-bar skel-w-55" />
              </div>
            </div>
          </section>
          {[0, 1].map((i) => (
            <section key={i} className="panel bd-skel-section" aria-hidden="true">
              <div className="skel-bar skel-w-40" />
              <div className="skel-bar skel-w-70" />
              <div className="skel-bar skel-w-55" />
            </section>
          ))}
        </div>
      )}

      {hasQuery && error && (
        <div className="bd-error" role="alert">
          {t('components.dataTable.errorPrefix', { message: error })}
        </div>
      )}

      {detail && (
        <>
          <section className="panel bd-bib">
            <div className="bd-cover">
              {/* todo/85 — 없음/로드 실패 모두 CoverThumb 한 곳에서(onError 폴백 공용화) */}
              <CoverThumb
                url={detail.coverUrl}
                alt={t('views.bookDetail.coverAlt', { title: detail.title })}
                width={120}
                height={168}
                emptyLabel={t('views.bookDetail.noCover')}
                className="bd-cover-img"
              />
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
              error={opsError}
              emptyHint={t('views.bookDetail.opsEmpty')}
              csvFileName="book-ops.csv"
              defaultPageSize={10}
              pageSizeOptions={[10, 25, 50]}
            />
          </section>

          {/* 조작 버튼 자리 — 「예약」은 서지 단위라 여기 남아 있다(todo/12). 「연장」「분실 처리」
              「변상 완료」는 todo/13부터는 서지 단위 버튼이 아니라 위 소장본 목록의 행 단위 액션이다
              (연장·분실은 어느 소장본인지, 변상은 어느 미변상 건인지가 반드시 필요해서 서지 전체에
              걸린 단일 버튼으로는 애초에 표현할 수 없다) — 그래서 죽은 비활성 버튼 3개를 없애고
              실제 행 액션(copyColumns의 rowActions 열)으로 옮겼다. */}
          <section className="bd-section bd-actions">
            <h2>{t('views.bookDetail.sectionActions')}</h2>
            <p className="bd-actions-hint">{t('views.bookDetail.actionsHint')}</p>
            <div className="bd-actions-row">
              <button type="button" onClick={handleReserveClick} disabled={reserving || reserveBusy}>
                <BookMarked size={16} aria-hidden /> {t('views.bookDetail.actionReserve')}
              </button>
            </div>
            {reserving && (
              <p className="bd-reserve-waiting" role="status">
                <span>{reserveBusy ? t('common.loading') : t('views.bookDetail.reserveWaitingScan')}</span>
                {!reserveBusy && (
                  <button type="button" className="ghost" onClick={handleReserveCancel}>
                    {t('common.cancel')}
                  </button>
                )}
              </p>
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={
          pendingAction?.kind === 'renew'
            ? t('views.bookDetail.confirmRenewTitle')
            : pendingAction?.kind === 'markLost'
              ? t('views.bookDetail.confirmMarkLostTitle')
              : t('views.bookDetail.confirmCompensateTitle')
        }
        message={
          pendingAction?.kind === 'renew' ? (
            t('views.bookDetail.confirmRenewBody', { barcode: pendingAction.copy.barcode })
          ) : pendingAction?.kind === 'markLost' ? (
            <div className="bd-confirm-form">
              <p>{t('views.bookDetail.confirmMarkLostBody', { barcode: pendingAction.copy.barcode })}</p>
              <label htmlFor="bd-lost-fine">{t('views.bookDetail.markLostFineLabel')}</label>
              <input
                id="bd-lost-fine"
                type="number"
                min={0}
                inputMode="numeric"
                value={lostFineInput}
                onChange={(e) => setLostFineInput(e.target.value)}
              />
            </div>
          ) : pendingAction?.kind === 'compensate' ? (
            t('views.bookDetail.confirmCompensateBody', {
              member: pendingAction.fine.memberName || pendingAction.fine.memberNo,
              title: pendingAction.fine.title,
              amount: formatKRW(pendingAction.fine.remainingAmount)
            })
          ) : (
            ''
          )
        }
        confirmLabel={
          pendingAction?.kind === 'renew'
            ? t('views.bookDetail.actionRenew')
            : pendingAction?.kind === 'markLost'
              ? t('views.bookDetail.actionMarkLost')
              : t('views.bookDetail.actionCompensate')
        }
        busy={actionBusy}
        confirmDisabled={pendingAction?.kind === 'markLost' && !isValidFineAmountInput(lostFineInput)}
        onConfirm={() => void handlePendingConfirm()}
        onCancel={closePendingAction}
      />
    </div>
  );
}
