import { describe, expect, test } from "bun:test";

import { authorAction, MENU_SPEEDS, moreMenuItems, PLAYBACK_ROWS } from "@/features/reels/menu";
import type { ReelItem } from "@/features/reels/model";
import { SPEEDS } from "@/features/reels/playback/playerPrefs";

function reel(extra: Partial<ReelItem> = {}): ReelItem {
  return {
    id: "r",
    authorId: "a",
    authorName: "A",
    authorUsername: "a",
    authorAvatarUrl: null,
    channelHandle: null,
    caption: "",
    hashtags: [],
    createdAt: "",
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
    viewCount: 0,
    viewerLiked: false,
    viewerSaved: false,
    commentsDisabled: false,
    shareHidden: false,
    downloadAllowed: false,
    isProcessing: false,
    reasonText: null,
    media: { mediaId: "m", width: 1080, height: 1920, durationMs: 1000, hlsUrl: null, fileUrl: "/f", downloadUrl: "/f", posterUrl: null, qualities: [] },
    ...extra,
  };
}

describe("moreMenuItems", () => {
  test("own reel: Delete, never Block / Follow / Interested / feedback rows", () => {
    const items = moreMenuItems(reel({ reasonText: "Popular" }), { isOwn: true, relationshipKnown: true, following: false });
    expect(items).toContain("delete");
    expect(items).toContain("clear-screen");
    for (const key of ["block", "follow", "unfollow", "interested", "not-interested", "dont-recommend", "report"]) {
      expect(items).not.toContain(key);
    }
  });

  test("a suggested reel offers Interested; a followed one does not", () => {
    const suggested = moreMenuItems(reel({ reasonText: "Because you watched" }), { isOwn: false, relationshipKnown: true, following: false });
    expect(suggested).toContain("why");
    expect(suggested).toContain("interested");
    const plain = moreMenuItems(reel(), { isOwn: false, relationshipKnown: true, following: true });
    expect(plain).not.toContain("interested");
    expect(plain).not.toContain("why");
  });

  test("Follow / Unfollow only once the relationship is known", () => {
    expect(moreMenuItems(reel(), { isOwn: false, relationshipKnown: false, following: false })).not.toContain("follow");
    expect(moreMenuItems(reel(), { isOwn: false, relationshipKnown: true, following: false })).toContain("follow");
    expect(moreMenuItems(reel(), { isOwn: false, relationshipKnown: true, following: true })).toContain("unfollow");
    // No username → nothing to call the follow route with.
    expect(moreMenuItems(reel({ authorUsername: "" }), { isOwn: false, relationshipKnown: true, following: false })).not.toContain("follow");
  });

  test("someone else's reel: Block, Not interested, Don't recommend, Report; no Delete", () => {
    const items = moreMenuItems(reel(), { isOwn: false, relationshipKnown: true, following: false });
    expect(items).toContain("block");
    expect(items).toContain("not-interested");
    expect(items).toContain("dont-recommend");
    expect(items).toContain("report");
    expect(items).not.toContain("delete");
  });

  test("order: link and info first, relationship rows, clear screen, feedback and report last; no playback keys", () => {
    const items = moreMenuItems(reel({ caption: "hi", downloadAllowed: true, reasonText: "r" }), { isOwn: false, relationshipKnown: true, following: false });
    expect(items).toEqual([
      "copy-link", "description", "download", "why",
      "interested", "follow", "block",
      "clear-screen",
      "not-interested", "dont-recommend", "report",
    ]);
    expect(items).not.toContain("playback");
    expect(items).not.toContain("theater");
  });
});

describe("playback rows", () => {
  test("Speed, Quality, Auto scroll, Theater mode, Captions — in that order, above the mapped rows", () => {
    expect([...PLAYBACK_ROWS]).toEqual(["speed", "quality", "auto-scroll", "theater", "captions"]);
  });
  test("the speed control offers exactly 0.75 / 1 / 1.25 / 1.5 / 2 (0.5 stays a valid stored value)", () => {
    expect([...MENU_SPEEDS]).toEqual([0.75, 1, 1.25, 1.5, 2]);
    for (const s of MENU_SPEEDS) expect(SPEEDS).toContain(s);
    expect(SPEEDS).toContain(0.5);
  });
});

describe("authorAction", () => {
  test("a channel reel subscribes, a plain creator follows, own reel does nothing", () => {
    expect(authorAction(reel({ channelHandle: "chan" }), false)).toBe("subscribe");
    expect(authorAction(reel(), false)).toBe("follow");
    expect(authorAction(reel({ channelHandle: "chan" }), true)).toBe("none");
    expect(authorAction(reel({ authorUsername: "" }), false)).toBe("none");
  });
});
