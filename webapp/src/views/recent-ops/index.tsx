import { useEffect } from 'react';
import type { ViewProps } from '../../types';
import { getViewMeta } from '../../registry';

// 최근 처리 뷰 — 스텁. 완전 구현은 이후 라운드.
export default function RecentOpsView({ shell }: ViewProps) {
  useEffect(() => {
    shell.setTitle(getViewMeta('recent-ops')?.title ?? '최근 처리');
  }, [shell]);

  return (
    <div className="panel" style={{ padding: 20 }}>
      <p>최근 처리 목록은 곧 제공됩니다.</p>
    </div>
  );
}
