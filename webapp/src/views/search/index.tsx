import { useEffect } from 'react';
import type { ViewProps } from '../../types';
import { getViewMeta } from '../../registry';

// 통합 검색 뷰 — 스텁. 완전 구현은 이후 라운드.
// 실 구현은 services/catalog.ts(IndexedDB 카탈로그 미러 검색, "검색은 브라우저에서, GAS 0회")를
// 쓸 예정이지만, 미러를 채울 서버 액션(syncCatalog)이 아직 doPost에 없어
// catalog.ts의 syncFromServer()는 UNKNOWN_ACTION을 그대로 반환한다(백엔드 공백, 이번 범위 밖).
export default function SearchView({ shell }: ViewProps) {
  useEffect(() => {
    shell.setTitle(getViewMeta('search')?.title ?? '통합 검색');
  }, [shell]);

  return (
    <div className="panel" style={{ padding: 20 }}>
      <p>통합 검색은 곧 제공됩니다.</p>
      <p style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-3)' }}>
        카탈로그 미러 검색 화면이 이 자리에 들어갈 예정입니다.
      </p>
    </div>
  );
}
