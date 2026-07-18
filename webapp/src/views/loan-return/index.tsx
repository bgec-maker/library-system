import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { ScanTarget, ViewProps } from '../../types';
import { getViewMeta } from '../../registry';
import { getEffectiveScanRoute, parseScan, subscribeScan } from '../../services/scanBus';
import { apiCall, newRequestId } from '../../services/api';
import { publishDataChange } from '../../services/dataChangeBus';
import { useSession } from '../../services/session';
import { renewLoan, markLoanLost } from '../../services/loanActionsData';
import { ScanCameraStart } from '../../components/ScanCameraStart';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { intlLocaleTag, t } from '../../i18n';
import './loan-return.css';

// 대출·반납 뷰 — FRONTEND.md "실행 정책": 확인 탭 없이 즉시 실행 + 실행취소 5초.
//
// 모드 토글 없음: 책을 스캔하면 서버 copyStatus로 현재 상태를 조회해서
//   대출 중(ON_LOAN)   → 즉시 반납
//   대출 가능           → "누가 빌리나요?" 대기 → 학생 스캔 → 대출
// 를 자동 분기한다 (doPost의 copyStatus/checkout/return 액션 — 이 뷰와 같은 커밋에서 추가됨.
// 시트 쪽 GAS가 아직 이전 배포라면 UNKNOWN_ACTION이 뜬다 → 재배포 필요 안내를 그대로 보여준다).
//
// todo/13 "반납 대기 화면" — 자동 반납을 없애지 않고, 반납 직후 5초 실행취소 창을 "3지선다"로
// 넓혔다: 실행취소(기존, 반대 트랜잭션) · 대신 연장 · 대신 분실 처리. 후자 둘은 반납이 이미
// 일어난 뒤라 대상 대출이 이미 RETURNED 상태다(renew_/markLoanLost_는 OPEN 대출만 다룬다) — 그래서
// "대신 연장/분실 처리"는 먼저 반납을 취소(재대출, undo와 같은 checkout 호출)한 뒤 그 자리에서
// renew_/markLoanLost_를 이어서 호출하는 합성 동작이다. 즉시실행 대상이 아니라 book-detail의
// 연장·분실 처리와 똑같이 ConfirmDialog를 거친다("전부 실행취소 불가 명시" 완료 조건 — 이 둘은
// checkout/return과 달리 예외가 아니다). 확인 버튼을 누르는 순간 기존 5초 실행취소 타이머는
// 취소되고(clearUndo) 그 시점부터는 앞으로 나아갈 뿐 되돌리지 않는다 — 확인 다이얼로그를 취소해도
// 반납 자체는 이미 완료된 채로 남는다(정상 반납으로 취급, docs/ASSUMPTIONS.md `## todo/13`).
// 대출(checkout) 직후 실행취소 창에는 이 두 버튼이 뜨지 않는다 — "방금 빌려준 책을 대신
// 연장/분실 처리"는 의미가 없다(대상이 반납이 아니라 이제 막 시작된 대출이라서).

type TxMode = 'checkout' | 'return';
type ActionKind = TxMode | 'status';
type OpStatus = 'pending' | 'ok' | 'error';

interface BookInfo {
  barcode: string;
  title: string;
  statusCode: string;
  onLoan: boolean;
  memberNo: string;
  memberName: string;
}

interface CopyStatusResult {
  copyId: string;
  barcode: string;
  statusCode: string;
  title: string;
  titleStatusCode: string;
  onLoan: boolean;
  loanId: string;
  dueAt: string;
  memberNo: string;
  memberName: string;
}

interface OpRecord {
  id: string; // requestId
  mode: TxMode;
  copyKey: string;
  memberKey?: string;
  status: OpStatus;
  errorCode?: string;
  errorMessage?: string;
  isUndo?: boolean;
  at: number;
}

interface UndoState {
  opId: string;
  mode: TxMode;
  copyKey: string;
  /** return 실행취소(=재대출)에 필요 — copyStatus 응답의 memberNo를 기억해 둔다. */
  memberKey?: string;
  /** todo/13 "대신 연장/분실 처리" 확인 다이얼로그 문구용(도서명) — mode==='return'일 때만 그
   *  버튼들을 보여주므로 checkout 쪽은 이 값을 몰라도 무방하다. */
  title: string;
  deadline: number;
}

