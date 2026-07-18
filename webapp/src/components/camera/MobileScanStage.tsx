import { useCallback, useEffect, useRef, useState } from 'react';
import { Flashlight, FlashlightOff, Pin, PinOff, X } from 'lucide-react';
import { cameraService, type CameraStatus } from '../../services/camera';
import { cameraSession, type CameraSessionStatus } from '../../services/cameraSession';
import { onScanFeedback } from '../../services/scanFeedback';
import { subscribeScan } from '../../services/scanBus';
import { getViewMeta } from '../../registry';
import type { ViewId } from '../../types';
import { t } from '../../i18n';
import { ScanAimFrame } from './ScanAimFrame';
import './MobileScanStage.css';

interface MobileScanStageProps {
  viewId: ViewId;
}

const FRAME_FLASH_MS = 220; // ScanFlashOverlay.tsx의 전면 플래시와 같은 길이 — 같은 "인식 순간" 언어.
const RECOGNIZED_TEXT_MS = 1000; // "인식 값 1초 표시" (완료 조건 문구 그대로).
const COUNTDOWN_VISIBLE_SEC = 30; // "유휴 자동종료 카운트다운(마지막 30초부터)".
const TICK_MS = 250;

// torch는 MediaTrackCapabilities(getCapabilities 반환값)·MediaTrackConstraintSet(applyConstraints
// 인자) 양쪽 다 TS 표준 DOM 타입에 없는 실험적 필드다(lib.dom.d.ts엔 MediaTrackSettings에만 있음) —
// camera.ts의 BarcodeDetectorLike처럼 최소 확장 타입을 로컬 선언한다.
interface TorchCapability {
  torch?: boolean;
}
type TorchConstraintSet = MediaTrackConstraintSet & TorchCapability;

/**
 * H1 — 모바일 풀스크린 스캔 무대. ScanCameraStart.tsx가 `platform==='mobile' && session.running`일
 * 때만 렌더한다. getUserMedia 호출점은 여전히 camera.ts 한 곳뿐 — 여기서는 이미 떠 있는 스트림을
 * attachPreview()로 "보여주기"만 하고, 시작/종료·연속 모드는 전부 cameraSession을 그대로 거친다.
 */
