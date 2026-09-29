import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  clamp01,
  correctionDue,
  DRIFT_THRESHOLD_S,
  onSoundError,
  onSoundPlayRefused,
  planSoundSync,
  SNAP_THRESHOLD_S,
  SOUND_RELOAD_AFTER_MS,
  soundDrift,
  soundDurationS,
  soundPosition,
  soundVolume,
  videoVolume,
  type SoundSyncInput,
} from "@/features/reels/playback/soundSync";

/** A reel playing normally with a 28.4 s sound in step. */
function input(over: Partial<SoundSyncInput> = {}): SoundSyncInput {
  return {
    videoTime: 5,
    videoPlaying: true,
    rate: 1,
    viewerVolume: 1,
    muted: false,
    originalVolume: 1,
    overlayVolume: 1,
    startOffsetS: 0,
    soundDurationS: 28.4,
    load: "ready",
    soundTime: 5,
    ...over,
  };
}

describe("soundPosition — where the sound should be", () => {
  test("start offset plus the video's clock", () => {
    expect(soundPosition(5, 0, 28.4)).toBe(5);
    expect(soundPosition(5, 1.5, 28.4)).toBe(6.5);
    expect(soundPosition(0, 1.5, 28.4)).toBe(1.5);
  });

  test("a sound shorter than the video loops: the position wraps by the sound's length", () => {
    expect(soundPosition(30, 0, 10)).toBe(0);
    expect(soundPosition(35, 0, 10)).toBe(5);
    expect(soundPosition(30, 1.5, 28.4)).toBeCloseTo(3.1, 6);
    expect(soundPosition(95, 0, 10)).toBe(5);
  });

  test("a start offset past the end wraps too", () => {
    expect(soundPosition(0, 12, 10)).toBe(2);
  });

  test("an unknown length cannot wrap: the position runs on", () => {
    expect(soundPosition(40, 1, 0)).toBe(41);
    expect(soundPosition(40, 1, NaN)).toBe(41);
    expect(soundPosition(40, 1, Infinity)).toBe(41);
  });

  test("never negative, never NaN", () => {
    expect(soundPosition(-3, 0, 10)).toBe(0);
    expect(soundPosition(NaN, 2, 10)).toBe(2);
    expect(soundPosition(4, -2, 10)).toBe(4);
    expect(soundPosition(4, NaN, 10)).toBe(4);
  });
});

describe("soundDrift — measured around the loop", () => {
  test("the plain distance when both are mid-sound", () => {
    expect(soundDrift(5, 5.2, 28.4)).toBeCloseTo(0.2, 6);
    expect(soundDrift(5.2, 5, 28.4)).toBeCloseTo(0.2, 6);
  });

  test("either side of the wrap, the two are close, not a whole sound apart", () => {
    expect(soundDrift(27.9, 0.1, 28)).toBeCloseTo(0.2, 6);
    expect(soundDrift(0.1, 27.9, 28)).toBeCloseTo(0.2, 6);
  });

  test("half a loop apart is the furthest two positions can be", () => {
    expect(soundDrift(0, 14, 28)).toBe(14);
    expect(soundDrift(0, 20, 28)).toBe(8);
  });

  test("with no known length the distance is linear", () => {
    expect(soundDrift(27.9, 0.1, 0)).toBeCloseTo(27.8, 6);
  });
});

describe("correctionDue — the threshold", () => {
  test("about 0.3 s while running: smaller differences are left alone", () => {
    expect(DRIFT_THRESHOLD_S).toBe(0.3);
    expect(correctionDue(0.1)).toBe(false);
    expect(correctionDue(0.29)).toBe(false);
    expect(correctionDue(0.3)).toBe(false);
    expect(correctionDue(0.31)).toBe(true);
    expect(correctionDue(2)).toBe(true);
  });

  test("tighter after a jump, and still not zero", () => {
    expect(SNAP_THRESHOLD_S).toBe(0.05);
    expect(correctionDue(0.04, "jump")).toBe(false);
    expect(correctionDue(0.06, "jump")).toBe(true);
    expect(correctionDue(0.2, "jump")).toBe(true);
    expect(correctionDue(0.2, "tick")).toBe(false);
  });
});

describe("planSoundSync — drift", () => {
  test("in step: nothing is moved", () => {
    const plan = planSoundSync(input());
    expect(plan.sound).not.toBeNull();
    expect(plan.sound!.seekTo).toBeNull();
    expect(plan.sound!.targetTime).toBe(5);
    expect(plan.sound!.play).toBe(true);
  });

  test("0.25 s out while running is left alone; 0.35 s out is corrected to the target", () => {
    expect(planSoundSync(input({ soundTime: 5.25 })).sound!.seekTo).toBeNull();
    expect(planSoundSync(input({ soundTime: 4.75 })).sound!.seekTo).toBeNull();
    expect(planSoundSync(input({ soundTime: 5.35 })).sound!.seekTo).toBe(5);
    expect(planSoundSync(input({ soundTime: 4.65 })).sound!.seekTo).toBe(5);
  });

  test("a sound that is mid-seek is not moved again, however far out", () => {
    expect(planSoundSync(input({ soundTime: 20, soundSeeking: true })).sound!.seekTo).toBeNull();
    expect(planSoundSync(input({ soundTime: 20, soundSeeking: false })).sound!.seekTo).toBe(5);
  });

  test("after a seek the sound lands on the new position", () => {
    const plan = planSoundSync(input({ videoTime: 12, soundTime: 5, reason: "jump" }));
    expect(plan.sound!.seekTo).toBe(12);
  });

  test("a jump inside the running threshold is still corrected", () => {
    expect(planSoundSync(input({ soundTime: 5.2, reason: "jump" })).sound!.seekTo).toBe(5);
    expect(planSoundSync(input({ soundTime: 5.2, reason: "tick" })).sound!.seekTo).toBeNull();
  });
});

