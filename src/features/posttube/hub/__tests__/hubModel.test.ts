import { describe, expect, test } from "bun:test";

import type { HubLibraryRow } from "../hubApi";
import {
  axisTicks,
  barRects,
  dedupeRows,
  diffPatch,
  filterLibraryRows,
  formatMs,
  formatWatchTime,
  liveRows,
  parseClock,
  retentionPath,
  sortLibraryRows,
  sparklineArea,
  sparklinePath,
  splitTags,
  surfaceLabel,
  toggleSelection,
} from "../hubModel";

const box = { width: 100, height: 20, pad: 0 };

describe("sparklinePath", () => {
  test("empty → no path; one point → a flat line", () => {
    expect(sparklinePath([], box)).toBe("");
    expect(sparklinePath([5], box)).toBe("M0 0 L100 0");
  });

  test("spreads points across the width and scales to the max", () => {
    expect(sparklinePath([0, 10, 5], box)).toBe("M0 20 L50 0 L100 10");
  });

  test("a pinned max keeps the scale stable between renders", () => {
    expect(sparklinePath([50, 100], box, 200)).toBe("M0 15 L100 10");
  });

  test("respects padding and never goes above zero", () => {
    expect(sparklinePath([0, 4], { width: 40, height: 10, pad: 2 })).toBe("M0 8 L40 2");
    expect(sparklinePath([-5, 5], box)).toBe("M0 20 L100 0");
  });

  test("area closes along the baseline", () => {
    expect(sparklineArea([0, 10], box)).toBe("M0 20 L100 0 L100 20 L0 20 Z");
    expect(sparklineArea([], box)).toBe("");
  });
});

describe("retentionPath", () => {
  test("is plotted against a fixed 100 and clamps out-of-range points", () => {
    expect(retentionPath([100, 50, 0], box)).toBe("M0 0 L50 10 L100 20");
    expect(retentionPath([150, -20], box)).toBe("M0 0 L100 20");
  });
});

describe("barRects", () => {
  test("48 equal bars fill the width, zeros keep a hairline", () => {
    const rects = barRects(new Array(48).fill(0).map((_, i) => (i === 47 ? 10 : 0)), { width: 288, height: 48, pad: 0 }, 1);
    expect(rects.length).toBe(48);
    expect(rects[47][3]).toBe(48);
    expect(rects[0][3]).toBe(0.5);
    expect(rects[47][0] + rects[47][2]).toBeCloseTo(288, 0);
    expect(barRects([], box)).toEqual([]);
  });
});

describe("axisTicks", () => {
  test("first, last and evenly spaced in between", () => {
    expect(axisTicks(0)).toEqual([]);
    expect(axisTicks(1)).toEqual([0]);
    expect(axisTicks(28, 4)).toEqual([0, 9, 18, 27]);
    expect(axisTicks(2, 4)).toEqual([0, 1]);
  });
});

/* ── table helpers ─────────────────────────────────────── */

function row(id: string, extra: Partial<HubLibraryRow> = {}): HubLibraryRow {
  return {
    id,
    title: `Title ${id}`,
    text: "",
    content_type: "long_video",
    cover_media_id: null,
    thumbnail_url: "",
    media_id: null,
    duration_seconds: 0,
    visibility: "public",
    scheduled_at: null,
    published_at: null,
    created_at: "2026-09-01T00:00:00Z",
    view_count: 0,
    comment_count: 0,
    like_count: 0,
    processing_status: "ready",
    flags: [],
    allow_download: false,
    source: null,
    ...extra,
  };
}

describe("filterLibraryRows", () => {
  const rows = [row("a", { title: "Cooking dal", visibility: "public" }), row("b", { title: "Bike repair", visibility: "private", flags: ["review_hold"] }), row("c", { title: "dal makhani", text: "Cooking again", visibility: "unlisted" })];

  test("title is case-insensitive and also matches the description", () => {
    expect(filterLibraryRows(rows, { visibility: "all", title: "DAL" }).map((r) => r.id)).toEqual(["a", "c"]);
    expect(filterLibraryRows(rows, { visibility: "all", title: "cooking" }).map((r) => r.id)).toEqual(["a", "c"]);
  });

  test("visibility and flag narrow further", () => {
    expect(filterLibraryRows(rows, { visibility: "private", title: "" }).map((r) => r.id)).toEqual(["b"]);
    expect(filterLibraryRows(rows, { visibility: "all", title: "", flag: "review_hold" }).map((r) => r.id)).toEqual(["b"]);
    expect(filterLibraryRows(rows, { visibility: "public", title: "bike" })).toEqual([]);
  });
});

