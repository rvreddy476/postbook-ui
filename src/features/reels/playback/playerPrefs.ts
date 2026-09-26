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
export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export type Speed = (typeof SPEEDS)[number];

export interface PlayerPrefs {
  /** true = play with sound. Browsers may still force a muted autoplay. */
  sound: boolean;
  volume: number; // 0..1
  speed: Speed;
  quality: QualityPref;
  captions: boolean;
  /** "loop" replays the reel; "next" advances when it ends. */
  onEnd: "loop" | "next";
}

export const DEFAULT_PREFS: PlayerPrefs = {
  sound: false,
  volume: 1,
  speed: 1,
  quality: "auto",
  captions: false,
  onEnd: "loop",
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
      speed: (SPEEDS as readonly number[]).includes(obj.speed as number)
        ? (obj.speed as Speed)
        : DEFAULT_PREFS.speed,
      quality:
        typeof obj.quality === "string" && /^(auto|\d{3,4}p)$/.test(obj.quality)
          ? obj.quality
          : DEFAULT_PREFS.quality,
      captions: typeof obj.captions === "boolean" ? obj.captions : DEFAULT_PREFS.captions,
      onEnd: obj.onEnd === "next" || obj.onEnd === "loop" ? obj.onEnd : DEFAULT_PREFS.onEnd,
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