describe("planSoundSync — looping", () => {
  test("a 10 s sound under a 35 s reel: the target wraps", () => {
    expect(planSoundSync(input({ videoTime: 35, soundDurationS: 10, soundTime: 5 })).sound!.targetTime).toBe(5);
    expect(planSoundSync(input({ videoTime: 35, soundDurationS: 10, soundTime: 5 })).sound!.seekTo).toBeNull();
  });

  test("the element wrapping a moment before the clock does is not a drift", () => {
    // 28.4 s sound: the video is at 28.35 (target 28.35), the looping element has already wrapped to 0.05.
    const plan = planSoundSync(input({ videoTime: 28.35, soundTime: 0.05 }));
    expect(plan.sound!.targetTime).toBeCloseTo(28.35, 6);
    expect(plan.sound!.seekTo).toBeNull();
  });

  test("the video looping back to the start pulls the sound back with it", () => {
    const plan = planSoundSync(input({ videoTime: 0.1, soundTime: 15 }));
    expect(plan.sound!.seekTo).toBeCloseTo(0.1, 6);
  });

  test("the start offset is kept on every lap of the video", () => {
    expect(planSoundSync(input({ videoTime: 0, startOffsetS: 1.5, soundTime: 1.5 })).sound!.targetTime).toBe(1.5);
    expect(planSoundSync(input({ videoTime: 0, startOffsetS: 1.5, soundTime: 9 })).sound!.seekTo).toBe(1.5);
  });
});

describe("planSoundSync — play, pause, rate, mute", () => {
  test("the sound runs only while the video does", () => {
    expect(planSoundSync(input({ videoPlaying: true })).sound!.play).toBe(true);
    expect(planSoundSync(input({ videoPlaying: false })).sound!.play).toBe(false);
  });

  test("a paused video still places the sound, so it resumes in step", () => {
    const plan = planSoundSync(input({ videoPlaying: false, videoTime: 9, soundTime: 2, reason: "jump" }));
    expect(plan.sound!.play).toBe(false);
    expect(plan.sound!.seekTo).toBe(9);
  });

  test("the sound takes the video's rate; a rate that is no rate is 1", () => {
    expect(planSoundSync(input({ rate: 1.5 })).sound!.rate).toBe(1.5);
    expect(planSoundSync(input({ rate: 0.25 })).sound!.rate).toBe(0.25);
    expect(planSoundSync(input({ rate: 0 })).sound!.rate).toBe(1);
    expect(planSoundSync(input({ rate: NaN })).sound!.rate).toBe(1);
    expect(planSoundSync(input({ rate: -2 })).sound!.rate).toBe(1);
  });

  test("mute is one switch for both: the sound is muted exactly when the video is", () => {
    expect(planSoundSync(input({ muted: true })).sound!.muted).toBe(true);
    expect(planSoundSync(input({ muted: false })).sound!.muted).toBe(false);
  });
});

describe("volumes", () => {
  test("video = viewer × original, sound = viewer × overlay", () => {
    const plan = planSoundSync(input({ viewerVolume: 0.5, originalVolume: 0.4, overlayVolume: 0.8 }));
    expect(plan.videoVolume).toBeCloseTo(0.2, 6);
    expect(plan.sound!.volume).toBeCloseTo(0.4, 6);
  });

  test("a creator who muted the original gets a silent video under the sound", () => {
    const plan = planSoundSync(input({ viewerVolume: 0.9, originalVolume: 0, overlayVolume: 1 }));
    expect(plan.videoVolume).toBe(0);
    expect(plan.sound!.volume).toBeCloseTo(0.9, 6);
  });

  test("a creator who muted the sound gets a silent sound", () => {
    expect(planSoundSync(input({ overlayVolume: 0 })).sound!.volume).toBe(0);
  });

  test("everything stays inside 0..1", () => {
    expect(clamp01(1.4)).toBe(1);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(NaN)).toBe(1);
    expect(videoVolume(2, 3, "ready")).toBe(1);
    expect(soundVolume(2, -1)).toBe(0);
  });
});

