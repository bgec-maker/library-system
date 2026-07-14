import { useMemo, useState } from 'react';
import { FileSearch } from 'lucide-react';
import type { ViewId } from '../types';
import { t } from '../i18n';
import { useVizData, type CategoryTreemapEntry } from '../services/vizData';
import { VizChartFrame } from './VizChartFrame';
import './viz.css';

// #3 장서 vs 대출 트리맵 — docs/VIZ.md V1 표 3행. 06_CATEGORIES × 08_COPIES/10_LOANS를 이중
// 트리맵(소장 권수 패널 · 누적 대출 패널)으로 그린다. 두 패널 모두 같은 카테고리를 같은
// 회전율(대출/소장) 색으로 칠해 "면적은 큰데 색은 fail(회전율 낮음)"인 분야를 한눈에 찾게
// 한다 — "많이 갖췄는데 안 나가는 분야는?"에 답하는 직접적인 인코딩(docs/ASSUMPTIONS.md todo/06).
// 색은 발산 램프 --viz-div-1(회전율 낮음)~5(회전율 높음)만 쓴다(DESIGN.md).

interface CategoryTreemapProps {
  /** 「그래서 뭘 하나」 버튼 대상 — 셸(대시보드)이든 뷰(리포트 허브)든 ShellContext.open과
   *  같은 시그니처를 넘겨받는다(src/viz/**는 셸 내부를 직접 import하지 않는다). */
  onNavigate?: (viewId: ViewId, params?: Record<string, unknown>) => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function layoutTreemap<T extends { value: number }>(items: T[], rect: Rect): (T & Rect)[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ ...items[0], ...rect }];
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return items.map((item) => ({ ...item, x: rect.x, y: rect.y, w: 0, h: 0 }));

  // 완전한 squarify 대신 "누적합이 절반에 가장 가까운 지점"에서 이분하는 slice-and-dice
  // 재귀 분할 — 수제 SVG 예산 안에서 충분히 읽히는 트리맵을 만든다(docs/ASSUMPTIONS.md todo/06).
  let splitIdx = 1;
  let bestDiff = Infinity;
  let acc = 0;
  for (let i = 0; i < items.length - 1; i++) {
    acc += items[i].value;
    const diff = Math.abs(acc - total / 2);
    if (diff < bestDiff) {
      bestDiff = diff;
      splitIdx = i + 1;
    }
  }
  const groupA = items.slice(0, splitIdx);
  const groupB = items.slice(splitIdx);
  const ratioA = groupA.reduce((s, i) => s + i.value, 0) / total;

  if (rect.w >= rect.h) {
    const wA = rect.w * ratioA;
    return [
      ...layoutTreemap(groupA, { x: rect.x, y: rect.y, w: wA, h: rect.h }),
      ...layoutTreemap(groupB, { x: rect.x + wA, y: rect.y, w: rect.w - wA, h: rect.h })
    ];
  }
  const hA = rect.h * ratioA;
  return [
    ...layoutTreemap(groupA, { x: rect.x, y: rect.y, w: rect.w, h: hA }),
    ...layoutTreemap(groupB, { x: rect.x, y: rect.y + hA, w: rect.w, h: rect.h - hA })
  ];
}

const TREEMAP_W = 220;
const TREEMAP_H = 160;

