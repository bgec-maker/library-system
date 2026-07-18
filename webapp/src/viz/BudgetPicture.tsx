import { useMemo, useState } from 'react';
import { intlLocaleTag, t } from '../i18n';
import { useVizData } from '../services/vizData';
import { VizChartFrame } from './VizChartFrame';
import './viz.css';

// #11 예산 그림 — docs/VIZ.md V1 표 11행. school-patch-v1/Code.gs computeBudgetViz_가 이미
// 연도별 × 출처별(상위 5개 + "그 외 출처", DESIGN.md 범주(≤6) 고정 팔레트 한도) 입수 단가 합계를
// 계산해 두었다. "적층 영역"(VIZ.md 원문)을 연도(x) × 누적 금액(y)의 스택 밴드로 그린다.
// 색은 DESIGN.md 범주 고정 순서(deep·brass·pass·wait·ink-2·fail)를 sourceOrder 인덱스 그대로
// 배정한다(CategoryTreemap.tsx의 발산 램프 대신 여기서는 "출처"가 이름 나열형 범주라 범주
// 고정 순서를 쓴다 — TurnoverQuadrant.tsx의 4분류와 같은 종류의 선택).
//
// ⚠ 인쇄 호환(todo/19 과제 노트 — 이 항목은 todo/24 R3 연간 운영 보고서가 "예산 차트(19) 삽입"을
// 예고한 재료다): 인쇄에는 hover가 없다. 그래서 이 컴포넌트는 다른 7종처럼 <title> 툴팁에만
// 의존하지 않고 (1) 각 밴드 오른쪽 끝에 출처명을 직접 텍스트로 라벨링하고, (2) 밴드 사이에
// var(--panel) 테두리를 그어(CategoryTreemap.tsx의 rect stroke 관례 재사용) 색이 인쇄에서
// 뭉개져도 경계가 보이게 하며, (3) 범례 자체도 스와치+출처명+합계 금액을 항상 텍스트로 함께
// 보여준다(색만으로 구분하지 않음). 그래도 화면이 완전히 washed out되는 극단적 경우를 대비해
// sr-only <table> 대체(모든 연도×출처 숫자를 그대로 담음)는 그대로 유지한다 — DESIGN.md
// "인쇄" 절 자체가 이미 인쇄 밀집 콘텐츠는 표 중심으로 간다고 전제하므로, 표 하나만으로도
// 이 차트가 전달하는 정보가 전부 보존된다(styles/print.css는 .print-root 안 어떤 <table>이든
// border-color를 검정으로 강제해 항상 읽힌다 — PrintDocument.tsx/print.css는 읽기 전용
// 참고로만 확인했고 이 항목에서 손대지 않았다).
//
// 행동 버튼 없음(의도적 예외, VIZ.md 원칙 ③) — 이 차트의 "그래서 뭘 하나"는 화면 안 이동이
// 아니라 todo/24가 만들 인쇄 보고서에 그대로 삽입되는 것 자체다. 그 리포트가 아직 없어(todo
// 범위 밖) 지금 누를 수 있는 버튼이 없다 — LoanHeatmap.tsx/LoanTimeOfDay.tsx/
// MonthlyLoanCurve.tsx가 이미 쓴 것과 같은 등급의 예외다(docs/ASSUMPTIONS.md todo/19).

// DESIGN.md 범주(≤6) 고정 순서 — sourceOrder(서버, 상위 5+기타 하나, 항상 ≤6) 인덱스와 대응.
const SOURCE_TOKENS = ['--deep', '--brass', '--pass', '--wait', '--ink-2', '--fail'];

