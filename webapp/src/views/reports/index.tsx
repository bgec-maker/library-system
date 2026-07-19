import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, Banknote, BookX, ChartColumn, FileBarChart, FileText, Gift, Megaphone, Printer, UserSearch } from 'lucide-react';
import type { ShellContext, ViewProps } from '../../types';
import { getViewMeta } from '../../registry';
import { PrintDocument } from '../../components/PrintDocument';
import { SampleDataBadge } from '../../components/SampleDataBadge';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  fetchDonorThanksReport,
  fetchHomeroomReport,
  fetchNoLoanFinderReport,
  fetchRecallNoticeReport,
  fetchWeedingRecommendReport,
  type DonorThanksGroup,
  type DonorThanksReport,
  type HomeroomLoanStatusRow,
  type HomeroomOverdueRow,
  type HomeroomPopularBook,
  type HomeroomReport,
  type NoLoanFinderReport,
  type PurchaseCandidateRow,
  type RecallNoticeItem,
  type RecallNoticeReport,
  type WeedingCandidateRow,
  type WeedingRecommendReport
} from '../../services/reportData';
import { fetchUnpaidFines, payFine, type UnpaidFineRow } from '../../services/loanActionsData';
import { AnnualOperationsReportPanel } from './AnnualOperationsReportPanel';
import { subscribeDataChange } from '../../services/dataChangeBus';
import {
  BudgetPicture,
  CategoryTreemap,
  ClassParticipation,
  CollectionAge,
  GradeReadingGap,
  OverdueFlow,
  TurnoverQuadrant,
  VizLazyMount
} from '../../viz';
import { t } from '../../i18n';
import { formatKRW } from '../../i18n/format';
import { fetchClassCodes, type ClassCodeEntry } from '../../services/memberData';
import './reports.css';

// 리포트 허브 — FEATURES.md R1 "종류 선택 → 미리보기 → 인쇄". todo/04가 만든 「조용한 신호」
// 5개 버튼(shells/desktop/DashboardBaseLayer.tsx)이 그대로 여기로 직행한다
// (`openWindow('reports', { type: <reportType> })`). todo/05가 먼저 2개(R1-1 미대출 학생 발굴 ·
// R1-2 담임 리포트)를 구현했고, todo/09가 나머지 3개(R1-3 죽은 장서/구매 추천 · R1-4 회수 쪽지 ·
// R1-5 기증 감사장)를 마저 채워 5종 전부 실제 구현으로 완성했다 — 더 이상 "다음 항목에서
// 구현됩니다" 플레이스홀더가 남아 있지 않다.
//
// 개인정보(FEATURES.md 원칙): 이 뷰는 registry.ts에 roles:['LIBRARIAN']로만 등록돼 있고,
// src/student/** 어디서도 이 뷰나 services/reportData.ts를 import하지 않는다 — 학생 표면에는
// 다른 학생의 미대출·연체가 노출될 경로 자체가 없다.

type ReportTypeId =
  | 'no-loan-finder'
  | 'homeroom-report'
  | 'weeding-recommend'
  | 'recall-notice'
  | 'donor-thanks'
  | 'annual-operations-report';

// todo/06 — 리포트 허브의 6번째 「허브 진입」 카드(docs/VIZ.md 구현 노트 "대시보드·reports에
// 착륙"). report 액션의 type 파라미터(ReportTypeId)와는 무관한 별개 화면(viz 액션으로 조회)이라
// apiWebReport_ 쪽 타입을 넓히지 않고 프론트 전용 식별자로만 둔다.
type VizInsightsId = 'viz-insights';
// todo/13 「미변상 목록」 — 이것도 report 액션이 아니라 별도 unpaidFines 액션(services/
// loanActionsData.ts)을 쓰는 화면이라 viz-insights와 같은 이유로 ReportTypeId에 섞지 않았다(읽기
// 전용 목록이면서도 "변상 완료" 쓰기 액션을 그 자리에서 실행한다는 점에서 나머지 5개 리포트와도
// 성격이 달라 REPORT_TYPES 배열이 아니라 독립 카드로 분리했다).
type UnpaidFinesId = 'unpaid-fines';
type SelectedPanelId = ReportTypeId | VizInsightsId | UnpaidFinesId;

interface ReportTypeMeta {
  id: ReportTypeId;
  labelKey: string;
  icon: LucideIcon;
  implemented: boolean;
}

