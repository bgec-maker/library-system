import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { cameraService, type CameraStatus } from '../../services/camera';
import { cameraSession, type CameraSessionStatus } from '../../services/cameraSession';
import { t } from '../../i18n';

// 우하단 고정 스캐너 도크 — 닫기 불가(접기만). DesktopShell 루트에 마운트되어 데스크톱 셸이 사는
// 동안 계속 떠 있는다("카메라는 창이 아니다"). ADR-020(온디맨드 반전) 이후로는 마운트 시 자동으로
// acquire()하지 않는다 — cameraSession이 시작/종료 정책을 갖고, 이 위젯은 그 상태를 보여주고
// (session.running 여부에 따라 시작 버튼 ↔ 미리보기+종료 버튼+연속 모드 핀을 전환) 트리거 중
// 하나("위젯 클릭")를 제공할 뿐이다.
export function ScannerDockWidget() {
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState<CameraStatus>(() => cameraService.getStatus());
  const [session, setSession] = useState<CameraSessionStatus>(() => cameraSession.getStatus());
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => cameraService.onStatus(setStatus), []);
  useEffect(() => cameraSession.onStatus(setSession), []);

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

  const dotColor = !session.running
    ? 'var(--idle)'
    : status.state === 'active'
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
        title={collapsed ? t('shell.desktop.scannerExpand') : t('shell.desktop.scannerCollapse')}
      >
        <span className="scanner-dock__dot" style={{ background: dotColor }} aria-hidden />
        <Camera size={14} aria-hidden />
        {!collapsed && <span className="scanner-dock__label">{t('shell.desktop.scannerLabel')}</span>}
      </button>
      {!collapsed && (
        <div className="scanner-dock__body">
          {session.running ? (
            <>
              <video ref={attachVideoRef} className="scanner-dock__preview" autoPlay muted playsInline />
              <p className="scanner-dock__status">{statusText(status)}</p>
              <label className="scanner-dock__continuous" title={t('camera.continuousModeHint')}>
                <input
                  type="checkbox"
                  checked={session.continuous}
                  onChange={(e) => cameraSession.setContinuous(e.target.checked)}
                />
                {t('camera.continuousMode')}
              </label>
              <button type="button" className="ghost scanner-dock__actionBtn" onClick={() => cameraSession.stop()}>
                {t('shell.desktop.scannerStop')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="scanner-dock__actionBtn"
              onClick={() => cameraSession.start('widget')}
            >
              {t('shell.desktop.scannerStart')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function statusText(status: CameraStatus): string {
  switch (status.state) {
    case 'active':
      return status.decoder === 'native' ? t('shell.desktop.scanningNative') : t('shell.desktop.scanningZxing');
    case 'starting':
      return t('shell.desktop.cameraPreparing');
    case 'error':
      return status.message ?? t('shell.desktop.cameraError');
    default:
      return t('shell.desktop.idle');
  }
}
