// FRONTEND.md: "피드백은 서비스 계층에서 일괄: 성공=사운드+초록 플래시(+모바일 진동), 실패=경고음.
// 뷰가 각자 구현하지 않는다." camera.ts가 디코드 결과를 여기로 흘려보내면,
// 사운드/진동은 여기서 직접 재생하고, 시각 플래시는 이벤트로만 내보내
// App 루트에 한 번만 마운트된 <ScanFlashOverlay/>가 그린다(뷰마다 중복 구현 금지).
export type ScanFeedbackKind = 'hit' | 'miss';

type Listener = (kind: ScanFeedbackKind) => void;
const listeners = new Set<Listener>();

export function onScanFeedback(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (audioCtx) return audioCtx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioCtx = new Ctor();
  return audioCtx;
}

function beep(freq: number, durationSec: number, gainValue: number) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);
    osc.start();
    osc.stop(ctx.currentTime + durationSec);
  } catch {
    /* 오디오 컨텍스트가 사용자 제스처 전이라 막힌 경우 등 — 무음으로 넘어간다 */
  }
}

export function playHit(): void {
  beep(880, 0.1, 0.18);
  navigator.vibrate?.(35);
  listeners.forEach((fn) => fn('hit'));
}

export function playMiss(): void {
  beep(220, 0.18, 0.14);
  navigator.vibrate?.([20, 40, 20]);
  listeners.forEach((fn) => fn('miss'));
}
