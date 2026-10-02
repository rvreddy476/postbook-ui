import { describe, expect, test } from "bun:test";

import { compareMoreLabels, moreRows, renditionCount, type MoreCapabilities, type MorePost, type MoreRowsInput, type MoreSurface } from "../moreRows";

/* A video with everything: two audio tracks, captions, three renditions, a description, sharing on, downloads allowed, a usable sound. */
const FULL: MorePost = {
  channelName: "Ravi",
  hasDescription: true,
  shareHidden: false,
  downloadAllowed: true,
  audioTrackCount: 2,
  hasCaptions: true,
  renditionCount: 3,
  usableSound: true,
};
const ALL: MoreCapabilities = { offline: true, edit: true, delete: true, manageAudio: true };

function input(surface: MoreSurface, post: Partial<MorePost> = {}, isOwner = false, can: Partial<MoreCapabilities> = {}): MoreRowsInput {
  return { surface, post: { ...FULL, ...post }, viewer: { isOwner }, can: { ...ALL, ...can } };
}
const labels = (i: MoreRowsInput) => moreRows(i).map((r) => r.label);
const keys = (i: MoreRowsInput) => moreRows(i).map((r) => r.key);
const sharedLabels = (i: MoreRowsInput) => moreRows(i).filter((r) => r.kind === "shared").map((r) => r.label);
const contextKeys = (i: MoreRowsInput) => moreRows(i).filter((r) => r.kind === "context").map((r) => r.key);

const SURFACES: MoreSurface[] = ["reels", "watch"];

describe("the shared More rows", () => {
  test("a viewer on a full video: the eleven shared rows, in these words, on both surfaces", () => {
    const want = ["Audio track", "Block Ravi", "Captions", "Copy link", "Description", "Don't recommend this channel", "Not interested", "Playback speed", "Quality", "Report", "Share"];
    expect(sharedLabels(input("reels"))).toEqual(want);
    expect(sharedLabels(input("watch"))).toEqual(want);
  });

  test("both surfaces return identical shared rows for the same item and viewer, whatever the item", () => {
    const posts: Partial<MorePost>[] = [
      {},
      { audioTrackCount: 1 },
      { hasCaptions: false },
      { renditionCount: 1 },
      { shareHidden: true },
      { hasDescription: false },
      { downloadAllowed: false, usableSound: false },
      { audioTrackCount: 1, hasCaptions: false, renditionCount: 0, shareHidden: true, hasDescription: false },
    ];
    for (const post of posts) {
      for (const isOwner of [false, true]) {
        const reels = moreRows(input("reels", post, isOwner)).filter((r) => r.kind === "shared");
        const watch = moreRows(input("watch", post, isOwner)).filter((r) => r.kind === "shared");
        expect(reels).toEqual(watch);
      }
    }
  });

  test("apart from the context rows the two lists are the same list", () => {
    const strip = (i: MoreRowsInput) => moreRows(i).filter((r) => r.key !== "auto-scroll" && r.key !== "use-sound" && r.key !== "edit");
    expect(strip(input("reels"))).toEqual(strip(input("watch")));
    expect(strip(input("reels", {}, true))).toEqual(strip(input("watch", {}, true)));
  });
});

describe("order", () => {
  test("ascending alphabetical by label, on both surfaces, viewer and owner", () => {
    for (const surface of SURFACES) {
      for (const isOwner of [false, true]) {
        const got = labels(input(surface, {}, isOwner));
        expect(got.length).toBeGreaterThan(8);
        expect([...got].sort(compareMoreLabels)).toEqual(got);
      }
    }
  });

  test("the full reels list and the full watch list, top to bottom", () => {
    expect(labels(input("reels"))).toEqual([
      "Audio track", "Auto scroll", "Block Ravi", "Captions", "Copy link", "Description", "Don't recommend this channel",
      "Not interested", "Playback speed", "Quality", "Report", "Save offline", "Share", "Use this sound",
    ]);
    expect(labels(input("watch"))).toEqual([
      "Audio track", "Block Ravi", "Captions", "Copy link", "Description", "Don't recommend this channel",
      "Not interested", "Playback speed", "Quality", "Report", "Save offline", "Share",
    ]);
    expect(labels(input("watch", {}, true))).toEqual([
      "Audio track", "Audio tracks", "Captions", "Copy link", "Delete", "Description", "Edit", "Playback speed", "Quality", "Save offline", "Share",
    ]);
  });
});

