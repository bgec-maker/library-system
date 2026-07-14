import { useEffect } from 'react';
import type { ViewProps } from '../../types';
import { getViewMeta } from '../../registry';
import { t } from '../../i18n';

// 리포트 허브 — 스텁. FEATURES.md R1 "종류 선택 → 미리보기 → 인쇄"의 실제 구현은 todo/05.
// 대시보드 「조용한 신호」(shells/desktop/DashboardBaseLayer.tsx)가 이미 이 뷰로
// `shell.open('reports', { type: <reportType> })` 형태로 직행하므로, 신호 버튼이 죽은
// 버튼이 되지 않도록 레지스트리·라우팅 골격만 지금 만들어 둔다.
export default function ReportsView({ shell, params }: ViewProps) {
  useEffect(() => {
    shell.setTitle(getViewMeta('reports')?.title ?? t('registry.reports.title'));
  }, [shell]);

  const requestedType = typeof params.type === 'string' ? params.type : null;

  return (
    <div className="panel" style={{ padding: 20 }}>
      <p>{t('views.reports.comingSoon')}</p>
      {requestedType && (
        <p className="mono" style={{ marginTop: 8, fontSize: 'var(--fs-sm)', color: 'var(--ink-3)' }}>
          {t('views.reports.requestedType', { type: requestedType })}
        </p>
      )}
    </div>
  );
}
