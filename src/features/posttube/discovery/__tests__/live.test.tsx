import { afterEach, describe, expect, spyOn, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import api from "@/lib/api";
import type { LiveStream } from "@/hooks/useLiveV2";
import { LiveView } from "../components/LivePage";
import { buildLiveListParams, buildPastStreamsParams, getLiveStreamsPage, getPastStreams } from "../discoveryApi";
import { calendarDaysFrom, formatClock, formatScheduled, groupUpcomingByDay, scheduledDayLabel } from "../discoveryModel";
import type { PostTubeVideo } from "../../types";

/*
  Local-time fixtures: every date is built with the Date(y, m, d, h, min)
  constructor so the day boundaries hold in whatever zone the runner is in.
*/
const NOW = new Date(2026, 8, 27, 12, 0).getTime(); // Sun 27 Sep 2026, 12:00 local
const at = (dayOffset: number, h: number, m = 0) => new Date(2026, 8, 27 + dayOffset, h, m).getTime();
const iso = (t: number) => new Date(t).toISOString();

const stream = (id: string, t: number | null, extra: Partial<LiveStream> = {}): LiveStream => ({
  id,
  creator_user_id: "u1",
  livekit_room: "r",
  title: `Show ${id}`,
  description: "",
  cover_media_id: null,
  status: "scheduled",
  visibility: "public",
  scheduled_at: t === null ? null : iso(t),
  started_at: null,
  ended_at: null,
  viewer_peak: 0,
  recording_url: null,
  recording_duration_seconds: null,
  created_at: iso(NOW),
  updated_at: iso(NOW),
  ...extra,
});

describe("day labels", () => {
  test("Today, Tomorrow, the weekday within the week, then the date", () => {
    expect(scheduledDayLabel(at(0, 18, 30), NOW)).toBe("Today");
    expect(scheduledDayLabel(at(0, 23, 59), NOW)).toBe("Today");
    expect(scheduledDayLabel(at(1, 0, 1), NOW)).toBe("Tomorrow");
    expect(scheduledDayLabel(at(2, 9), NOW)).toBe(new Date(at(2, 9)).toLocaleDateString(undefined, { weekday: "short" }));
    expect(scheduledDayLabel(at(6, 9), NOW)).toBe(new Date(at(6, 9)).toLocaleDateString(undefined, { weekday: "short" }));
    expect(scheduledDayLabel(at(10, 9), NOW)).toBe(new Date(at(10, 9)).toLocaleDateString(undefined, { day: "numeric", month: "short" }));
    // Late (time passed, not started) reads as Today.
    expect(scheduledDayLabel(at(-1, 20), NOW)).toBe("Today");
  });

  test("calendar days, not 24-hour windows", () => {
    expect(calendarDaysFrom(at(1, 0, 1), at(0, 23, 59))).toBe(1);
    expect(calendarDaysFrom(at(0, 0, 1), at(0, 23, 59))).toBe(0);
  });

  test("formatScheduled: 'Today · 18:30' style; empty when unparsable", () => {
    expect(formatScheduled(iso(at(0, 18, 30)), NOW)).toBe(`Today · ${formatClock(at(0, 18, 30))}`);
    expect(formatScheduled(iso(at(1, 9)), NOW)).toBe(`Tomorrow · ${formatClock(at(1, 9))}`);
    expect(formatScheduled(null, NOW)).toBe("");
    expect(formatScheduled("not a date", NOW)).toBe("");
  });
});

describe("groupUpcomingByDay", () => {
  test("one group per local day, soonest first, each day by time", () => {
    const days = groupUpcomingByDay(
      [stream("c", at(1, 9)), stream("a", at(0, 18, 30)), stream("d", at(3, 20)), stream("b", at(0, 14)), stream("e", at(1, 7))],
      NOW,
    );
    expect(days.map((d) => d.label)).toEqual(["Today", "Tomorrow", scheduledDayLabel(at(3, 20), NOW)]);
    expect(days.map((d) => d.streams.map((s) => s.id))).toEqual([["b", "a"], ["e", "c"], ["d"]]);
    expect(days[0].key).toBe("2026-09-27");
    expect(days[1].key).toBe("2026-09-28");
  });

  test("a late stream joins Today; live, ended, untimed and duplicate rows are dropped", () => {
    const days = groupUpcomingByDay(
      [
        stream("late", at(-1, 20)),
        stream("soon", at(0, 13)),
        stream("soon", at(0, 13)),
        stream("untimed", null),
        stream("bad", null, { scheduled_at: "nope" }),
        stream("went-live", at(0, 15), { status: "live" }),
        stream("ended", at(0, 16), { status: "ended" }),
      ],
      NOW,
    );
    expect(days).toHaveLength(1);
    expect(days[0].label).toBe("Today");
    expect(days[0].streams.map((s) => s.id)).toEqual(["late", "soon"]);
  });

  test("nothing in → nothing out", () => {
    expect(groupUpcomingByDay([], NOW)).toEqual([]);
  });
});

describe("the Live adapter", () => {
  afterEach(() => {
    (api.get as unknown as { mockRestore?: () => void }).mockRestore?.();
  });

  test("status is always on the wire; cursor only when given", () => {
    expect(buildLiveListParams({ status: "scheduled" })).toEqual({ status: "scheduled", limit: "24" });
    expect(buildLiveListParams({ status: "all", limit: 10, cursor: "c2" })).toEqual({ status: "all", limit: "10", cursor: "c2" });
    expect(buildPastStreamsParams()).toEqual({ limit: "12" });
    expect(buildPastStreamsParams({ limit: 6, cursor: "p2" })).toEqual({ limit: "6", cursor: "p2" });
  });

  test("GET /v1/livestream/streams?status=scheduled → rows and meta.next_cursor", async () => {
    const spy = spyOn(api, "get").mockResolvedValue({ data: { data: [stream("s1", at(0, 18))], meta: { next_cursor: "n2" } } } as never);
    const page = await getLiveStreamsPage({ status: "scheduled", limit: 24 });
    expect(spy).toHaveBeenCalledWith("/v1/livestream/streams", { params: { status: "scheduled", limit: "24" } });
    expect(page.items.map((s) => s.id)).toEqual(["s1"]);
    expect(page.next_cursor).toBe("n2");
  });

  test("GET /v1/posts/live-recordings → tube tiles through hydrateRows, the cursor from meta", async () => {
    const row = {
      id: "p1",
      author_id: "a1",
      title: "Sunday stream",
      text: "",
      content_type: "long_video",
      source: "live",
      created_at: "2026-09-26T10:00:00Z",
      media: [{ media_id: "m1", kind: "video", duration_ms: 3_600_000 }],
      counts: { likes: 0, comments: 0, shares: 0 },
      view_count: 12,
      author: { id: "a1", display_name: "Ravi" },
    };
    const spy = spyOn(api, "get").mockResolvedValue({ data: { data: [row], meta: { next_cursor: "c9" } } } as never);
    const page = await getPastStreams({ limit: 12 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("/v1/posts/live-recordings", { params: { limit: "12" } });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].id).toBe("p1");
    expect(page.items[0].title).toBe("Sunday stream");
    expect(page.items[0].channel_name).toBe("Ravi");
    expect(page.next_cursor).toBe("c9");
  });

  test("an empty page has no cursor", async () => {
    spyOn(api, "get").mockResolvedValue({ data: { data: [], meta: { next_cursor: "" } } } as never);
    const page = await getPastStreams();
    expect(page.items).toEqual([]);
    expect(page.next_cursor).toBeUndefined();
  });
});

describe("LiveView: Upcoming by day and Past streams", () => {
  const base = { creatorNames: { u1: "Bee" }, hasMore: false, loadingMore: false, onLoadMore: () => {}, now: NOW };

  test("Upcoming groups under day headings with the 'Today · time' badge; no TODO marker left", () => {
    const html = renderToStaticMarkup(
      <LiveView {...base} status="ready" live={[]} upcoming={[stream("t1", at(0, 18, 30)), stream("m1", at(1, 9))]} upcomingHasMore onUpcomingMore={() => {}} />,
    );
    expect(html).toContain('data-section="upcoming"');
    const today = html.indexOf('data-day="2026-09-27"');
    const tomorrow = html.indexOf('data-day="2026-09-28"');
    expect(today).toBeGreaterThan(-1);
    expect(tomorrow).toBeGreaterThan(today);
    expect(html).toContain('<h3 class="disco-day__title">Today</h3>');
    expect(html).toContain('<h3 class="disco-day__title">Tomorrow</h3>');
    expect(html).toContain(`Today · ${formatClock(at(0, 18, 30))}`);
    expect(html).toContain('class="disco-section__count">2<');
    expect(html).toContain("Show more");
    expect(html).not.toContain("TODO");
  });

  test("Past streams: tube tiles with Show more; loading shows the tile skeleton; error offers Retry", () => {
    const video = { id: "v1", author_id: "a1", title: "Last night", duration_seconds: 3600, view_count: 3, published_at: "2026-09-26T10:00:00Z", channel_name: "Ravi" } as unknown as PostTubeVideo;
    const ready = renderToStaticMarkup(<LiveView {...base} status="ready" live={[]} upcoming={[]} past={[video]} pastHasMore onPastMore={() => {}} />);
    expect(ready).toContain(">Past streams<");
    expect(ready).toContain('class="tube-grid"');
    expect(ready).toContain('href="/posttube/watch/v1"');
    expect(ready).toContain("Show more");
    expect(ready).not.toContain("Nobody is live right now");
    const loading = renderToStaticMarkup(<LiveView {...base} status="ready" live={[]} upcoming={[]} pastStatus="loading" />);
    expect(loading).toContain(">Past streams<");
    const failed = renderToStaticMarkup(<LiveView {...base} status="ready" live={[]} upcoming={[]} pastStatus="error" onPastRetry={() => {}} />);
    expect(failed).toContain("Could not load past streams");
  });

  test("everything empty is the one empty state", () => {
    const html = renderToStaticMarkup(<LiveView {...base} status="ready" live={[]} upcoming={[]} past={[]} />);
    expect(html).toContain("Nobody is live right now");
    expect(html).not.toContain("Past streams");
  });
});
