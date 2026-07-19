import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { newRequestId } from '../../services/api';
import {
  fetchMemberList,
  registerMemberApi,
  updateMemberApi,
  type ClassCodeEntry,
  type MemberListData,
  type MemberRow
} from '../../services/memberData';
import { getEffectiveScanRoute, subscribeScan } from '../../services/scanBus';
import { t } from '../../i18n';
import type { ShellContext, ViewProps } from '../../types';
import './members.css';

// 학생 관리 뷰 — todo/126(목록·검색·반 필터·스캔 핀) + todo/127(등록·수정·일괄 등록).
// 배경·데이터 원칙(로컬 필터, unavailable 폴백, 샘플 금지)은 services/memberData.ts 주석 참고.
//
// 쓰기 UX(127)의 설계 판단:
// - 개별 폼은 등록·수정 겸용 카드 하나 — 등록 성공 시 카드를 닫지 않고 이름만 비운다(35명
//   최초 입력 대비 연속 등록). 반 이동 = 수정 카드의 반 select 변경(별도 UI 없음 — 최빈 작업의
//   최단 경로).
// - requestId는 폼 열림~성공 사이 고정(useRef) — 네트워크 오류 후 재클릭이 같은 ID로 나가
//   executeWrite_ 멱등이 이중 등록을 흡수한다(registerQueue와 같은 관례). 성공 시에만 재발급.
// - 일괄 등록은 registerQueue 같은 상주 자동 재개를 일부러 만들지 않았다 — 감독하 일회성
//   작업(사서가 화면을 보며 실행)이라 실패 줄 재시도 버튼이면 충분하다(docs/ASSUMPTIONS.md).
// - 수정의 비고는 "추가" 의미다: 서버 updateMember_가 appendNote_로 기존 비고 뒤에 덧붙인다
//   (덮어쓰기가 아님) — 라벨로 명시해 혼동을 막는다.

type LoadState =
  | { phase: 'loading' }
  | { phase: 'unavailable' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; data: MemberListData };

// 상태 코드 → 사람 말. 동적 키 대신 스위치(리터럴 t()만 — check-i18n-keys가 사용 키를
// 정적으로 수확할 수 있어야 한다). 모르는 코드는 원문 그대로(미래 코드북 확장 내성).
function statusLabel(code: string): string {
  switch (code) {
    case 'ACTIVE':
      return t('views.members.status.active');
    case 'SUSPENDED':
      return t('views.members.status.suspended');
    case 'GRADUATED':
      return t('views.members.status.graduated');
    case 'TRANSFERRED':
      return t('views.members.status.transferred');
    case 'WITHDRAWN':
      return t('views.members.status.withdrawn');
    default:
      return code;
  }
}

const STATUS_FILTER_OPTIONS = ['ACTIVE', 'ALL', 'SUSPENDED', 'GRADUATED', 'TRANSFERRED', 'WITHDRAWN'] as const;
const EDIT_STATUS_OPTIONS = ['ACTIVE', 'SUSPENDED', 'GRADUATED', 'TRANSFERRED', 'WITHDRAWN'] as const;

// 출생연도 선택지 — 3살(입학 최연소 실례 2023년생)부터 30년 전까지. 자유 입력 대신 select:
// 오타(19199 등)를 원천 차단하고, 목록이 짧아 터치가 더 빠르다.
function birthYearOptions(): number[] {
  const thisYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = thisYear - 2; y >= thisYear - 30; y--) years.push(y);
  return years;
}

interface MemberFormProps {
  mode: 'create' | 'edit';
  member: MemberRow | null;
  classes: ClassCodeEntry[];
  defaultClassCode: string;
  shell: ShellContext;
  onRegistered: () => void;
  onUpdated: () => void;
  onCancel: () => void;
}

