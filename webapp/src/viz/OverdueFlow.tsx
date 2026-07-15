import { useMemo, useState } from 'react';
import { Megaphone } from 'lucide-react';
import type { ViewId } from '../types';
import { t } from '../i18n';
import { useVizData } from '../services/vizData';
import { VizChartFrame } from './VizChartFrame';
import './viz.css';

// #8 연체 흐름 — docs/VIZ.md V1 표 8행. school-patch-v1/Code.gs computeOverdueFlowViz_가
// 이미 최근 12주를 "발생"(그 주에 새로 연체로 넘어간 대출 — due_at 기준) · "해소"(그 주에
// 연체 상태로 반납된 대출 — returned_at 기준) 두 계열로 집계해 두었다(정확한 정의는 그
// 함수 주석 참고). "정책(정지 배수)이 듣고 있나"에 답하려면 두 계열이 서로 얼마나
// 붙어있는지가 핵심이라, DESIGN.md 범주(≤6) 고정 순서(deep·brass·pass·wait·ink-2·fail)
// 대신 발산 램프의 양 끝(--viz-div-1=fail 쪽·--viz-div-5=pass 쪽)을 쓴다 — DESIGN.md가
// 발산 램프를 정확히 "fail↔paper↔pass의 ±비교"용으로 정의해 두었고, 발생(나쁜 쪽 증가)과
// 해소(좋은 쪽 증가)는 문자 그대로 그 ± 비교이지 별 의미 없는 나열형 범주가 아니기
// 때문이다(docs/ASSUMPTIONS.md todo/18에 근거 기록).
//
// 행동 버튼은 회수 쪽지(recall-notice) 리포트로 연결한다 — "연체가 쌓이고 있다"를 본
// 다음 취할 수 있는 가장 직접적인 다음 행동이 담임별 회수 쪽지 인쇄이기 때문이다(같은
// 아이콘 Megaphone을 DashboardBaseLayer.tsx의 QUIET_SIGNALS.recallNotice와 공유 —
// DESIGN.md "같은 행동 같은 이름 관통").

interface OverdueFlowProps {
  onNavigate?: (viewId: ViewId, params?: Record<string, unknown>) => void;
}

const CHART_W = 300;
const CHART_H = 180;
const MARGIN_LEFT = 30;
const MARGIN_BOTTOM = 18;
const MARGIN_TOP = 8;
const MARGIN_RIGHT = 6;

export default function OverdueFlow({ onNavigate }: OverdueFlowProps) {
  const { loading, data, sample, computedAt, error } = useVizData('overdue-flow');
  const [showTable, setShowTable] = useState(false);

  const layout = useMemo(() => {
    const weeks = data?.weeks ?? [];
    if (weeks.length === 0) return null;
    const maxCount = weeks.reduce((m, w) => Math.max(m, w.occurredCount, w.resolvedCount), 0) || 1;
    const plotW = CHART_W - MARGIN_LEFT - MARGIN_RIGHT;
    const plotH = CHART_H - MARGIN_TOP - MARGIN_BOTTOM;
    const stepX = weeks.length > 1 ? plotW / (weeks.length - 1) : 0;
    const points = weeks.map((w, i) => ({
      ...w,
      x: MARGIN_LEFT + i * stepX,
      occurredY: MARGIN_TOP + plotH - (w.occurredCount / maxCount) * plotH,
      resolvedY: MARGIN_TOP + plotH - (w.resolvedCount / maxCount) * plotH
    }));
    const occurredPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.occurredY.toFixed(1)}`).join(' ');
    const resolvedPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.resolvedY.toFixed(1)}`).join(' ');
    return { points, occurredPath, resolvedPath, maxCount };
  }, [data]);

  const footer = (
    <button type="button" className="ghost viz-action-btn" onClick={() => onNavigate?.('reports', { type: 'recall-notice' })}>
      <Megaphone size={14} aria-hidden /> {t('viz.overdueFlow.actionButton')}
    </button>
  );

  return (
    <VizChartFrame
      title={t('viz.overdueFlow.title')}
      subtitle={t('viz.overdueFlow.subtitle')}
      sample={sample}
      loading={loading}
      error={error}
      computedAtText={computedAt || undefined}
      footer={onNavigate ? footer : undefined}
    >
      {layout && layout.points.length > 0 ? (
        <>
          <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-hidden="true">
            <line
              x1={MARGIN_LEFT}
              y1={CHART_H - MARGIN_BOTTOM}
              x2={CHART_W - MARGIN_RIGHT}
              y2={CHART_H - MARGIN_BOTTOM}
              stroke="var(--rule)"
            />
            <path d={layout.occurredPath} className="viz-overdue-line" stroke="var(--viz-div-1)" />
            <path d={layout.resolvedPath} className="viz-overdue-line" stroke="var(--viz-div-5)" />
            {layout.points.map((p) => (
              <g key={p.weekStart}>
                <circle cx={p.x} cy={p.occurredY} r={2.4} fill="var(--viz-div-1)">
                  <title>{`${p.weekStart} · ${t('viz.overdueFlow.colOccurred')} ${p.occurredCount}`}</title>
                </circle>
                <circle cx={p.x} cy={p.resolvedY} r={2.4} fill="var(--viz-div-5)">
                  <title>{`${p.weekStart} · ${t('viz.overdueFlow.colResolved')} ${p.resolvedCount}`}</title>
                </circle>
              </g>
            ))}
          </svg>
          <div className="viz-legend-scale">
            <span className="viz-legend-swatch" style={{ background: 'var(--viz-div-1)' }} />
            <span>{t('viz.overdueFlow.legendOccurred')}</span>
            <span className="viz-legend-swatch" style={{ background: 'var(--viz-div-5)' }} />
            <span>{t('viz.overdueFlow.legendResolved')}</span>
            <button type="button" className="ghost viz-table-toggle" onClick={() => setShowTable((v) => !v)}>
              {showTable ? t('viz.common.hideTable') : t('viz.common.showTable')}
            </button>
          </div>
          <table className={showTable ? 'viz-table' : 'viz-table viz-sr-only'}>
            <caption className={showTable ? undefined : 'viz-sr-only'}>{t('viz.overdueFlow.tableCaption')}</caption>
            <thead>
              <tr>
                <th>{t('viz.overdueFlow.colWeek')}</th>
                <th className="num">{t('viz.overdueFlow.colOccurred')}</th>
                <th className="num">{t('viz.overdueFlow.colResolved')}</th>
              </tr>
            </thead>
            <tbody>
              {layout.points.map((p) => (
                <tr key={p.weekStart}>
                  <td className="mono">{p.weekStart}</td>
                  <td className="num">{p.occurredCount}</td>
                  <td className="num">{p.resolvedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="viz-empty">{t('viz.overdueFlow.empty')}</p>
      )}
    </VizChartFrame>
  );
}