function TreemapSvg({
  entries,
  valueKey,
  divLevelByCode,
  labelKey
}: {
  entries: CategoryTreemapEntry[];
  valueKey: 'copyCount' | 'loanCount';
  divLevelByCode: Record<string, number>;
  labelKey: 'colCopyCount' | 'colLoanCount';
}) {
  const rects = useMemo(
    () => layoutTreemap(entries.map((e) => ({ ...e, value: e[valueKey] })), { x: 0, y: 0, w: TREEMAP_W, h: TREEMAP_H }),
    [entries, valueKey]
  );
  return (
    <svg width="100%" viewBox={`0 0 ${TREEMAP_W} ${TREEMAP_H}`} role="img" aria-hidden="true">
      {rects.map((r) => (
        <g key={r.categoryCode}>
          <rect
            className="viz-treemap-rect"
            x={r.x}
            y={r.y}
            width={Math.max(0, r.w - 1)}
            height={Math.max(0, r.h - 1)}
            fill={`var(--viz-div-${(divLevelByCode[r.categoryCode] ?? 2) + 1})`}
          >
            <title>{`${r.categoryLabel} · ${t(`viz.categoryTreemap.${labelKey}`)} ${r[valueKey]}`}</title>
          </rect>
          {r.w > 42 && r.h > 16 && (
            <text x={r.x + 4} y={r.y + 12} className="viz-treemap-label">
              {r.categoryLabel}
            </text>
          )}
          {r.w > 42 && r.h > 30 && (
            <text x={r.x + 4} y={r.y + 24} className="viz-treemap-label-dim">
              {r[valueKey]}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export default function CategoryTreemap({ onNavigate }: CategoryTreemapProps) {
  const { loading, data, sample, computedAt, error } = useVizData('category-treemap');
  const [showTable, setShowTable] = useState(false);

  const { sorted, divLevelByCode } = useMemo(() => {
    const categories = data?.categories ?? [];
    const ratios = categories.map((c) => (c.copyCount > 0 ? c.loanCount / c.copyCount : 0));
    const sortedRatios = [...ratios].sort((a, b) => a - b);
    const median = sortedRatios.length > 0 ? sortedRatios[Math.floor(sortedRatios.length / 2)] : 0;
    const deltas = ratios.map((r) => r - median);
    const maxAbsDelta = deltas.reduce((m, d) => Math.max(m, Math.abs(d)), 0) || 1;
    const levelByCode: Record<string, number> = {};
    categories.forEach((cat, i) => {
      const norm = deltas[i] / maxAbsDelta; // -1..1
      levelByCode[cat.categoryCode] = Math.min(4, Math.max(0, Math.round(((norm + 1) / 2) * 4)));
    });
    const sortedCats = [...categories].sort((a, b) => b.copyCount - a.copyCount);
    return { sorted: sortedCats, divLevelByCode: levelByCode };
  }, [data]);

  const footer = (
    <button type="button" className="ghost viz-action-btn" onClick={() => onNavigate?.('reports', { type: 'weeding-recommend' })}>
      <FileSearch size={14} aria-hidden /> {t('viz.categoryTreemap.actionButton')}
    </button>
  );

  return (
    <VizChartFrame
      title={t('viz.categoryTreemap.title')}
      subtitle={t('viz.categoryTreemap.subtitle')}
      sample={sample}
      loading={loading}
      error={error}
      computedAtText={computedAt || undefined}
      footer={onNavigate ? footer : undefined}
    >
      {sorted.length > 0 ? (
        <>
          <div className="viz-treemap-pair">
            <div>
              <p className="viz-treemap-heading">{t('viz.categoryTreemap.copyPanelHeading')}</p>
              <TreemapSvg entries={sorted} valueKey="copyCount" divLevelByCode={divLevelByCode} labelKey="colCopyCount" />
            </div>
            <div>
              <p className="viz-treemap-heading">{t('viz.categoryTreemap.loanPanelHeading')}</p>
              <TreemapSvg entries={sorted} valueKey="loanCount" divLevelByCode={divLevelByCode} labelKey="colLoanCount" />
            </div>
          </div>
          <div className="viz-legend-scale">
            <span className="viz-div-legend">
              {[1, 2, 3, 4, 5].map((step) => (
                <span key={step} className="viz-legend-swatch" style={{ background: `var(--viz-div-${step})` }} />
              ))}
            </span>
            <button type="button" className="ghost viz-table-toggle" onClick={() => setShowTable((v) => !v)}>
              {showTable ? t('viz.common.hideTable') : t('viz.common.showTable')}
            </button>
          </div>
          <table className={showTable ? 'viz-table' : 'viz-table viz-sr-only'}>
            <caption className={showTable ? undefined : 'viz-sr-only'}>{t('viz.categoryTreemap.tableCaption')}</caption>
            <thead>
              <tr>
                <th>{t('viz.categoryTreemap.colCategory')}</th>
                <th className="num">{t('viz.categoryTreemap.colCopyCount')}</th>
                <th className="num">{t('viz.categoryTreemap.colLoanCount')}</th>
                <th className="num">{t('viz.categoryTreemap.colRatio')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((cat) => (
                <tr key={cat.categoryCode}>
                  <td>{cat.categoryLabel}</td>
                  <td className="num">{cat.copyCount}</td>
                  <td className="num">{cat.loanCount}</td>
                  <td className="num">{cat.copyCount > 0 ? (cat.loanCount / cat.copyCount).toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="viz-empty">{t('viz.categoryTreemap.empty')}</p>
      )}
    </VizChartFrame>
  );
}