function MemberFormCard({ mode, member, classes, defaultClassCode, shell, onRegistered, onUpdated, onCancel }: MemberFormProps) {
  const labelSchool = classes.length > 0; // 이름 반 학교(코드북) vs 숫자 반 학교(정수 입력)
  const [name, setName] = useState(member?.name ?? '');
  const [classCode, setClassCode] = useState(
    member ? member.classCode : defaultClassCode || (labelSchool ? classes[0].code : '')
  );
  const [birthYear, setBirthYear] = useState(member?.birthYear ? String(member.birthYear) : '');
  const [status, setStatus] = useState(member?.statusCode ?? 'ACTIVE');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [invalidName, setInvalidName] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const requestIdRef = useRef(newRequestId());

  async function submit() {
    if (saving) return;
    const trimmedName = name.trim();
    if (mode === 'create' || trimmedName !== (member?.name ?? '')) {
      if (!trimmedName) {
        setInvalidName(true);
        nameRef.current?.focus();
        nameRef.current?.scrollIntoView({ block: 'center' });
        return;
      }
    }
    setErrorMsg('');
    setSaving(true);
    try {
      if (mode === 'create') {
        const res = await registerMemberApi({
          requestId: requestIdRef.current,
          name: trimmedName,
          classNo: classCode,
          birthYear: birthYear ? Number(birthYear) : '',
          note: note.trim() || undefined
        });
        if (!res.ok) {
          setErrorMsg(res.error.message || res.error.code);
          return;
        }
        shell.toast(t('views.members.registerDone', { name: trimmedName }), 'success');
        requestIdRef.current = newRequestId();
        setName('');
        setBirthYear('');
        setNote('');
        nameRef.current?.focus();
        onRegistered();
        return;
      }
      // edit — 바뀐 필드만 보낸다(서버가 "변경할 값" 최소 1개를 요구, 불변 값 재전송은 무의미).
      const target = member as MemberRow;
      const patch: { name?: string; classNo?: string; birthYear?: number; status?: string; note?: string } = {};
      if (trimmedName && trimmedName !== target.name) patch.name = trimmedName;
      if (classCode && classCode !== target.classCode) patch.classNo = classCode;
      if (birthYear && Number(birthYear) !== target.birthYear) patch.birthYear = Number(birthYear);
      if (status !== target.statusCode) patch.status = status;
      if (note.trim()) patch.note = note.trim();
      if (Object.keys(patch).length === 0) {
        onCancel();
        return;
      }
      const res = await updateMemberApi({ requestId: requestIdRef.current, memberKey: target.memberNo, ...patch });
      if (!res.ok) {
        setErrorMsg(res.error.message || res.error.code);
        return;
      }
      shell.toast(t('views.members.updateDone', { name: trimmedName || target.name }), 'success');
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  function onEnterSubmit(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter') void submit();
  }

  return (
    <div className="mem-form panel">
      <h2>{mode === 'create' ? t('views.members.formTitleCreate') : t('views.members.formTitleEdit', { name: member?.name ?? '' })}</h2>
      {mode === 'edit' && member && (
        <p className="mem-form-sub">
          {t('views.members.formEditSub', { memberNo: member.memberNo, openLoans: member.openLoans })}
        </p>
      )}
      <label htmlFor="mem-name">{t('views.members.nameLabel')}</label>
      <input
        id="mem-name"
        ref={nameRef}
        type="text"
        value={name}
        placeholder={t('views.members.namePlaceholder')}
        aria-invalid={invalidName || undefined}
        className={invalidName ? 'is-invalid' : undefined}
        enterKeyHint="go"
        autoFocus={mode === 'create'}
        onKeyDown={onEnterSubmit}
        onChange={(e) => {
          setName(e.target.value);
          if (invalidName) setInvalidName(false);
        }}
      />
      <label htmlFor="mem-class">{labelSchool ? t('views.members.classLabel') : t('views.members.classNumericLabel')}</label>
      {labelSchool ? (
        <select id="mem-class" value={classCode} onChange={(e) => setClassCode(e.target.value)}>
          {classes.map((cls) => (
            <option key={cls.code} value={cls.code}>
              {cls.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id="mem-class"
          type="text"
          inputMode="numeric"
          value={classCode}
          enterKeyHint="go"
          onKeyDown={onEnterSubmit}
          onChange={(e) => setClassCode(e.target.value)}
        />
      )}
      <label htmlFor="mem-birth-year">{t('views.members.birthYearLabel')}</label>
      <select id="mem-birth-year" value={birthYear} onChange={(e) => setBirthYear(e.target.value)}>
        <option value="">{t('views.members.birthYearUnknown')}</option>
        {birthYearOptions().map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </select>
      {mode === 'edit' && (
        <>
          <label htmlFor="mem-status">{t('views.members.statusEditLabel')}</label>
          <select id="mem-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {EDIT_STATUS_OPTIONS.map((code) => (
              <option key={code} value={code}>
                {statusLabel(code)}
              </option>
            ))}
          </select>
        </>
      )}
      <label htmlFor="mem-note">{mode === 'edit' ? t('views.members.noteAppendLabel') : t('views.members.noteLabel')}</label>
      <textarea id="mem-note" value={note} placeholder={t('views.members.notePlaceholder')} onChange={(e) => setNote(e.target.value)} />
      {errorMsg && <p className="mem-form-error">{errorMsg}</p>}
      {/* 폼 액션 위계는 todo/118 표준(주 버튼 전폭→취소 ghost) — 규칙은 members.css에 자체
          정의한다(.reg-formActions는 register 뷰의 lazy CSS라 여기 로드를 보장할 수 없음). */}
      <div className="mem-formActions">
        <button type="button" disabled={saving} onClick={() => void submit()}>
          {mode === 'create' ? t('views.members.saveCreate') : t('views.members.saveEdit')}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

// ---------- 일괄 등록 (붙여넣기 → 미리보기 → 순차 등록, 실패 줄만 재시도) ----------

interface BulkRow {
  line: number;
  name: string;
  classCode: string;
  classLabel: string;
  birthYear: number | '';
  error?: string;
  /** 내용 기반 안정 키(이름|반|연도|동일내용 n번째) — 줄 번호·파서 재실행에 흔들리지 않는다.
   *  requestId를 파서에서 발급하면 목록 갱신(classes 참조 교체)마다 재발급돼 "완료" 장부가
   *  증발하고 재실행이 중복 등록이 된다(실캡처로 확인한 실결함) — 장부는 run 쪽에서 이 키로
   *  관리한다. */
  lineKey: string;
}

function parseBulkText(text: string, classes: ClassCodeEntry[], defaultClassCode: string): BulkRow[] {
  const rows: BulkRow[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    const cells = line.split(/[\t,;]/).map((cell) => cell.trim());
    // CSV 헤더 줄 무시 — 헤더 토큰은 현재 로케일의 열 라벨(+영문 name)로 판정한다. 한글
    // 리터럴 게이트(views/** 금지)를 우회하지 않기 위한 것이기도 하고, 실제로 우리가 나눠주는
    // CSV 헤더가 바로 이 라벨이기도 하다. 다른 로케일 헤더가 오면 오류 줄로 표시될 뿐(삭제 유도).
    const headerToken = new RegExp(`^(${t('views.members.bulkColName')}|name)$`, 'i');
    if (rows.length === 0 && headerToken.test(cells[0] ?? '')) return;
    const name = cells[0] ?? '';
    let classToken = '';
    let yearToken = '';
    for (const cell of cells.slice(1)) {
      if (!cell) continue;
      if (/^\d{4}$/.test(cell)) yearToken = cell;
      else classToken = cell;
    }
    const row: BulkRow = {
      line: index + 1,
      name,
      classCode: '',
      classLabel: '',
      birthYear: '',
      lineKey: ''
    };
    if (!name) {
      row.error = t('views.members.bulkErrorNoName');
      rows.push(row);
      return;
    }
    if (classToken) {
      const matched = classes.find(
        (cls) => cls.code === classToken.toUpperCase() || cls.label.toLowerCase() === classToken.toLowerCase()
      );
      if (matched) {
        row.classCode = matched.code;
        row.classLabel = matched.label;
      } else if (classes.length === 0 && /^\d+$/.test(classToken)) {
        row.classCode = classToken; // 숫자 반 학교 — 정수 반 번호 그대로
        row.classLabel = classToken;
      } else {
        row.error = t('views.members.bulkErrorClass', { token: classToken });
        rows.push(row);
        return;
      }
    } else if (defaultClassCode) {
      const fallback = classes.find((cls) => cls.code === defaultClassCode);
      row.classCode = defaultClassCode;
      row.classLabel = fallback?.label ?? defaultClassCode;
    } else {
      row.error = t('views.members.bulkErrorNoClass');
      rows.push(row);
      return;
    }
    if (yearToken) {
      const year = Number(yearToken);
      const thisYear = new Date().getFullYear();
      if (year < 1900 || year > thisYear) {
        row.error = t('views.members.bulkErrorYear', { token: yearToken });
        rows.push(row);
        return;
      }
      row.birthYear = year;
    }
    rows.push(row);
  });
  // 내용 키 부여 — 완전 동일 내용이 여러 줄이면 n번째 표식으로 구분(쌍둥이 동명 실수 케이스에서
  // 두 번째 줄이 첫 줄의 완료 상태를 상속해 조용히 건너뛰어지는 것 방지).
  const seen = new Map<string, number>();
  for (const row of rows) {
    const base = `${row.name}|${row.classCode}|${row.birthYear}`;
    const nth = seen.get(base) ?? 0;
    seen.set(base, nth + 1);
    row.lineKey = `${base}|${nth}`;
  }
  return rows;
}

interface BulkRunEntry {
  requestId: string;
  status: 'ok' | 'failed';
  message?: string;
}

interface BulkPanelProps {
  classes: ClassCodeEntry[];
  defaultClassCode: string;
  shell: ShellContext;
  onImported: () => void;
}

function BulkImportPanel({ classes, defaultClassCode, shell, onImported }: BulkPanelProps) {
  const [text, setText] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<Record<string, BulkRunEntry>>({});

  const rows = useMemo(() => parseBulkText(text, classes, defaultClassCode), [text, classes, defaultClassCode]);
  const validRows = rows.filter((row) => !row.error);
  const failedCount = validRows.filter((row) => results[row.lineKey]?.status === 'failed').length;
  const okCount = validRows.filter((row) => results[row.lineKey]?.status === 'ok').length;

  async function run() {
    if (running || validRows.length === 0) return;
    setRunning(true);
    const targets = validRows.filter((row) => results[row.lineKey]?.status !== 'ok');
    setProgress({ done: 0, total: targets.length });
    let done = 0;
    let ok = 0;
    let failed = 0;
    // 순차 실행 — GAS 쓰기는 문서 락 직렬이라 병렬로 쏘면 BUSY만 늘어난다(registerQueue와
    // 같은 이유). requestId는 줄(lineKey)당 최초 시도에 1회 발급해 장부에 남긴다 — 실패 줄
    // 재시도가 같은 ID로 나가 executeWrite_ 멱등이 이중 등록을 흡수한다.
    for (const row of targets) {
      const requestId = results[row.lineKey]?.requestId ?? newRequestId();
      const res = await registerMemberApi({
        requestId,
        name: row.name,
        classNo: row.classCode,
        birthYear: row.birthYear,
        note: undefined
      });
      if (res.ok) {
        ok += 1;
        setResults((prev) => ({ ...prev, [row.lineKey]: { requestId, status: 'ok' } }));
      } else {
        failed += 1;
        setResults((prev) => ({ ...prev, [row.lineKey]: { requestId, status: 'failed', message: res.error.message || res.error.code } }));
      }
      done += 1;
      setProgress({ done, total: targets.length });
    }
    setRunning(false);
    shell.toast(t('views.members.bulkDone', { ok, failed }), failed ? 'error' : 'success');
    if (ok > 0) onImported();
  }

  return (
    <details className="mem-bulk panel">
      <summary>{t('views.members.bulkSummary')}</summary>
      <p className="mem-bulk-hint">{t('views.members.bulkHint')}</p>
      <textarea
        value={text}
        placeholder={t('views.members.bulkPlaceholder')}
        onChange={(e) => {
          setText(e.target.value);
          setProgress(null); // 장부(results)는 lineKey 기반이라 유지 — 무관한 줄의 완료가 증발하지 않는다
        }}
      />
      {rows.length > 0 && (
        <div className="mem-bulk-preview">
          <table className="mem-bulk-table">
            <thead>
              <tr>
                <th>{t('views.members.bulkColLine')}</th>
                <th>{t('views.members.bulkColName')}</th>
                <th>{t('views.members.bulkColClass')}</th>
                <th>{t('views.members.bulkColBirthYear')}</th>
                <th>{t('views.members.bulkColState')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const result = results[row.lineKey];
                return (
                  <tr key={`${row.line}-${row.lineKey}`}>
                    <td className="mem-bulk-line">{row.line}</td>
                    <td>{row.name || '—'}</td>
                    <td>{row.classLabel || '—'}</td>
                    <td>{row.birthYear || '—'}</td>
                    <td>
                      {row.error ? (
                        <span className="mem-bulk-state mem-bulk-state--error">{row.error}</span>
                      ) : result?.status === 'ok' ? (
                        <span className="mem-bulk-state mem-bulk-state--ok">{t('views.members.bulkStateOk')}</span>
                      ) : result?.status === 'failed' ? (
                        <span className="mem-bulk-state mem-bulk-state--error">
                          {t('views.members.bulkStateFailed')} — {result.message}
                        </span>
                      ) : (
                        <span className="mem-bulk-state">{t('views.members.bulkStatePending')}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="mem-bulk-actions">
        <button type="button" disabled={running || validRows.length === 0 || okCount === validRows.length} onClick={() => void run()}>
          {running && progress
            ? t('views.members.bulkRunning', { done: progress.done, total: progress.total })
            : failedCount > 0
              ? t('views.members.bulkRetry', { count: failedCount })
              : t('views.members.bulkStart', { count: validRows.length })}
        </button>
      </div>
    </details>
  );
}

// ---------- 뷰 본체 ----------

type FormMode = { mode: 'create' } | { mode: 'edit'; member: MemberRow } | null;

export default function MembersView({ shell }: ViewProps) {
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [scanPin, setScanPin] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);

  // background=true면 화면을 로딩으로 되돌리지 않고 제자리 갱신(등록 직후 폼·필터 유지).
  const load = useCallback(async (background = false) => {
    if (!background) setState({ phase: 'loading' });
    const res = await fetchMemberList();
    if (res.ok) setState({ phase: 'ready', data: res.data });
    else if (res.unavailable) setState({ phase: 'unavailable' });
    else if (!background) setState({ phase: 'error', message: res.message });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 학생 카드 스캔(S: 접두, scanBus kind 'student') → 그 학생만 핀. 카드를 손에 든 채
  // "이 아이 누구지/몇 권 빌렸지"가 현장 최빈 질문이라 스캔 한 번이 검색을 대체한다.
  // 같은 반 유사 이름(Aisyah/Aisyah star/Alisyah 실례)에서 이름 검색보다 안전한 경로.
  useEffect(
    () =>
      subscribeScan((evt) => {
        if (getEffectiveScanRoute() !== 'members') return;
        if (evt.target.kind !== 'student') return;
        if (state.phase !== 'ready') return;
        const code = evt.target.studentCode;
        const hit = state.data.members.find((m) => m.memberNo === code || m.memberId === code);
        if (hit) {
          setScanPin(hit.memberNo);
          setClassFilter('');
          setStatusFilter('ALL');
        } else {
          shell.toast(t('views.members.scanNotFound', { code }), 'error');
        }
      }),
    [state, shell]
  );

  if (state.phase === 'unavailable') {
    return (
      <div className="mem-view">
        <div className="mem-unavailable panel">
          <h2>{t('views.members.unavailableTitle')}</h2>
          <p>{t('views.members.unavailableBody')}</p>
          <button type="button" className="ghost" onClick={() => void load()}>
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  const data = state.phase === 'ready' ? state.data : null;
  const members = data?.members ?? [];
  const rows = members.filter((m) => {
    if (scanPin) return m.memberNo === scanPin;
    if (classFilter && m.classCode !== classFilter) return false;
    if (statusFilter !== 'ALL' && m.statusCode !== statusFilter) return false;
    return true;
  });

  // 출생연도 열은 스키마 업그레이드 전엔 숨긴다(전 행 공백 열은 "고장"으로 읽힌다 — 대신
  // 상단 힌트 줄이 이유를 말한다).
  const columns: DataTableColumn<MemberRow>[] = [
    { key: 'memberNo', header: t('views.members.colMemberNo'), sortable: true, mono: true, nowrap: true, mobilePrimary: true },
    { key: 'name', header: t('views.members.colName'), sortable: true, nowrap: true, mobileSecondary: true },
    { key: 'classLabel', header: t('views.members.colClass'), sortable: true, nowrap: true },
    ...(data?.birthYearReady
      ? [{ key: 'birthYear', header: t('views.members.colBirthYear'), sortable: true, numeric: true, mono: true } as DataTableColumn<MemberRow>]
      : []),
    { key: 'openLoans', header: t('views.members.colOpenLoans'), sortable: true, numeric: true },
    {
      key: 'statusCode',
      header: t('views.members.colStatus'),
      sortable: true,
      nowrap: true,
      sortAccessor: (row) => row.statusCode,
      filterValue: (row) => statusLabel(row.statusCode),
      csvValue: (row) => row.statusCode,
      render: (row) => (
        <span className={row.statusCode === 'ACTIVE' ? 'mem-status mem-status--active' : 'mem-status'}>
          {statusLabel(row.statusCode)}
        </span>
      )
    }
  ];

  return (
    <div className="mem-view">
      {data && !data.birthYearReady && <p className="mem-hint">{t('views.members.birthYearNotReady')}</p>}
      <div className="mem-filters" role="group" aria-label={t('views.members.filterAria')}>
        <button
          type="button"
          className={classFilter === '' && !scanPin ? 'mem-chip is-active' : 'mem-chip'}
          onClick={() => {
            setClassFilter('');
            setScanPin(null);
          }}
        >
          {t('views.members.chipAll')}
        </button>
        {(data?.classes ?? []).map((cls) => (
          <button
            key={cls.code}
            type="button"
            className={classFilter === cls.code && !scanPin ? 'mem-chip is-active' : 'mem-chip'}
            onClick={() => {
              setClassFilter(cls.code);
              setScanPin(null);
            }}
          >
            {cls.label}
          </button>
        ))}
        <select
          className="mem-status-select"
          aria-label={t('views.members.statusFilterAria')}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setScanPin(null);
          }}
        >
          {STATUS_FILTER_OPTIONS.map((code) => (
            <option key={code} value={code}>
              {code === 'ALL' ? t('views.members.statusAll') : statusLabel(code)}
            </option>
          ))}
        </select>
        {data && (
          <button type="button" className="mem-add-btn" onClick={() => setFormMode({ mode: 'create' })}>
            {t('views.members.addStudent')}
          </button>
        )}
      </div>
      {scanPin && (
        <div className="mem-scanpin">
          <span>{t('views.members.scanPin', { memberNo: scanPin })}</span>
          <button type="button" className="ghost" onClick={() => setScanPin(null)}>
            {t('views.members.scanPinClear')}
          </button>
        </div>
      )}
      {formMode && data && (
        <MemberFormCard
          key={formMode.mode === 'edit' ? formMode.member.memberId : 'create'}
          mode={formMode.mode}
          member={formMode.mode === 'edit' ? formMode.member : null}
          classes={data.classes}
          defaultClassCode={classFilter}
          shell={shell}
          onRegistered={() => void load(true)}
          onUpdated={() => {
            setFormMode(null);
            void load(true);
          }}
          onCancel={() => setFormMode(null)}
        />
      )}
      <DataTable<MemberRow>
        columns={columns}
        rows={rows}
        rowKey={(row) => row.memberId}
        onRowClick={(row) => setFormMode({ mode: 'edit', member: row })}
        platform={shell.platform}
        loading={state.phase === 'loading'}
        error={state.phase === 'error' ? state.message : null}
        emptyHint={t('views.members.emptyHint')}
        emptyAction={data ? { label: t('views.members.addStudent'), onClick: () => setFormMode({ mode: 'create' }) } : undefined}
        searchPlaceholder={t('views.members.searchPlaceholder')}
        csvFileName="members.csv"
        cardMetaColumns={2}
        ariaLabel={t('registry.members.title')}
        toolbarExtra={
          data ? <span className="mem-count">{t('views.members.countShown', { shown: rows.length, total: data.totalCount })}</span> : null
        }
      />
      {data && (
        <BulkImportPanel
          classes={data.classes}
          defaultClassCode={classFilter}
          shell={shell}
          onImported={() => void load(true)}
        />
      )}
    </div>
  );
}
