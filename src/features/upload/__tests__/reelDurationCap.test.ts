import { describe, expect, test } from "bun:test";
import { classifyVideo } from "../useUploadStudio";
import { FLICK_MAX_DURATION_SECONDS, stepIntro } from "../tokens";
import { shortsLongVideoNotice, uploadLimitLabels, validateMediaDuration, validateSelectedFile } from "../fileRules";
import { SHORTS_MAX_DURATION_MS, SHORTS_MAX_DURATION_SECONDS } from "@/lib/videoLimits";
import { REEL_MAX_DURATION_MS } from "@/features/reels/model";

// The Shorts boundary mirrors postclassify.FlickMaxDurationSeconds (classify.go):
// 600 s, inclusive, and a reel is portrait or square (founder, 2026-10-21).
describe("the Shorts boundary is 10 minutes, as on the server, from one constant", () => {
  test("every copy of the boundary is the one constant", () => {
    expect(SHORTS_MAX_DURATION_SECONDS).toBe(600);
    expect(FLICK_MAX_DURATION_SECONDS).toBe(SHORTS_MAX_DURATION_SECONDS);
    expect(SHORTS_MAX_DURATION_MS).toBe(600_000);
    expect(REEL_MAX_DURATION_MS).toBe(SHORTS_MAX_DURATION_MS);
  });

  test("599 s and exactly 600 s portrait are reels; 601 s is a long video", () => {
    expect(classifyVideo(599, 1080, 1920)).toBe("flick");
    expect(classifyVideo(600, 1080, 1920)).toBe("flick");
    expect(classifyVideo(601, 1080, 1920)).toBe("long_video");
  });

  test("a 240 s square video is a reel; a 240 s landscape one is not", () => {
    expect(classifyVideo(240, 1080, 1080)).toBe("flick");
    expect(classifyVideo(240, 1920, 1080)).toBe("long_video");
  });

  test("unknown duration or dimensions fall back to long video, as the server does", () => {
    expect(classifyVideo(null, 1080, 1920)).toBe("long_video");
    expect(classifyVideo(0, 1080, 1920)).toBe("long_video");
    expect(classifyVideo(240, null, 1920)).toBe("long_video");
    expect(classifyVideo(240, 1080, null)).toBe("long_video");
    expect(classifyVideo(240, 0, 0)).toBe("long_video");
  });
});

describe("a file over 10 minutes in the Shorts studio is accepted and posted as a long video", () => {
  const fifteenMinutes = 15 * 60;

  test("nothing refuses it: file rules and duration check pass in both Shorts studios", () => {
    for (const type of ["reel", "short"] as const) {
      expect(validateSelectedFile({ type: "video/mp4", size: 900 * 1024 * 1024 }, type)).toBeNull();
    }
    expect(validateMediaDuration(fifteenMinutes)).toBeNull();
    expect(classifyVideo(fifteenMinutes, 1080, 1920)).toBe("long_video");
  });

  test("the studio says so calmly, only over the boundary and only in the Shorts studio", () => {
    expect(shortsLongVideoNotice("reel", fifteenMinutes)).toBe("Over 10 minutes — this will be posted as a long video.");
    expect(shortsLongVideoNotice("short", 601)).toContain("long video");
    expect(shortsLongVideoNotice("reel", 600)).toBeNull();
    expect(shortsLongVideoNotice("reel", 599)).toBeNull();
    expect(shortsLongVideoNotice("reel", null)).toBeNull();
    expect(shortsLongVideoNotice("long", fifteenMinutes)).toBeNull();
    expect(shortsLongVideoNotice("podcast", fifteenMinutes)).toBeNull();
  });

  test("the labels say 10 minutes as a Short, and nothing about 5 minutes", () => {
    expect(uploadLimitLabels("reel").duration).toBe("Up to 10 minutes as a Short");
    expect(stepIntro("video", "reel").body).toContain("10 minutes");
    expect(stepIntro("video", "reel").body).toContain("long video");
    expect(stepIntro("video", "reel").body).not.toContain("5 minutes");
  });
});