// 아이콘·라벨 키는 DashboardBaseLayer.tsx의 QUIET_SIGNALS와 의도적으로 동일하다(DESIGN.md
// "같은 행동 같은 이름 관통") — reportType 문자열도 todo/04가 잠정 지정한 것을 그대로 채택했다
// (docs/ASSUMPTIONS.md todo/04 참고).
//
// todo/24 — 마지막 항목(연간 운영 보고서)은 FEATURES.md R3(행정 자동화)로, R1 "조용한 신호"
// 5종과 달리 대시보드 진입점이 없다(FEATURES.md 원칙 "R1은 로그인 불필요"가 조용한 신호의
// 근거였고 R3는 해당 없음) — 그래서 위 QUIET_SIGNALS 재사용 규칙에서 의도적으로 벗어나 이
// 리포트 전용 라벨 키(views.reports.annualOperations.cardLabel)를 새로 둔다.
const REPORT_TYPES: ReportTypeMeta[] = [
  { id: 'no-loan-finder', labelKey: 'dashboard.quietSignal.noLoanFinder', icon: UserSearch, implemented: true },
  { id: 'homeroom-report', labelKey: 'dashboard.quietSignal.homeroomReport', icon: FileText, implemented: true },
  { id: 'weeding-recommend', labelKey: 'dashboard.quietSignal.weedingRecommend', icon: BookX, implemented: true },
  { id: 'recall-notice', labelKey: 'dashboard.quietSignal.recallNotice', icon: Megaphone, implemented: true },
  { id: 'donor-thanks', labelKey: 'dashboard.quietSignal.donorThanks', icon: Gift, implemented: true },
  {
    id: 'annual-operations-report',
    labelKey: 'views.reports.annualOperations.cardLabel',
    icon: FileBarChart,
    implemented: true
  }
];

function isReportTypeId(value: string): value is ReportTypeId {
  return REPORT_TYPES.some((r) => r.id === value);
}

function isSelectedPanelId(value: string): value is SelectedPanelId {
  return isReportTypeId(value) || value === 'viz-insights' || value === 'unpaid-fines';
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
        {/* todo/13 — 7번째 카드 「미변상 목록」: unpaidFines 액션(services/loanActionsData.ts)을
            쓰는 별개 화면이라 위 viz-insights와 같은 이유로 REPORT_TYPES에 섞지 않았다. */}
        <button type="button" className="reports-type-card" onClick={() => onSelect('unpaid-fines')}>
          <Banknote size={20} aria-hidden />
          <span className="reports-type-card-label">{t('views.reports.unpaidFines.cardLabel')}</span>
        </button>
      </div>
    </div>
  );
}

// todo/18 — 연체 흐름·반 참여 링을 여기 더했다(트리맵·사분면과 같은 칸): 둘 다 "반/정책
// 단위로 뭘 할지" 판단 자료라 매일 훑는 대시보드 시계열(대출 잔디·예약 압력·하루의 파도·
// 열두 달 곡선)보다 "가끔 들여다보는 의사결정 자료"에 가깝다고 판단했다(task 노트의 제안을
// 그대로 채택, docs/ASSUMPTIONS.md todo/18). 반 참여 링의 「담임 리포트로 직행」은 링 각각이
// onNavigate를 grade/classNo와 함께 호출하고, 아래 HomeroomReportPanel이 그 params를 받아
// 입력칸을 채운 뒤 자동으로 미리보기까지 실행한다.
//
// todo/19 — 장서 나이·학년 독서 격차·예산 그림을 여기 더했다(V1 12종 중 나머지 1종인 서가
// 온도는 대시보드 쪽, shells/desktop/DashboardBaseLayer.tsx 참고): 장서 나이는 트리맵·회전율
// 사분면과 같은 "폐기 판단" 계열(같은 weeding-recommend 목적지로 연결), 학년 독서 격차는
// 반 참여 링과 같은 "참여 판단" 계열(같은 homeroom-report 목적지, 다만 학년만 특정), 예산
// 그림은 이 항목 과제 노트가 명시한 대로 인쇄 보고서(todo/24 R3) 재료라 그 목적지에 가까운
// 이 허브에 두었다. 이 칸이 4→7개로 늘었지만 reports-viz-grid는 이미 auto-fit 그리드라(그리드
// 정의 위 REPORT_TYPES 카드도 이미 7장) 줄바꿈만 늘어날 뿐 별도 "더 보기" 조작 없이도
// 자연스럽게 늘어난다고 판단했다(docs/ASSUMPTIONS.md todo/19).
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
        <Suspense fallback={<div className="reports-viz-loading">{t('common.loading')}</div>}>
          <VizLazyMount>
            <OverdueFlow onNavigate={(viewId, params) => shell.open(viewId, params)} />
          </VizLazyMount>
        </Suspense>
        <Suspense fallback={<div className="reports-viz-loading">{t('common.loading')}</div>}>
          <VizLazyMount>
            <ClassParticipation onNavigate={(viewId, params) => shell.open(viewId, params)} />
          </VizLazyMount>
        </Suspense>
        <Suspense fallback={<div className="reports-viz-loading">{t('common.loading')}</div>}>
          <VizLazyMount>
            <CollectionAge onNavigate={(viewId, params) => shell.open(viewId, params)} />
          </VizLazyMount>
        </Suspense>
        <Suspense fallback={<div className="reports-viz-loading">{t('common.loading')}</div>}>
          <VizLazyMount>
            <GradeReadingGap onNavigate={(viewId, params) => shell.open(viewId, params)} />
          </VizLazyMount>
        </Suspense>
        <Suspense fallback={<div className="reports-viz-loading">{t('common.loading')}</div>}>
          <VizLazyMount>
            <BudgetPicture />
          </VizLazyMount>
        </Suspense>
      </div>
    </div>
  );
}

