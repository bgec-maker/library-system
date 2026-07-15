import { useMemo, useState } from 'react';
import { Archive } from 'lucide-react';
import type { ViewId } from '../types';
import { t } from '../i18n';
import { useVizData } from '../services/vizData';
import { VizChartFrame } from './VizChartFrame';
import './viz.css';

// #5 장서 나이 — docs/VIZ.md V1 표 5행. school-patch-v1/Code.gs computeCollectionAgeViz_가
// 입수연도별 소장본 수를 status_code 6종(08_COPIES 검증 배열과 같은 순서 — AVAILABLE·ON_LOAN·
// HOLD_READY·REPAIR·LOST·WITHDRAWN)으로 적층해 이미 계산해 두었다. 색은 DESIGN.md 범주(≤6)
// 고정 순서(deep·brass·pass·wait·ink-2·fail)를 그 순서 그대로 배정한다 — 상태값이 정확히
// 6종이라 팔레트 한도에 딱 맞는다.
//
// "미점검" 요약(staleUncheckedCount/staleInspectionDays)은 별도 색 계열이 아니라 카드 안
// 한 줄 요약 문구로만 보여준다(서버 주석 참고 — 7번째 색 계열을 얹으면 범주 팔레트 한도를
// 넘는다).
//
// 행동 버튼은 죽은 장서·구매 추천 리포트(weeding-recommend)로 연결한다 — 트리맵·회전율
// 사분면(CategoryTreemap.tsx/TurnoverQuadrant.tsx)과 같은 목적지다. "노후 + 이미 폐기·분실"
// 비중이 큰 연도를 본 다음 취할 다음 행동이 바로 그 리포트이기 때문이다.

interface CollectionAgeProps {
  onNavigate?: (viewId: ViewId, params?: Record<string, unknown>) => void;
}

// DESIGN.md 범주(≤6) 고정 순서 — statusOrder(서버) 인덱스와 1:1 대응.
const STATUS_TOKENS = ['--deep', '--brass', '--pass', '--wait', '--ink-2', '--fail'];
const STATUS_LABEL_KEYS: Record<string, string> = {
  AVAILABLE: 'viz.collectionAge.status.AVAILABLE',
  ON_LOAN: 'viz.collectionAge.status.ON_LOAN',
  HOLD_READY: 'viz.collectionAge.status.HOLD_READY',
  REPAIR: 'viz.collectionAge.status.REPAIR',
  LOST: 'viz.collectionAge.status.LOST',
  WITHDRAWN: 'viz.collectionAge.status.WITHDRAWN'
};

const CHART_W = 320;
const CHART_H = 200;
const MARGIN_LEFT = 30;
const MARGIN_BOTTOM = 18;
const MARGIN_TOP = 8;
const MARGIN_RIGHT = 6;
const BAR_GAP = 4;