export function MobileScanStage({ viewId }: MobileScanStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [status, setStatus] = useState<CameraStatus>(() => cameraService.getStatus());
  const [session, setSession] = useState<CameraSessionStatus>(() => cameraSession.getStatus());
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [flash, setFlash] = useState(false);
  const [recognizedText, setRecognizedText] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const lastScanRef = useRef('');
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => cameraService.onStatus(setStatus), []);
  useEffect(() => cameraSession.onStatus(setSession), []);

  // <video> ref 콜백 — ScannerDockWidget.tsx와 동일 패턴(접기/펼치기마다 엘리먼트가 통째로
  // 마운트/언마운트되는 것과 같은 이유: 이 무대도 running이 바뀔 때만 마운트되므로, 마운트되는
  // 시점에 스트림이 이미 있으면 ref 콜백에서 바로 붙인다). useCallback으로 identity를 고정 —
  // 아니면 유휴 카운트다운 tick(250ms)마다 리렌더될 때 ref 콜백이 매번 새로 호출된다.
  const attachVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el) cameraService.attachPreview(el);
  }, []);

  // 스트림이 아직 준비되기 전에 마운트될 수 있다(cameraSession.start()는 running을 동기로
  // 먼저 true로 만들고 실제 getUserMedia는 비동기) — status.state가 'active'로 바뀌는 시점에
  // 다시 attachPreview + 트랙/토치 지원 여부를 갱신한다.
  useEffect(() => {
    if (status.state !== 'active') return;
    if (videoRef.current) cameraService.attachPreview(videoRef.current);
    const track = cameraService.getVideoTrack();
    trackRef.current = track;
    const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & TorchCapability) | undefined;
    setTorchSupported(caps?.torch === true);
    setTorchOn(false);
  }, [status.state]);

  // 네이티브 비디오 해상도 측정 — 메타데이터 로드 시 + 트랙 자체 해상도가 바뀌는 경우(video의
  // 'resize' 이벤트) 둘 다 재측정한다.
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
  }, [status.state]);

  // 컨테이너(화면) 크기 측정 — 모바일 회전 등 어떤 이유로든 크기가 바뀌면 조준 프레임을 다시 계산.
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
  }, []);

  // 인식 순간 — "성공/실패" 판정은 scanFeedback 버스(camera.ts가 이미 하는 판정)를 그대로
  // 신뢰하고, 인식된 원문 텍스트만 scanBus에서 받아둔다(판정 로직 재구현 금지).
  useEffect(() => subscribeScan((event) => { lastScanRef.current = event.raw; }), []);

  useEffect(
    () =>
      onScanFeedback((kind) => {
        if (kind !== 'hit') return;
        setFlash(true);
        setRecognizedText(lastScanRef.current);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        if (textTimerRef.current) clearTimeout(textTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlash(false), FRAME_FLASH_MS);
        textTimerRef.current = setTimeout(() => setRecognizedText(null), RECOGNIZED_TEXT_MS);
      }),
    []
  );

  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (textTimerRef.current) clearTimeout(textTimerRef.current);
    },
    []
  );

  // 유휴 자동종료 카운트다운 — cameraSession.idleDeadlineAt(절대 시각)을 마운트 동안 주기적으로
  // 재평가만 한다. 실제 타이머(3분 고정)는 cameraSession 안에 그대로 있다.
  useEffect(() => {
    // perf-budget: UI 카운트다운 틱(250ms) — 네트워크 호출 없음, 언마운트 시 해제.
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  function toggleTorch() {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    const constraint: TorchConstraintSet = { torch: next };
    try {
      void track.applyConstraints({ advanced: [constraint] }).catch(() => {
        /* capabilities는 torch:true를 보고했지만 실제 적용은 거부하는 기기 — 무음 실패 */
      });
      setTorchOn(next);
    } catch {
      /* applyConstraints 자체가 동기 예외를 던지는 구현 — 무음 실패 */
    }
  }

  const targetTitle = getViewMeta(viewId)?.title ?? viewId;
  const remainingSec = session.idleDeadlineAt !== null ? Math.max(0, Math.ceil((session.idleDeadlineAt - now) / 1000)) : null;
  const showCountdown = remainingSec !== null && remainingSec <= COUNTDOWN_VISIBLE_SEC;

  return (
    <div className="scan-stage" ref={containerRef}>
      <video ref={attachVideoRef} className="scan-stage__video" autoPlay muted playsInline />

      <ScanAimFrame
        videoWidth={videoSize.width}
        videoHeight={videoSize.height}
        containerWidth={containerSize.width}
        containerHeight={containerSize.height}
        flash={flash}
      />

      {recognizedText && (
        <div className="scan-stage__recognized" role="status">
          {recognizedText}
        </div>
      )}

      <div className="scan-stage__topbar">
        <span className="scan-stage__title">{t('camera.stage.scanningTo', { target: targetTitle })}</span>
        {showCountdown && remainingSec !== null && (
          <span className="scan-stage__countdown" role="status">
            {t('camera.stage.autoStopIn', { seconds: remainingSec })}
          </span>
        )}
      </div>

      <div className="scan-stage__bottombar">
        {torchSupported && (
          <button
            type="button"
            className={`scan-stage__iconBtn${torchOn ? ' is-active' : ''}`}
            aria-label={t('camera.stage.torch')}
            aria-pressed={torchOn}
            onClick={toggleTorch}
          >
            {torchOn ? <FlashlightOff size={20} aria-hidden /> : <Flashlight size={20} aria-hidden />}
          </button>
        )}
        <button
          type="button"
          className={`scan-stage__iconBtn${session.continuous ? ' is-active' : ''}`}
          aria-label={t('camera.continuousMode')}
          aria-pressed={session.continuous}
          title={t('camera.continuousModeHint')}
          onClick={() => cameraSession.setContinuous(!session.continuous)}
        >
          {session.continuous ? <Pin size={20} aria-hidden /> : <PinOff size={20} aria-hidden />}
        </button>
        <button
          type="button"
          className="scan-stage__iconBtn scan-stage__closeBtn"
          aria-label={t('camera.stop')}
          onClick={() => cameraSession.stop()}
        >
          <X size={22} aria-hidden />
        </button>
      </div>
    </div>
  );
}
