import { Suspense, useState } from 'react';
import { Printer } from 'lucide-react';
import type { ShellContext } from '../../types';
import { PrintDocument } from '../../components/PrintDocument';
import { SampleDataBadge } from '../../components/SampleDataBadge';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import {
  fetchAnnualOperationsReport,
  type AnnualOperationsLoanMonth,
  type AnnualOperationsReport,
  type AnnualOperationsTopLoan
} from '../../services/reportData';
import { BudgetPicture, VizLazyMount } from '../../viz';
import { t } from '../../i18n';
import { formatKRW } from '../../i18n/format';

// R3 연간 운영 보고서(FEATURES.md, todo/24) — index.tsx가 이미 1191줄이라(과제 노트의 판단
// 위임) 이 패널만 별도 파일로 뽑았다. 나머지 5종 패널과 같은 온디맨드 패턴(버튼을 눌러야
// 조회) + PrintDocument 감싸기 + 상호작용 DataTable(no-print) / 인쇄용 print-table 이중
// 렌더링(todo/08 관례)을 그대로 따른다. 예산 차트는 BudgetPicture(viz/BudgetPicture.tsx,
// todo/19가 이 항목을 위해 인쇄 호환으로 만들어 둔 컴포넌트)를 그대로 재사용한다 — 새 차트를
// 만들지 않는다(과제 지시).
//
// 기간 선택 — 완료 조건 "기간 선택". 기본은 연도 입력(서버 기본값 = 오늘 연도와 대칭), 체크박스로
// "직접 기간 지정"(startDate/endDate) 모드로 전환할 수 있다(docs/ASSUMPTIONS.md todo/24 참고 —
// 학년도 등 학사력 개념이 서버에 없어 달력 연도를 기본으로 삼았다).


function currentYearDefault(): number {
  return new Date().getFullYear();
}

// 열 라벨은 새로 만들지 않고 기존 키를 재사용한다(DESIGN.md "같은 행동 같은 이름 관통") — "월"은
// 담임 리포트의 월 선택 라벨(homeroom.monthLabel)과, "대출 건수"는 담임 리포트 인기책 표의 열
// 라벨(homeroom.colLoanCount)과 같은 개념이다.
const monthColumns: DataTableColumn<AnnualOperationsLoanMonth>[] = [
  { key: 'month', header: t('views.reports.homeroom.monthLabel'), sortable: true, mono: true, mobilePrimary: true },
  { key: 'count', header: t('views.reports.homeroom.colLoanCount'), sortable: true, numeric: true }
];

const topLoanColumns: DataTableColumn<AnnualOperationsTopLoan>[] = [
  { key: 'title', header: t('views.catalog.col.title'), sortable: true, mobilePrimary: true },
  { key: 'loanCount', header: t('views.reports.homeroom.colLoanCount'), sortable: true, numeric: true }
];

interface AnnualOperationsReportPanelProps {
  shell: ShellContext;
}

