import { useEffect } from 'react';
import type { ViewProps } from '../../types';
import { getViewMeta } from '../../registry';
import { ScanCameraStart } from '../../components/ScanCameraStart';
import { t } from '../../i18n';

// 장서 점검 뷰 — 스텁. 완전 구현은 이후 라운드(이 항목의 범위는 catalog 뷰뿐 — inventory 자체는
// todo/08 목록에 없다, docs/ASSUMPTIONS.md todo/08 참고).
// 실 구현은 services/catalog.ts(IndexedDB 카탈로그 미러)를 대조 기준으로 쓸 예정이다 — catalog.ts는
// todo/08에서 catalogSync 액션(doPost에 이미 wired)으로 채워지는 COPY 단위 미러로 재설계됐으므로
// 더 이상 백엔드 공백이 아니다(school-patch-v1/Code.gs apiWebCatalogSync_).
// scan:'focus' 뷰라 카메라 온디맨드(ADR-020) "뷰 버튼" 시작 트리거는 스텁 단계에서도 미리 심어둔다.
export default function InventoryView({ shell }: ViewProps) {
  useEffect(() => {
    shell.setTitle(getViewMeta('inventory')?.title ?? t('registry.inventory.title'));
  }, [shell]);

  return (
    <div className="panel" style={{ padding: 20 }}>
      <ScanCameraStart viewId="inventory" platform={shell.platform} />
      <p>{t('views.inventory.comingSoon')}</p>
      <p style={{ marginTop: 8, fontSize: 'var(--fs-sm)', color: 'var(--ink-3)' }}>{t('views.inventory.comingSoonDetail')}</p>
    </div>
  );
}
