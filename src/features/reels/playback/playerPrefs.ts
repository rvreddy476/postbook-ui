/*
  Viewer playback preferences for the reels stage, kept in localStorage.

  Sound is a deliberate choice the viewer makes once per browser (Instagram
  and the Android reels screen both remember it); speed, quality, captions
  and the end-of-reel behaviour are the settings-menu choices. Everything
  here is pure so it can be unit-tested; the hook in usePlayerPrefs.ts is the
  React binding.
*/

export const PLAYER_PREFS_KEY = "reels_player_prefs_v1";

export type QualityPref = "auto" | string; // "auto" | "360p" | "720p" | …
/*
  Playback speed is any 0.05 step between 0.25× and 2× (YouTube's slider);
  SPEEDS are the preset chips the menu and the theater bar cycle through.
*/
export const SPEED_MIN = 0.25;
export const SPEED_MAX = 2;
export const SPEED_STEP = 0.05;
export const SPEEDS = [0.25, 1, 1.25, 1.5, 2] as const;
export type Speed = number;

/** Snaps any number onto the 0.05 grid inside [0.25, 2]; NaN and garbage land on 1. */
export function clampSpeed(n: unknown): Speed {
  if (typeof n !== "number" || !Number.isFinite(n)) return 1;
  const snapped = Math.round(n / SPEED_STEP) * SPEED_STEP;
  const bounded = Math.min(SPEED_MAX, Math.max(SPEED_MIN, snapped));
  return Math.round(bounded * 100) / 100;
}

/** "0.25", "1.0", "1.25", "1.5", "2.0" — chip labels; "1.05" for slider values. */
export function speedChipLabel(s: number): string {
  return Number.isInteger(s) ? s.toFixed(1) : String(Math.round(s * 100) / 100);
}

export interface PlayerPrefs {
  /** true = play with sound. Browsers may still force a muted autoplay. */
  sound: boolean;
  volume: number; // 0..1
  speed: Speed;
  quality: QualityPref;
  captions: boolean;
  /** "loop" replays the reel; "next" advances when it ends. */
  onEnd: "loop" | "next";
  /** Preferred alternate audio language (BCP-47); null = the original track. */
  audioLanguage: string | null;
}

/** What onPrefsChange accepts: a partial, or a function of the latest prefs. */
export type PrefsPatch = Partial<PlayerPrefs> | ((prev: PlayerPrefs) => Partial<PlayerPrefs>);

export const DEFAULT_PREFS: PlayerPrefs = {
  sound: false,
  volume: 1,
  speed: 1,
  quality: "auto",
  captions: false,
  onEnd: "loop",
  audioLanguage: null,
};

export function parsePrefs(raw: string | null | undefined): PlayerPrefs {
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    const obj = JSON.parse(raw) as Partial<PlayerPrefs> | null;
    if (!obj || typeof obj !== "object") return { ...DEFAULT_PREFS };
    return {
      sound: typeof obj.sound === "boolean" ? obj.sound : DEFAULT_PREFS.sound,
      volume:
        typeof obj.volume === "number" && obj.volume >= 0 && obj.volume <= 1
          ? obj.volume
          : DEFAULT_PREFS.volume,
      speed: typeof obj.speed === "number" && Number.isFinite(obj.speed) && obj.speed >= SPEED_MIN && obj.speed <= SPEED_MAX
        ? clampSpeed(obj.speed)
        : DEFAULT_PREFS.speed,
      quality:
        typeof obj.quality === "string" && /^(auto|\d{3,4}p)$/.test(obj.quality)
          ? obj.quality
          : DEFAULT_PREFS.quality,
      captions: typeof obj.captions === "boolean" ? obj.captions : DEFAULT_PREFS.captions,
      onEnd: obj.onEnd === "next" || obj.onEnd === "loop" ? obj.onEnd : DEFAULT_PREFS.onEnd,
      audioLanguage: typeof obj.audioLanguage === "string" && /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(obj.audioLanguage) ? obj.audioLanguage.toLowerCase() : null,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function loadPrefs(): PlayerPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_PREFS };
  try {
    return parsePrefs(window.localStorage.getItem(PLAYER_PREFS_KEY));
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: PlayerPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PLAYER_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode / quota — the choice just does not persist */
  }
}

/**
  pickHlsLevel maps a quality preference onto hls.js level indices. -1 is
  hls.js's "auto". A rung the manifest does not have falls back to the
  closest one at or below it, so "1080p" on a 720p-max asset plays 720p
  rather than silently staying on auto.
*/
export function pickHlsLevel(pref: QualityPref, levelHeights: number[]): number {
  if (pref === "auto" || levelHeights.length === 0) return -1;
  const want = parseInt(pref, 10);
  if (!Number.isFinite(want)) return -1;
  let best = -1;
  let bestHeight = -1;
  levelHeights.forEach((h, i) => {
    if (h <= want && h > bestHeight) {
      best = i;
      bestHeight = h;
    }
  });
  if (best === -1) {
    // Everything is above the request: take the lowest rung.
    let minH = Infinity;
    levelHeights.forEach((h, i) => {
      if (h < minH) {
        minH = h;
        best = i;
      }
    });
  }
  return best;
}