export default function CollectionAge({ onNavigate }: CollectionAgeProps) {
  const { loading, data, sample, computedAt, error } = useVizData('collection-age');
  const [showTable, setShowTable] = useState(false);

  const layout = useMemo(() => {
    if (!data || data.years.length === 0) return null;
    const statusOrder = data.statusOrder;
    const totals = data.years.map((y) => statusOrder.reduce((s, code) => s + (y.statusCounts[code] || 0), 0));
    const maxTotal = Math.max(1, ...totals);
    const plotW = CHART_W - MARGIN_LEFT - MARGIN_RIGHT;
    const plotH = CHART_H - MARGIN_TOP - MARGIN_BOTTOM;
    const barW = Math.max(0, plotW / data.years.length - BAR_GAP);
    const bars = data.years.map((y, i) => {
      let cumulative = 0;
      const segments = statusOrder.map((code, si) => {
        const count = y.statusCounts[code] || 0;
        const segH = (count / maxTotal) * plotH;
        const segY = MARGIN_TOP + plotH - cumulative - segH;
        cumulative += segH;
        return { code, count, y: segY, h: segH, token: STATUS_TOKENS[si] ?? '--deep' };
      });
      return {
        year: y.year,
        x: MARGIN_LEFT + i * (plotW / data.years.length),
        total: totals[i],
        segments
      };
    });
    return { bars, maxTotal, statusOrder, barW };
  }, [data]);

  const footer = (
    <button
      type="button"
      className="ghost viz-action-btn"
      onClick={() => onNavigate?.('reports', { type: 'weeding-recommend' })}
    >
      <Archive size={14} aria-hidden /> {t('viz.collectionAge.actionButton')}
    </button>
  );

  return (
    <VizChartFrame
      title={t('viz.collectionAge.title')}
      subtitle={t('viz.collectionAge.subtitle')}
      sample={sample}
      loading={loading}
      error={error}
      computedAtText={computedAt || undefined}
      footer={onNavigate ? footer : undefined}
    >
      {layout && layout.bars.length > 0 ? (
        <>
          <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-hidden="true">
            <line
              x1={MARGIN_LEFT}
              y1={CHART_H - MARGIN_BOTTOM}
              x2={CHART_W - MARGIN_RIGHT}
              y2={CHART_H - MARGIN_BOTTOM}
              stroke="var(--rule)"
            />
            {layout.bars.map((bar) => (
              <g key={bar.year}>
                {bar.segments.map((seg) =>
                  seg.h > 0 ? (
                    <rect
                      key={seg.code}
                      className="viz-stack-bar-rect"
                      x={bar.x}
                      y={seg.y}
                      width={layout.barW}
                      height={seg.h}
                      fill={`var(${seg.token})`}
                    >
                      <title>{`${bar.year} · ${t(STATUS_LABEL_KEYS[seg.code] ?? 'viz.collectionAge.status.AVAILABLE')} ${seg.count}`}</title>
                    </rect>
                  ) : null
                )}
                <text x={bar.x + 2} y={CHART_H - 4} className="viz-bar-axis-label">
                  {bar.year}
                </text>
              </g>
            ))}
          </svg>
          <div className="viz-legend-scale">
            {layout.statusOrder.map((code, i) => (
              <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span className="viz-legend-swatch" style={{ background: `var(${STATUS_TOKENS[i] ?? '--deep'})` }} />
                {t(STATUS_LABEL_KEYS[code] ?? 'viz.collectionAge.status.AVAILABLE')}
              </span>
            ))}
            <button type="button" className="ghost viz-table-toggle" onClick={() => setShowTable((v) => !v)}>
              {showTable ? t('viz.common.hideTable') : t('viz.common.showTable')}
            </button>
          </div>
          {data && (
            <p className="viz-computed-at">
              {t('viz.collectionAge.staleLine', { count: data.staleUncheckedCount, days: data.staleInspectionDays })}
              {data.skippedNoAcquiredDate > 0
                ? ' · ' + t('viz.collectionAge.skippedLine', { count: data.skippedNoAcquiredDate })
                : ''}
            </p>
          )}
          <table className={showTable ? 'viz-table' : 'viz-table viz-sr-only'}>
            <caption className={showTable ? undefined : 'viz-sr-only'}>{t('viz.collectionAge.tableCaption')}</caption>
            <thead>
              <tr>
                <th>{t('viz.collectionAge.colYear')}</th>
                {layout.statusOrder.map((code) => (
                  <th key={code} className="num">
                    {t(STATUS_LABEL_KEYS[code] ?? 'viz.collectionAge.status.AVAILABLE')}
                  </th>
                ))}
                <th className="num">{t('viz.collectionAge.colTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {layout.bars.map((bar) => (
                <tr key={bar.year}>
                  <td className="mono">{bar.year}</td>
                  {bar.segments.map((seg) => (
                    <td key={seg.code} className="num">
                      {seg.count}
                    </td>
                  ))}
                  <td className="num">{bar.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="viz-empty">{t('viz.collectionAge.empty')}</p>
      )}
    </VizChartFrame>
  );
}
