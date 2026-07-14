import { useMemo, useState } from 'react';
import { intlLocaleTag, t } from '../i18n';
import { useVizData } from '../services/vizData';
import { VizChartFrame } from './VizChartFrame';
import './viz.css';

// #1 대출 잔디 — docs/VIZ.md V1 표 1행. LOANS 일별 건수(최근 1년)를 캘린더 히트맵(요일×주)으로
// 그린다. 색은 순차 램프 --viz-seq-1(적음)~5(많음)만 쓴다(DESIGN.md). "언제 붐비나"에 답하는
// 관찰용 차트라 자연스러운 행동 버튼이 없다 — VIZ.md 원칙 ③의 예외로 생략했다
// (docs/ASSUMPTIONS.md todo/06 참고, task 노트에서도 명시적으로 허용).

const CELL_SIZE = 11;
const CELL_GAP = 3;
const STEP = CELL_SIZE + CELL_GAP;
const ROWS = 7;
const MONTH_LABEL_HEIGHT = 14;

function parseLocalDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function levelForCount(count: number, maxCount: number): number {
  if (count <= 0 || maxCount <= 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export default function LoanHeatmap() {
  const { loading, data, sample, computedAt, error } = useVizData('loan-heatmap');
  const [showTable, setShowTable] = useState(false);

  const layout = useMemo(() => {
    const days = data?.days ?? [];
    if (days.length === 0) return null;
    const firstDate = parseLocalDate(days[0].date);
    const startDow = firstDate.getDay();
    const maxCount = days.reduce((m, d) => Math.max(m, d.count), 0);
    const monthFormatter = new Intl.DateTimeFormat(intlLocaleTag(), { month: 'short' });

    let prevMonth = -1;
    const monthLabels: { col: number; label: string }[] = [];
    const cells = days.map((day, i) => {
      const idx = startDow + i;
      const col = Math.floor(idx / 7);
      const row = idx % 7;
      const date = parseLocalDate(day.date);
      const month = date.getMonth();
      if (row === 0 && month !== prevMonth) {
        monthLabels.push({ col, label: monthFormatter.format(date) });
        prevMonth = month;
      }
      return { ...day, col, row, level: levelForCount(day.count, maxCount) };
    });
    const totalWeeks = Math.floor((startDow + days.length - 1) / 7) + 1;
    return { cells, monthLabels, totalWeeks, maxCount };
  }, [data]);

  const width = layout ? layout.totalWeeks * STEP + CELL_GAP : 0;
  const height = ROWS * STEP + CELL_GAP + MONTH_LABEL_HEIGHT;

  return (
    <VizChartFrame
      title={t('viz.loanHeatmap.title')}
      subtitle={t('viz.loanHeatmap.subtitle')}
      sample={sample}
      loading={loading}
      error={error}
      computedAtText={computedAt || undefined}
    >
      {layout && layout.cells.length > 0 ? (
        <>
          <div className="viz-heatmap-scroll">
            <svg width={width} height={height} role="img" aria-hidden="true">
              {layout.monthLabels.map((m) => (
                <text key={`${m.col}-${m.label}`} x={m.col * STEP} y={10} className="viz-heatmap-month-label">
                  {m.label}
                </text>
              ))}
              <g transform={`translate(0, ${MONTH_LABEL_HEIGHT})`}>
                {layout.cells.map((cell) => (
                  <rect
                    key={cell.date}
                    className="viz-heatmap-cell"
                    x={cell.col * STEP}
                    y={cell.row * STEP}
                    width={CELL_SIZE}
                    height={CELL_SIZE}
                    fill={`var(--viz-seq-${cell.level + 1})`}
                  >
                    <title>{`${cell.date} · ${t('viz.loanHeatmap.colCount')} ${cell.count}`}</title>
                  </rect>
                ))}
              </g>
            </svg>
          </div>
          <div className="viz-legend-scale">
            <span>{t('viz.loanHeatmap.legendLow')}</span>
            {[1, 2, 3, 4, 5].map((step) => (
              <span key={step} className="viz-legend-swatch" style={{ background: `var(--viz-seq-${step})` }} />
            ))}
            <span>{t('viz.loanHeatmap.legendHigh')}</span>
            <button type="button" className="ghost viz-table-toggle" onClick={() => setShowTable((v) => !v)}>
              {showTable ? t('viz.common.hideTable') : t('viz.common.showTable')}
            </button>
          </div>
          <table className={showTable ? 'viz-table' : 'viz-table viz-sr-only'}>
            <caption className={showTable ? undefined : 'viz-sr-only'}>{t('viz.loanHeatmap.tableCaption')}</caption>
            <thead>
              <tr>
                <th>{t('viz.loanHeatmap.colDate')}</th>
                <th className="num">{t('viz.loanHeatmap.colCount')}</th>
              </tr>
            </thead>
            <tbody>
              {layout.cells.map((cell) => (
                <tr key={cell.date}>
                  <td className="mono">{cell.date}</td>
                  <td className="num">{cell.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="viz-empty">{t('viz.loanHeatmap.empty')}</p>
      )}
    </VizChartFrame>
  );
}
