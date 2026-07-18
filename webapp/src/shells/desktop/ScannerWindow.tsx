import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Minus, X } from 'lucide-react';
import { cameraService, type CameraStatus } from '../../services/camera';
import { cameraSession, type CameraSessionStatus } from '../../services/cameraSession';
import { onScanFeedback } from '../../services/scanFeedback';
import { getEffectiveScanRoute, subscribeScanRoute } from '../../services/scanBus';
import { getViewMeta } from '../../registry';
import { t } from '../../i18n';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ScanAimFrame } from '../../components/camera/ScanAimFrame';
import {
  cancelCloseScannerWindow,
  closeScannerWindow,
  minimizeScannerWindow,
  persistScannerWindowRect,
  SCANNER_WINDOW_Z,
  setScannerWindowRect,
  useScannerWindowState
} from '../../services/scannerWindowStore';
import { DOCK_WIDTH } from './useWindowStore';
import './ScannerWindow.css';

// ADR-026 「데스크톱 스캐너 = 창」 — 카메라 세션 자체를 담는 창. shells/desktop/에 있지만
// useWindowStore/ViewId에는 등록하지 않는다("뷰 아님" — 카메라는 셸 관심사, views/**의 린트
// 경계 밖이라는 뜻이지 이 파일이 업무 뷰라는 뜻이 아니다). 상태·열기/닫기는 scannerWindowStore.ts
// 하나로 모으고, 여기서는 순수 렌더링 + 드래그/리사이즈 UX만 담당한다(Window.tsx의 드래그/리사이즈
// 메커니즘을 참고해 재현 — WindowState/ViewId에 결합돼 있는 그 파일 자체는 재사용하지 않는다).
//
// 리사이즈는 Window.tsx의 8방향 대신 SE(오른쪽 아래) 코너 1개로 단순화했다 — 유틸리티 창 하나에
// 8개 핸들을 다 두는 건 과하다고 판단(문서화: docs/ASSUMPTIONS.md "H2").

const MIN_W = 240;
const MIN_H = 220;
const MIN_VISIBLE = 80; // 드래그해도 타이틀바 일부가 항상 화면에 남도록 (Window.tsx와 같은 여유값 규모)
const TITLEBAR_ICON_SIZE = 14;
const COUNTDOWN_VISIBLE_SEC = 30; // MobileScanStage.tsx와 동일 — 유휴 자동종료 카운트다운 표시 구간.
const TICK_MS = 250;
const FLASH_MS = 220; // ScanFlashOverlay.tsx·MobileScanStage.tsx와 같은 "인식 순간" 길이.

