import { Suspense, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, BookX, ChartColumn, FileText, Gift, Megaphone, Printer, UserSearch } from 'lucide-react';
import type { ShellContext, ViewProps } from '../../types';
import { getViewMeta } from '../../registry';
import { PrintDocument } from '../../components/PrintDocument';
import { SampleDataBadge } from '../../components/SampleDataBadge';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import {
  fetchHomeroomReport,
  fetchNoLoanFinderReport,
  type HomeroomLoanStatusRow,
  type HomeroomOverdueRow,
  type HomeroomPopularBook,
  type HomeroomReport,
  type NoLoanFinderReport
} from '../../services/reportData';
import { CategoryTreemap, TurnoverQuadrant, VizLazyMount } from '../../viz';
import { t } from '../../i18n';
import './reports.css';

// 리포트 허브 — FEATURES.md R1 "종류 선택 → 미리보기 → 인쇄". todo/04가 만든 「조용한 신호」
// 5개 버튼(shells/desktop/DashboardBaseLayer.tsx)이 그대로 여기로 직행한다
// (`openWindow('reports', { type: <reportType> })`). 이번 항목은 그중 2개(R1-1 미대출 학생
// 발굴 · R1-2 담임 리포트)를 실제 구현하고, 나머지 3개(죽은 장서·회수 쪽지·기증 감사장)는
// todo/09가 채울 자리만 남겨 둔다 — 신호 버튼이 죽은 버튼이 되지 않게.
//
// 개인정보(FEATURES.md 원칙): 이 뷰는 registry.ts에 roles:['LIBRARIAN']로만 등록돼 있고,
// src/student/** 어디서도 이 뷰나 services/reportData.ts를 import하지 않는다 — 학생 표면에는
// 다른 학생의 미대출·연체가 노출될 경로 자체가 없다.

type ReportTypeId = 'no-loan-finder' | 'homeroom-report' | 'weeding-recommend' | 'recall-notice' | 'donor-thanks';

// todo/06 — 리포트 허브의 6번째 「허브 진입」 카드(docs/VIZ.md 구현 노트 "대시보드·reports에
// 착륙"). report 액션의 type 파라미터(ReportTypeId)와는 무관한 별개 화면(viz 액션으로 조회)이라
// apiWebReport_ 쪽 타입을 넓히지 않고 프론트 전용 식별자로만 둔다.
type VizInsightsId = 'viz-insights';
type SelectedPanelId = ReportTypeId | VizInsightsId;

interface ReportTypeMeta {
  id: ReportTypeId;
  labelKey: string;
  icon: LucideIcon;
  implemented: boolean;
}

// 아이콘·라벨 키는 DashboardBaseLayer.tsx의 QUIET_SIGNALS와 의도적으로 동일하다(DESIGN.md
// "같은 행동 같은 이름 관통") — reportType 문자열도 todo/04가 잠정 지정한 것을 그대로 채택했다
// (docs/ASSUMPTIONS.md todo/04 참고).
const REPORT_TYPES: ReportTypeMeta[] = [
  { id: 'no-loan-finder', labelKey: 'dashboard.quietSignal.noLoanFinder', icon: UserSearch, implemented: true },
  { id: 'homeroom-report', labelKey: 'dashboard.quietSignal.homeroomReport', icon: FileText, implemented: true },
  { id: 'weeding-recommend', labelKey: 'dashboard.quietSignal.weedingRecommend', icon: BookX, implemented: false },
  { id: 'recall-notice', labelKey: 'dashboard.quietSignal.recallNotice', icon: Megaphone, implemented: false },
  { id: 'donor-thanks', labelKey: 'dashboard.quietSignal.donorThanks', icon: Gift, implemented: false }
];

function isReportTypeId(value: string): value is ReportTypeId {
  return REPORT_TYPES.some((r) => r.id === value);
}

function isSelectedPanelId(value: string): value is SelectedPanelId {
  return isReportTypeId(value) || value === 'viz-insights';
}

