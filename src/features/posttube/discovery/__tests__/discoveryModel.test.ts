import { describe, expect, test } from "bun:test";

import type { LiveStream } from "@/hooks/useLiveV2";
import type { PostTubeVideo } from "../../types";
import type { SearchResult } from "../discoveryApi";
import { activeFilterCount, filterByPeriod, groupSearchResults, splitLiveStreams, summarizeGroups, withinPeriod } from "../discoveryModel";

const NOW = Date.parse("2026-09-27T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

describe("withinPeriod / filterByPeriod", () => {
  test("today is the last 24 hours, week the last 7 days, month the last 30", () => {
    expect(withinPeriod(hoursAgo(23), "today", NOW)).toBe(true);
    expect(withinPeriod(hoursAgo(25), "today", NOW)).toBe(false);
    expect(withinPeriod(hoursAgo(24 * 6), "week", NOW)).toBe(true);
    expect(withinPeriod(hoursAgo(24 * 8), "week", NOW)).toBe(false);
    expect(withinPeriod(hoursAgo(24 * 29), "month", NOW)).toBe(true);
    expect(withinPeriod(hoursAgo(24 * 31), "month", NOW)).toBe(false);
  });

  test("a missing or unparsable date is out; a far-future date is out", () => {
    expect(withinPeriod(undefined, "month", NOW)).toBe(false);
    expect(withinPeriod("not a date", "month", NOW)).toBe(false);
    expect(withinPeriod(new Date(NOW + 3_600_000 * 5).toISOString(), "month", NOW)).toBe(false);
  });

  test("filterByPeriod keeps the server's order", () => {
    const v = (id: string, h: number) => ({ id, published_at: hoursAgo(h) }) as PostTubeVideo;
    const rows = [v("a", 2), v("b", 30), v("c", 10), v("d", 24 * 9)];
    expect(filterByPeriod(rows, "today", NOW).map((r) => r.id)).toEqual(["a", "c"]);
    expect(filterByPeriod(rows, "week", NOW).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("groupSearchResults", () => {
  const video = (id: string): SearchResult => ({ kind: "video", id, title: id, href: "", thumbnailUrl: "", durationSeconds: 0, creatorName: "", creatorHref: "", publishedAt: "", viewCount: 0 });
  const channel = (id: string): SearchResult => ({ kind: "channel", id, name: id, handle: id, href: "", avatarUrl: "", followerCount: 0 });
  const collection = (id: string): SearchResult => ({ kind: "collection", id, title: id, href: "", coverUrl: "", itemCount: 0 });

  test("splits by kind, keeps order, dedupes on kind + id (the same id in two kinds is two rows)", () => {
    const groups = groupSearchResults([video("1"), channel("1"), video("2"), video("1"), collection("9"), channel("1")]);
    expect(groups.videos.map((v) => v.id)).toEqual(["1", "2"]);
    expect(groups.channels.map((c) => c.id)).toEqual(["1"]);
    expect(groups.collections.map((c) => c.id)).toEqual(["9"]);
  });

  test("summarizeGroups names only the kinds with rows, singular when one", () => {
    expect(summarizeGroups(groupSearchResults([]))).toBe("");
    expect(summarizeGroups(groupSearchResults([video("1"), video("2"), collection("9")]))).toBe("2 videos · 1 collection");
    expect(summarizeGroups(groupSearchResults([channel("a")]))).toBe("1 channel");
  });
});

test("activeFilterCount counts what is off its default", () => {
  expect(activeFilterCount({ q: "", tab: "videos", length: "any", when: "any", sort: "relevance" })).toBe(0);
  expect(activeFilterCount({ q: "", tab: "videos", length: "short", when: "year", sort: "date" })).toBe(3);
});

describe("splitLiveStreams", () => {
  const stream = (id: string, status: LiveStream["status"], extra: Partial<LiveStream> = {}): LiveStream => ({
    id,
    creator_user_id: "u",
    livekit_room: "r",
    title: id,
    description: "",
    cover_media_id: null,
    status,
    visibility: "public",
    scheduled_at: null,
    started_at: null,
    ended_at: null,
    viewer_peak: 0,
    recording_url: null,
    recording_duration_seconds: null,
    created_at: hoursAgo(1),
    updated_at: hoursAgo(1),
    ...extra,
  });

  test("live newest-start first, upcoming soonest first, ended and failed dropped, scheduled without a time dropped", () => {
    const { live, upcoming } = splitLiveStreams([
      stream("old", "live", { started_at: hoursAgo(3) }),
      stream("ended", "ended", { started_at: hoursAgo(5) }),
      stream("later", "scheduled", { scheduled_at: new Date(NOW + 7_200_000).toISOString() }),
      stream("new", "live", { started_at: hoursAgo(1) }),
      stream("soon", "scheduled", { scheduled_at: new Date(NOW + 1_800_000).toISOString() }),
      stream("untimed", "scheduled"),
      stream("failed", "failed"),
    ]);
    expect(live.map((s) => s.id)).toEqual(["new", "old"]);
    expect(upcoming.map((s) => s.id)).toEqual(["soon", "later"]);
  });

  test("an empty list splits into two empty lists", () => {
    expect(splitLiveStreams([])).toEqual({ live: [], upcoming: [] });
  });
});
