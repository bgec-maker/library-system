import { useCallback, useEffect, useRef, useState } from 'react';
import { BookPlus } from 'lucide-react';
import type { ViewProps } from '../../types';
import { getViewMeta } from '../../registry';
import { useSession } from '../../services/session';
import { apiCall, newRequestId, onApiLog, getRecentApiLog, type ApiCallLogEntry } from '../../services/api';
import { publishDataChange } from '../../services/dataChangeBus';
import { subscribeScan, getEffectiveScanRoute, isValidEan13 } from '../../services/scanBus';
import { ScanCameraStart } from '../../components/ScanCameraStart';
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

interface FailedEntry {
  requestId: string;
  payload: RegisterPayload;
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

type Screen = 'scan' | 'lookup' | 'confirm' | 'saving' | 'result';

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
              </div>
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
            {entry.payload.title || entry.payload.isbn} — {entry.reason}
          </span>
          <button type="button" onClick={() => onRetry(entry)}>
            {t('common.retry')}
          </button>
        </div>
      ))}
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
        const next = [...prev.filter((f) => f.requestId !== requestId), { requestId, payload, reason }];
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

  const retryFailed = useCallback(
    (entry: FailedEntry) => {
      // 재시도는 항상 같은 requestId — 서버 멱등(requestId)이 중복 저장을 흡수한다.
      // 자동 재시도는 하지 않는다: 사용자가 버튼을 눌러야만 여기 도달한다.
      void submitRegister(entry.requestId, entry.payload);
    },
    [submitRegister]
  );

  function handleCancel() {
    setLookup(null);
    setDupVisible(false);
    setForm(EMPTY_FORM);
    setErrorBanner('');
    setScreen('scan');
  }

  function handleNext() {
    setLookup(null);
    setResult(null);
    setForm(EMPTY_FORM);
    setScreen('scan');
  }

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

      <FailedList entries={failedList} onRetry={retryFailed} />
    </div>
  );
}
