import { describe, expect, test } from "bun:test";
import { classifyVideo } from "../useUploadStudio";
import { CONTENT_TYPE_META, FLICK_MAX_DURATION_SECONDS } from "../tokens";
import { uploadLimits, validateMediaDuration } from "../fileRules";

// The reel cap mirrors postclassify.FlickMaxDurationSeconds (classify.go): 300 s,
// inclusive, and a reel is portrait or square.
describe("reel duration cap is 5 minutes, as on the server", () => {
  test("the cap is 300 s for both reel upload types; long video is unchanged", () => {
    expect(FLICK_MAX_DURATION_SECONDS).toBe(300);
    expect(uploadLimits("reel").maxDuration).toBe(300);
    expect(uploadLimits("short").maxDuration).toBe(300);
    expect(CONTENT_TYPE_META.long.maxDuration).toBe(43200);
    expect(CONTENT_TYPE_META.podcast.maxDuration).toBe(28800);
  });

  test("a 240 s portrait video classifies as a reel and passes the limit", () => {
    expect(classifyVideo(240, 1080, 1920)).toBe("flick");
    expect(validateMediaDuration(240, "reel")).toBeNull();
    expect(validateMediaDuration(240, "short")).toBeNull();
  });

  test("a 240 s square video is a reel too", () => {
    expect(classifyVideo(240, 1080, 1080)).toBe("flick");
  });

  test("exactly 300 s is still a reel", () => {
    expect(classifyVideo(300, 1080, 1920)).toBe("flick");
    expect(validateMediaDuration(300, "reel")).toBeNull();
  });

  test("a 301 s portrait video is not a reel and fails the limit", () => {
    expect(classifyVideo(301, 1080, 1920)).toBe("long_video");
    expect(validateMediaDuration(301, "reel")).toContain("5 minutes");
    expect(validateMediaDuration(301, "short")).toContain("5 minutes");
  });

  test("a 240 s landscape video is not a reel", () => {
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
