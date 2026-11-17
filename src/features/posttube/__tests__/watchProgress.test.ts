import { describe, expect, test } from "bun:test";

import { watchProgressBody } from "../data/posttubeApi";
import { COMPLETED_PERCENT, normalizeProgressRow, RESUME_CUTOFF_PERCENT, resumePositionMs } from "../model";

describe("progress writes carry sent_at_ms (lv-53, was LV-C-3)", () => {
  test("the report time is on the wire, in Unix ms", () => {
    expect(watchProgressBody({ positionMs: 61_234.6, durationMs: 600_000 }, 1_763_380_000_123)).toEqual({
      position_ms: 61_235,
      duration_ms: 600_000,
      sent_at_ms: 1_763_380_000_123,
    });
  });
  test("a caller's own reading time wins over now", () => {
    expect(watchProgressBody({ positionMs: 1, durationMs: 2, completed: true, sentAtMs: 42 }, 99)).toMatchObject({ completed: true, sent_at_ms: 42 });
  });
});

describe("one finished bar on the web: post-service's 90%", () => {
  test("the resume cutoff is the completed bar", () => {
    expect(COMPLETED_PERCENT).toBe(90);
    expect(RESUME_CUTOFF_PERCENT).toBe(COMPLETED_PERCENT);
  });
  test("stopped at 92%: finished, starts from the top; at 89%: resumes", () => {
    const at92 = normalizeProgressRow({ post_id: "a", position_ms: 92_000, duration_ms: 100_000 });
    expect(at92.completed).toBe(true);
    expect(resumePositionMs(at92)).toBe(0);
    const at89 = normalizeProgressRow({ post_id: "b", position_ms: 89_000, duration_ms: 100_000 });
    expect(at89.completed).toBe(false);
    expect(resumePositionMs(at89)).toBe(89_000);
  });
});
