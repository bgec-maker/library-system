import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import type { ViewProps } from '../../types';
import { getViewMeta } from '../../registry';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { SampleDataBadge } from '../../components/SampleDataBadge';
import {
  fetchSettingsOverview,
  runBibliographicEnrichment,
  runIntegrityCheck,
  type ConfigRow,
  type EnrichBibliographicResult,
  type IntegrityCheckResult,
  type IntegrityIssue,
  type PolicyRow,
  type SettingsOverview
} from '../../services/settingsData';
import { t } from '../../i18n';
import './settings.css';

// 설정 뷰(todo/26) — POLICIES/CONFIG 읽기 전용 열람 + 무결성 점검·서지 보강 실행 버튼.
// LIBRARIAN 전용은 registry.ts의 roles 필터 하나로 전부 처리된다(viewsForRole()이 STATION 세션에
// 이 뷰 자체를 아예 목록에서 빼므로, 이 파일 안에 별도 역할 검사 코드를 두지 않는다).
//
// "수정은 시트/사이드바"(완료 조건) — 이 화면은 어떤 입력 필드도 두지 않는다. POLICIES/CONFIG는
// DataTable로 조회만 하고, 실제 값 변경은 상단 안내문이 가리키는 스프레드시트/사이드바에서만
// 이뤄진다(서버도 이 두 시트에 쓰는 액션을 아예 노출하지 않는다 — apiWebSettingsOverview_는
// readTable_만 부른다).
//
// 무결성 점검(runIntegrityCheck)은 읽기 전용이라 dashboardData.ts류의 UNKNOWN_ACTION→샘플 폴백을
// 그대로 쓰지만, 서지 보강(enrichBibliographic)은 실제 쓰기라 샘플로 "성공한 척"하지 않는다
// (services/settingsData.ts 참고, CLAUDE.md 검증 원칙).

const issueKey = (issue: IntegrityIssue, index: number) => `${issue.sheet}-${issue.row}-${issue.code}-${index}`;

// todo/75 — 16_CODEBOOK 시드 라벨 미러(라벨(코드) 병기, 미지 코드는 원값). 명시 Record이라
// 키 실존 게이트가 리터럴 호출 전수를 검증한다(동적 키 금지 관례 — register의 FAIL_REASON_LABELS와 동형).
const MEMBER_TYPE_LABELS: Record<string, () => string> = {
  GENERAL: () => t('views.settings.codebook.memberType.GENERAL'),
  CHILD: () => t('views.settings.codebook.memberType.CHILD'),
  STAFF: () => t('views.settings.codebook.memberType.STAFF'),
  STUDENT: () => t('views.settings.codebook.memberType.STUDENT'),
  TEACHER: () => t('views.settings.codebook.memberType.TEACHER')
};
const MATERIAL_TYPE_LABELS: Record<string, () => string> = {
  BOOK: () => t('views.settings.codebook.materialType.BOOK'),
  REFERENCE: () => t('views.settings.codebook.materialType.REFERENCE'),
  AV: () => t('views.settings.codebook.materialType.AV'),
  SET: () => t('views.settings.codebook.materialType.SET'),
  TEACHER_ONLY: () => t('views.settings.codebook.materialType.TEACHER_ONLY')
};
const POLICY_STATUS_LABELS: Record<string, () => string> = {
  ACTIVE: () => t('views.settings.codebook.status.ACTIVE'),
  INACTIVE: () => t('views.settings.codebook.status.INACTIVE')
};

function withCode(label: (() => string) | undefined, code: string): string {
  return label ? `${label()} (${code})` : code;
}
const memberTypeLabel = (code: string) => withCode(MEMBER_TYPE_LABELS[code], code);
const materialTypeLabel = (code: string) => withCode(MATERIAL_TYPE_LABELS[code], code);
const policyStatusLabel = (code: string) => withCode(POLICY_STATUS_LABELS[code], code);

