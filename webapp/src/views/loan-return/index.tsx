import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { ScanTarget, ViewProps } from '../../types';
import { getViewMeta } from '../../registry';
import { getEffectiveScanRoute, parseScan, subscribeScan } from '../../services/scanBus';
import { apiCall, newRequestId } from '../../services/api';
import { useSession } from '../../services/session';
import './loan-return.css';

// 대출·반납 뷰 — FRONTEND.md "실행 정책": 확인 탭 없이 즉시 실행 + 실행취소 5초.
//
// 모드 토글 없음: 책을 스캔하면 서버 copyStatus로 현재 상태를 조회해서
//   대출 중(ON_LOAN)   → 즉시 반납
//   대출 가능           → "누가 빌리나요?" 대기 → 학생 스캔 → 대출
// 를 자동 분기한다 (doPost의 copyStatus/checkout/return 액션 — 이 뷰와 같은 커밋에서 추가됨.
// 시트 쪽 GAS가 아직 이전 배포라면 UNKNOWN_ACTION이 뜬다 → 재배포 필요 안내를 그대로 보여준다).

type TxMode = 'checkout' | 'return';
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
  deadline: number;
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

function fmtTime(at: number): string {
  return new Date(at).toLocaleTimeString('ko-KR', { hour12: false });
}

function modeLabel(mode: TxMode): string {
  return mode === 'checkout' ? '대출' : '반납';
}

