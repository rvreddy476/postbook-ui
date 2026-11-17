import { describe, expect, test } from "bun:test";

import { sendEventsOnUnload } from "@/features/reels/playback/telemetry";
import { WatchSession } from "@/features/reels/playback/watchSession";

/*
  Reels watch telemetry, driven the way useWatchTelemetry drives it: media
  events, the 250 ms tick, the tab's visibility. V4-10..V4-12 (reels-51,
  reels-42, reels-43).
*/

type Sent = { type: string; payload: Record<string, unknown>; unload: boolean };

function rig(durationMs = 6000) {
  let now = 1_000_000;
  let ids = 0;
  const sent: Sent[] = [];
  const s = new WatchSession(
    { contentId: "c1", durationMs, position: 0, speed: 1 },
    {
      now: () => now,
      newSessionId: () => `s${++ids}`,
      send: (events, { unload }) => events.forEach((e) => sent.push({ type: e.type, payload: e.payload, unload })),
    },
  );
  /** Plays from `fromMs` for `ms`, ticking every 250 ms. */
  const play = (fromMs: number, ms: number) => {
    for (let t = 0; t <= ms; t += 250) {
      now += 250;
      s.tick({ paused: false, seeking: false, readyState: 4, currentMs: fromMs + t, speed: 1 });
    }
  };
  return { s, sent, play, advance: (ms: number) => (now += ms), types: () => sent.map((e) => e.type) };
}

describe("loop_count reflects real loops", () => {
  test("the native loop (timeupdate near the end, then seeking to 0) counts one loop per wrap", () => {
    const r = rig(6000);
    r.s.playing({ autoplay: true, muted: true });
    r.play(0, 5900);
    r.s.seeking(0);
    r.play(0, 5900);
    r.s.seeking(50);
    r.play(50, 3000);
    r.s.end();
    const end = r.sent.find((e) => e.type === "play_end")!;
    expect(end.payload.loop_count).toBe(2);
    expect(end.payload.end_reason).toBe("swipe_next");
  });

  test("a scrub back from the middle is not a loop", () => {
    const r = rig(60_000);
    r.s.playing({ autoplay: true, muted: false });
    r.play(0, 20_000);
    r.s.seeking(0);
    r.play(0, 2000);
    r.s.end();
    expect(r.sent.find((e) => e.type === "play_end")!.payload.loop_count).toBe(0);
  });

  test("a reel that ends (onEnd = next) closes as ended", () => {
    const r = rig(6000);
    r.s.playing({ autoplay: true, muted: true });
    r.play(0, 6000);
    r.s.ended();
    r.s.end();
    expect(r.sent.at(-1)!.payload.end_reason).toBe("ended");
  });
});

describe("play_end fires once per session, by keepalive", () => {
  test("unmount after pagehide sends nothing more; every play_end is an unload send", () => {
    const r = rig(30_000);
    r.s.playing({ autoplay: false, muted: false });
    r.play(0, 4000);
    r.s.end("backgrounded"); // pagehide
    r.s.end(); // then the unmount
    const ends = r.sent.filter((e) => e.type === "play_end");
    expect(ends).toHaveLength(1);
    expect(ends[0].unload).toBe(true);
    expect(ends[0].payload.end_reason).toBe("backgrounded");
  });

  test("hidden tab: play_end, no heartbeat while hidden, a new session with its own play_start on return", () => {
    const r = rig(120_000);
    r.s.playing({ autoplay: true, muted: true });
    r.play(0, 6000); // one heartbeat (5 s)
    const firstSession = r.sent[0].payload.session_id;
    expect(r.types()).toEqual(["play_start", "watch_heartbeat"]);

    r.s.hide();
    r.play(6000, 30_000); // the element kept playing in the background
    expect(r.types()).toEqual(["play_start", "watch_heartbeat", "play_end"]);

    r.s.show(true, { autoplay: true, muted: true });
    r.play(36_000, 6000);
    r.s.end();
    const t = r.types();
    expect(t.slice(3)).toEqual(["play_start", "watch_heartbeat", "play_end"]);
    const second = r.sent[3].payload.session_id;
    expect(second).not.toBe(firstSession);
    // the second session counts only what was watched after the return
    const lastEnd = r.sent.at(-1)!.payload;
    expect(lastEnd.session_id).toBe(second);
    expect(Number(lastEnd.watched_ms_total)).toBeLessThanOrEqual(6250);
  });

  test("returning to a paused reel waits for the next play to start the new session", () => {
    const r = rig(120_000);
    r.s.playing({ autoplay: true, muted: true });
    r.play(0, 3000);
    r.s.hide();
    r.s.show(false, { autoplay: false, muted: false });
    expect(r.types()).toEqual(["play_start", "play_end"]);
    r.s.playing({ autoplay: false, muted: false });
    expect(r.types()).toEqual(["play_start", "play_end", "play_start"]);
  });
});

describe("the unload transport", () => {
  test("keepalive fetch with the bearer token and the user id (sendBeacon cannot carry them)", () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = ((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(new Response(null, { status: 202 }));
    }) as unknown as typeof fetch;
    sendEventsOnUnload([{ event_id: "e1", type: "play_end", timestamp: "t", payload: {} }], {
      fetch: fetchImpl,
      token: () => "tok",
      userId: () => "u1",
      apiBase: "https://api.test",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.test/v1/analytics/events");
    expect(calls[0].init.keepalive).toBe(true);
    expect(calls[0].init.method).toBe("POST");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
    expect(headers["X-User-Id"]).toBe("u1");
    expect(headers["Idempotency-Key"]).toBeTruthy();
    expect(JSON.parse(String(calls[0].init.body)).events[0].type).toBe("play_end");
  });
});
