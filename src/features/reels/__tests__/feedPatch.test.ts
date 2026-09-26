import { describe, expect, test } from "bun:test";
import type { InfiniteData } from "@tanstack/react-query";

import type { ReelPage } from "@/features/reels/data/reelFeedApi";
import { applyReelPatch, removeReel } from "@/features/reels/hooks/useReelFeed";
import type { ReelItem } from "@/features/reels/model";

function item(id: string, extra: Partial<ReelItem> = {}): ReelItem {
  return {
    id,
    authorId: "a",
    authorName: "A",
    authorUsername: "a",
    authorAvatarUrl: null,
    channelHandle: null,
    caption: "",
    hashtags: [],
    createdAt: "",
    likeCount: 2,
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

const data: InfiniteData<ReelPage> = {
  pageParams: [undefined, "c1"],
  pages: [
    { items: [item("a"), item("b")], nextCursor: "c1" },
    { items: [item("c")], nextCursor: undefined },
  ],
};

describe("applyReelPatch", () => {
  test("patches the one reel and leaves other pages by reference", () => {
    const out = applyReelPatch(data, "c", (r) => ({ viewerLiked: true, likeCount: r.likeCount + 1 }))!;
    expect(out.pages[1].items[0]).toMatchObject({ viewerLiked: true, likeCount: 3 });
    expect(out.pages[0]).toBe(data.pages[0]);
    expect(out.pages[1]).not.toBe(data.pages[1]);
  });
  test("an unknown id returns the same object (no re-render)", () => {
    expect(applyReelPatch(data, "zzz", { viewerLiked: true })).toBe(data);
    expect(applyReelPatch(undefined, "a", {})).toBeUndefined();
  });
});

describe("removeReel", () => {
  test("drops the reel from whichever page holds it", () => {
    const out = removeReel(data, "a")!;
    expect(out.pages[0].items.map((i) => i.id)).toEqual(["b"]);
    expect(out.pages[1].items.map((i) => i.id)).toEqual(["c"]);
  });
});