function currentMonthDefault(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface TypeSelectorProps {
  onSelect: (id: SelectedPanelId) => void;
}

function TypeSelector({ onSelect }: TypeSelectorProps) {
  return (
    <div className="no-print">
      <h2>{t('views.reports.typeSelectorHeading')}</h2>
      <div className="reports-type-grid">
        {REPORT_TYPES.map((rt) => {
          const Icon = rt.icon;
          return (
            <button
              key={rt.id}
              type="button"
              className={`reports-type-card${rt.implemented ? '' : ' is-pending'}`}
              onClick={() => onSelect(rt.id)}
            >
              <Icon size={20} aria-hidden />
              <span className="reports-type-card-label">
                {t(rt.labelKey)}
                {!rt.implemented && <span className="reports-type-card-hint">{t('views.reports.comingSoon')}</span>}
              </span>
            </button>
          );
        })}
        {/* todo/06 — 6번째 「허브 진입」 카드: report 액션이 아니라 viz 액션(services/vizData.ts)을
            쓰는 별개 화면이라 REPORT_TYPES 배열 자체에는 섞지 않았다. */}
        <button type="button" className="reports-type-card" onClick={() => onSelect('viz-insights')}>
          <ChartColumn size={20} aria-hidden />
          <span className="reports-type-card-label">{t('views.reports.vizInsights.cardLabel')}</span>
        </button>
      </div>
    </div>
  );
}

function VizInsightsPanel({ shell }: { shell: ShellContext }) {
  return (
    <div>
      <div className="no-print">
        <h2>{t('views.reports.vizInsights.title')}</h2>
        <p className="reports-summary-line">{t('views.reports.vizInsights.subtitle')}</p>
      </div>
      <div className="reports-viz-grid no-print">
        <Suspense fallback={<div className="reports-viz-loading">{t('common.loading')}</div>}>
          <VizLazyMount>
            <CategoryTreemap onNavigate={(viewId, params) => shell.open(viewId, params)} />
          </VizLazyMount>
        </Suspense>
        <Suspense fallback={<div className="reports-viz-loading">{t('common.loading')}</div>}>
          <VizLazyMount>
            <TurnoverQuadrant onNavigate={(viewId, params) => shell.open(viewId, params)} />
          </VizLazyMount>
        </Suspense>
      </div>
    </div>
  );
}

interface NoLoanFinderPanelProps {
  shell: ShellContext;
}

function NoLoanFinderPanel({ shell }: NoLoanFinderPanelProps) {
  const [sinceDate, setSinceDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ data: NoLoanFinderReport; sample: boolean } | null>(null);

  async function handlePreview() {
    setLoading(true);
    setError(null);
    const outcome = await fetchNoLoanFinderReport(sinceDate || undefined);
    setLoading(false);
    if (outcome.ok) setResult({ data: outcome.data, sample: outcome.sample });
    else {
      setResult(null);
      setError(outcome.message);
    }
  }

  return (
    <div>
      <div className="no-print">
        <h2>{t('views.reports.noLoanFinder.title')}</h2>
        <div className="reports-form">
          <div className="reports-field">
            <label htmlFor="no-loan-since">{t('views.reports.noLoanFinder.sinceDateLabel')}</label>
            <input id="no-loan-since" type="date" value={sinceDate} onChange={(e) => setSinceDate(e.target.value)} />
          </div>
          <div className="reports-actions">
            <button type="button" onClick={() => void handlePreview()} disabled={loading}>
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
        <p className="reports-summary-line">{t('views.reports.noLoanFinder.sinceDateHint')}</p>
        {error && (
          <div className="reports-error" role="alert">
            {t('views.reports.fetchError', { message: error })}
          </div>
        )}
      </div>

      {result && (
        <div className="print-preview-frame">
          <PrintDocument libraryName={result.data.libraryName} generatedAtText={result.data.generatedAt}>
            <h2>{t('views.reports.noLoanFinder.printTitle')}</h2>
            <p className="reports-summary-line">
              {t('views.reports.noLoanFinder.totalCountLine', { date: result.data.sinceDate, count: result.data.totalCount })}
            </p>
            {result.data.classes.length === 0 ? (
              <p className="print-empty">{t('views.reports.noLoanFinder.empty')}</p>
            ) : (
              result.data.classes.map((cls) => (
                <div className="print-class-group" key={`${cls.grade}-${cls.classNo}`}>
                  <div className="print-class-title">
                    {t('views.reports.noLoanFinder.classHeading', {
                      grade: cls.grade,
                      classNo: cls.classNo,
                      count: cls.students.length
                    })}
                  </div>
                  <div className="print-name-list">
                    {cls.students.map((s) => (
                      <span key={s.memberNo}>{s.name}</span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </PrintDocument>
        </div>
      )}
    </div>
  );
}

// todo/08 「reports 목록을 DataTable로 이관」 — 담임 리포트의 표형 목록 4개(대출 현황·미대출
// 명단·연체 목록·인기책) 온스크린 미리보기를 공용 DataTable로 그린다(정렬·필터 가능, 완료 조건
// "중복 제거 증명": DataTable 자체가 유일한 표 구현이고 여기서 다시 구현하지 않는다). 인쇄
// 대상(PrintDocument 안 print-table)은 이 절과 완전히 분리된 기존 경로 그대로 — 손대지 않는다
// (styles/print.css 헤더 주석·DESIGN.md "인쇄" 절 예외). i18n 헤더 문자열은 이미 print-table이
// 쓰는 것과 같은 키를 재사용한다(DESIGN.md "같은 행동 같은 이름 관통", 새 키를 만들지 않음).
//
// loanStatus·noLoanList는 둘 다 HomeroomLoanStatusRow라 같은 열 정의를 공유한다(대출 0건인
// 학생 목록이 곧 noLoanList이므로 같은 컬럼 모양) — R1-1(미대출 학생 발굴)의 반별 그룹 명단과는
// 다르게, 이 4개는 개별 필드(번호·이름·대출건수 등)를 가진 진짜 표 데이터라 DataTable에 맞는다
// (docs/ASSUMPTIONS.md todo/08 참고, R1-1 쪽은 그대로 명단 형태로 남겨둔다).
const homeroomLoanStatusColumns: DataTableColumn<HomeroomLoanStatusRow>[] = [
  { key: 'studentNo', header: t('views.reports.homeroom.colSeat'), sortable: true, numeric: true, mono: true, mobilePrimary: true },
  { key: 'name', header: t('views.reports.homeroom.colName'), sortable: true, mobileSecondary: true },
  { key: 'loanCount', header: t('views.reports.homeroom.colLoanCount'), sortable: true, numeric: true }
];

const homeroomOverdueColumns: DataTableColumn<HomeroomOverdueRow>[] = [
  { key: 'name', header: t('views.reports.homeroom.colName'), sortable: true, mobilePrimary: true },
  { key: 'title', header: t('views.reports.homeroom.colBookTitle'), sortable: true, mobileSecondary: true },
  { key: 'dueAtText', header: t('views.reports.homeroom.colDueDate'), sortable: true, mono: true },
  {
    key: 'overdueDays',
    header: t('views.reports.homeroom.colOverdueDays'),
    sortable: true,
    numeric: true,
    render: (row) => t('views.reports.homeroom.overdueDaysValue', { days: row.overdueDays })
  }
];

const homeroomPopularColumns: DataTableColumn<HomeroomPopularBook>[] = [
  { key: 'title', header: t('views.reports.homeroom.colBookTitle'), sortable: true, mobilePrimary: true },
  { key: 'loanCount', header: t('views.reports.homeroom.colLoanCount'), sortable: true, numeric: true }
];

interface HomeroomReportPanelProps {
  shell: ShellContext;
}

function HomeroomReportPanel({ shell }: HomeroomReportPanelProps) {
  const [grade, setGrade] = useState(1);
  const [classNo, setClassNo] = useState(1);
  const [month, setMonth] = useState(() => currentMonthDefault());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ data: HomeroomReport; sample: boolean } | null>(null);

  async function handlePreview() {
    setLoading(true);
    setError(null);
    const outcome = await fetchHomeroomReport(grade, classNo, month);
    setLoading(false);
    if (outcome.ok) setResult({ data: outcome.data, sample: outcome.sample });
    else {
      setResult(null);
      setError(outcome.message);
    }
  }

  return (
    <div>
      <div className="no-print">
        <h2>{t('views.reports.homeroom.title')}</h2>
        <div className="reports-form">
          <div className="reports-field">
            <label htmlFor="homeroom-grade">{t('views.reports.homeroom.gradeLabel')}</label>
            <input
              id="homeroom-grade"
              type="number"
              min={1}
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value) || 0)}
            />
          </div>
          <div className="reports-field">
            <label htmlFor="homeroom-class">{t('views.reports.homeroom.classNoLabel')}</label>
            <input
              id="homeroom-class"
              type="number"
              min={1}
              value={classNo}
              onChange={(e) => setClassNo(Number(e.target.value) || 0)}
            />
          </div>
          <div className="reports-field">
            <label htmlFor="homeroom-month">{t('views.reports.homeroom.monthLabel')}</label>
            <input id="homeroom-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="reports-actions">
            <button type="button" onClick={() => void handlePreview()} disabled={loading}>
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
          <p className="reports-summary-line">{t('views.reports.homeroom.interactivePreviewHint')}</p>

          <h3>{t('views.reports.homeroom.loanStatusHeading')}</h3>
          <DataTable<HomeroomLoanStatusRow>
            columns={homeroomLoanStatusColumns}
            rows={result.data.loanStatus}
            rowKey={(row) => row.memberNo}
            platform={shell.platform}
            emptyHint={t('views.reports.homeroom.noLoanEmpty')}
            csvFileName="homeroom-loan-status.csv"
            defaultPageSize={25}
          />

          <h3>{t('views.reports.homeroom.noLoanHeading')}</h3>
          <DataTable<HomeroomLoanStatusRow>
            columns={homeroomLoanStatusColumns}
            rows={result.data.noLoanList}
            rowKey={(row) => row.memberNo}
            platform={shell.platform}
            emptyHint={t('views.reports.homeroom.noLoanEmpty')}
            csvFileName="homeroom-no-loan.csv"
            defaultPageSize={25}
          />

          <h3>{t('views.reports.homeroom.overdueHeading')}</h3>
          <DataTable<HomeroomOverdueRow>
            columns={homeroomOverdueColumns}
            rows={result.data.overdueList}
            rowKey={(row) => `${row.memberNo}-${row.title}-${row.dueAtText}`}
            platform={shell.platform}
            emptyHint={t('views.reports.homeroom.overdueEmpty')}
            csvFileName="homeroom-overdue.csv"
            defaultPageSize={25}
          />

          <h3>{t('views.reports.homeroom.popularBooksHeading')}</h3>
          <DataTable<HomeroomPopularBook>
            columns={homeroomPopularColumns}
            rows={result.data.popularBooks}
            rowKey={(row) => row.title}
            platform={shell.platform}
            emptyHint={t('views.reports.homeroom.popularEmpty')}
            csvFileName="homeroom-popular.csv"
            defaultPageSize={25}
          />
        </div>
      )}

      {result && (
        <div className="print-preview-frame">
          <PrintDocument libraryName={result.data.libraryName} generatedAtText={result.data.generatedAt}>
            <h2>{t('views.reports.homeroom.printTitle', { grade: result.data.grade, classNo: result.data.classNo, month: result.data.month })}</h2>
            <p className="reports-summary-line">
              {t('views.reports.homeroom.studentCountLine', {
                grade: result.data.grade,
                classNo: result.data.classNo,
                count: result.data.studentCount
              })}
            </p>

            <h2>{t('views.reports.homeroom.loanStatusHeading')}</h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th className="num">{t('views.reports.homeroom.colSeat')}</th>
                  <th>{t('views.reports.homeroom.colName')}</th>
                  <th className="num">{t('views.reports.homeroom.colLoanCount')}</th>
                </tr>
              </thead>
              <tbody>
                {result.data.loanStatus.map((row) => (
                  <tr key={row.memberNo}>
                    <td className="num mono">{row.studentNo}</td>
                    <td>{row.name}</td>
                    <td className="num">{row.loanCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2>{t('views.reports.homeroom.noLoanHeading')}</h2>
            {result.data.noLoanList.length === 0 ? (
              <p className="print-empty">{t('views.reports.homeroom.noLoanEmpty')}</p>
            ) : (
              <div className="print-name-list">
                {result.data.noLoanList.map((row) => (
                  <span key={row.memberNo}>{row.name}</span>
                ))}
              </div>
            )}

            <h2>{t('views.reports.homeroom.overdueHeading')}</h2>
            {result.data.overdueList.length === 0 ? (
              <p className="print-empty">{t('views.reports.homeroom.overdueEmpty')}</p>
            ) : (
              <table className="print-table">
                <thead>
                  <tr>
                    <th>{t('views.reports.homeroom.colName')}</th>
                    <th>{t('views.reports.homeroom.colBookTitle')}</th>
                    <th>{t('views.reports.homeroom.colDueDate')}</th>
                    <th className="num">{t('views.reports.homeroom.colOverdueDays')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.overdueList.map((row, i) => (
                    <tr key={`${row.memberNo}-${i}`}>
                      <td>{row.name}</td>
                      <td>{row.title}</td>
                      <td className="mono">{row.dueAtText}</td>
                      <td className="num">{t('views.reports.homeroom.overdueDaysValue', { days: row.overdueDays })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h2>{t('views.reports.homeroom.popularBooksHeading')}</h2>
            {result.data.popularBooks.length === 0 ? (
              <p className="print-empty">{t('views.reports.homeroom.popularEmpty')}</p>
            ) : (
              <table className="print-table">
                <thead>
                  <tr>
                    <th>{t('views.reports.homeroom.colBookTitle')}</th>
                    <th className="num">{t('views.reports.homeroom.colLoanCount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.popularBooks.map((row, i) => (
                    <tr key={`${row.title}-${i}`}>
                      <td>{row.title}</td>
                      <td className="num">{row.loanCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </PrintDocument>
        </div>
      )}
    </div>
  );
}

export default function ReportsView({ shell, params }: ViewProps) {
  const requestedType = typeof params.type === 'string' && isSelectedPanelId(params.type) ? params.type : null;
  const [selectedType, setSelectedType] = useState<SelectedPanelId | null>(requestedType);

  useEffect(() => {
    shell.setTitle(getViewMeta('reports')?.title ?? t('registry.reports.title'));
  }, [shell]);

  const selectedMeta = selectedType ? REPORT_TYPES.find((r) => r.id === selectedType) : null;

  return (
    <div className="reports-hub">
      {selectedType && (
        <div className="reports-toolbar no-print">
          <button type="button" className="ghost" onClick={() => setSelectedType(null)}>
            <ArrowLeft size={16} aria-hidden /> {t('views.reports.backToTypes')}
          </button>
        </div>
      )}

      {!selectedType && <TypeSelector onSelect={setSelectedType} />}

      {selectedType && selectedMeta && !selectedMeta.implemented && (
        <div className="panel reports-placeholder no-print">
          <p>{t('views.reports.comingSoonFor', { name: t(selectedMeta.labelKey) })}</p>
        </div>
      )}

      {selectedType === 'no-loan-finder' && <NoLoanFinderPanel shell={shell} />}
      {selectedType === 'homeroom-report' && <HomeroomReportPanel shell={shell} />}
      {selectedType === 'viz-insights' && <VizInsightsPanel shell={shell} />}
    </div>
  );
}
