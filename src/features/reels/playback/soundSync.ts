/*
  Keeping an added sound in step with the reel's video — the arithmetic,
  with no element in sight. The video and the sound are two files played by
  two elements (nothing is mixed on the server), so the player has to say,
  on every event that matters, where the sound should be, whether it should
  be running, and how loud each side is. ReelVideo only wires events to
  planSoundSync and copies the answer onto the elements.

  The rules:

  - Position: the sound is at (start offset + video time), wrapped by its own
    length when it is shorter than the video, so it loops under a long reel.
  - Drift: the two clocks are never exactly equal. The sound is moved only
    when it is further than DRIFT_THRESHOLD_S from where it should be — a
    seek is audible, so small differences are left alone. After a jump (a
    seek, a loop, a source switch, the tab coming back) the tighter
    SNAP_THRESHOLD_S applies, because the viewer expects the sound to land
    exactly. The distance is measured around the loop: 27.9 s and 0.1 s of a
    28 s sound are 0.2 s apart, not 27.8.
  - Running: the sound runs only while the video is really advancing.
  - Levels: video = viewer × the creator's original level, sound = viewer ×
    the creator's overlay level. Mute is one switch for both.
  - Failure: a sound that cannot be loaded is no sound. The video then plays
    at the viewer's full level, whatever the creator set for the original —
    a reel whose original was turned down to make room for a sound must not
    play quietly (or silently) under nothing.
*/

/** How far the sound may wander before it is moved, in seconds of media time. */
export const DRIFT_THRESHOLD_S = 0.3;
/** The tolerance right after a jump (seek, loop, source switch). */
export const SNAP_THRESHOLD_S = 0.05;
/** A sound still loading after this long is treated as one that failed. */
export const SOUND_LOAD_TIMEOUT_MS = 10_000;

/**
  "none": the reel has no added sound. "loading": it has one, not playable
  yet. "ready": playable. "failed": it could not be loaded.
*/
export type SoundLoad = "none" | "loading" | "ready" | "failed";

/** "tick" is the running clock; "jump" is anything that moved it. */
export type SyncReason = "tick" | "jump";

export interface SoundSyncInput {
  /** The video's clock, seconds. */
  videoTime: number;
  /** The video is advancing: not paused, not ended, not seeking, not waiting for data. */
  videoPlaying: boolean;
  /** The video's playback rate. */
  rate: number;
  /** The viewer's volume, 0..1. */
  viewerVolume: number;
  /** The video element is muted (the viewer's choice, or the browser's autoplay rule). */
  muted: boolean;
  /** The creator's level for the reel's own audio, 0..1. */
  originalVolume: number;
  /** The creator's level for the sound, 0..1. */
  overlayVolume: number;
  /** Where in the sound playback starts, seconds. */
  startOffsetS: number;
  /** The sound's length, seconds; 0 when unknown (then it cannot wrap). */
  soundDurationS: number;
  load: SoundLoad;
  /** The sound element's clock, seconds. */
  soundTime: number;
  /** The sound element is in the middle of a seek of its own: leave it be. */
  soundSeeking?: boolean;
  reason?: SyncReason;
}

export interface SoundCommand {
  /** Whether the sound should be running. */
  play: boolean;
  /** Where the sound should be, seconds. */
  targetTime: number;
  /** Set when a correction is due: move the sound here. null = leave its clock alone. */
  seekTo: number | null;
  volume: number;
  muted: boolean;
  rate: number;
}

export interface SoundSyncPlan {
  /** What the video element's volume should be. */
  videoVolume: number;
  /** What the sound element should be set to; null when there is nothing to play. */
  sound: SoundCommand | null;
}

function finite(value: number, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, finite(value, 1)));
}

/** The sound's length to wrap by: the element's own when it knows it, else what the server declared. */
export function soundDurationS(elementDuration: number | null | undefined, declaredMs: number | null | undefined): number {
  const own = finite(elementDuration ?? NaN, 0);
  if (own > 0) return own;
  const declared = finite(declaredMs ?? NaN, 0);
  return declared > 0 ? declared / 1000 : 0;
}

