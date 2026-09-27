/*
  Ambient mode: a small canvas samples the playing frame every 500 ms and
  the CSS blurs it into a glow behind the player. Nothing is sampled while
  paused (the last frame stays), and the caller stops it under reduced
  motion, in theater and in fullscreen.
*/

export const AMBIENT_INTERVAL_MS = 500;
export const AMBIENT_SAMPLE_W = 32;
export const AMBIENT_SAMPLE_H = 18;

export function startAmbient(video: HTMLVideoElement, canvas: HTMLCanvasElement, intervalMs = AMBIENT_INTERVAL_MS): () => void {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return () => undefined;
  canvas.width = AMBIENT_SAMPLE_W;
  canvas.height = AMBIENT_SAMPLE_H;
  let stopped = false;

  const paint = () => {
    if (stopped) return;
    if (video.readyState < 2 || video.paused || video.ended) return;
    try {
      ctx.drawImage(video, 0, 0, AMBIENT_SAMPLE_W, AMBIENT_SAMPLE_H);
    } catch {
      /* tainted or not ready */
    }
  };

  paint();
  const id = setInterval(paint, intervalMs);
  return () => {
    stopped = true;
    clearInterval(id);
  };
}

/** Ambient is off under reduced motion, theater and fullscreen, whatever the switch says. */
export function ambientAllowed(input: { pref: boolean; reducedMotion: boolean; theater: boolean; fullscreen: boolean }): boolean {
  return input.pref && !input.reducedMotion && !input.theater && !input.fullscreen;
}
