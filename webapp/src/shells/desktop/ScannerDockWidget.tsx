import { useCallback, useEffect, useRef, useState } from 'react';
import { cameraService, type CameraStatus } from '../../services/camera';

// 우하단 고정 스캐너 도크 — 닫기 불가(접기만). DesktopShell 루트에 마운트되어
// 데스크톱 셸이 사는 동안 카메라 ref-count를 계속 쥐고 있는다("카메라는 창이 아니다").
export function ScannerDockWidget() {
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState<CameraStatus>(() => cameraService.getStatus());
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    cameraService.acquire();
    const unsubscribe = cameraService.onStatus(setStatus);
    return () => {
      unsubscribe();
      cameraService.release();
    };
  }, []);

  // 접기/펼치기 토글마다 <video>가 통째로 마운트/언마운트된다(아래 조건부 렌더) — status.state가
  // 이미 'active'로 안 바뀌는 재펼침 케이스를 놓치지 않도록, effect 대신 ref 콜백에서 직접 붙인다.
  const attachVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el) cameraService.attachPreview(el);
  }, []);

  useEffect(() => {
    if (status.state === 'active' && videoRef.current) {
      cameraService.attachPreview(videoRef.current);
    }
  }, [status.state]);

  const dotColor =
    status.state === 'active'
      ? 'var(--pass)'
      : status.state === 'error'
        ? 'var(--fail)'
        : status.state === 'starting'
          ? 'var(--wait)'
          : 'var(--idle)';

  return (
    <div className={`scanner-dock${collapsed ? ' is-collapsed' : ''}`}>
      <button
        type="button"
        className="scanner-dock__toggle"
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? '스캐너 펼치기' : '스캐너 접기'}
      >
        <span className="scanner-dock__dot" style={{ background: dotColor }} aria-hidden />
        {!collapsed && <span className="scanner-dock__label">스캐너</span>}
      </button>
      {!collapsed && (
        <div className="scanner-dock__body">
          <video ref={attachVideoRef} className="scanner-dock__preview" autoPlay muted playsInline />
          <p className="scanner-dock__status">{statusText(status)}</p>
        </div>
      )}
    </div>
  );
}

function statusText(status: CameraStatus): string {
  switch (status.state) {
    case 'active':
      return status.decoder === 'native' ? '스캔 중 (내장 디코더)' : '스캔 중 (ZXing)';
    case 'starting':
      return '카메라 준비 중…';
    case 'error':
      return status.message ?? '카메라 오류';
    default:
      return '대기 중';
  }
}
