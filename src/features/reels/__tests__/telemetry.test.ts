import { describe, expect, test } from "bun:test";

import { buildHeartbeat, buildPlayEnd, buildPlayStart, type WatchState } from "@/features/reels/playback/telemetry";

const w: WatchState = {
  sessionId: "5b1f1a0e-6c4a-4f1e-9f5d-3a2f9c8e7d61",
  contentId: "3f860f61-ddb6-4be6-98e6-3b892e9c584f",
  durationMs: 28411,
  position: 3,
  watchedMsTotal: 12000,
  maxContinuousMs: 9000,
  loopCount: 25,
  speed: 1.5,
};

describe("analytics payloads match analytics-service's ingest contract", () => {
  test("play_start", () => {
    const e = buildPlayStart(w, { startMethod: "autoplay", isMuted: true, isAutoplay: true });
    expect(e.type).toBe("play_start");
    expect(e.event_id.length).toBeGreaterThanOrEqual(16);
    expect(e.payload).toMatchObject({
      content_id: w.contentId,
      session_id: w.sessionId,
      surface: "reels",
      position: 3,
      content_duration_ms: 28411,
      start_method: "autoplay",
      is_muted: true,
      is_autoplay: true,
    });
  });
  test("the heartbeat is named watch_heartbeat and its increment never exceeds the total", () => {
    const e = buildHeartbeat(w, { incrementMs: 50_000, playheadMs: 8000 });
    expect(e.type).toBe("watch_heartbeat");
    expect(e.payload.watched_ms_increment).toBe(12000);
    expect(e.payload.watched_ms_total).toBe(12000);
    expect(e.payload.playhead_position_ms).toBe(8000);
    expect(e.payload.playback_speed).toBe(1.5);
    expect(e.payload.loop_count).toBe(20); // capped, as the server caps it
  });
  test("play_end carries the totals and a closed-set reason", () => {
    const e = buildPlayEnd({ ...w, maxContinuousMs: 30_000 }, "swipe_next");
    expect(e.type).toBe("play_end");
    expect(e.payload).toMatchObject({
      content_duration_ms: 28411,
      watched_ms_total: 12000,
      max_continuous_watch_ms: 12000, // never above the total
      loop_count: 20,
      end_reason: "swipe_next",
      surface: "reels",
    });
  });
});
