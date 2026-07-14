import { useEffect } from 'react';
import type { ViewProps } from '../../types';
import { getViewMeta } from '../../registry';

// 장서 점검 뷰 — 스텁. 완전 구현은 이후 라운드.
// 실 구현은 services/catalog.ts(IndexedDB 카탈로그 미러)를 대조 기준으로 쓸 예정이지만,
// 미러를 채울 서버 액션(syncCatalog)이 아직 doPost에 없다(백엔드 공백, 이번 범위 밖).
export default function InventoryView({ shell }: ViewProps) {
  useEffect(() => {
    shell.setTitle(getViewMeta('inventory')?.title ?? '장서 점검');
  }, [shell]);

  return (
    <div className="panel" style={{ padding: 20 }}>
      <p>장서 점검은 곧 제공됩니다.</p>
      <p style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-3)' }}>
        스캔 대조 화면이 이 자리에 들어갈 예정입니다.
      </p>
    </div>
  );
}
