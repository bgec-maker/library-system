import { useMemo, useState } from 'react';
import { intlLocaleTag, t } from '../i18n';
import { useVizData } from '../services/vizData';
import { VizChartFrame } from './VizChartFrame';
import './viz.css';

// #12 열두 달 곡선 — docs/VIZ.md V1 표 12행. school-patch-v1/Code.gs
// computeMonthlyLoanCurveViz_가 이미 최근 4개년(그 이하면 있는 만큼만)의 월별 대출량을
// Jan~Dec 12칸으로 집계해 두었다. "방학 골짜기·개학 산"에 답하는 순수 관찰용 차트라 —
// #1 대출 잔디(LoanHeatmap.tsx)와 같은 이유로(자연스러운 이동 목적지가 이 항목 범위에
// 없음) VIZ.md 원칙 ③ 예외를 그대로 따라 행동 버튼을 생략했다(docs/ASSUMPTIONS.md todo/18).
//
// 색은 순차 램프(--viz-seq-1~5)를 "최근성"에 배정한다 — 가장 최근 연도가 항상 가장 짙은
// --viz-seq-5, 그보다 오래된 해일수록 한 단계씩 옅어지되 --viz-seq-2 밑으로는 내려가지
// 않는다(paper에 너무 가까우면 선이 안 보이므로). 순차 램프는 원래 "적음↔많음" 크기
// 비교용이지만(DESIGN.md), 여기서는 "오래됨↔최근"이라는 또 다른 단일 축의 크기 비교로
// 재해석해 썼다 — 같은 램프를 새 축에 재사용한 것이라 새 토큰을 만들지 않았다.

const CHART_W = 320;
const CHART_H = 200;
const MARGIN_LEFT = 30;
const MARGIN_BOTTOM = 18;
const MARGIN_TOP = 8;
const MARGIN_RIGHT = 6;

function levelForRecency(index: number, total: number): number {
  // index: 0 = 가장 오래된 해, total-1 = 최근 해. 최근 해는 항상 5, 그 전은 한 단계씩 옅게(최저 2).
  const distanceFromLatest = total - 1 - index;
  return Math.max(2, 5 - distanceFromLatest);
}

export default function MonthlyLoanCurve() {
  const { loading, data, sample, computedAt, error } = useVizData('monthly-loan-curve');
  const [showTable, setShowTable] = useState(false);

  const monthLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(intlLocaleTag(), { month: 'short' });
    return Array.from({ length: 12 }, (_, i) => formatter.format(new Date(2020, i, 1)));
  }, []);

  const layout = useMemo(() => {
    const years = data?.years ?? [];
    if (years.length === 0) return null;
    const maxCount = years.reduce((m, y) => Math.max(m, ...y.months), 0) || 1;
    const plotW = CHART_W - MARGIN_LEFT - MARGIN_RIGHT;
    const plotH = CHART_H - MARGIN_TOP - MARGIN_BOTTOM;
    const stepX = plotW / 11;
    const lines = years.map((y, i) => {
      const level = levelForRecency(i, years.length);
      const points = y.months.map((count, m) => ({
        x: MARGIN_LEFT + m * stepX,
        y: MARGIN_TOP + plotH - (count / maxCount) * plotH,
        count
      }));
      const path = points.map((p, i2) => `${i2 === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      return { year: y.year, level, points, path };
    });
    return { lines, maxCount };
  }, [data]);

  return (
    <VizChartFrame
      title={t('viz.monthlyLoanCurve.title')}
      subtitle={t('viz.monthlyLoanCurve.subtitle')}
      sample={sample}
      loading={loading}
      error={error}
      computedAtText={computedAt || undefined}
    >
      {layout && layout.lines.length > 0 ? (
        <>
          <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-hidden="true">
            <line
              x1={MARGIN_LEFT}
              y1={CHART_H - MARGIN_BOTTOM}
              x2={CHART_W - MARGIN_RIGHT}
              y2={CHART_H - MARGIN_BOTTOM}
              stroke="var(--rule)"
            />
            {monthLabels.map((label, i) => (
              <text
                key={label + i}
                x={MARGIN_LEFT + i * ((CHART_W - MARGIN_LEFT - MARGIN_RIGHT) / 11)}
                y={CHART_H - 4}
                className="viz-bar-axis-label"
              >
                {label}
              </text>
            ))}
            {layout.lines.map((line) => (
              <g key={line.year}>
                <path d={line.path} className="viz-curve-line" stroke={`var(--viz-seq-${line.level})`} />
                {line.points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={1.8} fill={`var(--viz-seq-${line.level})`}>
                    <title>{`${line.year}-${String(i + 1).padStart(2, '0')} · ${t('viz.monthlyLoanCurve.colCount')} ${p.count}`}</title>
                  </circle>
                ))}
              </g>
            ))}
          </svg>
          <div className="viz-legend-scale">
            {layout.lines.map((line) => (
              <span key={line.year} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span className="viz-legend-swatch" style={{ background: `var(--viz-seq-${line.level})` }} />
                {line.year}
              </span>
            ))}
            <button type="button" className="ghost viz-table-toggle" onClick={() => setShowTable((v) => !v)}>
              {showTable ? t('viz.common.hideTable') : t('viz.common.showTable')}
            </button>
          </div>
          <table className={showTable ? 'viz-table' : 'viz-table viz-sr-only'}>
            <caption className={showTable ? undefined : 'viz-sr-only'}>{t('viz.monthlyLoanCurve.tableCaption')}</caption>
            <thead>
              <tr>
                <th>{t('viz.monthlyLoanCurve.colMonth')}</th>
                {layout.lines.map((line) => (
                  <th key={line.year} className="num">
                    {line.year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthLabels.map((label, m) => (
                <tr key={label + m}>
                  <td>{label}</td>
                  {layout.lines.map((line) => (
                    <td key={line.year} className="num">
                      {line.points[m].count}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="viz-empty">{t('viz.monthlyLoanCurve.empty')}</p>
      )}
    </VizChartFrame>
  );
}
