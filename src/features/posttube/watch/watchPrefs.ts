/*
  The watch page's own switches, in localStorage: Ambient mode, Stable
  volume, the preferred alternate audio language. Speed / quality /
  captions / volume stay in TubePlayerPrefs (features/posttube/model.ts)
  and Auto play in the existing autoplay-next pref. Pure parse; the hook
  in hooks/useWatchPrefs.ts is the binding.
*/

export const WATCH_PREFS_KEY = "posttube_watch_prefs_v1";

export interface WatchPrefs {
  ambient: boolean;
  stableVolume: boolean;
  /** BCP-47; null = the original track. */
  audioLanguage: string | null;
}

export const DEFAULT_WATCH_PREFS: WatchPrefs = {
  ambient: true,
  stableVolume: false,
  audioLanguage: null,
};

export function parseWatchPrefs(raw: string | null | undefined): WatchPrefs {
  if (!raw) return { ...DEFAULT_WATCH_PREFS };
  try {
    const obj = JSON.parse(raw) as Partial<WatchPrefs> | null;
    if (!obj || typeof obj !== "object") return { ...DEFAULT_WATCH_PREFS };
    return {
      ambient: typeof obj.ambient === "boolean" ? obj.ambient : DEFAULT_WATCH_PREFS.ambient,
      stableVolume: typeof obj.stableVolume === "boolean" ? obj.stableVolume : DEFAULT_WATCH_PREFS.stableVolume,
      audioLanguage:
        typeof obj.audioLanguage === "string" && /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(obj.audioLanguage) ? obj.audioLanguage.toLowerCase() : null,
    };
  } catch {
    return { ...DEFAULT_WATCH_PREFS };
  }
}