export function ScannerWindow() {
  const winState = useScannerWindowState();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [status, setStatus] = useState<CameraStatus>(() => cameraService.getStatus());
  const [session, setSession] = useState<CameraSessionStatus>(() => cameraSession.getStatus());
  const [scanRoute, setScanRouteState] = useState(getEffectiveScanRoute());
  const [flash, setFlash] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const dragRef = useRef<{ startX: number; startY: number; winX: number; winY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; w: number; h: number } | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => cameraService.onStatus(setStatus), []);
  useEffect(() => cameraSession.onStatus(setSession), []);
  useEffect(() => subscribeScanRoute(setScanRouteState), []);

  // ScanAimFrame의 flash prop — MobileScanStage.tsx와 같은 신호(scanFeedback 'hit')를 그대로 소비한다.
  useEffect(
    () =>
      onScanFeedback((kind) => {
        if (kind !== 'hit') return;
        setFlash(true);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlash(false), FLASH_MS);
      }),
    []
  );
  useEffect(() => () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, []);

  // <video> ref 콜백 — ScannerDockWidget(구)·MobileScanStage.tsx와 동일 패턴: 이 창은 open이
  // false→true로 바뀔 때만 마운트되므로, 마운트 시점에 스트림이 이미 있으면 여기서 바로 붙인다.
  const attachVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el) cameraService.attachPreview(el);
  }, []);

  // cameraSession.start()는 running을 동기로 먼저 true로 만들고 실제 getUserMedia는 비동기라,
  // 스트림이 아직 없을 때 마운트될 수 있다 — status.state가 'active'로 바뀌는 시점에 재부착.
  useEffect(() => {
    if (status.state === 'active' && videoRef.current) cameraService.attachPreview(videoRef.current);
  }, [status.state]);

  // 네이티브 비디오 해상도 측정 — MobileScanStage.tsx와 동일(메타데이터 로드 + 'resize' 이벤트).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const measure = () => {
      if (v.videoWidth && v.videoHeight) setVideoSize({ width: v.videoWidth, height: v.videoHeight });
    };
    measure();
    v.addEventListener('loadedmetadata', measure);
    v.addEventListener('resize', measure);
    return () => {
      v.removeEventListener('loadedmetadata', measure);
      v.removeEventListener('resize', measure);
    };
  }, [status.state, winState.open, winState.minimized]);

  // 무대(비디오 컨테이너) 픽셀 크기 측정 — 창 리사이즈·최초 표시마다 조준 프레임을 다시 계산.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setContainerSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [winState.open, winState.minimized]);

  // 유휴 자동종료 카운트다운 — MobileScanStage.tsx와 동일: cameraSession.idleDeadlineAt(절대
  // 시각)을 주기적으로 재평가만 한다. 창이 닫히거나 최소화되면 재평가를 멈춘다(불필요한 타이머).
  useEffect(() => {
    if (!winState.open || winState.minimized) return;
    // perf-budget: UI 카운트다운 틱(250ms) — 네트워크 호출 없음, 언마운트 시 해제.
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [winState.open, winState.minimized]);

  function onTitlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, winX: winState.rect.x, winY: winState.rect.y };
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
  }

  function onDragMove(e: PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const nx = Math.max(DOCK_WIDTH - winState.rect.w + MIN_VISIBLE, d.winX + (e.clientX - d.startX));
    const ny = Math.max(0, d.winY + (e.clientY - d.startY));
    setScannerWindowRect({ ...winState.rect, x: nx, y: ny });
  }

  function onDragEnd() {
    dragRef.current = null;
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    persistScannerWindowRect();
  }

  function onResizePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, w: winState.rect.w, h: winState.rect.h };
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', onResizeEnd);
  }

  function onResizeMove(e: PointerEvent) {
    const r = resizeRef.current;
    if (!r) return;
    const w = Math.max(MIN_W, r.w + (e.clientX - r.startX));
    const h = Math.max(MIN_H, r.h + (e.clientY - r.startY));
    setScannerWindowRect({ ...winState.rect, w, h });
  }

  function onResizeEnd() {
    resizeRef.current = null;
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', onResizeEnd);
    persistScannerWindowRect();
  }

  if (!winState.open || winState.minimized) return null;

  const targetTitle = scanRoute ? (getViewMeta(scanRoute)?.title ?? scanRoute) : t('common.none');
  const remainingSec = session.idleDeadlineAt !== null ? Math.max(0, Math.ceil((session.idleDeadlineAt - now) / 1000)) : null;
  const showCountdown = remainingSec !== null && remainingSec <= COUNTDOWN_VISIBLE_SEC;

  return (
    <div
      className="window"
      style={{
        left: winState.rect.x,
        top: winState.rect.y,
        width: winState.rect.w,
        height: winState.rect.h,
        zIndex: SCANNER_WINDOW_Z
      }}
    >
      <div className="window-titlebar" onPointerDown={onTitlePointerDown}>
        <span className="window-titlebar__title">{t('shell.desktop.scannerLabel')}</span>
        <button type="button" className="window-btn" title={t('shell.desktop.minimize')} onClick={() => minimizeScannerWindow()}>
          <Minus size={TITLEBAR_ICON_SIZE} aria-hidden />
        </button>
        <button type="button" className="window-btn window-btn--close" title={t('common.close')} onClick={() => closeScannerWindow()}>
          <X size={TITLEBAR_ICON_SIZE} aria-hidden />
        </button>
      </div>
      <div className="window-body scanner-window__body">
        <div className="scanner-window__stage" ref={containerRef}>
          <video ref={attachVideoRef} className="scanner-window__video" autoPlay muted playsInline />
          <ScanAimFrame
            videoWidth={videoSize.width}
            videoHeight={videoSize.height}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
            flash={flash}
          />
        </div>
        <div className="scanner-window__footer">
          <p className="scanner-window__status">{statusText(status)}</p>
          <p className="scanner-window__target">{t('shell.desktop.scannerWindow.receivingTarget', { target: targetTitle })}</p>
          <div className="scanner-window__controls">
            <label className="scanner-dock__continuous" title={t('camera.continuousModeHint')}>
              <input
                type="checkbox"
                checked={session.continuous}
                onChange={(e) => cameraSession.setContinuous(e.target.checked)}
              />
              {t('camera.continuousMode')}
            </label>
            {showCountdown && remainingSec !== null && (
              <span className="scanner-window__countdown" role="status">
                {t('camera.stage.autoStopIn', { seconds: remainingSec })}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="window-resize window-resize--se" onPointerDown={onResizePointerDown} />
      {/* todo/114 — 연속 모드 중 닫기 확인: 네이티브 confirm 대신 앱 ConfirmDialog(포커스 트랩·
          danger 위계 동일). 확인=강제 닫기, 취소/ESC=대기 해제. */}
      <ConfirmDialog
        open={winState.closeConfirmPending}
        title={t('shell.desktop.scannerWindow.closeConfirmTitle')}
        message={t('shell.desktop.scannerWindow.confirmCloseContinuous')}
        confirmLabel={t('common.close')}
        onConfirm={() => closeScannerWindow(true)}
        onCancel={cancelCloseScannerWindow}
      />
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
