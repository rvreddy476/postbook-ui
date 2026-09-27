/*
  Stable volume: a Web Audio DynamicsCompressorNode between the media
  element and the speakers, created lazily the first time the switch goes
  on (an AudioContext before a gesture would start suspended; the media
  element source can only be created once, so it is kept for the element's
  life). Off = the source goes straight to the destination again.
*/

export interface StableVolumeHandle {
  enable(): void;
  disable(): void;
  /** Tears the graph down; the element plays normally afterwards. */
  dispose(): void;
  readonly enabled: boolean;
}

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function createStableVolume(media: HTMLMediaElement): StableVolumeHandle {
  let ctx: AudioContext | null = null;
  let source: MediaElementAudioSourceNode | null = null;
  let compressor: DynamicsCompressorNode | null = null;
  let enabled = false;

  const build = () => {
    if (ctx) return true;
    const Ctor = audioContextCtor();
    if (!Ctor) return false;
    try {
      ctx = new Ctor();
      source = ctx.createMediaElementSource(media);
      compressor = ctx.createDynamicsCompressor();
      // Gentle levelling: catch the loud parts, lift nothing.
      compressor.threshold.value = -24;
      compressor.knee.value = 30;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;
      return true;
    } catch {
      ctx = null;
      source = null;
      compressor = null;
      return false;
    }
  };

  const wire = () => {
    if (!ctx || !source || !compressor) return;
    try {
      source.disconnect();
    } catch {
      /* not connected yet */
    }
    if (enabled) {
      source.connect(compressor);
      compressor.connect(ctx.destination);
    } else {
      try {
        compressor.disconnect();
      } catch {
        /* not connected */
      }
      source.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  };

  return {
    get enabled() {
      return enabled;
    },
    enable() {
      if (!build()) return;
      enabled = true;
      wire();
    },
    disable() {
      enabled = false;
      if (ctx) wire();
    },
    dispose() {
      enabled = false;
      try {
        source?.disconnect();
        compressor?.disconnect();
      } catch {
        /* already gone */
      }
      void ctx?.close().catch(() => undefined);
      ctx = null;
      source = null;
      compressor = null;
    },
  };
}
