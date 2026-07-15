import { useMemo, useState } from 'react';
import { Boxes } from 'lucide-react';
import type { ViewId } from '../types';
import { t } from '../i18n';
import { useVizData } from '../services/vizData';
import { VizChartFrame } from './VizChartFrame';
import './viz.css';

// #4 서가 온도 — docs/VIZ.md V1 표 4행. school-patch-v1/Code.gs computeShelfHeatmapViz_가
// 서가(shelf_code)별 소장본 수·누적 대출 건수·평균 대출/권을 이미 계산해 두었다. 여기서는
// 서가마다 작은 타일(색 = 순차 램프, LoanHeatmap.tsx의 levelForCount와 같은 5단 버킷 관례)을
// CSS 그리드로 늘어놓는다 — ClassParticipation.tsx의 「CSS 그리드 + 타일마다 작은 SVG」 구조를
// 그대로 재사용한 것(정확한 물리적 서가 좌표 데이터가 없어 진짜 배치도 대신 이 근사를 쓴다,
// docs/ASSUMPTIONS.md todo/19).
//
// "죽은 구역"(회전율이 가장 낮은 버킷, level 0)은 색만으로 표시하지 않고 타일 테두리를
// 점선으로도 강조한다 — 색만으로 구분하지 않는 것이 접근성에 더 낫다는 일반 원칙을 여기서도
// 적용했다(예산 그림 BudgetPicture.tsx는 이 원칙을 인쇄 호환이라는 별도 요구사항 때문에
// 반드시 지켜야 해서 더 적극적으로 썼다 — 취지는 같다).
//
// 행동 버튼은 장서점검(inventory) 뷰로 연결한다 — "죽은 구역을 찾았다"는 관찰 다음의 가장
// 직접적인 다음 행동이 그 서가를 다시 훑어보는 점검 세션이기 때문이다(어떤 서가인지 특정해
// 넘길 파라미터 계약은 아직 inventory 뷰에 없어 세션 시작 화면으로만 이동한다).

interface ShelfHeatmapProps {
  onNavigate?: (viewId: ViewId, params?: Record<string, unknown>) => void;
}

function levelForAvg(avg: number, maxAvg: number): number {
  if (avg <= 0 || maxAvg <= 0) return 0;
  const ratio = avg / maxAvg;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

const TILE_W = 84;
const TILE_H = 60;

export default function ShelfHeatmap({ onNavigate }: ShelfHeatmapProps) {
  const { loading, data, sample, computedAt, error } = useVizData('shelf-heatmap');
  const [showTable, setShowTable] = useState(false);

  const tiles = useMemo(() => {
    const shelves = data?.shelves ?? [];
    const maxAvg = shelves.reduce((m, s) => Math.max(m, s.avgLoansPerCopy), 0);
    return shelves.map((s) => {
      const level = levelForAvg(s.avgLoansPerCopy, maxAvg);
      return { ...s, level, isDead: level === 0 };
    });
  }, [data]);

  const footer = (
    <button type="button" className="ghost viz-action-btn" onClick={() => onNavigate?.('inventory')}>
      <Boxes size={14} aria-hidden /> {t('viz.shelfHeatmap.actionButton')}
    </button>
  );

  return (
    <VizChartFrame
      title={t('viz.shelfHeatmap.title')}
      subtitle={t('viz.shelfHeatmap.subtitle')}
      sample={sample}
      loading={loading}
      error={error}
      computedAtText={computedAt || undefined}
      footer={onNavigate ? footer : undefined}
    >
      {tiles.length > 0 ? (
        <>
          <div className="viz-shelf-grid" aria-hidden={showTable}>
            {tiles.map((tile) => (
              <svg
                key={tile.shelfCode}
                width={TILE_W}
                height={TILE_H}
                viewBox={`0 0 ${TILE_W} ${TILE_H}`}
                role="img"
                aria-hidden="true"
                className={tile.isDead ? 'viz-shelf-tile viz-shelf-tile--dead' : 'viz-shelf-tile'}
              >
                <rect x={1} y={1} width={TILE_W - 2} height={TILE_H - 2} rx={4} fill={`var(--viz-seq-${tile.level + 1})`}>
                  <title>
                    {`${tile.shelfCode} · ${t('viz.shelfHeatmap.colAvg')} ${tile.avgLoansPerCopy.toFixed(1)} · ${t('viz.shelfHeatmap.colCopyCount')} ${tile.copyCount}`}
                  </title>
                </rect>
                <text x={TILE_W / 2} y={22} textAnchor="middle" className="viz-shelf-tile-code">
                  {tile.shelfCode}
                </text>
                <text x={TILE_W / 2} y={40} textAnchor="middle" className="viz-shelf-tile-avg">
                  {tile.avgLoansPerCopy.toFixed(1)}
                </text>
              </svg>
            ))}
          </div>
          <div className="viz-legend-scale">
            <span>{t('viz.shelfHeatmap.legendLow')}</span>
            {[1, 2, 3, 4, 5].map((step) => (
              <span key={step} className="viz-legend-swatch" style={{ background: `var(--viz-seq-${step})` }} />
            ))}
            <span>{t('viz.shelfHeatmap.legendHigh')}</span>
            <button type="button" className="ghost viz-table-toggle" onClick={() => setShowTable((v) => !v)}>
              {showTable ? t('viz.common.hideTable') : t('viz.common.showTable')}
            </button>
          </div>
          {data && data.skippedNoShelf > 0 && (
            <p className="viz-computed-at">{t('viz.shelfHeatmap.skippedLine', { count: data.skippedNoShelf })}</p>
          )}
          <table className={showTable ? 'viz-table' : 'viz-table viz-sr-only'}>
            <caption className={showTable ? undefined : 'viz-sr-only'}>{t('viz.shelfHeatmap.tableCaption')}</caption>
            <thead>
              <tr>
                <th>{t('viz.shelfHeatmap.colShelf')}</th>
                <th className="num">{t('viz.shelfHeatmap.colCopyCount')}</th>
                <th className="num">{t('viz.shelfHeatmap.colLoanCount')}</th>
                <th className="num">{t('viz.shelfHeatmap.colAvg')}</th>
              </tr>
            </thead>
            <tbody>
              {tiles.map((tile) => (
                <tr key={tile.shelfCode}>
                  <td>{tile.shelfCode}</td>
                  <td className="num">{tile.copyCount}</td>
                  <td className="num">{tile.totalLoanCount}</td>
                  <td className="num">{tile.avgLoansPerCopy.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="viz-empty">{t('viz.shelfHeatmap.empty')}</p>
      )}
    </VizChartFrame>
  );
}
