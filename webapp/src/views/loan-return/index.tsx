import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScanTarget, ViewProps } from '../../types';
import { getViewMeta } from '../../registry';
import { getEffectiveScanRoute, parseScan, subscribeScan } from '../../services/scanBus';
import { apiCall, newRequestId } from '../../services/api';
import './loan-return.css';

// 대출·반납 뷰 — FRONTEND.md "실행 정책": 확인 탭 없이 즉시 실행 + 실행취소 5초.
//
// ⚠️ 백엔드 공백(작업 지시서 그대로): school-patch-v1/Code.gs doPost는 현재
// 'lookupIsbn'·'registerByIsbn'만 라우팅한다. checkout_/return_ 도메인 함수는 존재하지만
// doPost에 연결돼 있지 않다. 이 뷰는 미래 계약(action:'checkout'|'return',
// payload {memberKey?, copyKey, note?, requestId})을 실제로 호출하고, 서버가 돌려주는
// UNKNOWN_ACTION을 감추지 않고 그대로 화면·콘솔에 드러낸다. 가짜 성공을 만들지 않는다.

type TxMode = 'checkout' | 'return';
type OpStatus = 'pending' | 'ok' | 'error';

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

export default function LoanReturnView({ shell }: ViewProps) {
  const [mode, setMode] = useState<TxMode>('checkout');
  const [book, setBook] = useState<{ barcode: string } | null>(null);
  const [student, setStudent] = useState<{ studentCode: string } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [ops, setOps] = useState<OpRecord[]>([]);
  const [todayCount, setTodayCount] = useState<number>(() => readTodayCount());
  const [lastFailedKey, setLastFailedKey] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);

  // 같은 (모드+바코드[+학생]) 조합은 자동으로 1회만 실행한다 — 실패해도 자동 재시도하지 않고
  // "다시 시도" 버튼(사람의 입력)을 눌러야만 재실행된다(요청 규칙 4).
  const lastAttemptRef = useRef<string | null>(null);
  const undoIntervalRef = useRef<number | null>(null);

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

  const runCheckout = useCallback(
    async (copyKey: string, memberKey: string) => {
      setBusy(true);
      const requestId = newRequestId();
      pushOp({ id: requestId, mode: 'checkout', copyKey, memberKey, status: 'pending', at: Date.now() });
      const res = await apiCall<Record<string, unknown>>('checkout', {
        memberKey,
        copyKey,
        note: note || undefined,
        requestId
      });
      if (res.ok) {
        patchOp(requestId, { status: 'ok' });
        setTodayCount(bumpTodayCount());
        shell.toast(`대출 처리 완료 — ${copyKey}`, 'success');
        startUndo(requestId, 'checkout', copyKey, memberKey);
        setBook(null);
        setStudent(null);
        setNote('');
        setLastFailedKey(null);
      } else {
        const message =
          res.error.code === 'UNKNOWN_ACTION'
            ? `서버에 checkout 액션이 아직 없습니다 — Code.gs doPost 확장 필요 (${res.error.message})`
            : `대출 처리 실패: ${res.error.message}`;
        console.error('[loan-return] checkout 실패', { code: res.error.code, message: res.error.message, copyKey, memberKey, requestId });
        patchOp(requestId, { status: 'error', errorCode: res.error.code, errorMessage: message });
        shell.toast(message, 'error');
        setLastFailedKey(`checkout:${copyKey}:${memberKey}`);
      }
      setBusy(false);
    },
    [note, patchOp, pushOp, shell, startUndo]
  );

  const runReturn = useCallback(
    async (copyKey: string) => {
      setBusy(true);
      const requestId = newRequestId();
      pushOp({ id: requestId, mode: 'return', copyKey, status: 'pending', at: Date.now() });
      const res = await apiCall<Record<string, unknown>>('return', {
        copyKey,
        note: note || undefined,
        requestId
      });
      if (res.ok) {
        patchOp(requestId, { status: 'ok' });
        setTodayCount(bumpTodayCount());
        shell.toast(`반납 처리 완료 — ${copyKey}`, 'success');
        startUndo(requestId, 'return', copyKey);
        setBook(null);
        setNote('');
        setLastFailedKey(null);
      } else {
        const message =
          res.error.code === 'UNKNOWN_ACTION'
            ? `서버에 return 액션이 아직 없습니다 — Code.gs doPost 확장 필요 (${res.error.message})`
            : `반납 처리 실패: ${res.error.message}`;
        console.error('[loan-return] return 실패', { code: res.error.code, message: res.error.message, copyKey, requestId });
        patchOp(requestId, { status: 'error', errorCode: res.error.code, errorMessage: message });
        shell.toast(message, 'error');
        setLastFailedKey(`return:${copyKey}`);
      }
      setBusy(false);
    },
    [note, patchOp, pushOp, shell, startUndo]
  );

  // 책+학생(대출) 또는 책만(반납)이 갖춰지면 즉시 실행 — 확인 탭 없음(FRONTEND.md 실행 정책).
  useEffect(() => {
    if (busy) return;
    if (mode === 'checkout' && book && student) {
      const key = `checkout:${book.barcode}:${student.studentCode}`;
      if (lastAttemptRef.current === key) return;
      lastAttemptRef.current = key;
      void runCheckout(book.barcode, student.studentCode);
    } else if (mode === 'return' && book) {
      const key = `return:${book.barcode}`;
      if (lastAttemptRef.current === key) return;
      lastAttemptRef.current = key;
      void runReturn(book.barcode);
    }
  }, [mode, book, student, busy, runCheckout, runReturn]);

  const applyScanTarget = useCallback(
    (target: ScanTarget) => {
      if (target.kind === 'book' || target.kind === 'book-url') {
        setBook({ barcode: target.barcode });
      } else if (target.kind === 'student') {
        setStudent({ studentCode: target.studentCode });
      } else if (target.kind === 'isbn') {
        shell.toast('ISBN 스캔은 도서 등록 뷰에서 처리하세요.', 'info');
      }
      // kind === 'unknown' → 조용히 무시(서비스 계층이 이미 실패음을 재생함, FRONTEND.md).
    },
    [shell]
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

  function handleClearSlots() {
    setBook(null);
    setStudent(null);
    setLastFailedKey(null);
    lastAttemptRef.current = null;
  }

  function handleModeChange(next: TxMode) {
    setMode(next);
    setLastFailedKey(null);
    lastAttemptRef.current = null;
  }

  function handleRetry() {
    if (busy) return;
    if (mode === 'checkout' && book && student) {
      lastAttemptRef.current = `checkout:${book.barcode}:${student.studentCode}`;
      void runCheckout(book.barcode, student.studentCode);
    } else if (mode === 'return' && book) {
      lastAttemptRef.current = `return:${book.barcode}`;
      void runReturn(book.barcode);
    }
  }

  async function handleUndoClick() {
    if (!undo) return;
    const { mode: undoOfMode, copyKey, memberKey } = undo;
    clearUndo();
    // 실행취소 = 반대 트랜잭션(요청 규칙 3) — checkout의 취소는 return, return의 취소는 checkout.
    // return은 memberKey를 수집하지 않으므로(대출만 memberKey 필요) return 취소 시 memberKey가
    // 비어 있을 수 있다 — 이 또한 서버에 checkout/return이 아직 없으므로 지금은 UNKNOWN_ACTION으로
    // 동일하게 드러난다(백엔드 공백, 배선만 해둠).
    const undoAction: TxMode = undoOfMode === 'checkout' ? 'return' : 'checkout';
    const requestId = newRequestId();
    const payload: Record<string, unknown> =
      undoAction === 'checkout' ? { memberKey, copyKey, requestId } : { copyKey, requestId };
    pushOp({ id: requestId, mode: undoAction, copyKey, memberKey, status: 'pending', isUndo: true, at: Date.now() });
    const res = await apiCall<Record<string, unknown>>(undoAction, payload);
    if (res.ok) {
      patchOp(requestId, { status: 'ok' });
      shell.toast('실행취소 완료', 'success');
    } else {
      const message =
        res.error.code === 'UNKNOWN_ACTION'
          ? `실행취소 실패 — 서버에 ${undoAction} 액션이 아직 없습니다 (Code.gs doPost 확장 필요)`
          : `실행취소 실패: ${res.error.message}`;
      console.error('[loan-return] undo 실패', { undoAction, code: res.error.code, message: res.error.message, copyKey, memberKey, requestId });
      patchOp(requestId, { status: 'error', errorCode: res.error.code, errorMessage: message });
      shell.toast(message, 'error');
    }
  }

  const currentKey =
    mode === 'checkout' && book && student
      ? `checkout:${book.barcode}:${student.studentCode}`
      : mode === 'return' && book
        ? `return:${book.barcode}`
        : null;
  const canRetry = Boolean(currentKey) && currentKey === lastFailedKey && !busy;

  return (
    <div className="lr-view">
      <div className="lr-mode-toggle" role="tablist" aria-label="처리 모드">
        <button
          type="button"
          className={mode === 'checkout' ? '' : 'ghost'}
          aria-pressed={mode === 'checkout'}
          onClick={() => handleModeChange('checkout')}
        >
          대출
        </button>
        <button
          type="button"
          className={mode === 'return' ? '' : 'ghost'}
          aria-pressed={mode === 'return'}
          onClick={() => handleModeChange('return')}
        >
          반납
        </button>
      </div>

      <div className="lr-slots">
        <div className={`lr-slot${book ? ' filled' : ''}`}>
          <span className="lr-slot-label">소장본</span>
          <span className="lr-slot-value mono">{book ? book.barcode : '스캔 대기 중'}</span>
        </div>
        {mode === 'checkout' && (
          <div className={`lr-slot${student ? ' filled' : ''}`}>
            <span className="lr-slot-label">학생</span>
            <span className="lr-slot-value mono">{student ? student.studentCode : '스캔 대기 중'}</span>
          </div>
        )}
      </div>

      <div className="lr-action-row">
        {busy && <span className="lr-status lr-status-busy">처리 중…</span>}
        {!busy && canRetry && <span className="lr-status lr-status-error">마지막 시도 실패 — 아래에서 다시 시도하세요.</span>}
        {canRetry && (
          <button type="button" className="warn" onClick={handleRetry}>
            다시 시도
          </button>
        )}
        {(book || student) && (
          <button type="button" className="ghost" onClick={handleClearSlots} disabled={busy}>
            지우기
          </button>
        )}
      </div>

      <label htmlFor="lr-note">비고 (선택)</label>
      <input id="lr-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 파손 확인" />

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
