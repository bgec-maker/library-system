import { useMemo, useState } from 'react';
import type { ViewId } from '../types';
import { t } from '../i18n';
import { useVizData } from '../services/vizData';
import { VizChartFrame } from './VizChartFrame';
import './viz.css';

// #10 반 참여 링 — docs/VIZ.md V1 표 10행. school-patch-v1/Code.gs computeClassParticipationViz_가
// 반별 "미대출 비율"(noLoanRatio, 최근 90일 — 그 함수 주석 참고)을 이미 계산해 두었다. 이
// 화면은 그 값을 뒤집어(participationRatio = 1 - noLoanRatio) 링을 채운다 — 링이 꽉 찰수록
// "잘 빌리는 반"으로 직관적으로 읽히게 하려는 선택이고, 서버가 내려주는 원 지표(noLoanRatio)
// 자체의 이름·방향은 VIZ.md 문구 그대로 유지한다(docs/ASSUMPTIONS.md todo/18).
//
// 색은 순차 램프(--viz-seq-1~5)를 참여율 구간(0~20%…80~100%)에 배정한다 — LoanHeatmap.tsx의
// levelForCount와 같은 5단 버킷 관례. 참여가 낮을수록 옅고(paper 쪽), 높을수록 짙다(deep 쪽).
//
// "반 참여 링 → 담임 리포트로 직행"(과제 노트가 명시한 목적지)은 링 하나하나를 클릭 가능한
// 버튼으로 만들어 그 반의 grade/classNo를 그대로 담임 리포트로 넘기는 방식으로 구현했다 —
// 전체 카드에 버튼 하나를 다는 대신(어느 반인지 특정할 수 없어 "직행"이 아니게 된다) 반 개수만큼
// 개별 행동 지점을 두는 편이 VIZ.md 원칙 ③("그림 옆엔 항상 행동 버튼")의 취지에 더 맞는다고
// 판단했다. views/reports/index.tsx의 HomeroomReportPanel이 grade/classNo params를 받으면 그
// 값으로 입력칸을 채우고 자동으로 미리보기까지 실행한다(그래야 진짜 "직행"이다).

interface ClassParticipationProps {
  onNavigate?: (viewId: ViewId, params?: Record<string, unknown>) => void;
}

const RING_SIZE = 68;
const RING_STROKE = 8;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

function levelForRatio(ratio: number): number {
  if (ratio <= 0.2) return 0;
  if (ratio <= 0.4) return 1;
  if (ratio <= 0.6) return 2;
  if (ratio <= 0.8) return 3;
  return 4;
}

export default function ClassParticipation({ onNavigate }: ClassParticipationProps) {
  const { loading, data, sample, computedAt, error } = useVizData('class-participation');
  const [showTable, setShowTable] = useState(false);

  const rings = useMemo(() => {
    const classes = data?.classes ?? [];
    return classes.map((cls) => {
      const participationRatio = 1 - cls.noLoanRatio;
      const level = levelForRatio(participationRatio);
      const dash = RING_C * participationRatio;
      return { ...cls, participationRatio, level, dash };
    });
  }, [data]);

  return (
    <VizChartFrame
      title={t('viz.classParticipation.title')}
      subtitle={t('viz.classParticipation.subtitle')}
      sample={sample}
      loading={loading}
      error={error}
      computedAtText={computedAt || undefined}
    >
      {rings.length > 0 ? (
        <>
          <div className="viz-ring-grid" aria-hidden={showTable}>
            {rings.map((cls) => {
              const label = t('viz.classParticipation.classLabel', { grade: cls.grade, classNo: cls.classNo });
              const pct = Math.round(cls.participationRatio * 100);
              return (
                <button
                  key={`${cls.grade}-${cls.classNo}`}
                  type="button"
                  className="viz-ring-btn"
                  disabled={!onNavigate}
                  onClick={() => onNavigate?.('reports', { type: 'homeroom-report', grade: cls.grade, classNo: cls.classNo })}
                  title={t('viz.classParticipation.ringTitle', { label, pct, count: cls.studentCount })}
                >
                  <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} role="img" aria-hidden="true">
                    <circle
                      cx={RING_SIZE / 2}
                      cy={RING_SIZE / 2}
                      r={RING_R}
                      fill="none"
                      stroke="var(--rule)"
                      strokeWidth={RING_STROKE}
                    />
                    <circle
                      cx={RING_SIZE / 2}
                      cy={RING_SIZE / 2}
                      r={RING_R}
                      fill="none"
                      stroke={`var(--viz-seq-${cls.level + 1})`}
                      strokeWidth={RING_STROKE}
                      strokeDasharray={`${cls.dash} ${RING_C - cls.dash}`}
                      strokeLinecap="round"
                      transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                    />
                    <text x={RING_SIZE / 2} y={RING_SIZE / 2 + 4} textAnchor="middle" className="viz-ring-pct">
                      {pct}%
                    </text>
                  </svg>
                  <span className="viz-ring-label">{label}</span>
                </button>
              );
            })}
          </div>
          <div className="viz-legend-scale">
            <span>{t('viz.classParticipation.legendLow')}</span>
            {[1, 2, 3, 4, 5].map((step) => (
              <span key={step} className="viz-legend-swatch" style={{ background: `var(--viz-seq-${step})` }} />
            ))}
            <span>{t('viz.classParticipation.legendHigh')}</span>
            <button type="button" className="ghost viz-table-toggle" onClick={() => setShowTable((v) => !v)}>
              {showTable ? t('viz.common.hideTable') : t('viz.common.showTable')}
            </button>
          </div>
          <table className={showTable ? 'viz-table' : 'viz-table viz-sr-only'}>
            <caption className={showTable ? undefined : 'viz-sr-only'}>{t('viz.classParticipation.tableCaption')}</caption>
            <thead>
              <tr>
                <th>{t('viz.classParticipation.colClass')}</th>
                <th className="num">{t('viz.classParticipation.colStudentCount')}</th>
                <th className="num">{t('viz.classParticipation.colNoLoanCount')}</th>
                <th className="num">{t('viz.classParticipation.colParticipationRatio')}</th>
              </tr>
            </thead>
            <tbody>
              {rings.map((cls) => (
                <tr key={`${cls.grade}-${cls.classNo}`}>
                  <td>{t('viz.classParticipation.classLabel', { grade: cls.grade, classNo: cls.classNo })}</td>
                  <td className="num">{cls.studentCount}</td>
                  <td className="num">{cls.noLoanCount}</td>
                  <td className="num">{Math.round(cls.participationRatio * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="viz-empty">{t('viz.classParticipation.empty')}</p>
      )}
    </VizChartFrame>
  );
}
