import { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { cameraService, type CameraStatus } from '../../services/camera';
import { cameraSession, type CameraSessionStatus } from '../../services/cameraSession';
import { openScannerWindow, restoreScannerWindow, useScannerWindowState } from '../../services/scannerWindowStore';
import { t } from '../../i18n';

// 우하단 고정 스캐너 도크 — ADR-026 개정: "스캐너는 창이 아니다"(구 ADR-018 부수결정)가 뒤집히며
// 미리보기·연속 모드 체크박스·종료 버튼은 전부 ScannerWindow.tsx로 옮겼다. 이 위젯은 이제
// 상태점(카메라 상태) + 버튼 하나로 축소됐다("도크 위젯은 상태점+열기 버튼으로 축소", ADR-026):
//  - 창이 닫혀 있으면 클릭 = 열기(= 카메라 시작, scannerWindowStore.openScannerWindow)
//  - 창이 열려 있으면(최소화 포함) 클릭 = 복원(scannerWindowStore.restoreScannerWindow) — 이미
//    펼쳐져 있을 때는 무해한 no-op이다. ScannerWindow는 항상 고정된 높은 z-index라
//    (scannerWindowStore.SCANNER_WINDOW_Z) "포커스"라는 별도 개념이 필요 없다.
export function ScannerDockWidget() {
  const [status, setStatus] = useState<CameraStatus>(() => cameraService.getStatus());
  const [session, setSession] = useState<CameraSessionStatus>(() => cameraSession.getStatus());
  const scannerWindow = useScannerWindowState();

  useEffect(() => cameraService.onStatus(setStatus), []);
  useEffect(() => cameraSession.onStatus(setSession), []);

  const dotColor = !session.running
    ? 'var(--idle)'
    : status.state === 'active'
      ? 'var(--pass)'
      : status.state === 'error'
        ? 'var(--fail)'
        : status.state === 'starting'
          ? 'var(--wait)'
          : 'var(--idle)';

  function handleClick() {
    if (!scannerWindow.open) {
      openScannerWindow();
      return;
    }
    restoreScannerWindow();
  }

  const label = !scannerWindow.open
    ? t('shell.desktop.scannerWindow.open')
    : scannerWindow.minimized
      ? t('shell.desktop.scannerWindow.restore')
      : t('shell.desktop.scannerWindow.focus');

  return (
    <button type="button" className="scanner-dock" onClick={handleClick} title={label}>
      <span className="scanner-dock__dot" style={{ background: dotColor }} aria-hidden />
      <Camera size={14} aria-hidden />
      <span className="scanner-dock__label">{t('shell.desktop.scannerLabel')}</span>
    </button>
  );
}
