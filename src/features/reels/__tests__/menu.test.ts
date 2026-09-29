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
    sound: null,
    originalVolume: 1,
    overlayVolume: 1,
    soundReuseAllowed: true,
    media: { mediaId: "m", width: 1080, height: 1920, durationMs: 1000, hlsUrl: null, fileUrl: "/f", downloadUrl: "/f", posterUrl: null, qualities: [] },
    ...extra,
  };
}

describe("moreMenuItems", () => {
  test("someone else's reel: Description (when there is text), Not interested, Don't recommend, Report, Use this sound — nothing else", () => {
    const items = moreMenuItems(reel({ caption: "hi", downloadAllowed: true, reasonText: "r" }), { isOwn: false, relationshipKnown: true, following: false });
    expect(items).toEqual(["description", "not-interested", "dont-recommend", "report", "use-sound"]);
  });

  test("reuse turned off by the creator: no Use this sound for anyone else", () => {
    const items = moreMenuItems(reel({ caption: "hi", soundReuseAllowed: false }), { isOwn: false, relationshipKnown: true, following: false });
    expect(items).toEqual(["description", "not-interested", "dont-recommend", "report"]);
  });

  test("the author may always use their own reel's sound, whatever the setting", () => {
    expect(moreMenuItems(reel({ soundReuseAllowed: false }), { isOwn: true, relationshipKnown: true, following: false })).toEqual(["use-sound"]);
  });

  test("a reel that plays an added sound offers that sound even when its own audio is locked", () => {
    const sound = { id: "s1", title: "Original sound - Asha", artist: "Asha", startMs: 0, durationMs: 1000, useCount: 1, sourcePostId: null };
    expect(moreMenuItems(reel({ sound, soundReuseAllowed: false }), { isOwn: false, relationshipKnown: true, following: false })).toEqual(["not-interested", "dont-recommend", "report", "use-sound"]);
  });

  test("a reel still processing has no sound to take", () => {
    expect(moreMenuItems(reel({ isProcessing: true }), { isOwn: true, relationshipKnown: true, following: false })).toEqual([]);
  });

  test("no caption and no hashtags: no Description row", () => {
    expect(moreMenuItems(reel(), { isOwn: false, relationshipKnown: true, following: false })).toEqual(["not-interested", "dont-recommend", "report", "use-sound"]);
    expect(moreMenuItems(reel({ hashtags: ["x"] }), { isOwn: false, relationshipKnown: true, following: false })).toEqual(["description", "not-interested", "dont-recommend", "report", "use-sound"]);
  });

  test("own reel: Description and Use this sound; never Not interested or Report", () => {
    expect(moreMenuItems(reel({ caption: "mine" }), { isOwn: true, relationshipKnown: true, following: false })).toEqual(["description", "use-sound"]);
    expect(moreMenuItems(reel(), { isOwn: true, relationshipKnown: true, following: false })).toEqual(["use-sound"]);
  });

  test("the cut rows never appear, whatever the reel carries", () => {
    const items = moreMenuItems(reel({ caption: "hi", downloadAllowed: true, reasonText: "r" }), { isOwn: false, relationshipKnown: true, following: true });
    for (const key of ["copy-link", "download", "why", "interested", "follow", "unfollow", "block", "delete", "clear-screen", "playback", "theater"]) {
      expect(items).not.toContain(key);
    }
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