// todo/77 — 무결성 문제 코드의 사용자 언어화: 제목·권장 조치·심각도. 서버가 주는 message
// (한글 상세)는 그대로 두고, 코드 원문 노출만 제목으로 바꾼다. 심각도(색=의미): 지금 처리
// (--fail) = 실물과 장부가 어긋나 대출 업무가 잘못 흐를 수 있는 것 / 확인 권장(--wait) = 기록
// 정합성 문제. 미지 코드는 원문 표시 + 심각도 없음(서버가 검사를 추가해도 안 깨진다).
const INTEGRITY_HIGH = new Set(['MULTIPLE_OPEN_LOANS', 'COPY_STATUS_MISMATCH', 'READY_STATUS_MISMATCH', 'MULTIPLE_READY_RESERVATIONS']);
const INTEGRITY_ISSUE_TEXTS: Record<string, { label: () => string; hint: () => string }> = {
  MISSING_KEY: { label: () => t('views.settings.integrityIssue.MISSING_KEY.label'), hint: () => t('views.settings.integrityIssue.MISSING_KEY.hint') },
  DUPLICATE_KEY: { label: () => t('views.settings.integrityIssue.DUPLICATE_KEY.label'), hint: () => t('views.settings.integrityIssue.DUPLICATE_KEY.hint') },
  ORPHAN_FOREIGN_KEY: { label: () => t('views.settings.integrityIssue.ORPHAN_FOREIGN_KEY.label'), hint: () => t('views.settings.integrityIssue.ORPHAN_FOREIGN_KEY.hint') },
  INVALID_DATE_ORDER: { label: () => t('views.settings.integrityIssue.INVALID_DATE_ORDER.label'), hint: () => t('views.settings.integrityIssue.INVALID_DATE_ORDER.hint') },
  RESERVATION_COPY_MISMATCH: { label: () => t('views.settings.integrityIssue.RESERVATION_COPY_MISMATCH.label'), hint: () => t('views.settings.integrityIssue.RESERVATION_COPY_MISMATCH.hint') },
  DUPLICATE_ACTIVE_RESERVATION: { label: () => t('views.settings.integrityIssue.DUPLICATE_ACTIVE_RESERVATION.label'), hint: () => t('views.settings.integrityIssue.DUPLICATE_ACTIVE_RESERVATION.hint') },
  MULTIPLE_READY_RESERVATIONS: { label: () => t('views.settings.integrityIssue.MULTIPLE_READY_RESERVATIONS.label'), hint: () => t('views.settings.integrityIssue.MULTIPLE_READY_RESERVATIONS.hint') },
  MULTIPLE_OPEN_LOANS: { label: () => t('views.settings.integrityIssue.MULTIPLE_OPEN_LOANS.label'), hint: () => t('views.settings.integrityIssue.MULTIPLE_OPEN_LOANS.hint') },
  COPY_STATUS_MISMATCH: { label: () => t('views.settings.integrityIssue.COPY_STATUS_MISMATCH.label'), hint: () => t('views.settings.integrityIssue.COPY_STATUS_MISMATCH.hint') },
  READY_STATUS_MISMATCH: { label: () => t('views.settings.integrityIssue.READY_STATUS_MISMATCH.label'), hint: () => t('views.settings.integrityIssue.READY_STATUS_MISMATCH.hint') }
};
const issueLabel = (code: string) => INTEGRITY_ISSUE_TEXTS[code]?.label() ?? code;
const issueHint = (code: string) => INTEGRITY_ISSUE_TEXTS[code]?.hint() ?? '';

