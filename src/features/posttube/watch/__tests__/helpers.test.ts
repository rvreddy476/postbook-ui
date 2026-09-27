import { describe, expect, test } from "bun:test";

import { chapterAt, chapterIndexAt, chapterTicks, normalizeChapters } from "../chapters";
import { collectionNeighbours, collectionWatchHref } from "../collectionNav";
import { keyHelpRows } from "../keysHelp";
import { descriptionNeedsMore, descriptionSegments, timestampToMs } from "../linkify";
import { RAIL_IDLE, railReducer } from "../railState";
import { scheduleSleep, sleepDue, sleepRemainingMs, sleepValueLabel } from "../sleepTimer";
import { parseStoryboardVtt, parseVttTimestamp, storyboardCueAt } from "../storyboard";
import { upNextChipQuery, upNextPills } from "../upNext";
import { parseWatchPrefs } from "../watchPrefs";
import { watchMoreMenuRows } from "../components/WatchMoreMenu";

/* ── chapters ─────────────────────────────────────────── */

const chapters = normalizeChapters([
  { start_ms: 130_000, title: "Middle" },
  { start_ms: 0, title: "Intro" },
  { start_ms: 300_000, title: "" },
  { start_ms: 130_000, title: "dupe" },
  { start_ms: -5, title: "negative" },
  "junk",
]);

describe("chapters", () => {
  test("normalize sorts, drops duplicates and garbage, names an untitled one by its clock", () => {
    expect(chapters).toEqual([
      { startMs: 0, title: "Intro" },
      { startMs: 130_000, title: "Middle" },
      { startMs: 300_000, title: "5:00" },
    ]);
    expect(normalizeChapters(null)).toEqual([]);
  });
  test("chapterAt(ms): the one that started last; null before the first / with none", () => {
    expect(chapterAt(chapters, 0)?.title).toBe("Intro");
    expect(chapterAt(chapters, 129_999)?.title).toBe("Intro");
    expect(chapterAt(chapters, 130_000)?.title).toBe("Middle");
    expect(chapterAt(chapters, 9_999_999)?.title).toBe("5:00");
    expect(chapterAt([{ startMs: 10_000, title: "Late" }], 5_000)).toBeNull();
    expect(chapterAt([], 5_000)).toBeNull();
    expect(chapterIndexAt(chapters, 200_000)).toBe(1);
    expect(chapterIndexAt(chapters, NaN)).toBe(-1);
  });
  test("ticks skip the one at 0 and anything past the end", () => {
    expect(chapterTicks(chapters, 600_000).map((t) => [Math.round(t.pct * 100) / 100, t.title])).toEqual([
      [21.67, "Middle"],
      [50, "5:00"],
    ]);
    expect(chapterTicks(chapters, 200_000)).toHaveLength(1);
    expect(chapterTicks(chapters, 0)).toEqual([]);
  });
});

/* ── sleep timer ──────────────────────────────────────── */

describe("sleep timer scheduling", () => {
  const now = 1_700_000_000_000;
  test("minutes → a wall-clock moment; End of video → the ended event; Off → nothing", () => {
    expect(scheduleSleep("15", now)).toEqual({ kind: "at", fireAt: now + 15 * 60_000 });
    expect(scheduleSleep("30", now)).toEqual({ kind: "at", fireAt: now + 30 * 60_000 });
    expect(scheduleSleep("60", now)).toEqual({ kind: "at", fireAt: now + 60 * 60_000 });
    expect(scheduleSleep("end", now)).toEqual({ kind: "end" });
    expect(scheduleSleep("off", now)).toBeNull();
  });
  test("remaining and due", () => {
    const s = scheduleSleep("15", now);
    expect(sleepRemainingMs(s, now + 60_000)).toBe(14 * 60_000);
    expect(sleepRemainingMs(s, now + 99 * 60_000)).toBe(0);
    expect(sleepRemainingMs(scheduleSleep("end", now), now)).toBeNull();
    expect(sleepDue(s, now + 14 * 60_000)).toBe(false);
    expect(sleepDue(s, now + 15 * 60_000)).toBe(true);
    expect(sleepDue(scheduleSleep("end", now), now + 1e9)).toBe(false);
  });
  test("the value beside the row", () => {
    expect(sleepValueLabel("off", null, now)).toBe("Off");
    expect(sleepValueLabel("end", scheduleSleep("end", now), now)).toBe("End of video");
    expect(sleepValueLabel("30", scheduleSleep("30", now), now + 60_000)).toBe("29 min left");
    expect(sleepValueLabel("15", scheduleSleep("15", now), now + 14.5 * 60_000)).toBe("1 min left");
  });
});

/* ── storyboard ───────────────────────────────────────── */