describe("visibility rules, the same on both surfaces", () => {
  test("own content: never Block, Don't recommend, Not interested or Report", () => {
    for (const surface of SURFACES) {
      const own = keys(input(surface, {}, true));
      for (const gone of ["block", "dont-recommend", "not-interested", "report"]) expect(own).not.toContain(gone);
      const other = keys(input(surface));
      for (const there of ["block", "dont-recommend", "not-interested", "report"]) expect(other).toContain(there);
    }
  });

  test("sharing off: no Share; Copy link stays", () => {
    for (const surface of SURFACES) {
      const off = keys(input(surface, { shareHidden: true }));
      expect(off).not.toContain("share");
      expect(off).toContain("copy-link");
      expect(keys(input(surface))).toContain("share");
    }
  });

  test("a single audio track: no Audio track row; two tracks: the row", () => {
    for (const surface of SURFACES) {
      expect(keys(input(surface, { audioTrackCount: 1 }))).not.toContain("audio");
      expect(keys(input(surface, { audioTrackCount: 0 }))).not.toContain("audio");
      expect(keys(input(surface, { audioTrackCount: 2 }))).toContain("audio");
    }
  });

  test("no captions: no Captions row", () => {
    for (const surface of SURFACES) {
      expect(keys(input(surface, { hasCaptions: false }))).not.toContain("captions");
      expect(keys(input(surface, { hasCaptions: true }))).toContain("captions");
    }
  });

  test("a single rendition: no Quality row; two: the row", () => {
    for (const surface of SURFACES) {
      expect(keys(input(surface, { renditionCount: 1 }))).not.toContain("quality");
      expect(keys(input(surface, { renditionCount: 0 }))).not.toContain("quality");
      expect(keys(input(surface, { renditionCount: 2 }))).toContain("quality");
    }
  });

  test("no description: no Description row", () => {
    for (const surface of SURFACES) {
      expect(keys(input(surface, { hasDescription: false }))).not.toContain("description");
      expect(keys(input(surface))).toContain("description");
    }
  });

  test("Copy link and Playback speed are always there", () => {
    for (const surface of SURFACES) {
      for (const isOwner of [false, true]) {
        const bare = keys(input(surface, { audioTrackCount: 1, hasCaptions: false, renditionCount: 1, shareHidden: true, hasDescription: false, downloadAllowed: false, usableSound: false }, isOwner, { offline: false, edit: false, delete: false, manageAudio: false }));
        expect(bare).toContain("copy-link");
        expect(bare).toContain("speed");
      }
    }
  });

  test("renditionCount counts distinct real rungs", () => {
    expect(renditionCount([])).toBe(0);
    expect(renditionCount([720])).toBe(1);
    expect(renditionCount([720, 720, 0])).toBe(1);
    expect(renditionCount([360, 720, 1080])).toBe(3);
  });
});

describe("context rows, only where allowed", () => {
  test("Auto scroll: reels only", () => {
    expect(contextKeys(input("reels"))).toContain("auto-scroll");
    expect(contextKeys(input("reels", {}, true))).toContain("auto-scroll");
    expect(keys(input("watch"))).not.toContain("auto-scroll");
    expect(keys(input("watch", {}, true))).not.toContain("auto-scroll");
  });

  test("Use this sound: a reel with a usable sound, never long video", () => {
    expect(contextKeys(input("reels"))).toContain("use-sound");
    expect(keys(input("reels", { usableSound: false }))).not.toContain("use-sound");
    expect(keys(input("watch", { usableSound: true }))).not.toContain("use-sound");
  });

  test("Save offline: the post allows it, or you own it — and only where the browser has private storage", () => {
    for (const surface of SURFACES) {
      expect(keys(input(surface, { downloadAllowed: true }))).toContain("offline");
      expect(keys(input(surface, { downloadAllowed: false }))).not.toContain("offline");
      expect(keys(input(surface, { downloadAllowed: false }, true))).toContain("offline");
      expect(keys(input(surface, { downloadAllowed: true }, true, { offline: false }))).not.toContain("offline");
    }
  });

  test("the owner's rows: on your own content only, and only where the screen exists", () => {
    for (const surface of SURFACES) {
      const viewer = keys(input(surface));
      for (const gone of ["delete", "edit", "manage-audio"]) expect(viewer).not.toContain(gone);
      const owner = keys(input(surface, {}, true));
      for (const there of ["delete", "edit", "manage-audio"]) expect(owner).toContain(there);
      const noScreens = keys(input(surface, {}, true, { edit: false, delete: false, manageAudio: false }));
      for (const gone of ["delete", "edit", "manage-audio"]) expect(noScreens).not.toContain(gone);
    }
  });

  test("every context row is one of the allowed six; nothing else differs", () => {
    const allowed = new Set(["auto-scroll", "use-sound", "offline", "delete", "edit", "manage-audio"]);
    for (const surface of SURFACES) {
      for (const isOwner of [false, true]) {
        for (const key of contextKeys(input(surface, {}, isOwner))) expect(allowed.has(key)).toBe(true);
        const shared = moreRows(input(surface, {}, isOwner)).filter((r) => r.kind === "shared").map((r) => r.key);
        for (const key of shared) expect(allowed.has(key)).toBe(false);
      }
    }
  });
});
