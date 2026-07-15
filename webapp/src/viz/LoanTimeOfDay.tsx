import { useMemo, useState } from 'react';
import { t } from '../i18n';
import { useVizData } from '../services/vizData';
import { VizChartFrame } from './VizChartFrame';
import './viz.css';

// #2 하루의 파도 — docs/VIZ.md V1 표 2행. LOANS.checked_out_at(최근 90일 —
// school-patch-v1/Code.gs computeLoanTimeOfDayViz_ 주석 참고)를 시각(0~23시)별 막대로 그린다.
// "점심 피크 — 스테이션·도우미 배치 근거"에 답하는 차트지만, 이 항목 범위에는 근무 배치
// 화면이 아직 없어(registry.ts의 ViewId에 그런 뷰가 없음) 자연스러운 이동 목적지가 없다 —
// #1 대출 잔디(LoanHeatmap.tsx)가 이미 쓴 것과 같은 VIZ.md 원칙 ③ 예외를 그대로 따라 행동
// 버튼을 생략했다(docs/ASSUMPTIONS.md todo/18). 대신 가장 붐비는 시간대 막대를 강조색으로
// 표시해 "언제가 피크인지"는 그림 자체가 바로 답한다.
//
// 막대는 순차 램프가 아니라 단일 강조(피크 시간대만 --brass, 나머지는 --deep)로 그린다 —
// 이 차트는 "시간대별 상대적 많고 적음"이 아니라 "피크가 어디냐"가 핵심 질문이라 회전율
// 사분면(TurnoverQuadrant.tsx)의 버블 강조 관례(단일 색 + 포인트 강조)와 결이 같다.

const CHART_W = 300;
const CHART_H = 160;
const MARGIN_LEFT = 28;
const MARGIN_BOTTOM = 18;
const MARGIN_TOP = 6;
const MARGIN_RIGHT = 6;
const BAR_GAP = 1.5;

export default function LoanTimeOfDay() {
  const { loading, data, sample, computedAt, error } = useVizData('loan-time-of-day');
  const [showTable, setShowTable] = useState(false);

  const layout = useMemo(() => {
    const hours = data?.hours ?? [];
    if (hours.length === 0) return null;
    const maxCount = hours.reduce((m, h) => Math.max(m, h.count), 0) || 1;
    const plotW = CHART_W - MARGIN_LEFT - MARGIN_RIGHT;
    const plotH = CHART_H - MARGIN_TOP - MARGIN_BOTTOM;
    const barW = plotW / hours.length - BAR_GAP;
    const bars = hours.map((h, i) => {
      const barH = (h.count / maxCount) * plotH;
      return {
        ...h,
        x: MARGIN_LEFT + i * (plotW / hours.length),
        y: MARGIN_TOP + plotH - barH,
        w: Math.max(0, barW),
        h: barH,
        isPeak: h.count === maxCount && maxCount > 0
      };
    });
    return { bars, maxCount };
  }, [data]);

  return (
    <VizChartFrame
      title={t('viz.loanTimeOfDay.title')}
      subtitle={t('viz.loanTimeOfDay.subtitle')}
      sample={sample}
      loading={loading}
      error={error}
      computedAtText={computedAt || undefined}
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
              <rect
                key={bar.hour}
                className="viz-bar-rect"
                x={bar.x}
                y={bar.y}
                width={bar.w}
                height={bar.h}
                fill={bar.isPeak ? 'var(--brass)' : 'var(--deep)'}
              >
                <title>{`${bar.hour}${t('viz.loanTimeOfDay.hourSuffix')} · ${t('viz.loanTimeOfDay.colCount')} ${bar.count}`}</title>
              </rect>
            ))}
            {[0, 6, 12, 18].map((hour) => (
              <text
                key={hour}
                x={MARGIN_LEFT + (hour / 24) * (CHART_W - MARGIN_LEFT - MARGIN_RIGHT)}
                y={CHART_H - 4}
                className="viz-bar-axis-label"
              >
                {hour}
              </text>
            ))}
          </svg>
          <div className="viz-legend-scale">
            <span className="viz-legend-swatch" style={{ background: 'var(--brass)' }} />
            <span>{t('viz.loanTimeOfDay.legendPeak')}</span>
            <button type="button" className="ghost viz-table-toggle" onClick={() => setShowTable((v) => !v)}>
              {showTable ? t('viz.common.hideTable') : t('viz.common.showTable')}
            </button>
          </div>
          <table className={showTable ? 'viz-table' : 'viz-table viz-sr-only'}>
            <caption className={showTable ? undefined : 'viz-sr-only'}>{t('viz.loanTimeOfDay.tableCaption')}</caption>
            <thead>
              <tr>
                <th>{t('viz.loanTimeOfDay.colHour')}</th>
                <th className="num">{t('viz.loanTimeOfDay.colCount')}</th>
              </tr>
            </thead>
            <tbody>
              {layout.bars.map((bar) => (
                <tr key={bar.hour}>
                  <td className="mono">{bar.hour}</td>
                  <td className="num">{bar.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="viz-empty">{t('viz.loanTimeOfDay.empty')}</p>
      )}
    </VizChartFrame>
  );
}
