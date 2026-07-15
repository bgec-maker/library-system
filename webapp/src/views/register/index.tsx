import { useCallback, useEffect, useRef, useState } from 'react';
import { BookPlus } from 'lucide-react';
import type { ViewProps } from '../../types';
import { getViewMeta } from '../../registry';
import { useSession } from '../../services/session';
import { apiCall, newRequestId, onApiLog, getRecentApiLog, type ApiCallLogEntry } from '../../services/api';
import { publishDataChange } from '../../services/dataChangeBus';
import { subscribeScan, getEffectiveScanRoute, isValidEan13 } from '../../services/scanBus';
import { ScanCameraStart } from '../../components/ScanCameraStart';
import { operatorNoteFor } from '../../services/operatorNote';
import { intlLocaleTag, t } from '../../i18n';
import './register.css';

// register.html("스파이크 — 검증된 등록 흐름")을 그대로 흡수: 스캔→조회→확인폼→저장→등록번호
// 크게 표시. 카메라/스캔은 셸이 이미 acquire()한 cameraService가 흘려보내는 scanBus 이벤트를
// 구독만 한다 — 이 뷰는 getUserMedia를 절대 직접 호출하지 않는다.
//
// 🔴 스모크 버그 대응: "스캔·저장까지 갔는데 시트에 행이 안 보임"이 프론트 문제인지
// (저장 요청이 실제로 안 나감) 서버 문제인지(doPost는 실행됐는데 시트에 안 쓰임) 구분하려면
// 사용자가 요청 1건 단위로 대조할 수 있어야 한다. 그래서 services/api.ts가 가로채 기록하는
// 진단 로그(요청/응답/시간)를 화면에 그대로 노출하고, 저장 성공 시 그 요청의 requestId를
// 결과 화면에도 남겨 GAS 실행 기록·18_SYS_OPERATIONS 시트와 대조할 단서를 준다.

interface LookupIsbnResult {
  isbn: string;
  title?: string;
  subtitle?: string;
  authors?: string;
  publisher?: string;
  publishedYear?: string | number;
  pageCount?: string | number;
  coverUrl?: string;
  source?: string;
  isDuplicate?: boolean;
  existingTitle?: string;
  existingTitleId?: string;
}

interface RegisterByIsbnResult {
  titleId?: string;
  barcodes: string[];
  title: string;
  created?: boolean;
  copyCount: number;
}

// registerTitle_(school-patch-v1/Code.gs ~818)의 반환 모양 그대로 — 무ISBN 수동 등록(todo/16)이
// createCopy:true로 함께 만든 첫 소장본의 barcode/copyId도 여기 실려온다.
interface RegisterTitleResult {
  titleId: string;
  title: string;
  isbn?: string;
  copyId?: string;
  barcode?: string;
}

// registerCopy_(school-patch-v1/Code.gs ~895)의 반환 모양 — 복본 일괄 발급(todo/16)이 이
// 응답의 barcode 하나씩을 순차로 쌓는다.
interface RegisterCopyResult {
  copyId?: string;
  barcode: string;
  titleId?: string;
  title?: string;
  holdReady?: boolean;
}

type BookCondition = 'GOOD' | 'FAIR' | 'DAMAGED';

// apiCall()의 payload 파라미터는 Record<string, unknown>이라 인덱스 시그니처가 필요하다
// (services/offlineQueue.ts의 QueuedRequest.payload와 동일한 관례).
type RegisterPayload = {
  isbn: string;
  operator: string;
  title: string;
  subtitle: string;
  authors: string;
  publisher: string;
  publishedYear: string;
  pageCount: string;
  coverUrl: string;
  copyCount: number;
  condition: BookCondition;
  requestId: string;
} & Record<string, unknown>;

// 무ISBN 수동 등록(todo/16) payload — registerTitle_이 그대로 기대하는 키만 담는다. isbn은
// 아예 넣지 않는다(payload.isbn 생략 시 normalizeIsbn_이 빈 문자열을 돌려줄 뿐 서버는 이 경로를
// 전혀 구분하지 않는다 — "ISBN 없는 서지"는 그냥 isbn13이 빈 서지다).
type ManualRegisterPayload = {
  operator: string;
  title: string;
  subtitle: string;
  authors: string;
  publisher: string;
  publishedYear: string;
  categoryCodes: string;
  description: string;
  condition: BookCondition;
  createCopy: true;
  note: string;
  requestId: string;
} & Record<string, unknown>;

