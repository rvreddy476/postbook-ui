import { describe, expect, test } from "bun:test";

import { srtToVtt } from "@/features/reels/playback/useSubtitleTrack";

describe("srtToVtt", () => {
  test("adds the header and rewrites comma milliseconds", () => {
    const srt = "1\r\n00:00:01,000 --> 00:00:02,500\r\nHello\r\n";
    expect(srtToVtt(srt)).toBe("WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.500\nHello\n");
  });
});
