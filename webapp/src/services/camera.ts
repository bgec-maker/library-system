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

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

// todo/14 — ZXing 디코드를 메인 스레드에서 Web Worker(public/zxing-worker.js)로 옮긴 뒤 그
// 워커와 주고받는 메시지 모양. 워커 쪽 ZXing 타입(MultiFormatReader 등)은 이제 이 파일이 전혀
// 몰라도 된다 — 메인 스레드는 크롭된 픽셀 버퍼를 보내고 {text} 결과만 받는다.
type ZxingWorkerMessage =
  | { type: 'ready' }
  | { type: 'error'; message?: string }
  | { type: 'result'; text: string | null };

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
  // ZXing 워커(todo/14) — camera.ts 수명(acquire/release로 여러 번 start/stop)과 무관하게 딱
  // 한 번만 만든다("카메라는 창이 아니다"와 같은 원칙: 워커도 세션 하나짜리 자원이 아니다).
  // zxingReady=true가 되기 전까지는 워커에게 프레임을 보내지 않는다.
  private zxingWorker: Worker | null = null;
  private zxingWorkerLoadPromise: Promise<void> | null = null;
  private zxingReady = false;
  // 워커가 이전 프레임을 아직 처리 중인지 — true면 이번 raf 틱은 디코드 자체를 건너뛴다
  // (큐잉 금지, "프레임 드랍" 자체가 스로틀의 정상 동작 — 아래 decodeFrame 주석 참고).
  private zxingWorkerBusy = false;
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
    await this.ensureZxingWorker();
    // 실패했으면 워커의 onerror/‘error’ 메시지 핸들러(ensureZxingWorker 안)가 이미
    // setStatus({state:'error', ...})를 호출했다 — 여기서 성공 상태로 덮어쓰지 않는다.
    // 성공(zxingReady)이면 stop()/start()를 몇 번 반복하든(워커는 최초 1회만 만들고 재사용)
    // 매번 다시 'zxing' 상태를 알린다 — stop()이 status.decoder를 undefined로 지우기 때문.
    if (this.zxingReady) this.setStatus({ decoder: 'zxing' });
  }

  /**
   * ZXing 디코드 워커(todo/14 「부채 상환 세트」 — 디코드를 메인 스레드 밖으로)를 최초 1회만
   * 만들고, 이후 start()/stop() 사이클마다는 이미 만든 워커를 그대로 재사용한다(카메라
   * 스트림처럼 acquire/release 때마다 새로 만들 필요가 없다 — 디코더 자체는 세션에 묶인
   * 자원이 아니다). public/zxing-worker.js는 public/zxing.js(벤더 UMD 번들, 수정 금지)와
   * 같은 디렉터리에 두고 importScripts('zxing.js')로 상대 경로 로드한다 — 이 워커 스크립트
   * 자신의 URL도 배포 서브패스(/library-system/app/ 등)를 타야 하므로, 이전 리비전이 zxing.js를
   * <script> 태그로 불러올 때 썼던 것과 동일하게 import.meta.env.BASE_URL을 그대로 접두사로 쓴다.
   */
  private ensureZxingWorker(): Promise<void> {
    if (this.zxingReady) return Promise.resolve();
    if (this.zxingWorkerLoadPromise) return this.zxingWorkerLoadPromise;
    this.zxingWorkerLoadPromise = new Promise((resolve) => {
      let worker: Worker;
      try {
        worker = new Worker(`${import.meta.env.BASE_URL}zxing-worker.js`);
      } catch (err) {
        this.setStatus({ state: 'error', message: `ZXing 워커 생성 실패: ${(err as Error)?.message ?? err} — 수동 입력을 사용하세요.` });
        resolve();
        return;
      }
      worker.onmessage = (e: MessageEvent<ZxingWorkerMessage>) => {
        const msg = e.data;
        if (msg.type === 'ready') {
          this.zxingReady = true;
          resolve();
        } else if (msg.type === 'error') {
          this.zxingReady = false;
          this.setStatus({ state: 'error', message: `ZXing 로드 실패: ${msg.message ?? ''} — 수동 입력을 사용하세요.` });
          resolve();
        } else if (msg.type === 'result') {
          // 워커가 응답했으니 다음 틱부터 다시 프레임을 보낼 수 있다(아래 decodeFrame 참고).
          this.zxingWorkerBusy = false;
          this.handleDecodedText(msg.text);
        }
      };
      worker.onerror = (ev) => {
        this.zxingReady = false;
        this.setStatus({ state: 'error', message: `ZXing 워커 오류: ${ev.message || '알 수 없는 오류'} — 수동 입력을 사용하세요.` });
        resolve();
      };
      this.zxingWorker = worker;
    });
    return this.zxingWorkerLoadPromise;
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

    try {
      if (this.detector) {
        // BarcodeDetector 네이티브 경로 — todo/14에서 전혀 손대지 않는다(여전히 메인 스레드에서
        // 동기적으로 detect()한다, 브라우저 구현이 이미 별도 스레드/프로세스에서 돌 수도 있지만
        // 그건 이 코드가 관여할 부분이 아니다).
        this.canvas.width = cropW;
        this.canvas.height = cropH;
        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(v, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const [hit] = await this.detector.detect(this.canvas);
        this.handleDecodedText(hit ? hit.rawValue : null);
      } else if (this.zxingReady && this.zxingWorker) {
        // ZXing 워커 경로(todo/14) — 워커가 이전 프레임을 아직 처리 중이면(zxingWorkerBusy)
        // 이번 틱은 크롭조차 하지 않고 완전히 건너뛴다. raf 루프(THROTTLE_MS=100ms 스로틀)는
        // 이 분기와 무관하게 계속 돌고, 다음 틱에서 다시 시도할 뿐이다 — 메시지를 큐에 쌓지
        // 않는다("100권 연속 스캔에서 프레임 드랍 없음"은 "디코더가 못 따라갈 프레임을
        // 버린다"는 뜻이지, 라디안스 프레임 자체를 하나도 안 건너뛴다는 뜻이 아니다: 애초에
        // 10fps로 스로틀된 시점에서 대부분의 원본 비디오 프레임은 이미 건너뛰고 있다).
        if (this.zxingWorkerBusy) return;
        this.canvas.width = cropW;
        this.canvas.height = cropH;
        const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(v, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const imageData = ctx.getImageData(0, 0, cropW, cropH);
        this.zxingWorkerBusy = true;
        // 제로카피 transfer — imageData.data.buffer는 이 호출 이후 메인 스레드에서 detached되지만
        // 이미 위 getImageData()로 필요한 값을 다 뽑아 canvas에 남겨둘 필요가 없으므로 안전하다.
        this.zxingWorker.postMessage({ width: cropW, height: cropH, buffer: imageData.data.buffer }, [imageData.data.buffer]);
      }
    } catch {
      /* 프레임 처리 오류 — 다음 프레임에서 재시도 */
    }
  }

  /**
   * 디코드 성공/실패 후의 공통 처리(중복 스캔 무시·publishScan·성공/실패 사운드) — BarcodeDetector
   * 분기(동기, decodeFrame 안에서 직접 호출)와 ZXing 워커의 'result' 메시지 핸들러(비동기,
   * ensureZxingWorker 안에서 호출) 둘 다 이 메서드 하나를 공유한다(todo/14 — 로직 중복 금지).
   */
  private handleDecodedText(text: string | null): void {
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