export function AnnualOperationsReportPanel({ shell }: AnnualOperationsReportPanelProps) {
  const [year, setYear] = useState(() => currentYearDefault());
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ data: AnnualOperationsReport; sample: boolean } | null>(null);

  async function handlePreview() {
    setLoading(true);
    setError(null);
    const outcome =
      useCustomRange && startDate && endDate
        ? await fetchAnnualOperationsReport({ startDate, endDate })
        : await fetchAnnualOperationsReport({ year });
    setLoading(false);
    if (outcome.ok) setResult({ data: outcome.data, sample: outcome.sample });
    else {
      setResult(null);
      setError(outcome.message);
    }
  }

  const periodLabel = result
    ? result.data.year != null
      ? t('views.reports.annualOperations.periodYearLabel', { year: result.data.year })
      : t('views.reports.annualOperations.periodRangeLabel', {
          start: result.data.periodStartText,
          end: result.data.periodEndText
        })
    : '';

  return (
    <div>
      <div className="no-print">
        <h2>{t('views.reports.annualOperations.title')}</h2>
        <p className="reports-summary-line">{t('views.reports.annualOperations.subtitle')}</p>
        <div className="reports-form">
          <div className="reports-field">
            <label>
              <input type="checkbox" checked={useCustomRange} onChange={(e) => setUseCustomRange(e.target.checked)} />{' '}
              {t('views.reports.annualOperations.customRangeToggle')}
            </label>
          </div>
          {!useCustomRange && (
            <div className="reports-field">
              <label htmlFor="annual-ops-year">{t('views.reports.annualOperations.yearLabel')}</label>
              <input
                id="annual-ops-year"
                type="number"
                inputMode="numeric"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(Number(e.target.value) || currentYearDefault())}
              />
            </div>
          )}
          {useCustomRange && (
            <>
              <div className="reports-field">
                <label htmlFor="annual-ops-start">{t('views.reports.annualOperations.startDateLabel')}</label>
                <input id="annual-ops-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="reports-field">
                <label htmlFor="annual-ops-end">{t('views.reports.annualOperations.endDateLabel')}</label>
                <input id="annual-ops-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </>
          )}
          <div className="reports-actions">
            <button
              type="button"
              onClick={() => void handlePreview()}
              disabled={loading || (useCustomRange && (!startDate || !endDate))}
            >
              {loading ? t('common.loading') : t('views.reports.previewButton')}
            </button>
            {result && (
              <button type="button" className="ghost" onClick={() => shell.print()}>
                <Printer size={16} aria-hidden /> {t('views.reports.printButton')}
              </button>
            )}
            {result?.sample && <SampleDataBadge />}
          </div>
        </div>
        {error && (
          <div className="reports-error" role="alert">
            {t('views.reports.fetchError', { message: error })}
          </div>
        )}
      </div>

      {result && (
        <div className="no-print reports-datatable-section">
          <p className="reports-summary-line">{periodLabel}</p>

          <h3>{t('views.reports.annualOperations.loanStatsHeading')}</h3>
          <DataTable<AnnualOperationsLoanMonth>
            columns={monthColumns}
            rows={result.data.loanStats.byMonth}
            rowKey={(row) => row.month}
            platform={shell.platform}
            emptyHint={t('views.reports.annualOperations.loanStatsEmpty')}
            csvFileName="annual-operations-loan-stats.csv"
            defaultPageSize={12}
          />

          <h3>{t('views.reports.annualOperations.topLoansHeading')}</h3>
          <DataTable<AnnualOperationsTopLoan>
            columns={topLoanColumns}
            rows={result.data.topLoans}
            rowKey={(row) => row.title}
            platform={shell.platform}
            emptyHint={t('views.reports.annualOperations.topLoansEmpty')}
            csvFileName="annual-operations-top-loans.csv"
            defaultPageSize={10}
          />
        </div>
      )}

      {result && (
        <div className="print-preview-frame">
          <PrintDocument libraryName={result.data.libraryName} generatedAtText={result.data.generatedAt}>
            <h2>{t('views.reports.annualOperations.printTitle')}</h2>
            <p className="reports-summary-line">{periodLabel}</p>

            <h2>{t('views.reports.annualOperations.loanStatsHeading')}</h2>
            <p className="reports-summary-line">
              {t('views.reports.annualOperations.loanTotalLine', { count: result.data.loanStats.totalCount })}
            </p>
            <table className="print-table">
              <thead>
                <tr>
                  <th>{t('views.reports.homeroom.monthLabel')}</th>
                  <th className="num">{t('views.reports.homeroom.colLoanCount')}</th>
                </tr>
              </thead>
              <tbody>
                {result.data.loanStats.byMonth.map((row) => (
                  <tr key={row.month}>
                    <td className="mono">{row.month}</td>
                    <td className="num">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2>{t('views.reports.annualOperations.collectionHeading')}</h2>
            <table className="print-table">
              <tbody>
                <tr>
                  <td>{t('views.reports.annualOperations.collectionStartCount')}</td>
                  <td className="num">{result.data.collection.startCount}</td>
                </tr>
                <tr>
                  <td>{t('views.reports.annualOperations.collectionEndCount')}</td>
                  <td className="num">{result.data.collection.endCount}</td>
                </tr>
                <tr>
                  <td>{t('views.reports.annualOperations.collectionNetChange')}</td>
                  <td className="num">{result.data.collection.netChange}</td>
                </tr>
              </tbody>
            </table>
            {result.data.collection.skippedNoAcquiredDate > 0 && (
              <p className="reports-summary-line">
                {t('views.reports.annualOperations.collectionSkippedNote', {
                  count: result.data.collection.skippedNoAcquiredDate
                })}
              </p>
            )}

            <h2>{t('views.reports.annualOperations.budgetHeading')}</h2>
            <p className="reports-summary-line">
              {t('views.reports.annualOperations.budgetTotalLine', {
                amount: formatKRW(result.data.budget.periodAcquisitionTotal)
              })}
            </p>
            <Suspense fallback={<div className="reports-viz-loading">{t('common.loading')}</div>}>
              <VizLazyMount>
                <BudgetPicture />
              </VizLazyMount>
            </Suspense>

            <h2>{t('views.reports.annualOperations.topLoansHeading')}</h2>
            {result.data.topLoans.length === 0 ? (
              <p className="print-empty">{t('views.reports.annualOperations.topLoansEmpty')}</p>
            ) : (
              <table className="print-table">
                <thead>
                  <tr>
                    <th>{t('views.catalog.col.title')}</th>
                    <th className="num">{t('views.reports.homeroom.colLoanCount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.topLoans.map((row, i) => (
                    <tr key={`${row.title}-${i}`}>
                      <td>{row.title}</td>
                      <td className="num">{row.loanCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h2>{t('views.reports.annualOperations.overdueHeading')}</h2>
            <table className="print-table">
              <tbody>
                <tr>
                  <td>{t('views.reports.annualOperations.overdueOpenCount')}</td>
                  <td className="num">{result.data.overdueSummary.openOverdueCount}</td>
                </tr>
                <tr>
                  <td>{t('views.reports.annualOperations.overdueUnpaidAmount')}</td>
                  <td className="num">{formatKRW(result.data.overdueSummary.unpaidFineAmount)}</td>
                </tr>
              </tbody>
            </table>
          </PrintDocument>
        </div>
      )}
    </div>
  );
}
