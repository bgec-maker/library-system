import { cameraService } from './camera';
import { subscribeScan } from './scanBus';
import { pushToast } from './toastBus';
import { t } from '../i18n';

// ADR-020 「카메라 상시 구동 → 온디맨드 반전」 정책 계층. camera.ts(CameraService 싱글턴·ref-count·
// getUserMedia 단일 호출점·디코드 루프)는 손대지 않는다 — "언제 acquire/release할지"만 이 위에서
// 정책으로 결정한다. 셸(위젯 클릭·단축키 S)과 뷰(스캔 화면의 "카메라 시작" 버튼, components/
// ScanCameraStart.tsx)가 전부 이 서비스 하나만 거쳐 카메라를 켠다 — cameraService.acquire/release를
// 직접 부르는 곳은 이제 이 파일 안쪽 뿐이어야 한다.
export interface CameraSessionStatus {
  running: boolean;
  /** 연속 모드 핀 — 켜져 있으면 유휴 타이머가 아예 걸리지 않는다(러시아워용, FRONTEND.md). */
  continuous: boolean;
}

const IDLE_MS = 3 * 60 * 1000; // 유휴 3분 자동 종료
const WARNING_LEAD_MS = 10 * 1000; // 종료 10초 전 토스트 예고

class CameraSessionImpl {
  private running = false;
  private continuous = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private statusListeners = new Set<(s: CameraSessionStatus) => void>();

  constructor() {
    // 유휴 판정의 "활동" 신호 = 스캔 이벤트(FRONTEND.md). running===false거나 continuous===true일
    // 때는 armIdleTimer가 즉시 리턴하므로, 구독 자체는 앱 수명 동안 한 번만 걸어도 안전하다
    // (camera.ts가 자기 상태를 onStatus로 broadcast하는 것과 같은 싱글턴 패턴).
    subscribeScan(() => this.armIdleTimer());
  }

  private notify(): void {
    const status = this.getStatus();
    this.statusListeners.forEach((fn) => fn(status));
  }

  getStatus(): CameraSessionStatus {
    return { running: this.running, continuous: this.continuous };
  }

  onStatus(fn: (s: CameraSessionStatus) => void): () => void {
    this.statusListeners.add(fn);
    fn(this.getStatus());
    return () => this.statusListeners.delete(fn);
  }

  /**
   * 시작 트리거 3+1곳(데스크톱 위젯 클릭·스캔 뷰 버튼·단축키 S·모바일 탭 진입 버튼)이 전부
   * 이 메서드 하나로 모인다. reason은 진단용(어떤 트리거가 켰는지 콘솔에 남긴다) — 동작은
   * 트리거와 무관하게 항상 같다.
   */
  start(reason?: string): void {
    if (!this.running) {
      void cameraService.acquire();
      this.running = true;
      if (reason) console.debug(`[cameraSession] start(${reason})`);
      this.notify();
    }
    this.armIdleTimer();
  }

  /**
   * 명시적 종료 — 유휴 타이머·연속 모드 핀과 무관하게 항상 즉시 끈다. 모바일 "이탈 시 즉시
   * 종료"(유예 없음)와 위젯의 수동 종료 버튼이 둘 다 이 무조건성에 기대고 있다.
   */
  stop(): void {
    this.clearTimers();
    if (this.running) {
      cameraService.release();
      this.running = false;
      this.notify();
    }
  }

  /**
   * 연속 모드 핀. 켜면 유휴 타이머를 완전히 해제(러시아워 동안 유휴 종료 없이 계속 구동),
   * 끄면서 아직 켜져 있는 상태라면 그 시점부터 새 유휴 카운트다운을 다시 건다.
   */
  setContinuous(pinned: boolean): void {
    this.continuous = pinned;
    if (pinned) {
      this.clearTimers();
    } else if (this.running) {
      this.armIdleTimer();
    }
    this.notify();
  }

  private clearTimers(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.warningTimer !== null) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
  }

  /**
   * 스캔(=활동)이 있을 때마다 다시 호출돼 3분 카운트다운을 리셋한다. 연속 모드이거나 애초에
   * 꺼져 있으면 아무 타이머도 걸지 않는다(자동 종료 대상이 아님).
   */
  private armIdleTimer(): void {
    this.clearTimers();
    if (this.continuous || !this.running) return;
    this.warningTimer = setTimeout(() => {
      pushToast(t('camera.idleWarning'), 'info');
    }, IDLE_MS - WARNING_LEAD_MS);
    this.idleTimer = setTimeout(() => {
      this.stop();
    }, IDLE_MS);
  }
}

export const cameraSession = new CameraSessionImpl();