export default function SettingsView({ shell }: ViewProps) {
  const [overview, setOverview] = useState<SettingsOverview | null>(null);
  const [sample, setSample] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [checkResult, setCheckResult] = useState<IntegrityCheckResult | null>(null);
  const [checkSample, setCheckSample] = useState(false);
  const [checking, setChecking] = useState(false);

  const [enrichResult, setEnrichResult] = useState<EnrichBibliographicResult | null>(null);
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    shell.setTitle(getViewMeta('settings')?.title ?? t('registry.settings.title'));
  }, [shell]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const outcome = await fetchSettingsOverview();
    setLoading(false);
    if (outcome.ok) {
      setOverview(outcome.data);
      setSample(outcome.sample);
    } else {
      setLoadError(outcome.message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleIntegrityCheck = useCallback(async () => {
    setChecking(true);
    const outcome = await runIntegrityCheck();
    setChecking(false);
    if (outcome.ok) {
      setCheckResult(outcome.data);
      setCheckSample(outcome.sample);
      shell.toast(
        outcome.data.issueCount
          ? t('views.settings.integrityIssuesFound', { count: outcome.data.issueCount })
          : t('views.settings.integrityNoIssues'),
        outcome.data.issueCount ? 'error' : 'success'
      );
    } else {
      shell.toast(t('views.settings.integrityFailed', { message: outcome.message }), 'error');
    }
  }, [shell]);

  const handleEnrich = useCallback(async () => {
    setEnriching(true);
    const outcome = await runBibliographicEnrichment();
    setEnriching(false);
    if (outcome.ok) {
      setEnrichResult(outcome.data);
      shell.toast(
        t('views.settings.enrichDone', { enriched: outcome.data.enrichedCount, remaining: outcome.data.remainingBlankCount }),
        'success'
      );
    } else {
      shell.toast(t('views.settings.enrichFailed', { message: outcome.message }), 'error');
    }
  }, [shell]);

  const policyColumns = useMemo<DataTableColumn<PolicyRow>[]>(
    () => [
      { key: 'policyId', header: t('views.settings.policyCol.policyId'), sortable: true, mono: true, mobilePrimary: true },
      {
        key: 'memberTypeCode',
        header: t('views.settings.policyCol.memberType'),
        sortable: true,
        mobileSecondary: true,
        // todo/75 — 코드 원값 단독은 내부어 금지 위반. 대조 화면이라 라벨(코드) 병기.
        render: (row) => memberTypeLabel(row.memberTypeCode),
        csvValue: (row) => memberTypeLabel(row.memberTypeCode),
        filterValue: (row) => `${row.memberTypeCode} ${memberTypeLabel(row.memberTypeCode)}`
      },
      {
        key: 'materialTypeCode',
        header: t('views.settings.policyCol.materialType'),
        sortable: true,
        render: (row) => materialTypeLabel(row.materialTypeCode),
        csvValue: (row) => materialTypeLabel(row.materialTypeCode),
        filterValue: (row) => `${row.materialTypeCode} ${materialTypeLabel(row.materialTypeCode)}`
      },
      { key: 'loanDays', header: t('views.settings.policyCol.loanDays'), sortable: true, numeric: true },
      { key: 'maxOpenLoans', header: t('views.settings.policyCol.maxOpenLoans'), sortable: true, numeric: true },
      { key: 'maxRenewals', header: t('views.settings.policyCol.maxRenewals'), sortable: true, numeric: true },
      { key: 'renewalDays', header: t('views.settings.policyCol.renewalDays'), sortable: true, numeric: true },
      { key: 'maxReservations', header: t('views.settings.policyCol.maxReservations'), sortable: true, numeric: true },
      { key: 'holdDays', header: t('views.settings.policyCol.holdDays'), sortable: true, numeric: true },
      { key: 'overdueFeePerDay', header: t('views.settings.policyCol.overdueFee'), sortable: true, numeric: true },
      { key: 'activeFromText', header: t('views.settings.policyCol.activeFrom'), sortable: true, mono: true },
      { key: 'activeToText', header: t('views.settings.policyCol.activeTo'), sortable: true, mono: true },
      {
        key: 'statusCode',
        header: t('views.settings.policyCol.status'),
        sortable: true,
        render: (row) => policyStatusLabel(row.statusCode),
        csvValue: (row) => policyStatusLabel(row.statusCode),
        filterValue: (row) => `${row.statusCode} ${policyStatusLabel(row.statusCode)}`
      },
      { key: 'updatedAtText', header: t('views.settings.policyCol.updatedAt'), sortable: true, mono: true },
      { key: 'updatedBy', header: t('views.settings.policyCol.updatedBy'), sortable: true }
    ],
    []
  );

  const configColumns = useMemo<DataTableColumn<ConfigRow>[]>(
    () => [
      { key: 'settingKey', header: t('views.settings.configCol.key'), sortable: true, mono: true, mobilePrimary: true },
      { key: 'settingValue', header: t('views.settings.configCol.value'), sortable: true, mono: true, mobileSecondary: true },
      { key: 'valueType', header: t('views.settings.configCol.valueType'), sortable: true },
      { key: 'description', header: t('views.settings.configCol.description'), sortable: true },
      { key: 'updatedAtText', header: t('views.settings.configCol.updatedAt'), sortable: true, mono: true },
      { key: 'updatedBy', header: t('views.settings.configCol.updatedBy'), sortable: true }
    ],
    []
  );

  const issueColumns = useMemo<DataTableColumn<IntegrityIssue & { rowKeyId: string }>[]>(
    () => [
      {
        // todo/77 — 코드 원문 대신 사람 말 제목 + 심각도 뱃지. 정렬·검색은 라벨과 코드 모두로.
        key: 'code',
        header: t('views.settings.issueCol.code'),
        sortable: true,
        mobilePrimary: true,
        sortAccessor: (row) => issueLabel(row.code),
        filterValue: (row) => `${row.code} ${issueLabel(row.code)}`,
        csvValue: (row) => `${issueLabel(row.code)} (${row.code})`,
        render: (row) => (
          <span className="settings-issue-label">
            <span className={`settings-issue-severity${INTEGRITY_HIGH.has(row.code) ? ' is-high' : ''}`}>
              {INTEGRITY_HIGH.has(row.code) ? t('views.settings.issueSeverityHigh') : t('views.settings.issueSeverityWarn')}
            </span>
            {issueLabel(row.code)}
          </span>
        )
      },
      { key: 'sheet', header: t('views.settings.issueCol.sheet'), sortable: true, mono: true },
      { key: 'row', header: t('views.settings.issueCol.row'), sortable: true, numeric: true },
      { key: 'message', header: t('views.settings.issueCol.message'), sortable: true, mobileSecondary: true },
      {
        key: 'hint',
        header: t('views.settings.issueCol.hint'),
        filterValue: (row) => issueHint(row.code),
        csvValue: (row) => issueHint(row.code),
        render: (row) => <span className="settings-issue-hint">{issueHint(row.code)}</span>
      }
    ],
    []
  );

  const issueRows = useMemo(
    () => (checkResult?.issues ?? []).map((issue, index) => ({ ...issue, rowKeyId: issueKey(issue, index) })),
    [checkResult]
  );

  const triggerLabel = (handlerFunction: string) => {
    if (handlerFunction === 'dailyLibraryMaintenance') return t('views.settings.triggerName.dailyLibraryMaintenance');
    if (handlerFunction === 'dailyVizBatch') return t('views.settings.triggerName.dailyVizBatch');
    return handlerFunction;
  };

  return (
    <div className="settings-view">
      <div className="settings-note panel">
        <p>{t('views.settings.readonlyNote')}</p>
      </div>

      {loadError && <div className="settings-error">{t('views.settings.loadFailed', { message: loadError })}</div>}

      <section className="panel settings-section">
        <div className="settings-section-head">
          <h2>{t('views.settings.policiesTitle')}</h2>
          <div className="settings-section-head-actions">
            {sample && <SampleDataBadge />}
            <button type="button" className="ghost" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={14} aria-hidden /> {loading ? t('common.loading') : t('views.settings.refresh')}
            </button>
          </div>
        </div>
        <DataTable<PolicyRow>
          columns={policyColumns}
          rows={overview?.policies ?? []}
          rowKey={(row) => row.policyId}
          platform={shell.platform}
          loading={loading && !overview}
          emptyHint={t('views.settings.policiesEmpty')}
          csvFileName="policies.csv"
          searchPlaceholder={t('views.settings.policiesSearchPlaceholder')}
          defaultPageSize={25}
        />
      </section>

      <section className="panel settings-section">
        <div className="settings-section-head">
          <h2>{t('views.settings.configTitle')}</h2>
          {sample && <SampleDataBadge />}
        </div>
        <DataTable<ConfigRow>
          columns={configColumns}
          rows={overview?.config ?? []}
          rowKey={(row) => row.settingKey}
          platform={shell.platform}
          loading={loading && !overview}
          emptyHint={t('views.settings.configEmpty')}
          csvFileName="config.csv"
          searchPlaceholder={t('views.settings.configSearchPlaceholder')}
          defaultPageSize={25}
        />
      </section>

      <section className="panel settings-section settings-status-block">
        <h2>{t('views.settings.triggersTitle')}</h2>
        <ul className="settings-trigger-list">
          {(overview?.triggers ?? []).map((trigger) => (
            <li key={trigger.handlerFunction} className={trigger.installed ? 'is-ok' : 'is-warn'}>
              {trigger.installed ? <CheckCircle2 size={16} aria-hidden /> : <XCircle size={16} aria-hidden />}
              <span>{triggerLabel(trigger.handlerFunction)}</span>
              <span className="settings-trigger-status">
                {trigger.installed ? t('views.settings.triggerInstalled') : t('views.settings.triggerNotInstalled')}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel settings-section">
        <h2>{t('views.settings.actionsTitle')}</h2>
        <div className="settings-action-row">
          <div className="settings-action-card">
            <h3>{t('views.settings.integrityTitle')}</h3>
            <p className="settings-hint">{t('views.settings.integrityHint')}</p>
            <button type="button" onClick={() => void handleIntegrityCheck()} disabled={checking}>
              {checking ? t('common.loading') : t('views.settings.integrityRun')}
            </button>
            {checkResult && (
              <div className="settings-result">
                <p>
                  {t('views.settings.integrityResultSummary', { count: checkResult.issueCount, at: checkResult.checkedAt })}{' '}
                  {checkSample && <SampleDataBadge />}
                </p>
                {checkResult.truncated && <p className="settings-hint">{t('views.settings.integrityTruncatedHint')}</p>}
                {/* todo/77 — 0건은 침묵이 아니라 안심 문구(NN/g 빈 상태 1단계와 같은 원리). */}
                {checkResult.issueCount === 0 && <p className="settings-allclear">{t('views.settings.integrityAllClear')}</p>}
                {checkResult.issueCount > 0 && (
                  <DataTable<IntegrityIssue & { rowKeyId: string }>
                    columns={issueColumns}
                    rows={issueRows}
                    rowKey={(row) => row.rowKeyId}
                    platform={shell.platform}
                    csvFileName="integrity-issues.csv"
                    defaultPageSize={25}
                  />
                )}
              </div>
            )}
          </div>
          <div className="settings-action-card">
            <h3>{t('views.settings.enrichTitle')}</h3>
            <p className="settings-hint">{t('views.settings.enrichHint')}</p>
            <button type="button" className="warn" onClick={() => void handleEnrich()} disabled={enriching}>
              {enriching ? t('common.loading') : t('views.settings.enrichRun')}
            </button>
            {enrichResult && (
              <p className="settings-result">
                {t('views.settings.enrichResultSummary', {
                  before: enrichResult.blankBeforeCount,
                  after: enrichResult.remainingBlankCount,
                  processed: enrichResult.processedCount,
                  cacheHit: enrichResult.skippedCacheHitCount,
                  failed: enrichResult.failedCount
                })}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* todo/45 — 실기기에서 "지금 어떤 빌드인가"를 즉시 확인하는 운영 표식(배포·캐시 의심 종결용). */}
      <p className="settings-build mono">{t('views.settings.buildLine', { id: __BUILD_ID__ })}</p>
    </div>
  );
}
