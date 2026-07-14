import { useEffect } from 'react';
import type { ViewProps } from '../../types';
import { getViewMeta } from '../../registry';

// 도서 상세 뷰 — 스텁. 완전 구현은 이후 라운드.
// params로 {titleId?, barcode?}를 받을 수 있다고 가정하고 받은 값을 그대로 보여주기만 한다 —
// 실제 조회는 하지 않는다(doPost에 그런 액션이 없다: lookupIsbn/registerByIsbn뿐).
export default function BookDetailView({ shell, params }: ViewProps) {
  useEffect(() => {
    shell.setTitle(getViewMeta('book-detail')?.title ?? '도서 상세');
  }, [shell]);

  const titleId = typeof params.titleId === 'string' ? params.titleId : undefined;
  const barcode = typeof params.barcode === 'string' ? params.barcode : undefined;

  return (
    <div className="panel" style={{ padding: 20 }}>
      <p>도서 상세는 곧 제공됩니다.</p>
      <dl style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-2)' }}>
        <dt>titleId</dt>
        <dd className="mono">{titleId ?? '(없음)'}</dd>
        <dt style={{ marginTop: 6 }}>barcode</dt>
        <dd className="mono">{barcode ?? '(없음)'}</dd>
      </dl>
    </div>
  );
}
