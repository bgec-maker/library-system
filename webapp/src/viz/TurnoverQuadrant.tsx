import { useMemo, useState } from 'react';
import { BookX } from 'lucide-react';
import type { ViewId } from '../types';
import { t } from '../i18n';
import { useVizData } from '../services/vizData';
import { VizChartFrame } from './VizChartFrame';
import './viz.css';

// #6 회전율 사분면 — docs/VIZ.md V1 표 6행. 서버(school-patch-v1/Code.gs
// computeTurnoverQuadrantViz_)가 이미 (대출횟수 버킷 6단) × (입수경과 버킷 5단) 그리드로
// 집계해 두었으므로, 여기서는 각 칸을 버블(점 크기 = 소장본 수)로 그리기만 한다 — 소장본
// 개별 좌표를 프론트가 다시 스캔하지 않는다(VIZ.md 원칙 ①).
//
// "스타/신참/잠자는/죽은" 4분류는 서버가 내려주지 않으므로(그리드 셀만 내려줌) 프론트가
// 버킷 인덱스로 분류한다 — 입수 1년 미만(ageBucketIndex<=1)은 "젊음", 그 이상은 "오래됨"으로
// 나누고, 젊은 쪽은 대출 3회 이상(loanBucketIndex>=3)이면 스타·아니면 신참, 오래된 쪽은
// 대출 0회(loanBucketIndex===0)면 죽은·아니면 잠자는으로 나눈다(docs/ASSUMPTIONS.md todo/06 —
// VIZ.md가 정확한 경계를 명시하지 않아 임의 지정).
const YOUNG_AGE_MAX_INDEX = 1;
const STAR_LOAN_MIN_INDEX = 3;

type QuadrantKey = 'star' | 'rookie' | 'dormant' | 'dead';

// 범주(≤6) 고정 순서(DESIGN.md: deep·brass·pass·wait·ink-2·fail)에서 앞 4개를 그대로 배정한다.
const QUADRANTS: { key: QuadrantKey; labelKey: string; token: string }[] = [
  { key: 'star', labelKey: 'viz.turnoverQuadrant.quadrantStar', token: '--deep' },
  { key: 'rookie', labelKey: 'viz.turnoverQuadrant.quadrantRookie', token: '--brass' },
  { key: 'dormant', labelKey: 'viz.turnoverQuadrant.quadrantDormant', token: '--pass' },
  { key: 'dead', labelKey: 'viz.turnoverQuadrant.quadrantDead', token: '--wait' }
];

function quadrantFor(loanBucketIndex: number, ageBucketIndex: number): QuadrantKey {
  const young = ageBucketIndex <= YOUNG_AGE_MAX_INDEX;
  if (young) return loanBucketIndex >= STAR_LOAN_MIN_INDEX ? 'star' : 'rookie';
  return loanBucketIndex === 0 ? 'dead' : 'dormant';
}

interface TurnoverQuadrantProps {
  onNavigate?: (viewId: ViewId, params?: Record<string, unknown>) => void;
}

const CHART_W = 300;
const CHART_H = 220;
const MARGIN_LEFT = 62;
const MARGIN_BOTTOM = 26;
const MARGIN_TOP = 6;
const MARGIN_RIGHT = 10;

