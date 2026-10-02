import { describe, expect, test } from "bun:test";

import { reelChannelName, reelMoreRows } from "@/features/reels/components/ReelMoreMenu";
import { authorAction, MENU_SPEEDS } from "@/features/reels/menu";
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

/* A plain reel as the stage sees it: one audio track, no captions, one rendition, a download link and the audio dialog available. */
const PLAIN = { isOwn: false, audioTrackCount: 1, hasCaptions: false, qualityHeights: [] as number[], canKeep: true, canManageAudio: true };
const keys = (r: ReelItem, ctx: Partial<typeof PLAIN> = {}) => reelMoreRows(r, { ...PLAIN, ...ctx }).map((row) => row.key);
const labels = (r: ReelItem, ctx: Partial<typeof PLAIN> = {}) => reelMoreRows(r, { ...PLAIN, ...ctx }).map((row) => row.label);

describe("reelMoreRows: a reel on the shared More model", () => {
  test("someone else's plain reel with text: the shared rows that can work, Auto scroll and Use this sound", () => {
    expect(labels(reel({ caption: "hi", reasonText: "r" }))).toEqual([
      "Auto scroll", "Block A", "Copy link", "Description", "Don't recommend this channel", "Not interested", "Playback speed", "Report", "Share", "Use this sound",
    ]);
  });

  test("a reel with everything: every shared row, Keep a copy when downloads are allowed", () => {
    expect(labels(reel({ caption: "hi", downloadAllowed: true }), { audioTrackCount: 3, hasCaptions: true, qualityHeights: [360, 720, 1080] })).toEqual([
      "Audio track", "Auto scroll", "Block A", "Captions", "Copy link", "Description", "Don't recommend this channel",
      "Keep a copy", "Not interested", "Playback speed", "Quality", "Report", "Share", "Use this sound",
    ]);
  });

  test("the channel name in Block: the author's name, else the handle", () => {
    expect(reelChannelName(reel({ authorName: "Asha", authorUsername: "asha" }))).toBe("Asha");
    expect(reelChannelName(reel({ authorName: "", authorUsername: "asha" }))).toBe("@asha");
    expect(reelChannelName(reel({ authorName: "", authorUsername: "" }))).toBe("this channel");
  });

  test("reuse turned off by the creator: no Use this sound for anyone else", () => {
    expect(keys(reel({ caption: "hi", soundReuseAllowed: false }))).not.toContain("use-sound");
  });

  test("the author may always use their own reel's sound, whatever the setting", () => {
    expect(keys(reel({ soundReuseAllowed: false }), { isOwn: true })).toContain("use-sound");
  });

  test("a reel that plays an added sound offers that sound even when its own audio is locked", () => {
    const sound = { id: "s1", title: "Original sound - Asha", artist: "Asha", startMs: 0, durationMs: 1000, useCount: 1, sourcePostId: null };
    expect(keys(reel({ sound, soundReuseAllowed: false }))).toContain("use-sound");
  });

  test("a reel still processing has no sound to take", () => {
    expect(keys(reel({ isProcessing: true }), { isOwn: true })).not.toContain("use-sound");
  });

  test("no caption and no hashtags: no Description row", () => {
    expect(keys(reel())).not.toContain("description");
    expect(keys(reel({ hashtags: ["x"] }))).toContain("description");
    expect(keys(reel({ caption: "c" }))).toContain("description");
  });

  test("own reel: Audio tracks and Delete, Keep a copy, no feedback rows, and no Edit (a reel has no edit screen)", () => {
    expect(labels(reel({ caption: "mine" }), { isOwn: true })).toEqual([
      "Audio tracks", "Auto scroll", "Copy link", "Delete", "Description", "Keep a copy", "Playback speed", "Share", "Use this sound",
    ]);
    expect(keys(reel(), { isOwn: true })).not.toContain("edit");
  });

  test("sharing off: no Share; downloads off: no Keep a copy for a viewer", () => {
    expect(keys(reel({ shareHidden: true }))).not.toContain("share");
    expect(keys(reel({ downloadAllowed: false }))).not.toContain("keep");
    expect(keys(reel({ downloadAllowed: true }))).toContain("keep");
    expect(keys(reel({ downloadAllowed: true }), { canKeep: false })).not.toContain("keep");
  });

  test("the cut rows never appear, whatever the reel carries", () => {
    const got: string[] = keys(reel({ caption: "hi", downloadAllowed: true, reasonText: "r" }));
    for (const key of ["why", "interested", "follow", "unfollow", "clear-screen", "playback", "theater"]) {
      expect(got).not.toContain(key);
    }
  });
});

describe("menu speeds", () => {
  test("the preset chips are the player's speeds", () => {
    expect([...MENU_SPEEDS]).toEqual([...SPEEDS]);
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
