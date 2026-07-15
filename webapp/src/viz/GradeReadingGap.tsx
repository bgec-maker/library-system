import { useMemo, useState } from 'react';
import type { ViewId } from '../types';
import { t } from '../i18n';
import { useVizData } from '../services/vizData';
import { VizChartFrame } from './VizChartFrame';
import './viz.css';

// #9 학년 독서 격차 — docs/VIZ.md V1 표 9행. school-patch-v1/Code.gs computeGradeReadingGapViz_가
// 최근 180일(≈한 학기, 그 함수 주석 참고) 대출 건수를 학생별로 4단 버킷(0회·1~3회·4~10회·
// 11회+)으로 나눠 학년별 분포를 이미 계산해 두었다. "분포 스트립"(VIZ.md 원문)을 학년마다 한
// 줄씩 100% 적층 가로 막대로 그린다 — 버킷은 "적음↔많음"이라는 단일 축의 순서형 범주라
// 순차 램프(--viz-seq-1~4, LoanHeatmap.tsx의 5단 버킷 관례와 같은 축, 여기는 서버가 4단으로
// 이미 나눠 보내 4단만 쓴다)를 배정한다 — 0회 버킷이 가장 옅은 색(paper에 가까움)인 것 자체가
// "비어 있음"을 시각적으로 대변한다.
//
// "담임 리포트로 직행"은 카드 전체에 버튼 하나를 다는 대신 학년(행) 하나하나를 클릭 가능한
// 버튼으로 만든다 — ClassParticipation.tsx(반 참여 링)가 이미 쓴 것과 같은 이유(카드 전체
// 버튼 하나로는 "몇 학년"인지 특정할 수 없어 "직행"이 안 된다)와 같은 패턴. 다만 이 차트는
// 학년 단위 집계라 반(classNo)까지는 특정할 수 없으므로 grade만 넘긴다 —
// views/reports/index.tsx의 HomeroomReportPanel은 initialClassNo가 없으면 자동 미리보기는
// 건너뛰고 학년 칸만 채운 채 기본 1반으로 대기한다(기존 동작 그대로, 새 코드 변경 없음).

interface GradeReadingGapProps {
  onNavigate?: (viewId: ViewId, params?: Record<string, unknown>) => void;
}

// 순차 램프 4단(적음→많음) — 서버 buckets 배열(항상 4단)과 인덱스로 대응.
const BUCKET_TOKENS = ['--viz-seq-1', '--viz-seq-2', '--viz-seq-3', '--viz-seq-4'];

const STRIP_W = 220;
const STRIP_H = 20;

export default function GradeReadingGap({ onNavigate }: GradeReadingGapProps) {
  const { loading, data, sample, computedAt, error } = useVizData('grade-reading-gap');
  const [showTable, setShowTable] = useState(false);

  const rows = useMemo(() => {
    const grades = data?.grades ?? [];
    return grades.map((g) => {
      let x = 0;
      const segments = g.bucketCounts.map((count, i) => {
        const w = g.studentCount > 0 ? (count / g.studentCount) * STRIP_W : 0;
        const seg = { bucketIndex: i, count, x, w };
        x += w;
        return seg;
      });
      return { ...g, segments };
    });
  }, [data]);

  return (
    <VizChartFrame
      title={t('viz.gradeReadingGap.title')}
      subtitle={t('viz.gradeReadingGap.subtitle')}
      sample={sample}
      loading={loading}
      error={error}
      computedAtText={computedAt || undefined}
    >
      {rows.length > 0 ? (
        <>
          <div className="viz-grade-strip-list" aria-hidden={showTable}>
            {rows.map((row) => (
              <button
                key={row.grade}
                type="button"
                className="viz-grade-strip-row"
                disabled={!onNavigate}
                onClick={() => onNavigate?.('reports', { type: 'homeroom-report', grade: row.grade })}
                title={t('viz.gradeReadingGap.rowTitle', { grade: row.grade, count: row.studentCount })}
              >
                <span className="viz-grade-strip-label">{t('viz.gradeReadingGap.gradeLabel', { grade: row.grade })}</span>
                <svg width={STRIP_W} height={STRIP_H} viewBox={`0 0 ${STRIP_W} ${STRIP_H}`} role="img" aria-hidden="true">
                  {row.segments.map((seg) =>
                    seg.w > 0 ? (
                      <rect
                        key={seg.bucketIndex}
                        x={seg.x}
                        y={1}
                        width={seg.w}
                        height={STRIP_H - 2}
                        fill={`var(${BUCKET_TOKENS[seg.bucketIndex] ?? '--viz-seq-1'})`}
                      >
                        <title>{`${data?.buckets[seg.bucketIndex] ?? ''} · ${seg.count}`}</title>
                      </rect>
                    ) : null
                  )}
                </svg>
                <span className="viz-grade-strip-count">{row.studentCount}</span>
              </button>
            ))}
          </div>
          <div className="viz-legend-scale">
            {(data?.buckets ?? []).map((label, i) => (
              <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span className="viz-legend-swatch" style={{ background: `var(${BUCKET_TOKENS[i] ?? '--viz-seq-1'})` }} />
                {label}
              </span>
            ))}
            <button type="button" className="ghost viz-table-toggle" onClick={() => setShowTable((v) => !v)}>
              {showTable ? t('viz.common.hideTable') : t('viz.common.showTable')}
            </button>
          </div>
          {data && <p className="viz-computed-at">{t('viz.gradeReadingGap.sinceLine', { date: data.sinceDate })}</p>}
          <table className={showTable ? 'viz-table' : 'viz-table viz-sr-only'}>
            <caption className={showTable ? undefined : 'viz-sr-only'}>{t('viz.gradeReadingGap.tableCaption')}</caption>
            <thead>
              <tr>
                <th>{t('viz.gradeReadingGap.colGrade')}</th>
                {(data?.buckets ?? []).map((label) => (
                  <th key={label} className="num">
                    {label}
                  </th>
                ))}
                <th className="num">{t('viz.gradeReadingGap.colStudentCount')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.grade}>
                  <td>{t('viz.gradeReadingGap.gradeLabel', { grade: row.grade })}</td>
                  {row.bucketCounts.map((count, i) => (
                    <td key={i} className="num">
                      {count}
                    </td>
                  ))}
                  <td className="num">{row.studentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="viz-empty">{t('viz.gradeReadingGap.empty')}</p>
      )}
    </VizChartFrame>
  );
}