const VTT = `WEBVTT

00:00:00.000 --> 00:00:06.000
storyboard.jpg#xywh=0,0,160,90

00:00:06.000 --> 00:00:12.000
storyboard.jpg#xywh=160,0,160,90

00:12.000 --> 00:18.000
storyboard.jpg#xywh=320,0,160,90

00:00:18.000 --> 00:00:10.000
storyboard.jpg#xywh=480,0,160,90

00:00:24.000 --> 00:00:30.000
no-xywh-here
`;

describe("storyboard VTT", () => {
  test("timestamps in both shapes", () => {
    expect(parseVttTimestamp("00:01:02.500")).toBe(62_500);
    expect(parseVttTimestamp("01:02.5")).toBe(62_500);
    expect(parseVttTimestamp("nope")).toBeNull();
  });
  test("parseStoryboardVtt → {start, end, x, y, w, h}; bad ranges and cues without xywh are skipped; the image is rewritten", () => {
    const cues = parseStoryboardVtt(VTT, () => "/v1/media/m1/serve/storyboard_jpg");
    expect(cues).toEqual([
      { start: 0, end: 6_000, x: 0, y: 0, w: 160, h: 90, image: "/v1/media/m1/serve/storyboard_jpg" },
      { start: 6_000, end: 12_000, x: 160, y: 0, w: 160, h: 90, image: "/v1/media/m1/serve/storyboard_jpg" },
      { start: 12_000, end: 18_000, x: 320, y: 0, w: 160, h: 90, image: "/v1/media/m1/serve/storyboard_jpg" },
    ]);
    expect(parseStoryboardVtt("not a vtt")).toEqual([]);
    expect(parseStoryboardVtt("WEBVTT\n\n00:00.000 --> 00:06.000\nstoryboard.jpg#xywh=0,0,160,90")[0].image).toBe("storyboard.jpg");
  });
  test("storyboardCueAt", () => {
    const cues = parseStoryboardVtt(VTT);
    expect(storyboardCueAt(cues, 0)?.x).toBe(0);
    expect(storyboardCueAt(cues, 5_999)?.x).toBe(0);
    expect(storyboardCueAt(cues, 6_000)?.x).toBe(160);
    expect(storyboardCueAt(cues, 17_999)?.x).toBe(320);
    expect(storyboardCueAt(cues, 18_000)).toBeNull();
    expect(storyboardCueAt([], 0)).toBeNull();
  });
});

/* ── up next chips ────────────────────────────────────── */

describe("Up next pills → chip=", () => {
  test("All sends nothing; topic, fresh and seen map to the related chip", () => {
    expect(upNextChipQuery("all")).toEqual({});
    expect(upNextChipQuery("topic", "science-tech")).toEqual({ chip: "topic:science-tech" });
    expect(upNextChipQuery("topic", null)).toEqual({});
    expect(upNextChipQuery("fresh")).toEqual({ chip: "fresh" });
    expect(upNextChipQuery("seen")).toEqual({ chip: "seen" });
  });
  test("the topic pill only exists with a topic; the order is All · topic · Fresh · Seen", () => {
    expect(upNextPills({ slug: "howto-style", label: "How-to & style" }).map((p) => p.label)).toEqual(["All", "How-to & style", "Fresh", "Seen"]);
    expect(upNextPills(null).map((p) => p.id)).toEqual(["all", "fresh", "seen"]);
  });
});

/* ── rail: love / pass exclusivity ────────────────────── */

describe("rail reducer", () => {
  test("love bumps the count and clears pass; pass clears love and the count follows", () => {
    let s = railReducer(RAIL_IDLE, { type: "sync", loved: false, passed: true, likeCount: 10 });
    expect(s).toEqual({ loved: false, passed: true, likeCount: 10 });
    s = railReducer(s, { type: "love" });
    expect(s).toEqual({ loved: true, passed: false, likeCount: 11 });
    s = railReducer(s, { type: "pass" });
    expect(s).toEqual({ loved: false, passed: true, likeCount: 10 });
    s = railReducer(s, { type: "pass" });
    expect(s).toEqual({ loved: false, passed: false, likeCount: 10 });
    s = railReducer(s, { type: "love" });
    s = railReducer(s, { type: "love" });
    expect(s).toEqual({ loved: false, passed: false, likeCount: 10 });
  });
  test("the server's answer settles love; a sync never lights both; revert restores", () => {
    const s = railReducer({ loved: false, passed: true, likeCount: 3 }, { type: "settle-love", loved: true, likeCount: 4 });
    expect(s).toEqual({ loved: true, passed: false, likeCount: 4 });
    expect(railReducer(RAIL_IDLE, { type: "sync", loved: true, passed: true, likeCount: 1 })).toEqual({ loved: true, passed: false, likeCount: 1 });
    expect(railReducer(s, { type: "revert", state: { loved: false, passed: true, likeCount: 3 } })).toEqual({ loved: false, passed: true, likeCount: 3 });
    expect(railReducer({ loved: false, passed: false, likeCount: 0 }, { type: "love" }).likeCount).toBe(1);
    expect(railReducer({ loved: true, passed: false, likeCount: 0 }, { type: "love" }).likeCount).toBe(0);
  });
});