type RegisterAction = 'registerByIsbn' | 'registerTitle';

interface FailedEntry {
  requestId: string;
  action: RegisterAction;
  // 실패 목록 표시용으로 필요한 최소 정보만 최상위에 꺼내둔다(payload는 두 액션이 서로 다른
  // 모양이라 유니온으로 두면 FailedList가 title/isbn을 꺼낼 때 unknown이 되어 JSX에 못 넣는다
  // — DataTable 등 다른 곳의 관례처럼 "표시용 필드는 평평하게" 원칙을 따른다).
  title: string;
  isbn: string;
  payload: Record<string, unknown>;
  reason: string;
}

interface FormState {
  title: string;
  subtitle: string;
  authors: string;
  publisher: string;
  publishedYear: string;
  pageCount: string;
  copyCount: string;
  condition: BookCondition;
}

// 무ISBN 수동 등록 전용 폼 — 사이드바 titleForm(Sidebar.html ~364)이 보여주는 필드 중 모바일
// 한 화면에 맞는 부분집합(서명·저자 필수, 부제/출판사/발행년/분류코드/설명은 선택). ISBN
// 조회 결과가 없으니 FormState(ISBN 흐름 전용)와 필드 구성이 달라 별도 타입으로 둔다 —
// FormState를 확장하면 ISBN 흐름의 검증 로직(title만 필수)까지 손대야 해서 오히려 위험하다.
interface ManualFormState {
  title: string;
  subtitle: string;
  authors: string;
  publisher: string;
  publishedYear: string;
  categoryCodes: string;
  description: string;
  condition: BookCondition;
}

type Screen = 'scan' | 'lookup' | 'confirm' | 'manualConfirm' | 'saving' | 'result';

const EMPTY_FORM: FormState = {
  title: '',
  subtitle: '',
  authors: '',
  publisher: '',
  publishedYear: '',
  pageCount: '',
  copyCount: '1',
  condition: 'GOOD'
};

const EMPTY_MANUAL_FORM: ManualFormState = {
  title: '',
  subtitle: '',
  authors: '',
  publisher: '',
  publishedYear: '',
  categoryCodes: '',
  description: '',
  condition: 'GOOD'
};

function formFromLookup(data: LookupIsbnResult): FormState {
  return {
    title: data.title ?? '',
    subtitle: data.subtitle ?? '',
    authors: data.authors ?? '',
    publisher: data.publisher ?? '',
    publishedYear: data.publishedYear != null ? String(data.publishedYear) : '',
    pageCount: data.pageCount != null ? String(data.pageCount) : '',
    copyCount: '1',
    condition: 'GOOD'
  };
}

// register.html의 localStorage 영속(오늘 카운터·실패 목록)을 계승 — apiUrl/token/operator만
// 세션 서비스로 옮기고, 이 둘은 뷰 자체 상태라 여기서 직접 관리한다.
const TODAY_KEY = `lib.register.today.${new Date().toISOString().slice(0, 10)}`;
const FAILED_KEY = 'lib.register.failed';

function readTodayCount(): number {
  const n = Number(localStorage.getItem(TODAY_KEY) ?? '0');
  return Number.isFinite(n) ? n : 0;
}
function writeTodayCount(n: number): void {
  localStorage.setItem(TODAY_KEY, String(n));
}
function readFailedList(): FailedEntry[] {
  try {
    const raw = localStorage.getItem(FAILED_KEY);
    return raw ? (JSON.parse(raw) as FailedEntry[]) : [];
  } catch {
    return [];
  }
}
function writeFailedList(list: FailedEntry[]): void {
  localStorage.setItem(FAILED_KEY, JSON.stringify(list));
}

function outcomeLabel(outcome: ApiCallLogEntry['outcome']): string {
  switch (outcome) {
    case 'ok':
      return 'OK';
    case 'error':
      return 'ERROR';
    case 'network':
      return 'NETWORK';
    case 'timeout':
      return 'TIMEOUT';
    default:
      return outcome;
  }
}