describe("failure is silent: the reel plays alone at the viewer's full volume", () => {
  test("a sound that failed to load: no sound command, and the creator's original level is dropped", () => {
    const plan = planSoundSync(input({ load: "failed", viewerVolume: 0.7, originalVolume: 0.2 }));
    expect(plan.sound).toBeNull();
    expect(plan.videoVolume).toBeCloseTo(0.7, 6);
  });

  test("even when the creator muted the original: a failed sound must not leave the reel silent", () => {
    expect(planSoundSync(input({ load: "failed", viewerVolume: 1, originalVolume: 0 })).videoVolume).toBe(1);
    expect(videoVolume(0.6, 0, "failed")).toBeCloseTo(0.6, 6);
  });

  test("a reel with no added sound plays at the viewer's level, whatever the creator levels say", () => {
    const plan = planSoundSync(input({ load: "none", viewerVolume: 0.8, originalVolume: 0.3 }));
    expect(plan.sound).toBeNull();
    expect(plan.videoVolume).toBeCloseTo(0.8, 6);
  });

  test("while the sound is still loading nothing plays beside the video, and the mix is already applied", () => {
    const plan = planSoundSync(input({ load: "loading", viewerVolume: 1, originalVolume: 0.3 }));
    expect(plan.sound).toBeNull();
    expect(plan.videoVolume).toBeCloseTo(0.3, 6);
  });
});

describe("onSoundPlayRefused — the browser's autoplay rule", () => {
  test("an unmuted start refused mutes both sides, as the video does for itself", () => {
    expect(onSoundPlayRefused("NotAllowedError", false)).toBe("mute-both");
  });
  test("already muted, or interrupted by a pause: nothing to do", () => {
    expect(onSoundPlayRefused("NotAllowedError", true)).toBe("ignore");
    expect(onSoundPlayRefused("AbortError", false)).toBe("ignore");
    expect(onSoundPlayRefused(undefined, false)).toBe("ignore");
  });
});

describe("soundDurationS", () => {
  test("the element's own length wins; the declared one stands in until it is known", () => {
    expect(soundDurationS(28.4, 30_000)).toBe(28.4);
    expect(soundDurationS(NaN, 28_400)).toBe(28.4);
    expect(soundDurationS(undefined, 28_400)).toBe(28.4);
    expect(soundDurationS(Infinity, 28_400)).toBe(28.4);
    expect(soundDurationS(0, 0)).toBe(0);
    expect(soundDurationS(null, null)).toBe(0);
  });
});

describe("the module and its wiring", () => {
  const sync = readFileSync(resolve(import.meta.dir, "../playback/soundSync.ts"), "utf8");
  const player = readFileSync(resolve(import.meta.dir, "../components/ReelVideo.tsx"), "utf8");

  test("soundSync touches no element, no window and no timer", () => {
    const code = sync.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const banned of ["document", "window", "HTMLAudioElement", "HTMLVideoElement", "requestAnimationFrame", "setTimeout", "setInterval", "import "]) {
      expect(code).not.toContain(banned);
    }
  });

  test("the player decides nothing itself: every level and position comes from planSoundSync", () => {
    expect(player).toContain("planSoundSync({");
    expect(player).toContain("video.volume = plan.videoVolume");
    expect(player).not.toContain("video.volume = prefs.volume");
    expect(player).not.toContain("video.volume = level");
  });

  test("the hidden audio element: preload auto, the serve route, no crossOrigin, stopped when it goes away", () => {
    const at = player.indexOf("<audio ref=");
    expect(at).toBeGreaterThan(-1);
    const tag = player.slice(at, player.indexOf("/>", at));
    expect(tag).toContain('preload="auto"');
    expect(tag).not.toContain("crossOrigin");
    expect(tag).not.toContain("controls");
    expect(player).toContain("audio.src = soundServeHref(soundId);");
    expect(player).toContain('audio.removeAttribute("src");');
  });

  test("driven by media events and visibility, never by an animation frame", () => {
    expect(player).not.toContain("requestAnimationFrame");
    for (const name of ['"timeupdate"', '"play"', '"pause"', '"seeking"', '"seeked"', '"ratechange"', '"volumechange"', '"ended"', '"emptied"', '"waiting"', '"playing"', '"visibilitychange"']) {
      expect(player).toContain(name);
    }
  });

  test("a sound failure raises nothing: no toast, no console call in the player", () => {
    expect(player).not.toContain("console.");
    expect(player).not.toContain("toast");
  });
});

describe("a sound that fails after it had loaded", () => {
  test("is asked for again once its link has had time to expire", () => {
    expect(onSoundError("ready", SOUND_RELOAD_AFTER_MS)).toBe("reload");
    expect(onSoundError("ready", 6 * 60_000)).toBe("reload");
  });

  test("fails for good when it breaks straight after loading, so a broken file cannot reload in a loop", () => {
    expect(onSoundError("ready", 0)).toBe("fail");
    expect(onSoundError("ready", SOUND_RELOAD_AFTER_MS - 1)).toBe("fail");
    expect(onSoundError("ready", Number.NaN)).toBe("fail");
  });

  test("is not asked for again when it never loaded", () => {
    for (const load of ["loading", "failed", "none"] as const) expect(onSoundError(load, 10 * 60_000)).toBe("fail");
  });
});
