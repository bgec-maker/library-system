import { useEffect, useState } from 'react';
import { onScanFeedback } from '../services/scanFeedback';

const FLASH_MS = 220;

/** 스캔 성공 시 초록 플래시 — 셸 루트에서 한 번만 마운트(뷰마다 중복 구현 금지, FRONTEND.md). */
export function ScanFlashOverlay() {
  const [on, setOn] = useState(false);

  useEffect(
    () =>
      onScanFeedback((kind) => {
        if (kind !== 'hit') return;
        setOn(true);
        setTimeout(() => setOn(false), FLASH_MS);
      }),
    []
  );

  if (!on) return null;
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--pass)',
        opacity: 0.35,
        pointerEvents: 'none',
        zIndex: 9998,
        transition: 'opacity 120ms ease-out'
      }}
    />
  );
}
