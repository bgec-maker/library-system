import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import type { ViewId } from '../types';
import { t } from '../i18n';
import { useVizData } from '../services/vizData';
import { VizChartFrame } from './VizChartFrame';
import './viz.css';

// #7 예약 압력 — docs/VIZ.md V1 표 7행. 현재 대기열이 있는 서명만 스파크라인 목록으로 보여준다.
// "지금 사야 할 책"에 답하는 차트라 최상위(대기 인원 1위) 서명에 대해 바로 도서 상세로
// 이동하는 행동 버튼을 붙인다(VIZ.md 원칙 ③) — 서버가 이미 대기 인원 내림차순으로 정렬해
// 내려주므로(computeReservationPressureViz_) titles[0]이 곧 최상위다.

const SPARK_W = 64;
const SPARK_H = 22;

function sparkPath(trend: number[]): string {
  if (trend.length === 0) return '';
  const max = Math.max(1, ...trend);
  const stepX = trend.length > 1 ? SPARK_W / (trend.length - 1) : 0;
  return trend
    .map((v, i) => {
      const x = i * stepX;
      const y = SPARK_H - (v / max) * (SPARK_H - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

interface ReservationPressureProps {
  onNavigate?: (viewId: ViewId, params?: Record<string, unknown>) => void;
}

export default function ReservationPressure({ onNavigate }: ReservationPressureProps) {
  const { loading, data, sample, computedAt, error } = useVizData('reservation-pressure');
  const [showTable, setShowTable] = useState(false);

  const titles = data?.titles ?? [];
  const top = titles[0];

  const footer = top && (
    <button type="button" className="ghost viz-action-btn" onClick={() => onNavigate?.('book-detail', { titleId: top.titleId })}>
      <BookOpen size={14} aria-hidden /> {t('viz.reservationPressure.actionButton', { title: top.title })}
    </button>
  );

  return (
    <VizChartFrame
      title={t('viz.reservationPressure.title')}
      subtitle={t('viz.reservationPressure.subtitle')}
      sample={sample}
      loading={loading}
      error={error}
      computedAtText={computedAt || undefined}
      footer={onNavigate ? footer : undefined}
    >
      {titles.length > 0 ? (
        <>
          <ul className="viz-sparkline-list" aria-hidden={showTable}>
            {titles.map((item) => {
              const path = sparkPath(item.trend);
              const lastX = item.trend.length > 1 ? SPARK_W : 0;
              const max = Math.max(1, ...item.trend);
              const lastV = item.trend[item.trend.length - 1] ?? 0;
              const lastY = SPARK_H - (lastV / max) * (SPARK_H - 4) - 2;
              return (
                <li key={item.titleId} className="viz-sparkline-row">
                  <span className="viz-sparkline-title">{item.title}</span>
                  <span className="viz-sparkline-queue">{item.queueLength}</span>
                  <svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} role="img" aria-hidden="true">
                    <path d={path} className="viz-sparkline-path" />
                    <circle cx={lastX} cy={lastY} r={2.2} className="viz-sparkline-dot" />
                    <title>{`${item.title} · ${t('viz.reservationPressure.colTrend')}: ${item.trend.join(', ')}`}</title>
                  </svg>
                </li>
              );
            })}
          </ul>
          <div className="viz-legend-scale">
            <button type="button" className="ghost viz-table-toggle" onClick={() => setShowTable((v) => !v)}>
              {showTable ? t('viz.common.hideTable') : t('viz.common.showTable')}
            </button>
          </div>
          <table className={showTable ? 'viz-table' : 'viz-table viz-sr-only'}>
            <caption className={showTable ? undefined : 'viz-sr-only'}>{t('viz.reservationPressure.tableCaption')}</caption>
            <thead>
              <tr>
                <th>{t('viz.reservationPressure.colTitle')}</th>
                <th className="num">{t('viz.reservationPressure.colQueue')}</th>
                <th>{t('viz.reservationPressure.colTrend')}</th>
              </tr>
            </thead>
            <tbody>
              {titles.map((item) => (
                <tr key={item.titleId}>
                  <td>{item.title}</td>
                  <td className="num">{item.queueLength}</td>
                  <td className="mono">{item.trend.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="viz-empty">{t('viz.reservationPressure.empty')}</p>
      )}
    </VizChartFrame>
  );
}