function DiagnosticsPanel({ log, onCopy }: { log: ApiCallLogEntry[]; onCopy: () => void }) {
  return (
    <div className="reg-diagPanel panel">
      <div className="reg-diagHead">
        <span>{t('views.register.diagRecentRequests', { count: log.length })}</span>
        <button type="button" className="ghost" onClick={onCopy}>
          {t('views.register.diagCopyButton')}
        </button>
      </div>
      {log.length === 0 ? (
        <p className="reg-diagEmpty">{t('views.register.diagEmpty')}</p>
      ) : (
        <ul className="reg-diagList mono">
          {log.map((entry, i) => (
            <li key={`${entry.at}-${i}`} className={`reg-diagRow outcome-${entry.outcome}`}>
              <div className="reg-diagLine1">
                <span>{new Date(entry.at).toLocaleTimeString(intlLocaleTag(), { hour12: false })}</span>
                <span>{entry.action}</span>
                <span className="reg-diagOutcome">{outcomeLabel(entry.outcome)}</span>
                <span>{entry.durationMs}ms</span>
              </div>
              <div className="reg-diagLine2">
                requestId: {entry.requestId ?? '—'} · http {entry.httpStatus ?? '—'} · {entry.resultCode ?? '—'}
                {entry.transport && ` · ${entry.transport}`}
              </div>
              {(entry.errName || entry.responseType || entry.redirected !== undefined) && (
                <div className="reg-diagLine2">
                  {entry.errName && `err: ${entry.errName}`}
                  {entry.errName && (entry.responseType || entry.redirected !== undefined) && ' · '}
                  {entry.responseType && `res.type: ${entry.responseType}`}
                  {entry.responseType && entry.redirected !== undefined && ' · '}
                  {entry.redirected !== undefined && `redirected: ${entry.redirected}`}
                </div>
              )}
              {entry.resultMessage && <div className="reg-diagLine3">{entry.resultMessage}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FailedList({ entries, onRetry }: { entries: FailedEntry[]; onRetry: (entry: FailedEntry) => void }) {
  if (entries.length === 0) return null;
  return (
    <div className="reg-failList">
      <h2>{t('views.register.failedListHeading')}</h2>
      {entries.map((entry) => (
        <div className="reg-failRow" key={entry.requestId}>
          <span>
            {entry.title || entry.isbn} — {entry.reason}
          </span>
          <button type="button" onClick={() => onRetry(entry)}>
            {t('common.retry')}
          </button>
        </div>
      ))}
    </div>
  );
}

// 복본 일괄 발급(todo/16 「등록 확장」) — "이 책 N권" 요청을 apiWebRegisterCopy_(action:
// 'registerCopy') N번 순차 호출로 처리한다. 한 화면에서 title+최초 소장본 등록 직후(ISBN 경로든
// 무ISBN 수동 경로든) 또는 "복본으로 추가"로 기존 서지에 붙었을 때나 모두 result 화면에 이미
// titleId가 있으므로, 이 패널 하나가 세 경우 전부를 커버한다(각기 다른 화면을 새로 만들지
// 않는다).
//
// 순차 호출: 서버 executeWrite_ 안 withWriteLock_이 모든 쓰기를 이미 직렬화하지만, 그와 별개로
// 프론트가 하나씩 await해야만 "몇 번째 요청까지 성공했는지"를 안정적으로 추적해 실시간 진행률
// ("3/5 발급 중…")과 부분 실패 시 "이미 발급된 것은 남겨두고 나머지만 재시도"를 구현할 수
// 있다(Promise.all이면 어느 것이 실패했는지는 알아도 "몇 권째까지"는 알 수 없다).
function BulkCopyPanel({
  titleId,
  operator,
  onIssued
}: {
  titleId: string;
  operator: string;
  onIssued: (issuedCount: number) => void;
}) {
  const [countInput, setCountInput] = useState('5');
  const [issued, setIssued] = useState<string[]>([]);
  const [target, setTarget] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const runTo = useCallback(
    async (newTarget: number) => {
      setBusy(true);
      setError('');
      setTarget(newTarget);
      let codes = issued;
      const startedAt = codes.length;
      for (let i = codes.length; i < newTarget; i++) {
        const requestId = newRequestId();
        const res = await apiCall<RegisterCopyResult>('registerCopy', {
          titleKey: titleId,
          operator,
          note: operatorNoteFor(operator),
          requestId
        });
        if (!res.ok) {
          setIssued(codes);
          setError(res.error.message || t('common.unknownError'));
          setBusy(false);
          if (codes.length > startedAt) onIssued(codes.length - startedAt);
          return;
        }
        codes = [...codes, res.data.barcode];
        setIssued(codes);
      }
      setBusy(false);
      if (codes.length > startedAt) onIssued(codes.length - startedAt);
    },
    [issued, operator, titleId, onIssued]
  );

  const remaining = target - issued.length;
  const canStartFresh = !busy && remaining <= 0;

  return (
    <div className="reg-bulkPanel panel">
      <h2>{t('views.register.bulkHeading')}</h2>

      {canStartFresh && (
        <div className="reg-row2">
          <div>
            <label htmlFor="regBulkCount">{t('views.register.bulkCountLabel')}</label>
            <input
              id="regBulkCount"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={countInput}
              onChange={(e) => setCountInput(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => void runTo(issued.length + Math.max(1, Math.min(50, Number(countInput) || 1)))}
          >
            {t('views.register.bulkIssueButton')}
          </button>
        </div>
      )}

      {busy && (
        <div className="reg-bulkProgress">
          <div className="reg-spinner" aria-hidden="true" />
          <span>{t('views.register.bulkProgress', { done: issued.length, total: target })}</span>
        </div>
      )}

      {!busy && error && remaining > 0 && (
        <>
          <div className="reg-errBanner" role="alert">
            {t('views.register.bulkPartialError', { done: issued.length, total: target, reason: error })}
          </div>
          <button type="button" onClick={() => void runTo(target)}>
            {t('views.register.bulkRetryRemaining', { remaining })}
          </button>
        </>
      )}

      {issued.length > 0 && (
        <div className="reg-bulkIssued">
          <h3>{t('views.register.bulkIssuedHeading', { count: issued.length })}</h3>
          <p className="reg-bulkPencilHint">{t('views.register.bulkPencilHint')}</p>
          <div className="reg-bulkList mono">
            {issued.map((code) => (
              <div key={code}>{code}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RegisterView({ shell }: ViewProps) {
  const operator = useSession((s) => s.operator);

  useEffect(() => {
    shell.setTitle(getViewMeta('register')?.title ?? t('registry.register.title'));
  }, [shell]);

  const [screen, setScreen] = useState<Screen>('scan');
  const screenRef = useRef<Screen>('scan');
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  const [isbn, setIsbn] = useState('');
  const [lookup, setLookup] = useState<LookupIsbnResult | null>(null);
  const [dupVisible, setDupVisible] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');

  // 무ISBN 수동 등록(todo/16) — 위 lookup/form(ISBN 흐름 전용)과 분리된 자체 상태.
  const [manualForm, setManualForm] = useState<ManualFormState>(EMPTY_MANUAL_FORM);

  const [errorBanner, setErrorBanner] = useState('');
  const [todayCount, setTodayCount] = useState<number>(readTodayCount);
  const [failedList, setFailedList] = useState<FailedEntry[]>(readFailedList);
  const [result, setResult] = useState<(RegisterByIsbnResult & { requestId: string }) | null>(null);

  const [diagOpen, setDiagOpen] = useState(false);
  const [diagLog, setDiagLog] = useState<ApiCallLogEntry[]>(() => [...getRecentApiLog()]);

  useEffect(() => onApiLog((entry) => setDiagLog((prev) => [entry, ...prev].slice(0, 50))), []);

  const beginLookup = useCallback(async (rawIsbn: string) => {
    setIsbn(rawIsbn);
    setErrorBanner('');
    setScreen('lookup');
    const res = await apiCall<LookupIsbnResult>('lookupIsbn', { isbn: rawIsbn });
    if (!res.ok) {
      if (res.error.code === 'NOT_FOUND') {
        const empty: LookupIsbnResult = { isbn: rawIsbn, source: 'MANUAL', isDuplicate: false };
        setLookup(empty);
        setForm(formFromLookup(empty));
        setDupVisible(false);
        setScreen('confirm');
        return;
      }
      setErrorBanner(res.error.message || t('views.register.errorLookupFailed'));
      setScreen('scan');
      return;
    }
    setLookup(res.data);
    setForm(formFromLookup(res.data));
    setDupVisible(Boolean(res.data.isDuplicate));
    setScreen('confirm');
  }, []);

  // 셸이 이미 acquire()해둔 카메라의 스캔 이벤트를 구독. 이 창(register)이 현재 스캔 라우트일
  // 때, 그리고 지금 화면이 대기 상태(scan)일 때만 반응한다 — 다른 뷰가 포커스거나 이미
  // 등록 흐름 중간이면 무시(register.html처럼 카메라를 직접 켜고 끄지 않으므로 필수 가드).
  useEffect(
    () =>
      subscribeScan((event) => {
        if (getEffectiveScanRoute() !== 'register') return;
        if (screenRef.current !== 'scan') return;
        if (event.target.kind !== 'isbn') return;
        void beginLookup(event.target.isbn);
      }),
    [beginLookup]
  );

  function handleManualSubmit() {
    const digits = manualValue.replace(/[^0-9]/g, '');
    const validPrefix = digits.startsWith('978') || digits.startsWith('979');
    if (!validPrefix || !isValidEan13(digits)) {
      setErrorBanner(t('views.register.errorInvalidIsbn'));
      return;
    }
    setManualOpen(false);
    setManualValue('');
    void beginLookup(digits);
  }

  const submitRegister = useCallback(async (requestId: string, payload: RegisterPayload) => {
    setErrorBanner('');
    setScreen('saving');
    const res = await apiCall<RegisterByIsbnResult>('registerByIsbn', payload);
    if (!res.ok) {
      const reason = res.error.message || t('common.unknownError');
      setErrorBanner(t('views.register.errorSaveFailed', { reason }));
      setFailedList((prev) => {
        const next = [
          ...prev.filter((f) => f.requestId !== requestId),
          { requestId, action: 'registerByIsbn' as const, title: payload.title, isbn: payload.isbn, payload, reason }
        ];
        writeFailedList(next);
        return next;
      });
      setScreen('confirm');
      return;
    }
    setFailedList((prev) => {
      const next = prev.filter((f) => f.requestId !== requestId);
      writeFailedList(next);
      return next;
    });
    setTodayCount((prev) => {
      const next = prev + (res.data.copyCount || payload.copyCount);
      writeTodayCount(next);
      return next;
    });
    setResult({ ...res.data, requestId });
    setScreen('result');
    // FRONTEND.md 대시보드 갱신 트리거 "트랜잭션 후" — dashboardData가 구독해 재조회한다.
    publishDataChange();
  }, []);

  // 무ISBN 수동 등록(todo/16) 저장 — submitRegister와 같은 실패/성공 뼈대(진단 로그·실패
  // 목록·오늘 카운터·result 화면·publishDataChange)를 따르지만 다른 action('registerTitle')과
  // 다른 응답 모양(barcodes 배열이 아니라 barcode 하나)이라 별도 함수로 둔다.
  const submitManualRegister = useCallback(async (requestId: string, payload: ManualRegisterPayload) => {
    setErrorBanner('');
    setScreen('saving');
    const res = await apiCall<RegisterTitleResult>('registerTitle', payload);
    if (!res.ok) {
      const reason = res.error.message || t('common.unknownError');
      setErrorBanner(t('views.register.errorSaveFailed', { reason }));
      setFailedList((prev) => {
        const next = [
          ...prev.filter((f) => f.requestId !== requestId),
          { requestId, action: 'registerTitle' as const, title: payload.title, isbn: '', payload, reason }
        ];
        writeFailedList(next);
        return next;
      });
      setScreen('manualConfirm');
      return;
    }
    setFailedList((prev) => {
      const next = prev.filter((f) => f.requestId !== requestId);
      writeFailedList(next);
      return next;
    });
    setTodayCount((prev) => {
      const next = prev + 1;
      writeTodayCount(next);
      return next;
    });
    setResult({
      titleId: res.data.titleId,
      title: res.data.title,
      barcodes: res.data.barcode ? [res.data.barcode] : [],
      created: true,
      copyCount: 1,
      requestId
    });
    setScreen('result');
    publishDataChange();
  }, []);

  const handleSave = useCallback(async () => {
    if (!lookup) return;
    const title = form.title.trim();
    if (!title) {
      setErrorBanner(t('views.register.errorTitleRequired'));
      return;
    }
    if (!operator) {
      setErrorBanner(t('views.register.errorNoOperator'));
      return;
    }
    const copyCount = Math.max(1, Math.min(50, Number(form.copyCount) || 1));
    const requestId = newRequestId();
    const payload: RegisterPayload = {
      isbn: lookup.isbn,
      operator,
      title,
      subtitle: form.subtitle.trim(),
      authors: form.authors.trim(),
      publisher: form.publisher.trim(),
      publishedYear: form.publishedYear.trim(),
      pageCount: form.pageCount.trim(),
      coverUrl: lookup.coverUrl || '',
      copyCount,
      condition: form.condition,
      requestId
    };
    await submitRegister(requestId, payload);
  }, [lookup, form, operator, submitRegister]);

  // 무ISBN 수동 등록(todo/16) 저장 — 사이드바 titleForm과 같은 서버 로직(registerTitle_)을
  // 그대로 쓰되, 이 폼은 서명·저자만 필수(handleSave의 title-only 필수 검증과 다르다 — ISBN
  // 흐름은 여기서 손대지 않는다).
  const handleManualSave = useCallback(async () => {
    const title = manualForm.title.trim();
    const authors = manualForm.authors.trim();
    if (!title) {
      setErrorBanner(t('views.register.errorTitleRequired'));
      return;
    }
    if (!authors) {
      setErrorBanner(t('views.register.errorAuthorsRequired'));
      return;
    }
    if (!operator) {
      setErrorBanner(t('views.register.errorNoOperator'));
      return;
    }
    const requestId = newRequestId();
    const payload: ManualRegisterPayload = {
      operator,
      title,
      subtitle: manualForm.subtitle.trim(),
      authors,
      publisher: manualForm.publisher.trim(),
      publishedYear: manualForm.publishedYear.trim(),
      categoryCodes: manualForm.categoryCodes.trim(),
      description: manualForm.description.trim(),
      condition: manualForm.condition,
      createCopy: true,
      note: operatorNoteFor(operator),
      requestId
    };
    await submitManualRegister(requestId, payload);
  }, [manualForm, operator, submitManualRegister]);

  const retryFailed = useCallback(
    (entry: FailedEntry) => {
      // 재시도는 항상 같은 requestId — 서버 멱등(requestId)이 중복 저장을 흡수한다.
      // 자동 재시도는 하지 않는다: 사용자가 버튼을 눌러야만 여기 도달한다.
      if (entry.action === 'registerTitle') {
        void submitManualRegister(entry.requestId, entry.payload as ManualRegisterPayload);
      } else {
        void submitRegister(entry.requestId, entry.payload as RegisterPayload);
      }
    },
    [submitRegister, submitManualRegister]
  );

  function handleCancel() {
    setLookup(null);
    setDupVisible(false);
    setForm(EMPTY_FORM);
    setErrorBanner('');
    setScreen('scan');
  }

  function handleManualCancel() {
    setManualForm(EMPTY_MANUAL_FORM);
    setErrorBanner('');
    setScreen('scan');
  }

  function handleNext() {
    setLookup(null);
    setResult(null);
    setForm(EMPTY_FORM);
    setManualForm(EMPTY_MANUAL_FORM);
    setScreen('scan');
  }

  // 복본 일괄 발급(todo/16) 완료 콜백 — submitRegister/submitManualRegister의 성공 경로와 같은
  // 두 가지 부수효과(오늘 카운터·대시보드 갱신 트리거)를 그대로 따른다. 부분 실패라도 실제로
  // 발급된 권수(issuedCount)만큼은 반영한다 — 이미 만들어진 소장본을 통계에서 숨기지 않는다.
  const handleBulkIssued = useCallback((issuedCount: number) => {
    setTodayCount((prev) => {
      const next = prev + issuedCount;
      writeTodayCount(next);
      return next;
    });
    publishDataChange();
  }, []);

  async function handleCopyDiagLog() {
    const text = JSON.stringify(diagLog, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      shell.toast(t('views.register.diagCopySuccess'), 'success');
    } catch {
      shell.toast(t('views.register.diagCopyFailure'), 'error');
    }
  }

  return (
    <div className="reg-root">
      <header className="reg-header">
        <h1>
          <BookPlus size={20} aria-hidden /> {t('registry.register.title')}
        </h1>
        <div className="reg-stats">
          {t('views.register.todayPrefix')} <b>{todayCount}</b>
          {t('views.register.todayUnit')}
        </div>
        <button type="button" className="ghost reg-diagBtn" onClick={() => setDiagOpen((v) => !v)}>
          {t('views.register.diagLogLabel')} {diagOpen ? t('common.hide') : t('common.show')}
        </button>
      </header>

      {errorBanner && (
        <div className="reg-errBanner" role="alert">
          {errorBanner}
        </div>
      )}

      {diagOpen && <DiagnosticsPanel log={diagLog} onCopy={() => void handleCopyDiagLog()} />}

      {screen === 'scan' && (
        <section className="reg-scan panel">
          <ScanCameraStart viewId="register" platform={shell.platform} />
          <p className="reg-scanHint">{t('views.register.scanHint')}</p>
          {!manualOpen ? (
            <button type="button" className="ghost" onClick={() => setManualOpen(true)}>
              {t('views.register.manualEntryButton')}
            </button>
          ) : (
            <div className="reg-manual">
              <label htmlFor="regManualIsbn">{t('views.register.manualIsbnLabel')}</label>
              <input
                id="regManualIsbn"
                inputMode="numeric"
                placeholder="9788901234567"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value.replace(/[^0-9]/g, '').slice(0, 13))}
              />
              <div className="reg-row2" style={{ marginTop: 10 }}>
                <button type="button" onClick={handleManualSubmit}>
                  {t('views.register.lookupButton')}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setManualOpen(false);
                    setManualValue('');
                  }}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
          {!manualOpen && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setManualForm(EMPTY_MANUAL_FORM);
                setErrorBanner('');
                setScreen('manualConfirm');
              }}
            >
              {t('views.register.manualRegisterButton')}
            </button>
          )}
        </section>
      )}

      {screen === 'manualConfirm' && (
        <section className="reg-confirm">
          <div className="reg-confirmForm panel">
            <div className="reg-titleRow">
              <span className="reg-srcTag">{t('views.register.manualFormHeading')}</span>
            </div>

            <label htmlFor="regMTitle">{t('views.register.labelTitle')}</label>
            <input
              id="regMTitle"
              value={manualForm.title}
              onChange={(e) => setManualForm((f) => ({ ...f, title: e.target.value }))}
            />

            <label htmlFor="regMAuthors">{t('views.register.labelAuthorsRequired')}</label>
            <input
              id="regMAuthors"
              value={manualForm.authors}
              onChange={(e) => setManualForm((f) => ({ ...f, authors: e.target.value }))}
            />

            <label htmlFor="regMSubtitle">{t('views.register.labelSubtitle')}</label>
            <input
              id="regMSubtitle"
              value={manualForm.subtitle}
              onChange={(e) => setManualForm((f) => ({ ...f, subtitle: e.target.value }))}
            />

            <div className="reg-row2">
              <div>
                <label htmlFor="regMPublisher">{t('views.register.labelPublisher')}</label>
                <input
                  id="regMPublisher"
                  value={manualForm.publisher}
                  onChange={(e) => setManualForm((f) => ({ ...f, publisher: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="regMYear">{t('views.register.labelYear')}</label>
                <input
                  id="regMYear"
                  inputMode="numeric"
                  value={manualForm.publishedYear}
                  onChange={(e) => setManualForm((f) => ({ ...f, publishedYear: e.target.value }))}
                />
              </div>
            </div>

            <label htmlFor="regMCategory">{t('views.register.labelCategoryCodes')}</label>
            <input
              id="regMCategory"
              value={manualForm.categoryCodes}
              onChange={(e) => setManualForm((f) => ({ ...f, categoryCodes: e.target.value }))}
            />

            <label htmlFor="regMDescription">{t('views.register.labelDescription')}</label>
            <textarea
              id="regMDescription"
              value={manualForm.description}
              onChange={(e) => setManualForm((f) => ({ ...f, description: e.target.value }))}
            />

            <label htmlFor="regMCondition">{t('views.register.labelCondition')}</label>
            <select
              id="regMCondition"
              value={manualForm.condition}
              onChange={(e) => setManualForm((f) => ({ ...f, condition: e.target.value as BookCondition }))}
            >
              <option value="GOOD">{t('views.register.conditionGood')}</option>
              <option value="FAIR">{t('views.register.conditionFair')}</option>
              <option value="DAMAGED">{t('views.register.conditionDamaged')}</option>
            </select>

            <button type="button" onClick={() => void handleManualSave()}>
              {t('common.save')}
            </button>
            <button type="button" className="ghost" onClick={handleManualCancel}>
              {t('views.register.cancelAndRescan')}
            </button>
          </div>
        </section>
      )}

      {screen === 'lookup' && (
        <section className="reg-lookup panel">
          <div className="reg-spinner" aria-hidden="true" />
          <div>
            {t('views.register.lookupInProgress')} (<span className="mono">{isbn}</span>)
          </div>
        </section>
      )}

      {screen === 'confirm' && lookup && (
        <section className="reg-confirm">
          {dupVisible && (
            <div className="reg-dupBanner">
              <b>{t('views.register.dupBannerTitle', { title: lookup.existingTitle ?? lookup.title ?? '' })}</b>
              <div>{t('views.register.dupBannerQuestion')}</div>
              <div className="reg-row2" style={{ marginTop: 10 }}>
                <button type="button" onClick={() => setDupVisible(false)}>
                  {t('views.register.addAsDuplicate')}
                </button>
                <button type="button" className="ghost" onClick={() => setDupVisible(false)}>
                  {t('views.register.editAndRegister')}
                </button>
              </div>
            </div>
          )}
          {!dupVisible && (
            <div className="reg-confirmForm panel">
              <div className="reg-titleRow">
                {lookup.coverUrl && <img className="reg-cover" src={lookup.coverUrl} alt="" />}
                <div>
                  <div className="mono reg-isbn">{lookup.isbn}</div>
                  <span className="reg-srcTag">{lookup.source ?? 'MANUAL'}</span>
                </div>
              </div>

              <label htmlFor="regTitle">{t('views.register.labelTitle')}</label>
              <input id="regTitle" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />

              <label htmlFor="regSubtitle">{t('views.register.labelSubtitle')}</label>
              <input id="regSubtitle" value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} />

              <label htmlFor="regAuthors">{t('views.register.labelAuthors')}</label>
              <input id="regAuthors" value={form.authors} onChange={(e) => setForm((f) => ({ ...f, authors: e.target.value }))} />

              <div className="reg-row2">
                <div>
                  <label htmlFor="regPublisher">{t('views.register.labelPublisher')}</label>
                  <input
                    id="regPublisher"
                    value={form.publisher}
                    onChange={(e) => setForm((f) => ({ ...f, publisher: e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="regYear">{t('views.register.labelYear')}</label>
                  <input
                    id="regYear"
                    inputMode="numeric"
                    value={form.publishedYear}
                    onChange={(e) => setForm((f) => ({ ...f, publishedYear: e.target.value }))}
                  />
                </div>
              </div>

              <div className="reg-row2">
                <div>
                  <label htmlFor="regPages">{t('views.register.labelPages')}</label>
                  <input
                    id="regPages"
                    inputMode="numeric"
                    value={form.pageCount}
                    onChange={(e) => setForm((f) => ({ ...f, pageCount: e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="regCopyCount">{t('views.register.labelCopyCount')}</label>
                  <input
                    id="regCopyCount"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={50}
                    value={form.copyCount}
                    onChange={(e) => setForm((f) => ({ ...f, copyCount: e.target.value }))}
                  />
                </div>
              </div>

              <label htmlFor="regCondition">{t('views.register.labelCondition')}</label>
              <select
                id="regCondition"
                value={form.condition}
                onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value as BookCondition }))}
              >
                <option value="GOOD">{t('views.register.conditionGood')}</option>
                <option value="FAIR">{t('views.register.conditionFair')}</option>
                <option value="DAMAGED">{t('views.register.conditionDamaged')}</option>
              </select>

              <button type="button" onClick={() => void handleSave()}>
                {t('common.save')}
              </button>
              <button type="button" className="ghost" onClick={handleCancel}>
                {t('views.register.cancelAndRescan')}
              </button>
            </div>
          )}
        </section>
      )}

      {screen === 'saving' && (
        <section className="reg-lookup panel">
          <div className="reg-spinner" aria-hidden="true" />
          <div>{t('views.register.saving')}</div>
        </section>
      )}

      {screen === 'result' && result && (
        <section className="reg-result panel">
          <div className={`reg-bignum${result.barcodes.length > 1 ? ' multi' : ''}`}>{result.barcodes[0]}</div>
          {result.barcodes.length > 1 && (
            <div className="reg-barcodeList">
              {result.barcodes.slice(1).map((b) => (
                <div key={b}>{b}</div>
              ))}
            </div>
          )}
          <div className="reg-resultTitle">
            {result.title}
            {result.created ? t('views.register.newTitleSuffix') : t('views.register.dupTitleSuffix')}
            {t('views.register.pencilHint')}
          </div>
          <div className="reg-resultMeta mono">
            {result.titleId && <div>{t('views.register.titleIdLine', { id: result.titleId })}</div>}
            <div>{t('views.register.requestIdLine', { id: result.requestId })}</div>
          </div>
          <button type="button" onClick={handleNext}>
            {t('views.register.nextScan')}
          </button>
        </section>
      )}

      {screen === 'result' && result && result.titleId && (
        <BulkCopyPanel titleId={result.titleId} operator={operator} onIssued={handleBulkIssued} />
      )}

      <FailedList entries={failedList} onRetry={retryFailed} />
    </div>
  );
}