/** todo/13 — 반납 대기 창(undo 5초)에서 「대신 연장」「대신 분실 처리」를 눌렀을 때의 목표 동작.
 *  실행 자체는 handleRedirectConfirm이 "반납 취소(재대출) → renew_/markLoanLost_" 순으로 합성한다. */
type RedirectKind = 'renew' | 'markLost';
interface RedirectState {
  copyKey: string;
  memberKey?: string;
  title: string;
  kind: RedirectKind;
}

const OPS_LIMIT = 12;
const UNDO_MS = 5000;
const TODAY_KEY_PREFIX = 'lib.loanReturn.today.';

function todayKey(): string {
  return TODAY_KEY_PREFIX + new Date().toISOString().slice(0, 10);
}

// register.html의 "세션 카운터" 패턴(날짜별 localStorage 키)을 계승한 로컬 표시용 카운터일 뿐
// — 진실은 항상 시트(FRONTEND.md 플랫폼 주의). iOS 저장소 축출로 지워져도 무방하다.
function readTodayCount(): number {
  try {
    return Number(localStorage.getItem(todayKey()) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function bumpTodayCount(): number {
  const next = readTodayCount() + 1;
  try {
    localStorage.setItem(todayKey(), String(next));
  } catch {
    /* 저장소 접근 불가 — 화면 카운터만 이번 세션에서 갱신되고 새로고침 시 리셋됨(허용) */
  }
  return next;
}

// ADR-023: 날짜·숫자는 사전에 넣지 않고 Intl.*(locale)로 로케일만 반영한다.
function fmtTime(at: number): string {
  return new Date(at).toLocaleTimeString(intlLocaleTag(), { hour12: false });
}

// views/reports/index.tsx·views/book-detail/index.tsx의 formatCurrency와 같은 한 줄짜리 헬퍼
// (todo/13 「대신 분실 처리」 완료 토스트의 대체비 표시용).
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(intlLocaleTag(), { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount);
}

function actionKindLabel(kind: ActionKind): string {
  switch (kind) {
    case 'checkout':
      return t('views.loanReturn.modeCheckout');
    case 'return':
      return t('views.loanReturn.modeReturn');
    case 'status':
      return t('views.loanReturn.modeStatus');
  }
}

function actionErrorMessage(kind: ActionKind, code: string, message: string): string {
  const kindLabel = actionKindLabel(kind);
  if (code === 'UNKNOWN_ACTION') {
    return t('views.loanReturn.errorUnknownAction', { kind: kindLabel });
  }
  return t('views.loanReturn.errorGeneric', { kind: kindLabel, message });
}

// book-detail/index.tsx의 isValidFineAmountInput과 같은 검증(markLoanLost_의 nonNegativeInteger_
// 요구조건) — 공유 유틸로 뽑을 만큼 무겁지 않아 각 화면이 한 줄을 각자 갖는다(이 파일의
// formatCurrency 없음·book-detail의 formatCurrency 중복과 같은 결).
function isValidFineAmountInput(value: string): boolean {
  if (value.trim() === '') return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

export default function LoanReturnView({ shell }: ViewProps) {
  const operator = useSession((s) => s.operator);
  const [book, setBook] = useState<BookInfo | null>(null);
  const [student, setStudent] = useState<{ studentCode: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ops, setOps] = useState<OpRecord[]>([]);
  const [todayCount, setTodayCount] = useState<number>(() => readTodayCount());
  const [lastFailedKey, setLastFailedKey] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);
  // todo/13 「대신 연장」「대신 분실 처리」 확인 다이얼로그 상태 — undo와 별개(undo 타이머는
  // 이 다이얼로그를 여는 순간 clearUndo로 취소된다, 아래 openRedirect 참고).
  const [redirect, setRedirect] = useState<RedirectState | null>(null);
  const [redirectFineInput, setRedirectFineInput] = useState('');
  const [redirectBusy, setRedirectBusy] = useState(false);

  // 같은 (모드+바코드[+학생]) 조합은 자동으로 1회만 실행 — 실패해도 자동 재시도하지 않고
  // "다시 시도" 버튼(사람의 입력)을 눌러야만 재실행된다.
  const lastAttemptRef = useRef<string | null>(null);
  const undoIntervalRef = useRef<number | null>(null);
  const bookRef = useRef<BookInfo | null>(null);
  bookRef.current = book;
  const studentRef = useRef<{ studentCode: string } | null>(null);
  studentRef.current = student;
  const checkingRef = useRef(false);
  checkingRef.current = checking;
  const busyRef = useRef(false);
  busyRef.current = busy;

  useEffect(() => {
    shell.setTitle(getViewMeta('loan-return')?.title ?? t('registry.loanReturn.title'));
  }, [shell]);

  const clearUndo = useCallback(() => {
    if (undoIntervalRef.current !== null) {
      clearInterval(undoIntervalRef.current);
      undoIntervalRef.current = null;
    }
    setUndo(null);
    setUndoSecondsLeft(0);
  }, []);

  // 언마운트 시 실행취소 타이머 정리.
  useEffect(() => clearUndo, [clearUndo]);

  const startUndo = useCallback(
    (opId: string, txMode: TxMode, copyKey: string, title: string, memberKey?: string) => {
      if (undoIntervalRef.current !== null) clearInterval(undoIntervalRef.current);
      const deadline = Date.now() + UNDO_MS;
      setUndo({ opId, mode: txMode, copyKey, memberKey, title, deadline });
      setUndoSecondsLeft(Math.ceil(UNDO_MS / 1000));
      // perf-budget: 실행취소 5초 스낵바의 1초 UI 틱 — 네트워크 호출 없음, 만료 시 해제.
      undoIntervalRef.current = setInterval(() => {
        const remain = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        setUndoSecondsLeft(remain);
        if (remain <= 0) clearUndo();
      }, 200);
    },
    [clearUndo]
  );

  const pushOp = useCallback((op: OpRecord) => {
    setOps((prev) => [op, ...prev].slice(0, OPS_LIMIT));
  }, []);

  const patchOp = useCallback((id: string, patch: Partial<OpRecord>) => {
    setOps((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }, []);

  const operatorNote = useCallback(
    () => (operator ? t('views.loanReturn.operatorNoteWithName', { operator }) : t('views.loanReturn.operatorNote')),
    [operator]
  );

  const resetSlots = useCallback(() => {
    setBook(null);
    setStudent(null);
    setLastFailedKey(null);
    lastAttemptRef.current = null;
  }, []);

  const runCheckout = useCallback(
    async (info: BookInfo, memberKey: string) => {
      setBusy(true);
      const requestId = newRequestId();
      pushOp({ id: requestId, mode: 'checkout', copyKey: info.barcode, memberKey, status: 'pending', at: Date.now() });
      const res = await apiCall<{ memberName?: string; dueAt?: string }>('checkout', {
        memberKey,
        copyKey: info.barcode,
        note: operatorNote(),
        requestId
      });
      if (res.ok) {
        patchOp(requestId, { status: 'ok' });
        setTodayCount(bumpTodayCount());
        const message = res.data?.memberName
          ? t('views.loanReturn.checkoutDoneWithMember', { title: info.title, member: res.data.memberName })
          : t('views.loanReturn.checkoutDone', { title: info.title });
        shell.toast(message, 'success');
        startUndo(requestId, 'checkout', info.barcode, info.title, memberKey);
        resetSlots();
        // FRONTEND.md 대시보드 갱신 트리거 "트랜잭션 후" — dashboardData가 구독해 재조회한다.
        publishDataChange();
      } else {
        const message = actionErrorMessage('checkout', res.error.code, res.error.message);
        console.error('[loan-return] checkout 실패', { code: res.error.code, message: res.error.message, copyKey: info.barcode, memberKey, requestId });
        patchOp(requestId, { status: 'error', errorCode: res.error.code, errorMessage: message });
        shell.toast(message, 'error');
        setLastFailedKey(`checkout:${info.barcode}:${memberKey}`);
      }
      setBusy(false);
    },
    [operatorNote, patchOp, pushOp, resetSlots, shell, startUndo]
  );

  const runReturn = useCallback(
    async (info: BookInfo) => {
      setBusy(true);
      const requestId = newRequestId();
      pushOp({ id: requestId, mode: 'return', copyKey: info.barcode, memberKey: info.memberNo || undefined, status: 'pending', at: Date.now() });
      const res = await apiCall<Record<string, unknown>>('return', {
        copyKey: info.barcode,
        note: operatorNote(),
        requestId
      });
      if (res.ok) {
        patchOp(requestId, { status: 'ok' });
        setTodayCount(bumpTodayCount());
        const message = info.memberName
          ? t('views.loanReturn.returnDoneWithMember', { title: info.title, member: info.memberName })
          : t('views.loanReturn.returnDone', { title: info.title });
        shell.toast(message, 'success');
        // 반납 실행취소(=재대출)에 memberNo가 필요 — copyStatus에서 받아둔 값을 넘긴다.
        startUndo(requestId, 'return', info.barcode, info.title, info.memberNo || undefined);
        resetSlots();
        publishDataChange();
      } else {
        const message = actionErrorMessage('return', res.error.code, res.error.message);
        console.error('[loan-return] return 실패', { code: res.error.code, message: res.error.message, copyKey: info.barcode, requestId });
        patchOp(requestId, { status: 'error', errorCode: res.error.code, errorMessage: message });
        shell.toast(message, 'error');
        setLastFailedKey(`return:${info.barcode}`);
      }
      setBusy(false);
    },
    [operatorNote, patchOp, pushOp, resetSlots, shell, startUndo]
  );

  // 책 스캔 → copyStatus 조회 → 대출중이면 즉시 반납 / 가능하면 학생 대기(또는 선스캔된 학생으로 즉시 대출).
  const handleBookScan = useCallback(
    async (barcode: string) => {
      if (checkingRef.current || busyRef.current) return;
      setChecking(true);
      const res = await apiCall<CopyStatusResult>('copyStatus', { copyKey: barcode });
      setChecking(false);
      if (!res.ok) {
        const message = actionErrorMessage('status', res.error.code, res.error.message);
        console.error('[loan-return] copyStatus 실패', { code: res.error.code, message: res.error.message, copyKey: barcode });
        shell.toast(message, 'error');
        return;
      }
      const data = res.data;
      const info: BookInfo = {
        barcode: data.barcode,
        title: data.title,
        statusCode: data.statusCode,
        onLoan: data.onLoan,
        memberNo: data.memberNo,
        memberName: data.memberName
      };

      if (data.onLoan) {
        // 대출 중인 책 → 즉시 반납 (같은 책 재스캔 연타는 lastAttempt 가드가 흡수)
        const key = `return:${info.barcode}`;
        if (lastAttemptRef.current === key) return;
        lastAttemptRef.current = key;
        setBook(info);
        void runReturn(info);
        return;
      }

      if (data.titleStatusCode !== 'ACTIVE' || (data.statusCode !== 'AVAILABLE' && data.statusCode !== 'HOLD_READY')) {
        shell.toast(t('views.loanReturn.cannotCheckout', { title: data.title, status: data.statusCode }), 'error');
        return;
      }

      const pendingStudent = studentRef.current;
      if (pendingStudent) {
        const key = `checkout:${info.barcode}:${pendingStudent.studentCode}`;
        if (lastAttemptRef.current === key) return;
        lastAttemptRef.current = key;
        setBook(info);
        void runCheckout(info, pendingStudent.studentCode);
        return;
      }

      // "누가 빌리나요?" 대기 상태
      setBook(info);
      setLastFailedKey(null);
      lastAttemptRef.current = null;
    },
    [runCheckout, runReturn, shell]
  );

  const handleStudentScan = useCallback(
    (studentCode: string) => {
      const pendingBook = bookRef.current;
      if (pendingBook && !pendingBook.onLoan) {
        const key = `checkout:${pendingBook.barcode}:${studentCode}`;
        if (lastAttemptRef.current === key) return;
        lastAttemptRef.current = key;
        setStudent({ studentCode });
        void runCheckout(pendingBook, studentCode);
      } else {
        // 학생을 먼저 스캔한 경우 — 책 스캔을 기다린다.
        setStudent({ studentCode });
      }
    },
    [runCheckout]
  );

  const applyScanTarget = useCallback(
    (target: ScanTarget) => {
      if (target.kind === 'book' || target.kind === 'book-url') {
        void handleBookScan(target.barcode);
      } else if (target.kind === 'student') {
        handleStudentScan(target.studentCode);
      } else if (target.kind === 'isbn') {
        shell.toast(t('views.loanReturn.isbnHint'), 'info');
      }
      // kind === 'unknown' → 조용히 무시(서비스 계층이 이미 실패음을 재생함, FRONTEND.md).
    },
    [handleBookScan, handleStudentScan, shell]
  );

  // scanBus 구독 — 이 뷰가 유효 스캔 라우트일 때만 반응한다(포커스 아닌 창은 무시).
  useEffect(
    () =>
      subscribeScan((evt) => {
        if (getEffectiveScanRoute() !== 'loan-return') return;
        applyScanTarget(evt.target);
      }),
    [applyScanTarget]
  );

  function handleManualSubmit() {
    setManualError(null);
    const target = parseScan(manualInput);
    if (target.kind === 'unknown') {
      setManualError(t('views.loanReturn.manualUnknownFormat'));
      return;
    }
    applyScanTarget(target);
    setManualInput('');
  }

  function handleRetry() {
    if (busy || !lastFailedKey) return;
    const pendingBook = bookRef.current;
    if (!pendingBook) return;
    if (lastFailedKey.startsWith('return:')) {
      lastAttemptRef.current = lastFailedKey;
      void runReturn(pendingBook);
    } else if (lastFailedKey.startsWith('checkout:') && studentRef.current) {
      lastAttemptRef.current = lastFailedKey;
      void runCheckout(pendingBook, studentRef.current.studentCode);
    }
  }

  async function handleUndoClick() {
    if (!undo) return;
    const { mode: undoOfMode, copyKey, memberKey } = undo;
    clearUndo();
    // 실행취소 = 반대 트랜잭션 — checkout의 취소는 return, return의 취소는 재checkout
    // (copyStatus에서 받아둔 memberNo 사용; 없으면 서버가 VALIDATION_ERROR로 알려준다).
    const undoAction: TxMode = undoOfMode === 'checkout' ? 'return' : 'checkout';
    const requestId = newRequestId();
    const undoNote = `${operatorNote()} · ${t('views.loanReturn.undoPrefix')}`;
    const payload: Record<string, unknown> =
      undoAction === 'checkout' ? { memberKey, copyKey, note: undoNote, requestId } : { copyKey, note: undoNote, requestId };
    pushOp({ id: requestId, mode: undoAction, copyKey, memberKey, status: 'pending', isUndo: true, at: Date.now() });
    const res = await apiCall<Record<string, unknown>>(undoAction, payload);
    if (res.ok) {
      patchOp(requestId, { status: 'ok' });
      shell.toast(t('views.loanReturn.undoDone'), 'success');
    } else {
      const message = actionErrorMessage(undoAction, res.error.code, res.error.message);
      console.error('[loan-return] undo 실패', { undoAction, code: res.error.code, message: res.error.message, copyKey, memberKey, requestId });
      patchOp(requestId, { status: 'error', errorCode: res.error.code, errorMessage: message });
      shell.toast(t('views.loanReturn.undoFailed', { message }), 'error');
    }
  }

  // todo/13 「대신 연장」「대신 분실 처리」 — undo 타이머는 즉시 취소한다(그 시점부터 "실행취소"
  // 자체는 더 이상 선택지가 아니다, 확인 다이얼로그를 취소해도 반납은 이미 완료된 채로 남는다).
  function openRedirect(kind: RedirectKind) {
    if (!undo || undo.mode !== 'return') return;
    setRedirectFineInput('');
    setRedirect({ copyKey: undo.copyKey, memberKey: undo.memberKey, title: undo.title, kind });
    clearUndo();
  }

  function closeRedirect() {
    if (redirectBusy) return;
    setRedirect(null);
  }

  // 반납 대신 연장/분실 처리 — renew_/markLoanLost_는 OPEN 대출만 다루는데 반납이 이미 일어난
  // 뒤라 대상 대출은 RETURNED 상태다. 그래서 먼저 반납을 취소(재대출 — 기존 undo와 같은 checkout
  // 호출)한 뒤 그 자리에서 renew_/markLoanLost_를 이어서 호출한다(위 헤더 주석 참고). 앞 단계가
  // 실패하면(예: 그 사이 다른 회원 예약이 소장본을 선점) 뒷단계는 시도하지 않는다 — 이미 존재하던
  // "실행취소 자체가 실패할 수 있다" 위험과 같은 종류이지 이 항목이 새로 만든 위험이 아니다.
  async function handleRedirectConfirm() {
    if (!redirect) return;
    if (redirect.kind === 'markLost' && !isValidFineAmountInput(redirectFineInput)) return;
    setRedirectBusy(true);
    const note = operatorNote();
    const undoNote = `${note} · ${t('views.loanReturn.undoPrefix')}`;
    const undoRes = await apiCall<Record<string, unknown>>('checkout', {
      memberKey: redirect.memberKey,
      copyKey: redirect.copyKey,
      note: undoNote,
      requestId: newRequestId()
    });
    if (!undoRes.ok) {
      setRedirectBusy(false);
      setRedirect(null);
      shell.toast(t('views.loanReturn.redirectUndoFailed', { message: undoRes.error.message || undoRes.error.code }), 'error');
      return;
    }

    if (redirect.kind === 'renew') {
      const res = await renewLoan(redirect.copyKey, note);
      setRedirectBusy(false);
      setRedirect(null);
      if (res.ok) {
        shell.toast(t('views.loanReturn.redirectRenewDone', { title: redirect.title, dueAt: res.data.newDueAt }), 'success');
        publishDataChange();
      } else {
        console.error('[loan-return] redirect renew 실패', { code: res.code, message: res.message, copyKey: redirect.copyKey });
        shell.toast(t('views.loanReturn.redirectRenewFailed', { message: res.message }), 'error');
      }
      return;
    }

    const fineAmount = Number(redirectFineInput);
    const res = await markLoanLost(redirect.copyKey, fineAmount, note);
    setRedirectBusy(false);
    setRedirect(null);
    if (res.ok) {
      shell.toast(
        res.data.replacementFineAmount > 0
          ? t('views.loanReturn.redirectMarkLostDoneWithFine', {
              title: redirect.title,
              amount: formatCurrency(res.data.replacementFineAmount)
            })
          : t('views.loanReturn.redirectMarkLostDone', { title: redirect.title }),
        'success'
      );
      publishDataChange();
    } else {
      console.error('[loan-return] redirect markLost 실패', { code: res.code, message: res.message, copyKey: redirect.copyKey });
      shell.toast(t('views.loanReturn.redirectMarkLostFailed', { message: res.message }), 'error');
    }
  }

  const awaitingStudent = Boolean(book && !book.onLoan && !busy && !checking);
  const canRetry = Boolean(lastFailedKey) && !busy && !checking;

  return (
    <div className="lr-view">
      <header className="lr-header">
        <h1>
          <ArrowLeftRight size={20} aria-hidden /> {t('registry.loanReturn.title')}
        </h1>
        <span className="lr-header-hint">{t('views.loanReturn.hint')}</span>
      </header>

      <ScanCameraStart viewId="loan-return" platform={shell.platform} />

      <div className="lr-slots">
        <div className={`lr-slot${book ? ' filled' : ''}`}>
          <span className="lr-slot-label">{t('views.loanReturn.slotBook')}</span>
          <span className="lr-slot-value mono">
            {checking ? t('views.loanReturn.checking') : book ? book.barcode : t('views.loanReturn.waitingScan')}
          </span>
          {book && <span className="lr-slot-sub">{book.title}</span>}
        </div>
        <div className={`lr-slot${student ? ' filled' : ''}${awaitingStudent ? ' waiting' : ''}`}>
          <span className="lr-slot-label">{t('views.loanReturn.slotStudent')}</span>
          <span className="lr-slot-value mono">
            {student ? student.studentCode : awaitingStudent ? t('views.loanReturn.awaitingStudent') : '—'}
          </span>
        </div>
      </div>

      <div className="lr-action-row">
        {(checking || busy) && <span className="lr-status lr-status-busy">{t('views.loanReturn.statusBusy')}</span>}
        {canRetry && <span className="lr-status lr-status-error">{t('views.loanReturn.retryHint')}</span>}
        {canRetry && (
          <button type="button" className="warn" onClick={handleRetry}>
            {t('views.loanReturn.retryButton')}
          </button>
        )}
        {(book || student) && (
          <button type="button" className="ghost" onClick={resetSlots} disabled={busy || checking}>
            {t('views.loanReturn.clear')}
          </button>
        )}
      </div>

      <details className="lr-manual">
        <summary>{t('views.loanReturn.manualSummary')}</summary>
        <div className="lr-manual-row">
          <input
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder={t('views.loanReturn.manualPlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleManualSubmit();
            }}
          />
          <button type="button" onClick={handleManualSubmit}>
            {t('views.loanReturn.manualApply')}
          </button>
        </div>
        {manualError && <p className="lr-manual-error">{manualError}</p>}
      </details>

      <div className="lr-recent">
        <div className="lr-recent-header">
          <span>{t('views.loanReturn.todayCount', { count: todayCount })}</span>
          <span className="lr-recent-caption">{t('views.loanReturn.recentCaption')}</span>
        </div>
        <ul className="lr-recent-list">
          {ops.length === 0 && <li className="lr-recent-empty">{t('views.loanReturn.recentEmpty')}</li>}
          {ops.map((op) => (
            <li key={op.id} className={`lr-op lr-op-${op.status}`}>
              <span className="lr-op-mode">
                {op.isUndo ? t('views.loanReturn.undoPrefix') : ''}
                {actionKindLabel(op.mode)}
              </span>
              <span className="lr-op-copy mono">{op.copyKey}</span>
              {op.memberKey && <span className="lr-op-member mono">{op.memberKey}</span>}
              <span className="lr-op-time">{fmtTime(op.at)}</span>
              <span className="lr-op-status">
                {op.status === 'pending'
                  ? t('views.loanReturn.opPending')
                  : op.status === 'ok'
                    ? t('views.loanReturn.opDone')
                    : (op.errorCode ?? t('views.loanReturn.opFailed'))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {undo && (
        <div className="lr-undo-bar">
          <span>{t('views.loanReturn.undoBarText', { mode: actionKindLabel(undo.mode), copyKey: undo.copyKey })}</span>
          <div className="lr-undo-actions">
            <button type="button" onClick={() => void handleUndoClick()}>
              {t('views.loanReturn.undoButton', { seconds: undoSecondsLeft })}
            </button>
            {/* todo/13 "반납 대기 화면" — 반납(undo.mode==='return') 직후에만 대안을 보여준다.
                방금 빌려준 책(checkout)을 "대신 연장/분실 처리"하는 건 의미가 없다. */}
            {undo.mode === 'return' && (
              <>
                <button type="button" className="ghost" onClick={() => openRedirect('renew')}>
                  {t('views.loanReturn.redirectRenewButton')}
                </button>
                <button type="button" className="ghost" onClick={() => openRedirect('markLost')}>
                  {t('views.loanReturn.redirectMarkLostButton')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(redirect)}
        title={
          redirect?.kind === 'renew'
            ? t('views.loanReturn.redirectRenewConfirmTitle')
            : t('views.loanReturn.redirectMarkLostConfirmTitle')
        }
        message={
          redirect?.kind === 'renew' ? (
            t('views.loanReturn.redirectRenewConfirmBody', { title: redirect.title })
          ) : redirect ? (
            <div className="lr-redirect-form">
              <p>{t('views.loanReturn.redirectMarkLostConfirmBody', { title: redirect.title })}</p>
              <label htmlFor="lr-redirect-fine">{t('views.bookDetail.markLostFineLabel')}</label>
              <input
                id="lr-redirect-fine"
                type="number"
                min={0}
                inputMode="numeric"
                value={redirectFineInput}
                onChange={(e) => setRedirectFineInput(e.target.value)}
              />
            </div>
          ) : (
            ''
          )
        }
        confirmLabel={redirect?.kind === 'renew' ? t('views.bookDetail.actionRenew') : t('views.bookDetail.actionMarkLost')}
        busy={redirectBusy}
        confirmDisabled={redirect?.kind === 'markLost' && !isValidFineAmountInput(redirectFineInput)}
        onConfirm={() => void handleRedirectConfirm()}
        onCancel={closeRedirect}
      />
    </div>
  );
}
