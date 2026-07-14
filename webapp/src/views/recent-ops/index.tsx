import { useEffect } from 'react';
import type { ViewProps } from '../../types';
import { getViewMeta } from '../../registry';
import { t } from '../../i18n';

// 최근 처리 뷰 — 스텁. 완전 구현은 이후 라운드.
export default function RecentOpsView({ shell }: ViewProps) {
  useEffect(() => {
    shell.setTitle(getViewMeta('recent-ops')?.title ?? t('registry.recentOps.title'));
  }, [shell]);

  return (
    <div className="panel" style={{ padding: 20 }}>
      <p>{t('views.recentOps.comingSoon')}</p>
    </div>
  );
}