export default function TurnoverQuadrant({ onNavigate }: TurnoverQuadrantProps) {
  const { loading, data, sample, computedAt, error } = useVizData('turnover-quadrant');
  const [showTable, setShowTable] = useState(false);

  const bubbles = useMemo(() => {
    if (!data) return [];
    const plotW = CHART_W - MARGIN_LEFT - MARGIN_RIGHT;
    const plotH = CHART_H - MARGIN_TOP - MARGIN_BOTTOM;
    const colW = plotW / data.ageBuckets.length;
    const rowH = plotH / data.loanBuckets.length;
    const maxCount = data.cells.reduce((m, c) => Math.max(m, c.count), 0) || 1;
    return data.cells.map((cell) => {
      const cx = MARGIN_LEFT + colW * (cell.ageBucketIndex + 0.5);
      const cy = MARGIN_TOP + plotH - rowH * (cell.loanBucketIndex + 0.5);
      const r = cell.count <= 0 ? 0 : 3 + Math.sqrt(cell.count / maxCount) * 18;
      const quadrant = quadrantFor(cell.loanBucketIndex, cell.ageBucketIndex);
      return { ...cell, cx, cy, r, quadrant };
    });
  }, [data]);

  const dividerX = data ? MARGIN_LEFT + ((CHART_W - MARGIN_LEFT - MARGIN_RIGHT) / data.ageBuckets.length) * (YOUNG_AGE_MAX_INDEX + 1) : 0;

  const footer = (
    <button type="button" className="ghost viz-action-btn" onClick={() => onNavigate?.('reports', { type: 'weeding-recommend' })}>
      <BookX size={14} aria-hidden /> {t('viz.turnoverQuadrant.actionButton')}
    </button>
  );

  return (
    <VizChartFrame
      title={t('viz.turnoverQuadrant.title')}
      subtitle={t('viz.turnoverQuadrant.subtitle')}
      sample={sample}
      loading={loading}
      error={error}
      computedAtText={computedAt || undefined}
      footer={onNavigate ? footer : undefined}
    >
      {data && bubbles.length > 0 ? (
        <>
          <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-hidden="true">
            <line
              x1={dividerX}
              y1={MARGIN_TOP}
              x2={dividerX}
              y2={CHART_H - MARGIN_BOTTOM}
              stroke="var(--rule)"
              strokeDasharray="3 3"
            />
            {data.loanBuckets.map((label, i) => {
              const plotH = CHART_H - MARGIN_TOP - MARGIN_BOTTOM;
              const rowH = plotH / data.loanBuckets.length;
              const y = MARGIN_TOP + plotH - rowH * (i + 0.5);
              return (
                <text key={label} x={MARGIN_LEFT - 6} y={y + 3} textAnchor="end" className="viz-quadrant-axis-label">
                  {label}
                </text>
              );
            })}
            {data.ageBuckets.map((label, i) => {
              const plotW = CHART_W - MARGIN_LEFT - MARGIN_RIGHT;
              const colW = plotW / data.ageBuckets.length;
              const x = MARGIN_LEFT + colW * (i + 0.5);
              return (
                <text key={label} x={x} y={CHART_H - 8} textAnchor="middle" className="viz-quadrant-axis-label">
                  {label}
                </text>
              );
            })}
            <text x={MARGIN_LEFT} y={CHART_H} className="viz-quadrant-axis-label">
              {t('viz.turnoverQuadrant.axisAge')}
            </text>
            {bubbles.map((b) => {
              const quadrantMeta = QUADRANTS.find((q) => q.key === b.quadrant);
              return (
                <circle
                  key={`${b.loanBucketIndex}-${b.ageBucketIndex}`}
                  className="viz-quadrant-bubble"
                  cx={b.cx}
                  cy={b.cy}
                  r={b.r}
                  fill={`var(${quadrantMeta?.token ?? '--deep'})`}
                >
                  <title>
                    {`${data.loanBuckets[b.loanBucketIndex]} × ${data.ageBuckets[b.ageBucketIndex]} — ${t('viz.turnoverQuadrant.colCount')} ${b.count} (${quadrantMeta ? t(quadrantMeta.labelKey) : ''})`}
                  </title>
                </circle>
              );
            })}
          </svg>
          <div className="viz-legend-scale">
            {QUADRANTS.map((q) => (
              <span key={q.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span className="viz-legend-swatch" style={{ background: `var(${q.token})` }} />
                {t(q.labelKey)}
              </span>
            ))}
            <button type="button" className="ghost viz-table-toggle" onClick={() => setShowTable((v) => !v)}>
              {showTable ? t('viz.common.hideTable') : t('viz.common.showTable')}
            </button>
          </div>
          <p className="viz-computed-at">
            {t('viz.turnoverQuadrant.totalLine', { count: data.totalCopies, skipped: data.skippedNoAcquiredDate })}
          </p>
          <table className={showTable ? 'viz-table' : 'viz-table viz-sr-only'}>
            <caption className={showTable ? undefined : 'viz-sr-only'}>{t('viz.turnoverQuadrant.tableCaption')}</caption>
            <thead>
              <tr>
                <th>{t('viz.turnoverQuadrant.colLoanBucket')}</th>
                <th>{t('viz.turnoverQuadrant.colAgeBucket')}</th>
                <th className="num">{t('viz.turnoverQuadrant.colCount')}</th>
              </tr>
            </thead>
            <tbody>
              {bubbles.map((b) => (
                <tr key={`${b.loanBucketIndex}-${b.ageBucketIndex}`}>
                  <td>{data.loanBuckets[b.loanBucketIndex]}</td>
                  <td>{data.ageBuckets[b.ageBucketIndex]}</td>
                  <td className="num">{b.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="viz-empty">{t('viz.turnoverQuadrant.empty')}</p>
      )}
    </VizChartFrame>
  );
}