describe("sortLibraryRows", () => {
  const rows = [
    row("a", { view_count: 5, comment_count: 1, published_at: "2026-09-03T00:00:00Z", title: "beta" }),
    row("b", { view_count: 50, comment_count: 1, published_at: "2026-09-01T00:00:00Z", title: "Alpha" }),
    row("c", { view_count: 5, comment_count: 9, scheduled_at: "2026-09-05T00:00:00Z", title: "gamma" }),
  ];

  test("published desc uses published_at, then scheduled_at, then created_at", () => {
    expect(sortLibraryRows(rows, "published", "desc").map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect(sortLibraryRows(rows, "published", "asc").map((r) => r.id)).toEqual(["b", "a", "c"]);
  });

  test("views, comments and title; ties break on id so the order is stable", () => {
    expect(sortLibraryRows(rows, "views", "desc").map((r) => r.id)).toEqual(["b", "a", "c"]);
    expect(sortLibraryRows(rows, "comments", "desc").map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect(sortLibraryRows(rows, "title", "asc").map((r) => r.id)).toEqual(["b", "a", "c"]);
    expect(sortLibraryRows(rows, "views", "asc")).not.toBe(rows);
  });
});

describe("dedupeRows / liveRows / toggleSelection", () => {
  test("dedupe keeps first sight", () => {
    expect(dedupeRows([row("a", { title: "first" }), row("b"), row("a", { title: "second" })]).map((r) => r.title)).toEqual(["first", "Title b"]);
  });

  test("liveRows is null until a row carries source", () => {
    expect(liveRows([row("a"), row("b")])).toBeNull();
    expect(liveRows([row("a", { source: "upload" }), row("b", { source: "live" })])!.map((r) => r.id)).toEqual(["b"]);
  });

  test("toggleSelection returns a new set", () => {
    const s = new Set(["a"]);
    const t = toggleSelection(s, "b");
    expect([...t]).toEqual(["a", "b"]);
    expect([...toggleSelection(t, "a")]).toEqual(["b"]);
    expect(s.size).toBe(1);
  });
});

/* ── formatters ─────────────────────────────────────────── */

describe("clock and tags", () => {
  test("formatMs / parseClock round-trip", () => {
    expect(formatMs(0)).toBe("0:00");
    expect(formatMs(65_000)).toBe("1:05");
    expect(formatMs(3_723_000)).toBe("1:02:03");
    expect(parseClock("1:05")).toBe(65_000);
    expect(parseClock("1:02:03")).toBe(3_723_000);
    expect(parseClock("90")).toBe(90_000);
    expect(parseClock("1:75")).toBeNull();
    expect(parseClock("abc")).toBeNull();
    expect(parseClock("")).toBeNull();
  });

  test("watch time and surfaces", () => {
    expect(formatWatchTime(30_000)).toBe("30s");
    expect(formatWatchTime(5 * 60_000)).toBe("5m");
    expect(formatWatchTime(2 * 3_600_000 + 60_000)).toBe("2h 1m");
    expect(surfaceLabel("home")).toBe("Watch");
    expect(surfaceLabel("push_notification")).toBe("Push notification");
  });

  test("splitTags dedupes, trims, drops the #", () => {
    expect(splitTags("#dal, Dal ,cooking,, ")).toEqual(["dal", "cooking"]);
  });

  test("diffPatch only carries what changed, arrays by value", () => {
    expect(diffPatch({ a: 1, b: [1, 2], c: "x" }, { a: 1, b: [1, 2], c: "y" })).toEqual({ c: "y" });
    expect(diffPatch({ b: [1] }, { b: [1, 2] })).toEqual({ b: [1, 2] });
    expect(diffPatch({ v: undefined }, { v: undefined })).toEqual({});
  });
});
