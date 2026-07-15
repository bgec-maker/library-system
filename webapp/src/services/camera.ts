import { publishScan } from './scanBus';
import { playHit, playMiss } from './scanFeedback';

// ★ CameraService 싱글턴 — getUserMedia 호출 지점은 이 파일 단 한 곳(FRONTEND.md 수용 기준).
// ref-count로 수명을 관리한다: 데스크톱 도크 위젯과 모바일 스캔 탭이 각자 acquire()/release()를
// 불러도 실제 스트림은 하나만 산다. "카메라는 창이 아니다" — 창 개폐와 생명주기가 분리돼 있어야
// 해서, 뷰/창이 아니라 셸이 acquire/release를 호출한다(뷰는 scanBus만 구독).

// iOS Safari 전부 + Windows/Linux Chrome은 BarcodeDetector가 없다(school-patch-v1 CLAUDE.md 규칙 7).
// 있으면 그쪽을 쓰고, 없으면 ZXing 로컬 번들로 폴백한다.
interface BarcodeDetectorResult {
  rawValue: string;
  format: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<BarcodeDetectorResult[]>;
}
interface BarcodeDetectorConstructor {
  new (options?: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats?(): Promise<string[]>;
}

interface ZXingReader {
  setHints(hints: Map<unknown, unknown>): void;
  decode(bitmap: unknown): { getText(): string };
  reset(): void;
}
interface ZXingNamespace {
  MultiFormatReader: new () => ZXingReader;
  DecodeHintType: { POSSIBLE_FORMATS: unknown; TRY_HARDER: unknown };
  BarcodeFormat: { EAN_13: unknown };
  RGBLuminanceSource: new (data: Uint32Array, width: number, height: number) => unknown;
  BinaryBitmap: new (binarizer: unknown) => unknown;
  HybridBinarizer: new (source: unknown) => unknown;
}
declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
    ZXing?: ZXingNamespace;
  }
}

export type CameraState = 'idle' | 'starting' | 'active' | 'error';
export interface CameraStatus {
  state: CameraState;
  decoder?: 'native' | 'zxing';
  message?: string;
}

// 조준 프레임(가운데 72% x 40%)만 잘라 디코더에 넘긴다 — 처리 픽셀을 줄여 발열을 낮춘다
// (register.html에서 실측 검증된 크롭 비율을 그대로 이식).
// export: H1(components/camera/ScanAimFrame.tsx)이 화면 위 조준 프레임을 이 크롭 영역과
// "픽셀 일치"시키기 위해 이 값을 그대로 import한다 — UI 쪽에서 값을 다시 하드코딩하면 이 비율이
// 바뀔 때 드리프트가 생기므로, 단일 원천으로 여기서만 export한다(디코드 루프 로직 자체는 불변).
export const CROP = { xRatio: 0.14, wRatio: 0.72, yRatio: 0.3, hRatio: 0.4 };
const THROTTLE_MS = 100; // 10fps
const DEDUPE_MS = 1200;

class CameraServiceImpl {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private refCount = 0;
  private rafHandle: number | null = null;
  private lastFrameAt = 0;
  private lastHitAt = 0;
  private lastHitText = '';
  private canvas: HTMLCanvasElement = document.createElement('canvas');
  private detector: BarcodeDetectorLike | null = null;
  private zxingReader: ZXingReader | null = null;
  private zxingLoadPromise: Promise<void> | null = null;
  private status: CameraStatus = { state: 'idle' };
  private statusListeners = new Set<(s: CameraStatus) => void>();

  private setStatus(patch: Partial<CameraStatus>) {
    this.status = { ...this.status, ...patch };
    this.statusListeners.forEach((fn) => fn(this.status));
  }

  onStatus(fn: (s: CameraStatus) => void): () => void {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => this.statusListeners.delete(fn);
  }

  getStatus(): CameraStatus {
    return this.status;
  }

  /** 도크 위젯 등에서 실시간 미리보기를 보여줄 때만 사용 — 디코드용 video와 별개 엘리먼트에 같은 스트림을 붙인다. */
  attachPreview(el: HTMLVideoElement): void {
    if (this.stream) el.srcObject = this.stream;
  }

  /**
   * 활성 스트림의 비디오 트랙 — 읽기 전용 접근자(추가만, getUserMedia 호출점·스트림 수명 관리는
   * 그대로 이 파일 안쪽뿐). H1 모바일 스캔 무대의 토치 토글처럼 track.getCapabilities()/
   * applyConstraints()가 필요한 UI를 위한 것 — 스트림이 없으면 null.
   */
  getVideoTrack(): MediaStreamTrack | null {
    return this.stream?.getVideoTracks()[0] ?? null;
  }