function actionErrorMessage(kind: '대출' | '반납' | '상태 조회', code: string, message: string): string {
  if (code === 'UNKNOWN_ACTION') {
    return `${kind} 실패 — 서버 배포가 이전 버전입니다. Apps Script에서 Code.gs를 새 버전으로 재배포하세요.`;
  }
  return `${kind} 실패: ${message}`;
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
    shell.setTitle(getViewMeta('loan-return')?.title ?? '대출·반납');
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
    (opId: string, txMode: TxMode, copyKey: string, memberKey?: string) => {
      if (undoIntervalRef.current !== null) clearInterval(undoIntervalRef.current);
      const deadline = Date.now() + UNDO_MS;
      setUndo({ opId, mode: txMode, copyKey, memberKey, deadline });
      setUndoSecondsLeft(Math.ceil(UNDO_MS / 1000));
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

  const operatorNote = useCallback(() => (operator ? `웹앱 · ${operator}` : '웹앱'), [operator]);

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
        const who = res.data?.memberName ? ` → ${res.data.memberName}` : '';
        shell.toast(`대출 완료 — ${info.title}${who}`, 'success');
        startUndo(requestId, 'checkout', info.barcode, memberKey);
        resetSlots();
      } else {
        const message = actionErrorMessage('대출', res.error.code, res.error.message);
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
        const who = info.memberName ? ` (${info.memberName})` : '';
        shell.toast(`반납 완료 — ${info.title}${who}`, 'success');
        // 반납 실행취소(=재대출)에 memberNo가 필요 — copyStatus에서 받아둔 값을 넘긴다.
        startUndo(requestId, 'return', info.barcode, info.memberNo || undefined);
        resetSlots();
      } else {
        const message = actionErrorMessage('반납', res.error.code, res.error.message);
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
        const message = actionErrorMessage('상태 조회', res.error.code, res.error.message);
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
        shell.toast(`대출할 수 없는 상태입니다 — ${data.title} (${data.statusCode})`, 'error');
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
        shell.toast('ISBN 스캔은 도서 등록 뷰에서 처리하세요.', 'info');
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
      setManualError('인식할 수 없는 형식입니다 (소장본 바코드 7자리 또는 S:학생코드).');
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
    const payload: Record<string, unknown> =
      undoAction === 'checkout'
        ? { memberKey, copyKey, note: `${operatorNote()} · 실행취소`, requestId }
        : { copyKey, note: `${operatorNote()} · 실행취소`, requestId };
    pushOp({ id: requestId, mode: undoAction, copyKey, memberKey, status: 'pending', isUndo: true, at: Date.now() });
    const res = await apiCall<Record<string, unknown>>(undoAction, payload);
    if (res.ok) {
      patchOp(requestId, { status: 'ok' });
      shell.toast('실행취소 완료', 'success');
    } else {
      const message = actionErrorMessage(undoAction === 'checkout' ? '대출' : '반납', res.error.code, res.error.message);
      console.error('[loan-return] undo 실패', { undoAction, code: res.error.code, message: res.error.message, copyKey, memberKey, requestId });
      patchOp(requestId, { status: 'error', errorCode: res.error.code, errorMessage: message });
      shell.toast(`실행취소 실패 — ${message}`, 'error');
    }
  }

  const awaitingStudent = Boolean(book && !book.onLoan && !busy && !checking);
  const canRetry = Boolean(lastFailedKey) && !busy && !checking;

  return (
    <div className="lr-view">
      <header className="lr-header">
        <h1>
          <ArrowLeftRight size={20} aria-hidden /> 대출·반납
        </h1>
        <span className="lr-header-hint">책을 스캔하면 자동으로 대출/반납을 판별합니다</span>
      </header>

      <div className="lr-slots">
        <div className={`lr-slot${book ? ' filled' : ''}`}>
          <span className="lr-slot-label">소장본</span>
          <span className="lr-slot-value mono">{checking ? '조회 중…' : book ? book.barcode : '스캔 대기 중'}</span>
          {book && <span className="lr-slot-sub">{book.title}</span>}
        </div>
        <div className={`lr-slot${student ? ' filled' : ''}${awaitingStudent ? ' waiting' : ''}`}>
          <span className="lr-slot-label">학생</span>
          <span className="lr-slot-value mono">
            {student ? student.studentCode : awaitingStudent ? '누가 빌리나요? — 학생증을 스캔하세요' : '—'}
          </span>
        </div>
      </div>

      <div className="lr-action-row">
        {(checking || busy) && <span className="lr-status lr-status-busy">처리 중…</span>}
        {canRetry && <span className="lr-status lr-status-error">마지막 시도 실패 — 아래에서 다시 시도하세요.</span>}
        {canRetry && (
          <button type="button" className="warn" onClick={handleRetry}>
            다시 시도
          </button>
        )}
        {(book || student) && (
          <button type="button" className="ghost" onClick={resetSlots} disabled={busy || checking}>
            지우기
          </button>
        )}
      </div>

      <details className="lr-manual">
        <summary>수동 입력 (카메라 사용 불가 시)</summary>
        <div className="lr-manual-row">
          <input
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="소장본 바코드 7자리 또는 S:학생코드"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleManualSubmit();
            }}
          />
          <button type="button" onClick={handleManualSubmit}>
            적용
          </button>
        </div>
        {manualError && <p className="lr-manual-error">{manualError}</p>}
      </details>

      <div className="lr-recent">
        <div className="lr-recent-header">
          <span>오늘 {todayCount}건</span>
          <span className="lr-recent-caption">(로컬 표시용 — 실제 기록은 시트 기준)</span>
        </div>
        <ul className="lr-recent-list">
          {ops.length === 0 && <li className="lr-recent-empty">아직 처리한 건이 없습니다.</li>}
          {ops.map((op) => (
            <li key={op.id} className={`lr-op lr-op-${op.status}`}>
              <span className="lr-op-mode">
                {op.isUndo ? '취소·' : ''}
                {modeLabel(op.mode)}
              </span>
              <span className="lr-op-copy mono">{op.copyKey}</span>
              {op.memberKey && <span className="lr-op-member mono">{op.memberKey}</span>}
              <span className="lr-op-time">{fmtTime(op.at)}</span>
              <span className="lr-op-status">
                {op.status === 'pending' ? '처리 중' : op.status === 'ok' ? '완료' : (op.errorCode ?? '실패')}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {undo && (
        <div className="lr-undo-bar">
          <span>
            {modeLabel(undo.mode)} 처리됨 — {undo.copyKey}
          </span>
          <button type="button" onClick={() => void handleUndoClick()}>
            실행취소 ({undoSecondsLeft}s)
          </button>
        </div>
      )}
    </div>
  );
}
