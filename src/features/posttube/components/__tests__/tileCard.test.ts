import { describe, expect, test } from "bun:test";
import { subscribersLabel, timeAgo, viewsLabel } from "../../model";
import { tileMenuRows } from "../tileMenuRows";

const NOW = new Date(2026, 9, 19, 12, 0, 0).getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("timeAgo on PostTube", () => {
  test("words, not shorthand", () => {
    expect(timeAgo(ago(30_000), NOW)).toBe("just now");
    expect(timeAgo(ago(5 * 60_000), NOW)).toBe("5 min ago");
    expect(timeAgo(ago(3_600_000), NOW)).toBe("1 hour ago");
    expect(timeAgo(ago(2 * 3_600_000), NOW)).toBe("2 hours ago");
    expect(timeAgo(ago(86_400_000), NOW)).toBe("1 day ago");
    expect(timeAgo(ago(3 * 86_400_000), NOW)).toBe("3 days ago");
  });
  test("a week or more is the date, never 19d ago or 2mo ago", () => {
    expect(timeAgo(new Date(2026, 8, 30, 9).toISOString(), NOW)).toBe("30 Sep");
    expect(timeAgo(new Date(2025, 6, 4, 9).toISOString(), NOW)).toBe("4 Jul 2025");
  });
  test("missing or bad dates print nothing", () => {
    expect(timeAgo(null, NOW)).toBe("");
    expect(timeAgo("nope", NOW)).toBe("");
  });
});

describe("viewsLabel", () => {
  test("no views reads as such", () => {
    expect(viewsLabel(0)).toBe("No views yet");
    expect(viewsLabel(1)).toBe("1 view");
    expect(viewsLabel(42)).toBe("42 views");
    expect(subscribersLabel(1)).toBe("1 subscriber");
    expect(subscribersLabel(12)).toBe("12 subscribers");
  });
});

describe("tileMenuRows", () => {
  const labels = (o: Parameters<typeof tileMenuRows>[0]) => tileMenuRows(o).map((r) => r.label);

  test("signed out: only what needs no account", () => {
    expect(labels({ signedIn: false, own: false, queued: false })).toEqual(["Copy link", "Share"]);
  });
  test("signed in, someone else's video: the whole list, alphabetical", () => {
    expect(labels({ signedIn: true, own: false, queued: false })).toEqual([
      "Add to collection",
      "Copy link",
      "Don't recommend this channel",
      "Not interested",
      "Share",
      "Watch later",
    ]);
  });
  test("your own video has no not-interested rows; a queued one offers removal", () => {
    expect(labels({ signedIn: true, own: true, queued: true })).toEqual([
      "Add to collection",
      "Copy link",
      "Remove from Watch later",
      "Share",
    ]);
  });
});
