import { useEffect } from 'react';
import type { ViewProps } from '../../types';
import { getViewMeta } from '../../registry';
import { t } from '../../i18n';

// 통합 검색 뷰 — 스텁. 완전 구현은 이후 라운드(이 항목의 범위는 catalog 뷰뿐 — search 자체는
// todo/08 목록에 없다, docs/ASSUMPTIONS.md todo/08 참고).
// 실 구현은 services/catalog.ts(IndexedDB 카탈로그 미러 검색, "검색은 브라우저에서, GAS 0회")를
// 그대로 재사용할 예정이다 — catalog.ts는 todo/08에서 catalogSync 액션(doPost에 이미 wired,
// school-patch-v1/Code.gs apiWebCatalogSync_)으로 채워지는 COPY 단위 미러로 재설계됐으므로,
// 이 뷰가 구현될 때는 services/catalog.ts의 useCatalogSync()/getCatalogState()에서 바로
// 검색하면 된다(더 이상 백엔드 공백이 아니다).
export default function SearchView({ shell }: ViewProps) {
  useEffect(() => {
    shell.setTitle(getViewMeta('search')?.title ?? t('registry.search.title'));
  }, [shell]);

  return (
    <div className="panel" style={{ padding: 20 }}>
      <p>{t('views.search.comingSoon')}</p>
      <p style={{ marginTop: 8, fontSize: 'var(--fs-sm)', color: 'var(--ink-3)' }}>{t('views.search.comingSoonDetail')}</p>
    </div>
  );
}
