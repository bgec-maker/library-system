import { useCallback, useEffect, useState } from 'react';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { fetchMemberList, type MemberListData, type MemberRow } from '../../services/memberData';
import { getEffectiveScanRoute, subscribeScan } from '../../services/scanBus';
import { t } from '../../i18n';
import type { ViewProps } from '../../types';
import './members.css';

// 학생 관리 뷰 — todo/126(난민학교 대응). 지금까지 학생 등록·관리는 스프레드시트 사이드바에만
// 있어 사서가 웹앱↔시트를 오갔다. 이 학교의 최빈 관리 작업이 "반 이동"(수준별 개별 배정이라
// 수시 발생)이므로 웹앱 상주 표면으로 올린다. 이 항목은 조회 절반(목록·검색·필터·스캔 핀),
// 쓰기 절반(등록·수정·일괄)은 todo/127.
//
// 데이터는 memberList(status:'ALL') 한 번으로 다 받고 반·상태·검색·핀 필터를 전부 로컬에서
// 한다 — 전교 수십 명 규모(ADR-024 원칙, services/memberData.ts 주석 참고).
//
// 재배포 전(UNKNOWN_ACTION)엔 "서버 업데이트 필요" 안내만 그린다 — 샘플 명단 폴백은 금지
// (가짜 학생과 실학생의 혼동은 관리 화면에서 사고다). PATCH_NOTES 재배포 대장이 단일 원장.

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

export default function MembersView({ shell }: ViewProps) {
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [scanPin, setScanPin] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ phase: 'loading' });
    const res = await fetchMemberList();
    if (res.ok) setState({ phase: 'ready', data: res.data });
    else if (res.unavailable) setState({ phase: 'unavailable' });
    else setState({ phase: 'error', message: res.message });
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
      </div>
      {scanPin && (
        <div className="mem-scanpin">
          <span>{t('views.members.scanPin', { memberNo: scanPin })}</span>
          <button type="button" className="ghost" onClick={() => setScanPin(null)}>
            {t('views.members.scanPinClear')}
          </button>
        </div>
      )}
      <DataTable<MemberRow>
        columns={columns}
        rows={rows}
        rowKey={(row) => row.memberId}
        platform={shell.platform}
        loading={state.phase === 'loading'}
        error={state.phase === 'error' ? state.message : null}
        emptyHint={t('views.members.emptyHint')}
        searchPlaceholder={t('views.members.searchPlaceholder')}
        csvFileName="members.csv"
        cardMetaColumns={2}
        ariaLabel={t('registry.members.title')}
        toolbarExtra={
          data ? <span className="mem-count">{t('views.members.countShown', { shown: rows.length, total: data.totalCount })}</span> : null
        }
      />
    </div>
  );
}
