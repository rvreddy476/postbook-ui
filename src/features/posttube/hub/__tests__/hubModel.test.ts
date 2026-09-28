import { describe, expect, test } from "bun:test";

import type { HubLibraryRow } from "../hubApi";
import {
  BULK_FIELDS,
  LIBRARY_FILTER_DEFAULT,
  LIBRARY_FILTER_FIELDS,
  activeFilterChips,
  buildBulkPatch,
  bulkFailures,
  clearFilterKey,
  parseViewsInput,
  readableHubError,
  rowPatchFromBulk,
  visibilityPlan,
  type LibraryFilter,
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
    description: "",
    made_for_kids: false,
    age_restricted: false,
    hide_like_count: false,
    default_comment_sort: "top",
    related_post_id: null,
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

describe("filterLibraryRows: the filter menu (hub batch)", () => {
  const rows = [
    row("a", { title: "Dal", description: "A slow Sunday recipe", view_count: 10, made_for_kids: true }),
    row("b", { title: "Bike", text: "Chain and gears", view_count: 250, age_restricted: true }),
    row("c", { title: "Rain", view_count: 5_000, flags: ["made_for_kids"] }),
    row("d", { title: "Cold open", view_count: 0 }),
  ];
  const f = (extra: Partial<LibraryFilter>): LibraryFilter => ({ ...LIBRARY_FILTER_DEFAULT, ...extra });

  test("the defaults match every row", () => {
    expect(filterLibraryRows(rows, LIBRARY_FILTER_DEFAULT).map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  });

  test("description matches the description, falling back to text, never the title", () => {
    expect(filterLibraryRows(rows, f({ description: "SUNDAY" })).map((r) => r.id)).toEqual(["a"]);
    expect(filterLibraryRows(rows, f({ description: "gears" })).map((r) => r.id)).toEqual(["b"]);
    expect(filterLibraryRows(rows, f({ description: "rain" }))).toEqual([]);
  });

  test("made for kids reads the column or the flag; age restriction yes / no", () => {
    expect(filterLibraryRows(rows, f({ madeForKids: "yes" })).map((r) => r.id)).toEqual(["a", "c"]);
    expect(filterLibraryRows(rows, f({ madeForKids: "no" })).map((r) => r.id)).toEqual(["b", "d"]);
    expect(filterLibraryRows(rows, f({ ageRestricted: "yes" })).map((r) => r.id)).toEqual(["b"]);
    expect(filterLibraryRows(rows, f({ ageRestricted: "no" })).map((r) => r.id)).toEqual(["a", "c", "d"]);
  });

  test("views range is inclusive at both ends; either end can be open; 0 is a real bound", () => {
    expect(filterLibraryRows(rows, f({ viewsMin: 10, viewsMax: 250 })).map((r) => r.id)).toEqual(["a", "b"]);
    expect(filterLibraryRows(rows, f({ viewsMin: 251 })).map((r) => r.id)).toEqual(["c"]);
    expect(filterLibraryRows(rows, f({ viewsMax: 0 })).map((r) => r.id)).toEqual(["d"]);
    expect(filterLibraryRows(rows, f({ viewsMin: null, viewsMax: null })).length).toBe(4);
    expect(filterLibraryRows(rows, f({ viewsMin: Number.NaN })).length).toBe(4);
  });

  test("filters combine", () => {
    expect(filterLibraryRows(rows, f({ madeForKids: "yes", viewsMin: 100 })).map((r) => r.id)).toEqual(["c"]);
  });

  test("chips: one per active filter in the menu's order, and ✕ clears just that one", () => {
    const filter = f({ title: " dal ", visibility: "private", madeForKids: "no", ageRestricted: "yes", viewsMin: 1000, viewsMax: 20000, description: "rain" });
    const chips = activeFilterChips(filter);
    expect(chips.map((c) => c.key)).toEqual(["ageRestricted", "description", "madeForKids", "title", "views", "visibility"]);
    expect(chips.map((c) => c.label)).toEqual(["Age-restricted", "Description: rain", "Not made for kids", "Title: dal", "Views 1,000–20,000", "Visibility: Private"]);
    expect(activeFilterChips(f({ viewsMin: 5 }))[0].label).toBe("Views ≥ 5");
    expect(activeFilterChips(f({ viewsMax: 0 }))[0].label).toBe("Views ≤ 0");
    expect(activeFilterChips(LIBRARY_FILTER_DEFAULT)).toEqual([]);
    const cleared = clearFilterKey(filter, "views");
    expect(cleared.viewsMin).toBeNull();
    expect(cleared.viewsMax).toBeNull();
    expect(cleared.title).toBe(" dal ");
    expect(clearFilterKey(filter, "visibility").visibility).toBe("all");
    expect(clearFilterKey(filter, "madeForKids").madeForKids).toBe("any");
  });

  test("the filter menu is in ascending alphabetical order", () => {
    const labels = LIBRARY_FILTER_FIELDS.map((x) => x.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
    expect(labels).toEqual(["Age restriction", "Description", "Made for kids", "Title", "Views", "Visibility"]);
  });

  test("views boxes: whole numbers with separators, blank = open", () => {
    expect(parseViewsInput("1,200")).toBe(1200);
    expect(parseViewsInput(" 0 ")).toBe(0);
    expect(parseViewsInput("")).toBeNull();
    expect(parseViewsInput("-3")).toBeNull();
    expect(parseViewsInput("1.5")).toBeNull();
    expect(parseViewsInput("abc")).toBeNull();
  });
});

describe("bulk edit fields (contract C)", () => {
  test("the Edit list is alphabetical and never offers title or description", () => {
    const labels = BULK_FIELDS.map((x) => x.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
    const keys = BULK_FIELDS.map((x) => x.key as string);
    expect(keys).not.toContain("title");
    expect(keys).not.toContain("text");
    expect(keys).toContain("visibility");
    expect(keys.length).toBe(17);
  });

  test("switches, choices, dates, topic, language and tags become the right patch", () => {
    expect(buildBulkPatch("visibility", "unlisted")).toEqual({ visibility: "unlisted" });
    expect(buildBulkPatch("visibility", "scheduled")).toBeNull();
    expect(buildBulkPatch("comments", "off")).toEqual({ no_comments: true });
    expect(buildBulkPatch("comments", "on")).toEqual({ no_comments: false });
    expect(buildBulkPatch("age_restricted", "on")).toEqual({ age_restricted: true });
    expect(buildBulkPatch("hide_like_count", "off")).toEqual({ hide_like_count: false });
    expect(buildBulkPatch("made_for_kids", "")).toBeNull();
    expect(buildBulkPatch("license", "creative_commons")).toEqual({ license: "creative_commons" });
    expect(buildBulkPatch("license", "cc-by")).toBeNull();
    expect(buildBulkPatch("comment_access", "followers")).toEqual({ comment_access: "followers" });
    expect(buildBulkPatch("default_comment_sort", "newest")).toEqual({ default_comment_sort: "newest" });
    expect(buildBulkPatch("remix_setting", "allow_audio_only")).toEqual({ remix_setting: "allow_audio_only" });
    expect(buildBulkPatch("recording_date", "2026-09-01")).toEqual({ recording_date: "2026-09-01" });
    expect(buildBulkPatch("recording_date", "01/09/2026")).toBeNull();
    expect(buildBulkPatch("category", "music")).toEqual({ category: "music" });
    expect(buildBulkPatch("language", "te")).toEqual({ language: "te" });
    expect(buildBulkPatch("tags", "#dal, Dal, rice")).toEqual({ tags: ["dal", "rice"], tags_mode: "add" });
    expect(buildBulkPatch("tags", "a", "remove")).toEqual({ tags: ["a"], tags_mode: "remove" });
    expect(buildBulkPatch("tags", "x, y", "replace")).toEqual({ tags: ["x", "y"], tags_mode: "replace" });
    expect(buildBulkPatch("tags", " , ")).toBeNull();
  });

  test("a successful patch updates the columns the table shows", () => {
    expect(rowPatchFromBulk({ visibility: "private", age_restricted: true, license: "standard" })).toEqual({ visibility: "private", age_restricted: true });
    expect(rowPatchFromBulk({ tags: ["a"], tags_mode: "add" })).toEqual({});
  });

  test("failures carry the row title and readable words", () => {
    const out = bulkFailures(
      [
        { post_id: "a", ok: true },
        { post_id: "b", ok: false, error: "FORBIDDEN" },
        { post_id: "z", ok: false, error: "SOMETHING_NEW" },
        { post_id: "y", ok: false },
      ],
      [row("a"), row("b", { title: "Bike" })],
    );
    expect(out).toEqual([
      { id: "b", title: "Bike", message: "Only the creator can change this video." },
      { id: "z", title: "A video", message: "It didn't go through (SOMETHING_NEW)." },
      { id: "y", title: "A video", message: "It didn't go through." },
    ]);
  });

  test("server codes read as sentences", () => {
    expect(readableHubError("INVALID_RECORDING_DATE")).toContain("future");
    expect(readableHubError("RELATED_SELF")).toContain("itself");
    expect(readableHubError("RELATED_NOT_FOUND")).toContain("your own");
    expect(readableHubError("TOO_MANY_SHARES")).toContain("50");
    expect(readableHubError("invalid_license")).toContain("license");
    expect(readableHubError(null, "fallback")).toBe("fallback");
    expect(readableHubError("NEW_CODE", "fallback")).toBe("fallback");
  });
});

describe("visibilityPlan (the popover's Save)", () => {
  const now = Date.parse("2026-09-28T10:00:00Z");
  const pub = { visibility: "public" as const, scheduled_at: null };
  const sched = { visibility: "scheduled" as const, scheduled_at: "2026-10-01T10:00:00Z" };

  test("same state → nothing to do; a new state → one visibility write", () => {
    expect(visibilityPlan(pub, "public", null, now)).toBeNull();
    expect(visibilityPlan(pub, "private", null, now)).toEqual({ publishNow: false, visibility: "private" });
  });

  test("leaving scheduled publishes now, then applies the state", () => {
    expect(visibilityPlan(sched, "unlisted", null, now)).toEqual({ publishNow: true, visibility: "unlisted" });
  });

  test("scheduling needs a future time; the same time again is nothing to do", () => {
    expect(visibilityPlan(pub, "scheduled", null, now)).toBeNull();
    expect(visibilityPlan(pub, "scheduled", "2026-09-28T09:00:00Z", now)).toBeNull();
    expect(visibilityPlan(pub, "scheduled", "not a date", now)).toBeNull();
    expect(visibilityPlan(pub, "scheduled", "2026-09-29T09:00:00Z", now)).toEqual({ publishNow: false, scheduleAt: "2026-09-29T09:00:00.000Z" });
    expect(visibilityPlan(sched, "scheduled", "2026-10-01T10:00:00.000Z", now)).toBeNull();
    expect(visibilityPlan(sched, "scheduled", "2026-10-02T10:00:00Z", now)?.scheduleAt).toBe("2026-10-02T10:00:00.000Z");
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