const CHART_W = 320;
const CHART_H = 200;
const MARGIN_LEFT = 34;
const MARGIN_BOTTOM = 18;
const MARGIN_TOP = 10;
// todo/104 — 라벨 슬롯: 사용자 캡처에서 「학교 운영ㅂ」처럼 우측 라벨이 viewBox 경계에
// 잘렸다. 슬롯을 70으로 넓히고(아래), 그래도 넘치는 자유 텍스트 출처명은 5자+…로 줄인다 —
// 전체 명칭·금액은 범례와 sr 표가 항상 온전히 제공하므로 밴드 라벨은 "가리키는 손가락"만 하면 된다.
const MARGIN_RIGHT = 70;
const BAND_LABEL_MAX_CHARS = 6;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(intlLocaleTag(), { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount);
}

export default function BudgetPicture() {
  const { loading, data, sample, computedAt, error } = useVizData('budget-picture');
  const [showTable, setShowTable] = useState(false);

  const layout = useMemo(() => {
    if (!data || data.years.length === 0) return null;
    const sourceOrder = data.sourceOrder;
    // 연도가 딱 하나뿐이면 "영역"을 그릴 폭이 없다 — 같은 값을 좌우 끝에 복제해 평평한 밴드로
    // 대체 렌더한다(퇴화 케이스 방어, docs/ASSUMPTIONS.md todo/19).
    const years = data.years.length === 1 ? [data.years[0], data.years[0]] : data.years;
    const n = years.length;
    const maxTotal = Math.max(1, ...years.map((y) => y.total));
    const plotW = CHART_W - MARGIN_LEFT - MARGIN_RIGHT;
    const plotH = CHART_H - MARGIN_TOP - MARGIN_BOTTOM;
    const stepX = n > 1 ? plotW / (n - 1) : 0;
    const xs = years.map((_, i) => MARGIN_LEFT + i * stepX);

    const bands = sourceOrder.map((label, bi) => {
      let bottom = new Array(n).fill(0);
      for (let k = 0; k < bi; k++) {
        bottom = bottom.map((v, i) => v + (years[i].sources[k]?.amount ?? 0));
      }
      const top = bottom.map((v, i) => v + (years[i].sources[bi]?.amount ?? 0));
      const toY = (v: number) => MARGIN_TOP + plotH - (v / maxTotal) * plotH;
      const topPoints = xs.map((x, i) => `${x.toFixed(1)},${toY(top[i]).toFixed(1)}`);
      const bottomPoints = xs
        .map((x, i) => `${x.toFixed(1)},${toY(bottom[i]).toFixed(1)}`)
        .reverse();
      const path = `M${topPoints.join(' L')} L${bottomPoints.join(' L')} Z`;
      // 범례 합계는 화면 렌더용으로 복제된 `years`가 아니라 원본 data.years에서 직접 합산한다
      // (연도 1개뿐일 때 복제된 두 항목을 그대로 더하면 두 배로 셈해지는 걸 피한다).
      const totalAmount = data.years.reduce((s, y) => s + (y.sources[bi]?.amount ?? 0), 0);
      const lastMidY = toY((top[n - 1] + bottom[n - 1]) / 2);
      const labelShort = label.length > BAND_LABEL_MAX_CHARS ? `${label.slice(0, BAND_LABEL_MAX_CHARS - 1)}…` : label;
      return { label, labelShort, path, token: SOURCE_TOKENS[bi] ?? '--deep', totalAmount, lastMidY };
    });

    // todo/104 — 얇은 인접 밴드(그 외 출처·외부 공모…)의 라벨이 세로로 겹치던 것: 위에서부터
    // 최소 11px 간격을 강제(라벨 y만 밀고 밴드 기하는 그대로).
    const MIN_LABEL_GAP = 11;
    let prevY = -Infinity;
    const bandsWithLabelY = bands
      .slice()
      .sort((a, b) => a.lastMidY - b.lastMidY)
      .map((band) => {
        const labelY = Math.max(band.lastMidY, prevY + MIN_LABEL_GAP);
        prevY = labelY;
        return { band, labelY };
      });
    const labelYByLabel = new Map(bandsWithLabelY.map(({ band, labelY }) => [band.label, labelY]));

    return {
      bands: bands.map((band) => ({ ...band, labelY: labelYByLabel.get(band.label) ?? band.lastMidY })),
      years,
      xs,
      yearLabels: data.years.map((y) => y.year)
    };
  }, [data]);

  return (
    <VizChartFrame
      title={t('viz.budgetPicture.title')}
      subtitle={t('viz.budgetPicture.subtitle')}
      sample={sample}
      loading={loading}
      error={error}
      computedAtText={computedAt || undefined}
    >
      {layout && layout.bands.length > 0 ? (
        <>
          <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-hidden="true">
            <line
              x1={MARGIN_LEFT}
              y1={CHART_H - MARGIN_BOTTOM}
              x2={CHART_W - MARGIN_RIGHT}
              y2={CHART_H - MARGIN_BOTTOM}
              stroke="var(--rule)"
            />
            {layout.bands.map((band) => (
              <path key={band.label} d={band.path} className="viz-budget-band" fill={`var(${band.token})`} />
            ))}
            {/* 밴드 오른쪽 끝에 출처명을 직접 라벨링 — 인쇄(hover 없음)에서도 색만으로 구분하지
                않도록 항상 보이는 텍스트를 남긴다(위 컴포넌트 주석 참고). */}
            {layout.bands.map((band) => (
              <text key={band.label} x={CHART_W - MARGIN_RIGHT + 4} y={band.labelY + 3} className="viz-budget-band-label">
                {band.labelShort}
              </text>
            ))}
            {layout.yearLabels.map((year, i) => (
              <text
                key={year}
                x={MARGIN_LEFT + i * (layout.xs.length > 1 ? (CHART_W - MARGIN_LEFT - MARGIN_RIGHT) / (layout.xs.length - 1) : 0)}
                y={CHART_H - 4}
                className="viz-bar-axis-label"
              >
                {year}
              </text>
            ))}
          </svg>
          {/* 범례 = 스와치 + 출처명 + 합계 금액을 항상 텍스트로 표시(색만으로 구분하지 않음 —
              인쇄 호환 요구사항, 위 컴포넌트 주석 참고). */}
          <ul className="viz-budget-legend">
            {layout.bands.map((band) => (
              <li key={band.label}>
                <span className="viz-legend-swatch" style={{ background: `var(${band.token})` }} />
                <span className="viz-budget-legend-label">{band.label}</span>
                <span className="viz-budget-legend-amount">{formatCurrency(band.totalAmount)}</span>
              </li>
            ))}
          </ul>
          <div className="viz-legend-scale">
            <button type="button" className="ghost viz-table-toggle" onClick={() => setShowTable((v) => !v)}>
              {showTable ? t('viz.common.hideTable') : t('viz.common.showTable')}
            </button>
          </div>
          {data && (data.skippedNoSource > 0 || data.skippedNoAcquiredDate > 0) && (
            <p className="viz-computed-at">
              {t('viz.budgetPicture.skippedLine', { source: data.skippedNoSource, date: data.skippedNoAcquiredDate })}
            </p>
          )}
          <table className={showTable ? 'viz-table' : 'viz-table viz-sr-only'}>
            <caption className={showTable ? undefined : 'viz-sr-only'}>{t('viz.budgetPicture.tableCaption')}</caption>
            <thead>
              <tr>
                <th>{t('viz.budgetPicture.colYear')}</th>
                {(data?.sourceOrder ?? []).map((label) => (
                  <th key={label} className="num">
                    {label}
                  </th>
                ))}
                <th className="num">{t('viz.budgetPicture.colTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.years ?? []).map((y) => (
                <tr key={y.year}>
                  <td className="mono">{y.year}</td>
                  {y.sources.map((s) => (
                    <td key={s.sourceLabel} className="num">
                      {formatCurrency(s.amount)}
                    </td>
                  ))}
                  <td className="num">{formatCurrency(y.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="viz-empty">{t('viz.budgetPicture.empty')}</p>
      )}
    </VizChartFrame>
  );
}
