import { SPEEDS, type Speed } from "@/features/reels/playback/playerPrefs";

/*
  Theater mode helpers. Pure.

  The bottom bar's speed button cycles through the same rungs the settings
  menu offers, wrapping after 2× back to 0.5×. An unknown value (nothing
  stored yet, a stale pref) lands on normal speed rather than throwing.
*/

export function cycleSpeed(current: number): Speed {
  if (!Number.isFinite(current)) return 1;
  const at = (SPEEDS as readonly number[]).indexOf(current);
  if (at === -1) {
    // A slider value between presets steps up to the next preset.
    const above = SPEEDS.find((s) => s > current);
    return above !== undefined && current >= SPEEDS[0] && current <= SPEEDS[SPEEDS.length - 1] ? above : 1;
  }
  if (at === -1) return 1;
  return SPEEDS[(at + 1) % SPEEDS.length];
}

export function speedLabel(speed: number): string {
  return `${Number.isInteger(speed) ? speed.toFixed(1) : String(speed)}x`;
}
