/**
 * Notification sound using Web Audio API.
 * Two ascending sine tones for a pleasant "ding" effect.
 * Debounced to 1 second to prevent rapid-fire pings.
 */

let audioCtx: AudioContext | null = null;
let lastPlayedAt = 0;

const DEBOUNCE_MS = 1000;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export function playNotificationSound() {
  const now = Date.now();
  if (now - lastPlayedAt < DEBOUNCE_MS) return;
  lastPlayedAt = now;

  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const t = ctx.currentTime;

  // Tone 1: 880Hz for 80ms
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.value = 880;
  gain1.gain.setValueAtTime(0.12, t);
  gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(t);
  osc1.stop(t + 0.1);

  // Tone 2: 1174Hz for 120ms (starts after tone 1)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.value = 1174;
  gain2.gain.setValueAtTime(0.12, t + 0.08);
  gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(t + 0.08);
  osc2.stop(t + 0.22);
}