/* ── collection navigation ────────────────────────────── */

describe("collection prev / next", () => {
  const ids = ["a", "b", "c"];
  test("wraps at both ends", () => {
    expect(collectionNeighbours(ids, "a")).toEqual({ index: 0, prev: "c", next: "b", count: 3 });
    expect(collectionNeighbours(ids, "b")).toEqual({ index: 1, prev: "a", next: "c", count: 3 });
    expect(collectionNeighbours(ids, "c")).toEqual({ index: 2, prev: "b", next: "a", count: 3 });
  });
  test("one item has no neighbours; a video not in the list starts it; an empty list has nothing", () => {
    expect(collectionNeighbours(["a"], "a")).toEqual({ index: 0, prev: null, next: null, count: 1 });
    expect(collectionNeighbours(ids, "zz")).toEqual({ index: -1, prev: null, next: "a", count: 3 });
    expect(collectionNeighbours([], "a")).toEqual({ index: -1, prev: null, next: null, count: 0 });
    expect(collectionNeighbours(["a", "a", "b"], "b").count).toBe(2);
  });
  test("the href keeps the list", () => {
    expect(collectionWatchHref("v1", "pl 1")).toBe("/posttube/watch/v1?list=pl%201");
    expect(collectionWatchHref("v1", null)).toBe("/posttube/watch/v1");
  });
});

/* ── description ──────────────────────────────────────── */

describe("description linkify", () => {
  test("urls, hashtags and timestamps", () => {
    const segs = descriptionSegments("See https://example.com/x). #Momentum at 1:02:03 and 0:45, not 12:345.");
    expect(segs).toEqual([
      { kind: "text", text: "See " },
      { kind: "url", text: "https://example.com/x", href: "https://example.com/x" },
      { kind: "text", text: ")." },
      { kind: "text", text: " " },
      { kind: "hashtag", text: "#Momentum", tag: "Momentum" },
      { kind: "text", text: " at " },
      { kind: "timestamp", text: "1:02:03", ms: 3_723_000 },
      { kind: "text", text: " and " },
      { kind: "timestamp", text: "0:45", ms: 45_000 },
      { kind: "text", text: ", not 12:345." },
    ]);
    expect(timestampToMs("2:30")).toBe(150_000);
    expect(descriptionSegments("")).toEqual([]);
  });
  test("More appears past three lines or 220 characters", () => {
    expect(descriptionNeedsMore("one\ntwo\nthree")).toBe(false);
    expect(descriptionNeedsMore("one\ntwo\nthree\nfour")).toBe(true);
    expect(descriptionNeedsMore("x".repeat(221))).toBe(true);
  });
});

/* ── keys pane, more menu, prefs ──────────────────────── */

describe("keys pane from the key map", () => {
  test("carries I (miniplayer) and T (theater) and the digit row", () => {
    const rows = keyHelpRows();
    const by = Object.fromEntries(rows.map((r) => [r.action, r.keys]));
    expect(by["Play / pause"]).toEqual(["Space", "K"]);
    expect(by["Miniplayer"]).toEqual(["I"]);
    expect(by["Theater"]).toEqual(["T"]);
    expect(by["Next video"]).toEqual(["N"]);
    expect(by["Jump to that tenth"]).toEqual(["0–9"]);
    expect(by["Back 10 s"]).toEqual(["J"]);
    expect(by["Forward 5 s"]).toEqual(["→"]);
  });
});

describe("the rail's More rows, ascending", () => {
  test("viewer and owner", () => {
    expect(watchMoreMenuRows(false, "Ravi").map((r) => r.label)).toEqual(["Block Ravi", "Don't recommend this channel", "Not interested", "Report"]);
    expect(watchMoreMenuRows(true, "Ravi").map((r) => r.label)).toEqual(["Audio tracks", "Delete", "Edit"]);
  });
});

describe("watch prefs", () => {
  test("defaults and a stored shape", () => {
    expect(parseWatchPrefs(null)).toEqual({ ambient: true, stableVolume: false, audioLanguage: null });
    expect(parseWatchPrefs('{"ambient":false,"stableVolume":true,"audioLanguage":"HI"}')).toEqual({ ambient: false, stableVolume: true, audioLanguage: "hi" });
    expect(parseWatchPrefs('{"audioLanguage":"not a tag!"}').audioLanguage).toBeNull();
    expect(parseWatchPrefs("{bad").ambient).toBe(true);
  });
});
