import type { ReactNode } from 'react';
import { SampleDataBadge } from '../components/SampleDataBadge';
import { t } from '../i18n';
import './viz.css';

interface VizChartFrameProps {
  title: string;
  subtitle: string;
  sample: boolean;
  loading: boolean;
  error: string | null;
  computedAtText?: string;
  children: ReactNode;
  /** 「그래서 뭘 하나」 버튼(VIZ.md 원칙 ③) — 자연스러운 목적지가 아직 없으면 생략 가능(문서화). */
  footer?: ReactNode;
}

/**
 * 차트 4종 공용 헤더/빈 상태/오류/집계 시각 chrome — src/viz/**는 views/shells/student
 * 밖이라 ADR-023 i18n 린트 대상은 아니지만, ScanCameraStart.tsx·PrintDocument.tsx와 같은
 * 관례로 UI 카피는 그대로 t()를 쓴다(제목·부제 문자열 자체는 호출측이 t()로 만들어 넘긴다).
 */
export function VizChartFrame({ title, subtitle, sample, loading, error, computedAtText, children, footer }: VizChartFrameProps) {
  return (
    <div className="viz-card panel">
      <div className="viz-card-header">
        <div className="viz-title-group">
          <h3>{title}</h3>
          <p className="viz-subtitle">{subtitle}</p>
        </div>
        {sample && <SampleDataBadge />}
      </div>

      {loading && <p className="viz-empty">{t('common.loading')}</p>}
      {error && (
        <p className="viz-error" role="alert">
          {t('viz.common.fetchError', { message: error })}
        </p>
      )}
      {!loading && !error && children}

      {computedAtText && <p className="viz-computed-at">{t('viz.common.computedAt', { time: computedAtText })}</p>}
      {footer && <div className="viz-card-footer">{footer}</div>}
    </div>
  );
}