// todo/13 「미변상 목록」 — services/loanActionsData.ts의 apiWebUnpaidFines_(읽기)를 views/
// reservations/index.tsx와 같은 패턴(DataTable + 행 액션 버튼, 리포트 5종의 "미리보기 버튼
// 누르면 그때 조회" 온디맨드 패턴이 아니라 진입 즉시 조회 + 수동 새로고침 + 트랜잭션 후 자동
// 갱신)으로 보여준다 — 「할 일 목록」에 가까운 화면이라 리포트보다 예약 관리 쪽 관례가 더 맞다고
// 판단했다. 「변상 완료」는 book-detail의 것과 같은 ConfirmDialog·payFine_(amount=잔액 전액) 흐름을
// 공유한다(views.bookDetail.confirmCompensateTitle/Body·compensateDone/Failed 키를 그대로
// 재사용 — DESIGN.md "같은 행동 같은 이름 관통").
interface UnpaidFinesPanelProps {
  shell: ShellContext;
}

function UnpaidFinesPanel({ shell }: UnpaidFinesPanelProps) {
  const [rows, setRows] = useState<UnpaidFineRow[]>([]);
  const [sample, setSample] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRow, setConfirmRow] = useState<UnpaidFineRow | null>(null);
  const [payBusy, setPayBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const outcome = await fetchUnpaidFines();
    setLoading(false);
    if (outcome.ok) {
      setRows(outcome.data);
      setSample(outcome.sample);
    } else {
      setError(outcome.message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 트랜잭션 후 갱신(views/reservations/index.tsx와 같은 신호) — book-detail에서 분실 처리·변상
  // 완료가 일어나도 이 목록이 반영되게 한다.
  useEffect(() => subscribeDataChange(() => void load()), [load]);

  async function handleConfirmPay() {
    if (!confirmRow) return;
    setPayBusy(true);
    const res = await payFine(confirmRow.fineId, confirmRow.remainingAmount);
    setPayBusy(false);
    setConfirmRow(null);
    if (res.ok) {
      shell.toast(t('views.bookDetail.compensateDone', { member: confirmRow.memberName || confirmRow.memberNo }), 'success');
      void load();
    } else {
      console.error('[reports] payFine 실패', { code: res.code, message: res.message, fineId: confirmRow.fineId });
      shell.toast(t('views.bookDetail.compensateFailed', { message: res.message }), 'error');
    }
  }

  const columns = useMemo<DataTableColumn<UnpaidFineRow>[]>(
    () => [
      {
        key: 'memberName',
        header: t('views.reports.unpaidFines.colMember'),
        sortable: true,
        nowrap: true, // todo/102 — 이름 통짜
        render: (row) => row.memberName || row.memberNo,
        mobilePrimary: true
      },
      { key: 'title', header: t('views.reservations.col.title'), sortable: true, mobileSecondary: true },
      { key: 'barcode', header: t('views.catalog.col.barcode'), sortable: true, mono: true },
      {
        key: 'remainingAmount',
        header: t('views.reports.unpaidFines.colRemaining'),
        sortable: true,
        numeric: true,
        render: (row) => formatKRW(row.remainingAmount)
      },
      {
        key: 'amount',
        header: t('views.reports.unpaidFines.colAmount'),
        sortable: true,
        numeric: true,
        render: (row) => formatKRW(row.amount)
      },
      { key: 'assessedAt', header: t('views.reports.unpaidFines.colAssessedAt'), sortable: true, mono: true, nowrap: true },
      {
        key: 'rowActions',
        header: t('views.reservations.col.actions'),
        filterValue: false,
        csvValue: () => '',
        render: (row) => (
          <button type="button" className="warn" onClick={() => setConfirmRow(row)}>
            <Banknote size={14} aria-hidden /> {t('views.bookDetail.actionCompensate')}
          </button>
        )
      }
    ],
    []
  );

  // todo/76 — 전체 컬럼 CSV(백업 충실도: 원값·시트 컬럼명).
  const csvFullColumns = useMemo<DataTableColumn<UnpaidFineRow>[]>(
    () => [
      { key: 'fineId', header: 'fine_id' },
      { key: 'memberId', header: 'member_id' },
      { key: 'memberNo', header: 'member_no' },
      { key: 'memberName', header: 'member_name' },
      { key: 'loanId', header: 'loan_id' },
      { key: 'copyId', header: 'copy_id' },
      { key: 'barcode', header: 'barcode' },
      { key: 'titleId', header: 'title_id' },
      { key: 'title', header: 'title' },
      { key: 'amount', header: 'amount' },
      { key: 'paidAmount', header: 'paid_amount' },
      { key: 'remainingAmount', header: 'remaining_amount' },
      { key: 'statusCode', header: 'status_code' },
      { key: 'assessedAt', header: 'assessed_at' }
    ],
    []
  );

  return (
    <div>
      <div className="no-print">
        <h2>{t('views.reports.unpaidFines.title')}</h2>
        <p className="reports-summary-line">{t('views.reports.unpaidFines.subtitle')}</p>
        {error && (
          <div className="reports-error" role="alert">
            {t('views.reports.fetchError', { message: error })}
          </div>
        )}
      </div>

      <DataTable<UnpaidFineRow>
        csvFullColumns={csvFullColumns}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.fineId}
        platform={shell.platform}
        loading={loading && rows.length === 0}
        emptyHint={t('views.reports.unpaidFines.empty')}
        toolbarExtra={sample ? <SampleDataBadge /> : null}
        csvFileName="unpaid-fines.csv"
        defaultPageSize={25}
      />

      <ConfirmDialog
        open={Boolean(confirmRow)}
        title={t('views.bookDetail.confirmCompensateTitle')}
        message={
          confirmRow
            ? t('views.bookDetail.confirmCompensateBody', {
                member: confirmRow.memberName || confirmRow.memberNo,
                title: confirmRow.title,
                amount: formatKRW(confirmRow.remainingAmount)
              })
            : ''
        }
        confirmLabel={t('views.bookDetail.actionCompensate')}
        busy={payBusy}
        onConfirm={() => void handleConfirmPay()}
        onCancel={() => setConfirmRow(null)}
      />
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
  // todo/102 — 이름·날짜는 통짜("박지/호"·"2026-06-/20" 꺾임 실측 방지, todo/95 계약).
  { key: 'name', header: t('views.reports.homeroom.colName'), sortable: true, nowrap: true, mobilePrimary: true },
  { key: 'title', header: t('views.reports.homeroom.colBookTitle'), sortable: true, mobileSecondary: true },
  { key: 'dueAtText', header: t('views.reports.homeroom.colDueDate'), sortable: true, mono: true, nowrap: true },
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
  /** todo/18 — 반 참여 링(ClassParticipation.tsx)이 「담임 리포트로 직행」할 때 넘기는 반
   *  지정. 둘 다 없으면 기존과 동일하게 1학년 1반이 기본값이다(과거 동작 그대로 보존). */
  initialGrade?: number | null;
  initialClassNo?: number | null;
}

function HomeroomReportPanel({ shell, initialGrade, initialClassNo }: HomeroomReportPanelProps) {
  const [grade, setGrade] = useState(initialGrade ?? 1);
  const [classNo, setClassNo] = useState(initialClassNo ?? 1);
  // todo/128 — 이름 반 학교 이중 모드: CLASS 코드북이 있으면 학년·반 숫자 입력 대신 반 select
  // 하나(이 학교엔 학년 축이 아예 없다). null = 조회 중, [] = 숫자 학교/미배포(종전 UI 그대로 —
  // 회귀 0). 서버 계약은 reportHomeroomClass_의 classCode 모드(todo/124).
  const [classes, setClasses] = useState<ClassCodeEntry[] | null>(null);
  const [classCode, setClassCode] = useState('');
  const [month, setMonth] = useState(() => currentMonthDefault());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ data: HomeroomReport; sample: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchClassCodes().then((res) => {
      if (!alive) return;
      if (res.ok && res.classes.length > 0) {
        setClasses(res.classes);
        setClassCode((prev) => prev || res.classes[0].code);
      } else {
        setClasses([]);
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  const labelMode = (classes?.length ?? 0) > 0;

  const handlePreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    const outcome = await fetchHomeroomReport(labelMode ? { classCode } : { grade, classNo }, month);
    setLoading(false);
    if (outcome.ok) setResult({ data: outcome.data, sample: outcome.sample });
    else {
      setResult(null);
      setError(outcome.message);
    }
  }, [labelMode, classCode, grade, classNo, month]);

  // todo/18 — 반 참여 링에서 특정 반을 지정해 넘어온 경우에만 "직행"답게 진입 즉시 한 번
  // 자동으로 미리보기를 실행한다(그 외 나머지 4개 리포트 패널과 동일하게 평소엔 버튼을
  // 눌러야만 조회하는 온디맨드 방식을 그대로 유지 — UnpaidFinesPanel 정도만 예외였는데
  // 여기 새 예외가 하나 더 생긴 셈이다). 최초 마운트 시 1회만 실행되도록 플래그로 막는다.
  const [autoPreviewDone, setAutoPreviewDone] = useState(false);
  useEffect(() => {
    if (autoPreviewDone) return;
    if (initialGrade == null || initialClassNo == null) return;
    if (classes === null || labelMode) return; // todo/128 — 라벨 학교에선 학년·반 딥링크가 무의미(학년 축 없음)
    setAutoPreviewDone(true);
    void handlePreview();
  }, [autoPreviewDone, initialGrade, initialClassNo, classes, labelMode, handlePreview]);

  return (
    <div>
      <div className="no-print">
        <h2>{t('views.reports.homeroom.title')}</h2>
        <div className="reports-form">
          {labelMode ? (
            <div className="reports-field">
              <label htmlFor="homeroom-class-code">{t('views.reports.homeroom.classNoLabel')}</label>
              <select id="homeroom-class-code" value={classCode} onChange={(e) => setClassCode(e.target.value)}>
                {(classes ?? []).map((cls) => (
                  <option key={cls.code} value={cls.code}>
                    {cls.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="reports-field">
                <label htmlFor="homeroom-grade">{t('views.reports.homeroom.gradeLabel')}</label>
                <input
                  id="homeroom-grade"
                  type="number"
                  inputMode="numeric"
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
                  inputMode="numeric"
                  min={1}
                  value={classNo}
                  onChange={(e) => setClassNo(Number(e.target.value) || 0)}
                />
              </div>
            </>
          )}
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
            <h2>
              {result.data.classLabel
                ? t('views.reports.homeroom.printTitleClass', { classLabel: result.data.classLabel, month: result.data.month })
                : t('views.reports.homeroom.printTitle', { grade: result.data.grade, classNo: result.data.classNo, month: result.data.month })}
            </h2>
            <p className="reports-summary-line">
              {result.data.classLabel
                ? t('views.reports.homeroom.studentCountLineClass', { classLabel: result.data.classLabel, count: result.data.studentCount })
                : t('views.reports.homeroom.studentCountLine', {
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

// ── R1-3 죽은 장서 / 구매 추천 ──────────────────────────────────────────────────────
// FEATURES.md "입수 2년↑·대출 0회 = 폐기 후보 / 예약 누적·회전율 상위 = 복본 구매 후보". 열
// 라벨은 새로 만들지 않고 이미 같은 개념을 가리키는 기존 키를 그대로 재사용한다(DESIGN.md
// "같은 행동 같은 이름 관통"): barcode/title/author/shelf/acquiredAt은 views.catalog.col.*
// (todo/08 카탈로그 열과 동일 개념), queueLength는 viz.reservationPressure.colQueue("대기
// 인원", todo/06), copyCount는 views.register.labelCopyCount("복본수", 등록 폼과 동일 개념).
const weedingCandidateColumns: DataTableColumn<WeedingCandidateRow>[] = [
  { key: 'barcode', header: t('views.catalog.col.barcode'), sortable: true, mono: true, mobilePrimary: true },
  { key: 'title', header: t('views.catalog.col.title'), sortable: true, mobileSecondary: true },
  { key: 'author', header: t('views.catalog.col.authors'), sortable: true },
  { key: 'shelfCode', header: t('views.catalog.col.shelf'), sortable: true },
  { key: 'acquiredAtText', header: t('views.catalog.col.acquiredAt'), sortable: true, mono: true }
];

const purchaseCandidateColumns: DataTableColumn<PurchaseCandidateRow>[] = [
  { key: 'title', header: t('views.catalog.col.title'), sortable: true, mobilePrimary: true },
  { key: 'queueLength', header: t('viz.reservationPressure.colQueue'), sortable: true, numeric: true, mobileSecondary: true },
  { key: 'copyCount', header: t('views.register.labelCopyCount'), sortable: true, numeric: true },
  {
    key: 'ratio',
    header: t('views.reports.weeding.colRatio'),
    sortable: true,
    numeric: true,
    render: (row) => row.ratio.toFixed(2)
  }
];

interface WeedingRecommendPanelProps {
  shell: ShellContext;
}

function WeedingRecommendPanel({ shell }: WeedingRecommendPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ data: WeedingRecommendReport; sample: boolean } | null>(null);

  async function handlePreview() {
    setLoading(true);
    setError(null);
    const outcome = await fetchWeedingRecommendReport();
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
        <h2>{t('views.reports.weeding.title')}</h2>
        <div className="reports-form">
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
          <p className="reports-summary-line">
            {t('views.reports.weeding.subtitle', { years: result.data.minAgeYears })}
          </p>

          <h3>{t('views.reports.weeding.weedingHeading')}</h3>
          <DataTable<WeedingCandidateRow>
            columns={weedingCandidateColumns}
            rows={result.data.weedingCandidates}
            rowKey={(row) => row.copyId}
            platform={shell.platform}
            emptyHint={t('views.reports.weeding.weedingEmpty')}
            csvFileName="weeding-candidates.csv"
            defaultPageSize={25}
          />

          <h3>{t('views.reports.weeding.purchaseHeading')}</h3>
          <DataTable<PurchaseCandidateRow>
            columns={purchaseCandidateColumns}
            rows={result.data.purchaseCandidates}
            rowKey={(row) => row.titleId}
            platform={shell.platform}
            emptyHint={t('views.reports.weeding.purchaseEmpty')}
            csvFileName="purchase-candidates.csv"
            defaultPageSize={25}
          />
        </div>
      )}

      {result && (
        <div className="print-preview-frame">
          <PrintDocument libraryName={result.data.libraryName} generatedAtText={result.data.generatedAt}>
            <h2>{t('views.reports.weeding.printTitle')}</h2>
            <p className="reports-summary-line">
              {t('views.reports.weeding.subtitle', { years: result.data.minAgeYears })}
            </p>

            <h2>{t('views.reports.weeding.weedingHeading')}</h2>
            {result.data.weedingCandidates.length === 0 ? (
              <p className="print-empty">{t('views.reports.weeding.weedingEmpty')}</p>
            ) : (
              <table className="print-table">
                <thead>
                  <tr>
                    <th className="mono">{t('views.catalog.col.barcode')}</th>
                    <th>{t('views.catalog.col.title')}</th>
                    <th>{t('views.catalog.col.authors')}</th>
                    <th>{t('views.catalog.col.shelf')}</th>
                    <th className="mono">{t('views.catalog.col.acquiredAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.weedingCandidates.map((row) => (
                    <tr key={row.copyId}>
                      <td className="mono">{row.barcode}</td>
                      <td>{row.title}</td>
                      <td>{row.author}</td>
                      <td>{row.shelfCode}</td>
                      <td className="mono">{row.acquiredAtText}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h2>{t('views.reports.weeding.purchaseHeading')}</h2>
            {result.data.purchaseCandidates.length === 0 ? (
              <p className="print-empty">{t('views.reports.weeding.purchaseEmpty')}</p>
            ) : (
              <table className="print-table">
                <thead>
                  <tr>
                    <th>{t('views.catalog.col.title')}</th>
                    <th className="num">{t('viz.reservationPressure.colQueue')}</th>
                    <th className="num">{t('views.register.labelCopyCount')}</th>
                    <th className="num">{t('views.reports.weeding.colRatio')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.purchaseCandidates.map((row) => (
                    <tr key={row.titleId}>
                      <td>{row.title}</td>
                      <td className="num">{row.queueLength}</td>
                      <td className="num">{row.copyCount}</td>
                      <td className="num">{row.ratio.toFixed(2)}</td>
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

// ── R1-4 회수 쪽지 ──────────────────────────────────────────────────────────────────
// FEATURES.md "연체·방학 미반납을 담임별로 쪽지 인쇄... 교실 전달용 절취 쪽지". 인쇄 레이아웃은
// R1-1/R1-2의 .print-table/.print-class-group과 형태가 달라(DESIGN.md "회수 쪽지: 절취선(dashed)
// + 한 반이 한 열") styles/print.css에 새 클래스(.print-recall-grid/.print-recall-slip 등)를
// 추가했다 — 기존 인쇄 클래스는 겹쳐 쓰지 않는다. 온스크린 인터랙티브 미리보기는 서버가 이미
// 학급별로 그룹화해 내려준 데이터를 평평하게 펼쳐(grade/classNo를 각 행에 얹어) 정렬·필터
// 가능한 단일 DataTable로 보여준다 — 열 라벨은 담임 리포트(homeroom)의 연체 목록과 같은
// 개념이라 그 키를 그대로 재사용한다.
type RecallNoticeFlatRow = RecallNoticeItem & { grade: number; classNo: number };

const recallNoticeColumns: DataTableColumn<RecallNoticeFlatRow>[] = [
  { key: 'grade', header: t('views.reports.homeroom.gradeLabel'), sortable: true, numeric: true },
  { key: 'classNo', header: t('views.reports.homeroom.classNoLabel'), sortable: true, numeric: true },
  { key: 'studentNo', header: t('views.reports.homeroom.colSeat'), sortable: true, numeric: true, mono: true },
  // todo/102 — 이름·날짜는 통짜("박지/호"·"2026-06-/20" 꺾임 실측 방지, todo/95 계약).
  { key: 'name', header: t('views.reports.homeroom.colName'), sortable: true, nowrap: true, mobilePrimary: true },
  { key: 'title', header: t('views.reports.homeroom.colBookTitle'), sortable: true, mobileSecondary: true },
  { key: 'dueAtText', header: t('views.reports.homeroom.colDueDate'), sortable: true, mono: true, nowrap: true },
  {
    key: 'overdueDays',
    header: t('views.reports.homeroom.colOverdueDays'),
    sortable: true,
    numeric: true,
    render: (row) => t('views.reports.homeroom.overdueDaysValue', { days: row.overdueDays })
  }
];

interface RecallNoticePanelProps {
  shell: ShellContext;
}

function RecallNoticePanel({ shell }: RecallNoticePanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ data: RecallNoticeReport; sample: boolean } | null>(null);

  const flatRows = useMemo<RecallNoticeFlatRow[]>(() => {
    if (!result) return [];
    return result.data.classes.flatMap((cls) => cls.items.map((item) => ({ ...item, grade: cls.grade, classNo: cls.classNo })));
  }, [result]);

  async function handlePreview() {
    setLoading(true);
    setError(null);
    const outcome = await fetchRecallNoticeReport();
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
        <h2>{t('views.reports.recall.title')}</h2>
        <p className="reports-summary-line">{t('views.reports.recall.subtitle')}</p>
        <div className="reports-form">
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
          <p className="reports-summary-line">
            {t('views.reports.recall.asOfDateLine', { date: result.data.asOfDate, count: result.data.totalCount })}
          </p>
          <DataTable<RecallNoticeFlatRow>
            columns={recallNoticeColumns}
            rows={flatRows}
            rowKey={(row) => `${row.grade}-${row.classNo}-${row.studentNo}-${row.title}`}
            platform={shell.platform}
            emptyHint={t('views.reports.homeroom.overdueEmpty')}
            csvFileName="recall-notice.csv"
            defaultPageSize={25}
          />
        </div>
      )}

      {result && (
        <div className="print-preview-frame">
          <PrintDocument libraryName={result.data.libraryName} generatedAtText={result.data.generatedAt}>
            <h2>{t('views.reports.recall.printTitle')}</h2>
            <p className="reports-summary-line">
              {t('views.reports.recall.asOfDateLine', { date: result.data.asOfDate, count: result.data.totalCount })}
            </p>
            <p className="reports-summary-line no-print">{t('views.reports.recall.cutLineHint')}</p>

            {result.data.classes.length === 0 ? (
              <p className="print-empty">{t('views.reports.homeroom.overdueEmpty')}</p>
            ) : (
              <div className="print-recall-grid">
                {result.data.classes.map((cls) => (
                  <div className="print-recall-slip" key={`${cls.grade}-${cls.classNo}`}>
                    <div className="print-recall-slip-header">
                      {t('views.reports.recall.classHeading', { grade: cls.grade, classNo: cls.classNo, count: cls.items.length })}
                    </div>
                    {cls.items.map((item, i) => (
                      <div className="print-recall-item" key={`${item.studentNo}-${i}`}>
                        <div className="print-recall-item-name">
                          {item.studentNo}. {item.name}
                        </div>
                        <div className="print-recall-item-title">{item.title}</div>
                        <div className="print-recall-item-due">
                          {t('views.reports.recall.overdueLine', { date: item.dueAtText, days: item.overdueDays })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </PrintDocument>
        </div>
      )}
    </div>
  );
}

// ── R1-5 기증 감사장 ────────────────────────────────────────────────────────────────
// FEATURES.md "연말 기증자별 목록·감사장 일괄 생성... 기증 선순환 유도". 08_COPIES에는 기증자
// 개인 식별 필드가 없어(school-patch-v1/Code.gs reportDonorThanks_ 주석·docs/ASSUMPTIONS.md
// todo/09 참고) acquisition_source 원문 문자열을 그룹 키로 쓴다 — 화면은 이 그룹이 "기증자
// 이름"이 아니라 "입수 경로 값"이라는 사실을 disclaimer로 정직하게 밝힌다(임의로 "OOO님께
// 감사드립니다" 같은 확인되지 않은 인적 문구를 만들지 않는다). 금액은 사전에 문자열로 박아
// 넣지 않고 i18n/format의 formatKRW(Intl.NumberFormat)로 로케일에 맞춰 표시한다(ADR-023).

const donorGroupColumns: DataTableColumn<DonorThanksGroup>[] = [
  { key: 'sourceLabel', header: t('views.reports.donor.colSource'), sortable: true, mobilePrimary: true },
  {
    key: 'itemCount',
    header: t('views.reports.donor.colItemCount'),
    sortable: true,
    numeric: true,
    sortAccessor: (row) => row.items.length,
    render: (row) => row.items.length
  },
  {
    key: 'totalPrice',
    header: t('views.reports.donor.colTotalPrice'),
    sortable: true,
    numeric: true,
    mobileSecondary: true,
    render: (row) => formatKRW(row.totalPrice)
  }
];

interface DonorThanksPanelProps {
  shell: ShellContext;
}

function DonorThanksPanel({ shell }: DonorThanksPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ data: DonorThanksReport; sample: boolean } | null>(null);

  async function handlePreview() {
    setLoading(true);
    setError(null);
    const outcome = await fetchDonorThanksReport();
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
        <h2>{t('views.reports.donor.title')}</h2>
        <p className="reports-summary-line">{t('views.reports.donor.subtitle')}</p>
        <p className="reports-notice">{t('views.reports.donor.disclaimer')}</p>
        <div className="reports-form">
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
          {result.data.skippedNoSource > 0 && (
            <p className="reports-summary-line">{t('views.reports.donor.skippedNote', { count: result.data.skippedNoSource })}</p>
          )}
          <DataTable<DonorThanksGroup>
            columns={donorGroupColumns}
            rows={result.data.donorGroups}
            rowKey={(row) => row.sourceLabel}
            platform={shell.platform}
            emptyHint={t('views.reports.donor.donorEmpty')}
            csvFileName="donor-thanks.csv"
            defaultPageSize={25}
          />
        </div>
      )}

      {result && (
        <div className="print-preview-frame">
          <PrintDocument libraryName={result.data.libraryName} generatedAtText={result.data.generatedAt}>
            <h2>{t('views.reports.donor.printTitle')}</h2>
            <p className="reports-summary-line">{t('views.reports.donor.disclaimer')}</p>

            {result.data.donorGroups.length === 0 ? (
              <p className="print-empty">{t('views.reports.donor.donorEmpty')}</p>
            ) : (
              result.data.donorGroups.map((group) => (
                <div className="print-class-group" key={group.sourceLabel}>
                  <div className="print-class-title">
                    {t('views.reports.donor.groupHeading', {
                      source: group.sourceLabel,
                      count: group.items.length,
                      total: formatKRW(group.totalPrice)
                    })}
                  </div>
                  <table className="print-table">
                    <thead>
                      <tr>
                        <th>{t('views.catalog.col.title')}</th>
                        <th className="mono">{t('views.catalog.col.acquiredAt')}</th>
                        <th className="num">{t('views.reports.donor.colTotalPrice')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => (
                        <tr key={item.copyId}>
                          <td>{item.title}</td>
                          <td className="mono">{item.acquiredAtText}</td>
                          <td className="num">{formatKRW(item.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </PrintDocument>
        </div>
      )}
    </div>
  );
}

// todo/18 — 반 참여 링이 넘기는 grade/classNo(둘 다 number)만 골라낸다. 그 외 출처(직접 URL
// 조작 등)로 이상한 값이 들어와도 조용히 null로 떨어뜨려 기존 기본값(1학년 1반) 동작을 지킨다.
function numberParam(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
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
      {selectedType === 'homeroom-report' && (
        <HomeroomReportPanel shell={shell} initialGrade={numberParam(params.grade)} initialClassNo={numberParam(params.classNo)} />
      )}
      {selectedType === 'weeding-recommend' && <WeedingRecommendPanel shell={shell} />}
      {selectedType === 'recall-notice' && <RecallNoticePanel shell={shell} />}
      {selectedType === 'donor-thanks' && <DonorThanksPanel shell={shell} />}
      {selectedType === 'annual-operations-report' && <AnnualOperationsReportPanel shell={shell} />}
      {selectedType === 'viz-insights' && <VizInsightsPanel shell={shell} />}
      {selectedType === 'unpaid-fines' && <UnpaidFinesPanel shell={shell} />}
    </div>
  );
}