  async acquire(): Promise<void> {
    this.refCount += 1;
    if (this.refCount === 1) await this.start();
  }

  release(): void {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount === 0) this.stop();
  }

  private async start(): Promise<void> {
    this.setStatus({ state: 'starting', message: undefined });
    if (!navigator.mediaDevices?.getUserMedia) {
      this.setStatus({ state: 'error', message: '이 브라우저는 카메라를 지원하지 않습니다.' });
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false
      });
    } catch (err) {
      this.setStatus({ state: 'error', message: `카메라 오류: ${(err as Error)?.message ?? err}` });
      return;
    }
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => {});

    await this.initDecoder();
    this.setStatus({ state: 'active' });
    this.loop();
  }

  private stop(): void {
    if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video = null;
    this.setStatus({ state: 'idle', decoder: undefined });
  }

  private async initDecoder(): Promise<void> {
    if (window.BarcodeDetector) {
      try {
        const formats = (await window.BarcodeDetector.getSupportedFormats?.()) ?? [];
        if (formats.includes('ean_13')) {
          this.detector = new window.BarcodeDetector({ formats: ['ean_13'] });
          this.setStatus({ decoder: 'native' });
          return;
        }
      } catch {
        /* 네이티브 감지 실패 — ZXing으로 폴백 */
      }
    }
    await this.ensureZXingLoaded();
    if (window.ZXing) {
      const reader = new window.ZXing.MultiFormatReader();
      const hints = new Map<unknown, unknown>();
      hints.set(window.ZXing.DecodeHintType.POSSIBLE_FORMATS, [window.ZXing.BarcodeFormat.EAN_13]);
      hints.set(window.ZXing.DecodeHintType.TRY_HARDER, true);
      reader.setHints(hints);
      this.zxingReader = reader;
      this.setStatus({ decoder: 'zxing' });
    } else {
      this.setStatus({ state: 'error', message: 'ZXing 로드 실패 — 수동 입력을 사용하세요.' });
    }
  }

  private ensureZXingLoaded(): Promise<void> {
    if (window.ZXing) return Promise.resolve();
    if (this.zxingLoadPromise) return this.zxingLoadPromise;
    this.zxingLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${import.meta.env.BASE_URL}zxing.js`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('zxing.js 로드 실패'));
      document.head.appendChild(script);
    });
    return this.zxingLoadPromise;
  }

  private loop = (): void => {
    const v = this.video;
    const now = performance.now();
    if (v && v.readyState === 4 && now - this.lastFrameAt >= THROTTLE_MS) {
      this.lastFrameAt = now;
      void this.decodeFrame(v);
    }
    this.rafHandle = requestAnimationFrame(this.loop);
  };

  private async decodeFrame(v: HTMLVideoElement): Promise<void> {
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    if (!vw || !vh) return;
    const cropX = Math.round(vw * CROP.xRatio);
    const cropW = Math.round(vw * CROP.wRatio);
    const cropY = Math.round(vh * CROP.yRatio);
    const cropH = Math.round(vh * CROP.hRatio);

    let text: string | null = null;
    try {
      if (this.detector) {
        this.canvas.width = cropW;
        this.canvas.height = cropH;
        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(v, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const [hit] = await this.detector.detect(this.canvas);
        if (hit) text = hit.rawValue;
      } else if (this.zxingReader && window.ZXing) {
        this.canvas.width = cropW;
        this.canvas.height = cropH;
        const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(v, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const imageData = ctx.getImageData(0, 0, cropW, cropH);
        const luminanceSource = new window.ZXing.RGBLuminanceSource(new Uint32Array(imageData.data.buffer), cropW, cropH);
        const bitmap = new window.ZXing.BinaryBitmap(new window.ZXing.HybridBinarizer(luminanceSource));
        try {
          text = this.zxingReader.decode(bitmap).getText();
        } catch {
          /* 프레임에 코드 없음 — 정상 */
        } finally {
          this.zxingReader.reset();
        }
      }
    } catch {
      /* 프레임 처리 오류 — 다음 프레임에서 재시도 */
    }

    if (!text) return;
    const now = performance.now();
    if (text === this.lastHitText && now - this.lastHitAt < DEDUPE_MS) return;
    this.lastHitText = text;
    this.lastHitAt = now;

    const event = publishScan(text);
    if (event.target.kind === 'unknown') playMiss();
    else playHit();
  }
}

export const cameraService = new CameraServiceImpl();
