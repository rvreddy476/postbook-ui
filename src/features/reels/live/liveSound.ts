import type { PlayerPrefs } from "@/features/reels/playback/playerPrefs";

/*
  Sound on the live stage follows the reels sound preference
  (reels_player_prefs_v1): a browser that has never chosen starts muted,
  and once the viewer unmutes, every stream after it — and every reel —
  plays with sound until they mute again.
*/

/** Whether the live player is silent. */
export function liveMuted(prefs: Pick<PlayerPrefs, "sound">): boolean {
  return prefs.sound !== true;
}

/** The mute button: flips the shared preference; unmuting never lands on volume 0. */
export function toggleLiveSound(prefs: Pick<PlayerPrefs, "sound" | "volume">): Partial<PlayerPrefs> {
  if (prefs.sound) return { sound: false };
  return { sound: true, volume: prefs.volume > 0 ? prefs.volume : 1 };
}