/** Where the sound should be for a given video time. Wraps when the length is known. */
export function soundPosition(videoTime: number, startOffsetS: number, durationS: number): number {
  const at = Math.max(0, finite(startOffsetS)) + Math.max(0, finite(videoTime));
  const length = finite(durationS);
  if (length <= 0) return at;
  return at % length;
}

/** How far apart two positions of the sound are, measured around the loop. */
export function soundDrift(soundTime: number, targetTime: number, durationS: number): number {
  const apart = Math.abs(finite(soundTime) - finite(targetTime));
  const length = finite(durationS);
  if (length <= 0) return apart;
  const wrapped = apart % length;
  return Math.min(wrapped, length - wrapped);
}

/** Whether a drift is large enough to move the sound. */
export function correctionDue(drift: number, reason: SyncReason = "tick"): boolean {
  return drift > (reason === "jump" ? SNAP_THRESHOLD_S : DRIFT_THRESHOLD_S);
}

/**
  The video element's volume. The creator's original level applies only
  while there is a sound to play beside it (loading or ready); with no
  sound, or one that failed, the viewer's own level is used in full.
*/
export function videoVolume(viewerVolume: number, originalVolume: number, load: SoundLoad): number {
  const viewer = clamp01(viewerVolume);
  if (load === "none" || load === "failed") return viewer;
  return viewer * clamp01(originalVolume);
}

export function soundVolume(viewerVolume: number, overlayVolume: number): number {
  return clamp01(viewerVolume) * clamp01(overlayVolume);
}

function safeRate(rate: number): number {
  const r = finite(rate, 1);
  return r > 0 ? r : 1;
}

/** Everything the two elements should be set to, for one event. */
export function planSoundSync(input: SoundSyncInput): SoundSyncPlan {
  const volume = videoVolume(input.viewerVolume, input.originalVolume, input.load);
  if (input.load !== "ready") return { videoVolume: volume, sound: null };

  const targetTime = soundPosition(input.videoTime, input.startOffsetS, input.soundDurationS);
  const drift = soundDrift(input.soundTime, targetTime, input.soundDurationS);
  const move = !input.soundSeeking && correctionDue(drift, input.reason ?? "tick");
  return {
    videoVolume: volume,
    sound: {
      play: input.videoPlaying,
      targetTime,
      seekTo: move ? targetTime : null,
      volume: soundVolume(input.viewerVolume, input.overlayVolume),
      muted: input.muted,
      rate: safeRate(input.rate),
    },
  };
}

/**
  What to do when the browser refuses to start the sound. An unmuted start
  refused by the autoplay rule mutes BOTH sides — exactly what the video
  does for itself — so the viewer never hears half of the mix; the unmute
  tap then lets both through. Anything else (a pause that interrupted the
  start, a refusal while already muted) is left for the next event.
*/
export function onSoundPlayRefused(errorName: string | undefined, soundMuted: boolean): "mute-both" | "ignore" {
  return errorName === "NotAllowedError" && !soundMuted ? "mute-both" : "ignore";
}

/*
  A sound that was playing and then fails has most likely outlived its link:
  /serve answers with a signed address that lives five minutes, and a sound
  left paused for longer is refused when it asks for its next bytes. Asking
  /serve again gets a fresh one. Only a sound that HAD loaded is asked for
  again, and not more often than this, so a file that is really broken fails
  once and stays failed instead of reloading in a loop.
*/
export const SOUND_RELOAD_AFTER_MS = 30_000;

export function onSoundError(load: SoundLoad, msSinceLoad: number): "reload" | "fail" {
  return load === "ready" && Number.isFinite(msSinceLoad) && msSinceLoad >= SOUND_RELOAD_AFTER_MS ? "reload" : "fail";
}
