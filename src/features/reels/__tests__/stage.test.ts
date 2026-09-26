import { describe, expect, test } from "bun:test";

import { STAGE_DEFAULT_ASPECT, STAGE_MAX_ASPECT, STAGE_MIN_ASPECT, stageAspect } from "../stage";
import { feedFromSearch } from "../feed";

describe("stageAspect", () => {
  test("portrait and landscape media keep their own ratio", () => {
    expect(stageAspect(1080, 1920)).toBeCloseTo(9 / 16, 6);
    expect(stageAspect(1920, 1080)).toBeCloseTo(16 / 9, 6);
    expect(stageAspect(1080, 1350)).toBeCloseTo(0.8, 6);
    expect(stageAspect(1000, 1000)).toBe(1);
  });

  test("extremes clamp to [9:16, 16:9]", () => {
    expect(stageAspect(100, 2000)).toBe(STAGE_MIN_ASPECT);
    expect(stageAspect(4000, 100)).toBe(STAGE_MAX_ASPECT);
  });

  test("unknown or broken dimensions fall back to 9:16", () => {
    expect(stageAspect()).toBe(STAGE_DEFAULT_ASPECT);
    expect(stageAspect(undefined, 1920)).toBe(STAGE_DEFAULT_ASPECT);
    expect(stageAspect(1080, undefined)).toBe(STAGE_DEFAULT_ASPECT);
    expect(stageAspect(0, 1920)).toBe(STAGE_DEFAULT_ASPECT);
    expect(stageAspect(1080, 0)).toBe(STAGE_DEFAULT_ASPECT);
    expect(stageAspect(-1, 1)).toBe(STAGE_DEFAULT_ASPECT);
    expect(stageAspect(Number.NaN, 1)).toBe(STAGE_DEFAULT_ASPECT);
    expect(stageAspect(Number.POSITIVE_INFINITY, 1)).toBe(STAGE_DEFAULT_ASPECT);
  });
});

describe("feedFromSearch", () => {
  test("?feed=following is Following; anything else is For You", () => {
    expect(feedFromSearch(new URLSearchParams("feed=following"))).toBe("following");
    expect(feedFromSearch(new URLSearchParams("reelId=x&feed=following"))).toBe("following");
    expect(feedFromSearch(new URLSearchParams(""))).toBe("for-you");
    expect(feedFromSearch(new URLSearchParams("feed=foryou"))).toBe("for-you");
    expect(feedFromSearch(new URLSearchParams("feed=Following"))).toBe("for-you");
    expect(feedFromSearch(null)).toBe("for-you");
    expect(feedFromSearch(undefined)).toBe("for-you");
  });
});
