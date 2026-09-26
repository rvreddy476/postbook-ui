import { describe, expect, test } from "bun:test";

import { isNavItemCurrent, videoNav, REELS_NAV_APPS, REELS_NAV_TOP, VIDEO_NAV_FOOTER, VIDEO_NAV_TOP, VIDEO_NAV_YOU } from "../nav";

describe("videoNav (tube)", () => {
  test("top group is Home, Reels, PostTube, Explore and highlights the current app", () => {
    const tube = videoNav("tube").find((s) => s.key === "top")!;
    expect(tube.items.map((i) => i.label)).toEqual(["Home", "Reels", "PostTube", "Explore"]);
    expect(tube.items.map((i) => i.href ?? i.action)).toEqual(["/", "/reels", "/posttube", "explore"]);
    expect(tube.items.find((i) => i.key === "tube")!.active).toBe(true);
    expect(tube.items.find((i) => i.key === "reels")!.active).toBe(false);
  });

  test("the You section lists the library routes in order", () => {
    const you = videoNav("tube").find((s) => s.key === "you")!;
    expect(you.title).toBe("You");
    expect(you.items.map((i) => i.href)).toEqual([
      "/posttube/channel",
      "/posttube/history",
      "/posttube/playlists",
      "/posttube/uploads",
      "/saved",
      "/reels/liked",
      "/posttube/scheduled",
    ]);
    expect(you.items.map((i) => i.label)).toEqual([
      "Your channel", "History", "Playlists", "Your videos", "Saved", "Liked reels", "Scheduled",
    ]);
  });

  test("the footer has Settings, Help, Terms, Privacy and is not in the rail", () => {
    const footer = videoNav("tube").find((s) => s.key === "footer")!;
    expect(footer.rail).toBe(false);
    expect(footer.items.map((i) => [i.label, i.href])).toEqual([
      ["Settings", "/settings"], ["Help", "/help"], ["Terms", "/terms"], ["Privacy", "/privacy"],
    ]);
    expect(videoNav("tube").filter((s) => s.rail).map((s) => s.key)).toEqual(["top", "you"]);
  });

  test("every item has an icon, a unique key, and exactly one of href or action", () => {
    for (const all of [[...VIDEO_NAV_TOP, ...VIDEO_NAV_YOU, ...VIDEO_NAV_FOOTER], [...REELS_NAV_TOP, ...REELS_NAV_APPS, ...VIDEO_NAV_FOOTER]]) {
      expect(new Set(all.map((i) => i.key)).size).toBe(all.length);
      for (const item of all) {
        expect(typeof item.icon).not.toBe("undefined");
        const hasHref = typeof item.href === "string" && item.href.startsWith("/");
        const hasAction = item.action === "explore";
        expect(hasHref !== hasAction).toBe(true);
      }
    }
  });

  test("videoNav returns fresh arrays so callers cannot mutate the registry", () => {
    const a = videoNav("tube");
    a[1].items.pop();
    expect(videoNav("tube")[1].items.length).toBe(VIDEO_NAV_YOU.length);
    const r = videoNav("reels");
    r[0].items.pop();
    expect(videoNav("reels")[0].items.length).toBe(REELS_NAV_TOP.length);
  });
});

describe("videoNav (reels)", () => {
  test("reads For You … Profile, then Home / PostTube / Liked reels, then the footer", () => {
    const sections = videoNav("reels");
    expect(sections.map((s) => s.key)).toEqual(["top", "apps", "footer"]);
    const top = sections[0];
    expect(top.items.map((i) => i.label)).toEqual(["For You", "Following", "Explore", "Friends", "LIVE", "Messages", "Activity", "Upload", "Profile"]);
    expect(top.items.map((i) => i.href ?? i.action)).toEqual([
      "/reels", "/reels?feed=following", "explore", "/connections", "/live", "/messenger", "/notifications", "/reels/create", "/profile",
    ]);
    expect(sections[1].items.map((i) => [i.label, i.href])).toEqual([["Home", "/"], ["PostTube", "/posttube"], ["Liked reels", "/reels/liked"]]);
    expect(sections[2].items).toEqual([...VIDEO_NAV_FOOTER]);
  });

  test("only the first nine are in the rail; nothing is app-highlighted", () => {
    const sections = videoNav("reels");
    expect(sections.filter((s) => s.rail).map((s) => s.key)).toEqual(["top"]);
    expect(sections[0].items.length).toBe(9);
    for (const s of sections) for (const i of s.items) expect(Boolean(i.active)).toBe(false);
  });
});

describe("isNavItemCurrent", () => {
  test("matches the page itself and pages under it", () => {
    expect(isNavItemCurrent({ href: "/posttube/history" }, "/posttube/history")).toBe(true);
    expect(isNavItemCurrent({ href: "/posttube/playlists" }, "/posttube/playlists/abc")).toBe(true);
    expect(isNavItemCurrent({ href: "/posttube/playlists" }, "/posttube/playlistsx")).toBe(false);
    expect(isNavItemCurrent({ href: "/saved" }, "/saved?tab=reels")).toBe(true);
  });

  test("root only matches root; buttons are never current", () => {
    expect(isNavItemCurrent({ href: "/" }, "/")).toBe(true);
    expect(isNavItemCurrent({ href: "/" }, "/reels")).toBe(false);
    expect(isNavItemCurrent({ href: "/" }, null)).toBe(true);
    expect(isNavItemCurrent({}, "/reels")).toBe(false);
  });

  test("For You is current only on /reels without a feed param", () => {
    const forYou = REELS_NAV_TOP.find((i) => i.key === "for-you")!;
    expect(isNavItemCurrent(forYou, "/reels", "")).toBe(true);
    expect(isNavItemCurrent(forYou, "/reels", "reelId=abc")).toBe(true);
    expect(isNavItemCurrent(forYou, "/reels", "?feed=following")).toBe(false);
    expect(isNavItemCurrent(forYou, "/reels?feed=following")).toBe(false);
    expect(isNavItemCurrent(forYou, "/reels/liked", "")).toBe(false);
    expect(isNavItemCurrent(forYou, "/reels/create", "")).toBe(false);
  });

  test("Following is current only with ?feed=following", () => {
    const following = REELS_NAV_TOP.find((i) => i.key === "following")!;
    expect(isNavItemCurrent(following, "/reels", "feed=following")).toBe(true);
    expect(isNavItemCurrent(following, "/reels", "reelId=x&feed=following")).toBe(true);
    expect(isNavItemCurrent(following, "/reels", "")).toBe(false);
    expect(isNavItemCurrent(following, "/reels", "feed=foryou")).toBe(false);
    expect(isNavItemCurrent(following, "/reels/liked", "feed=following")).toBe(false);
  });

  test("Upload and Liked reels light up on their own pages, never For You", () => {
    const upload = REELS_NAV_TOP.find((i) => i.key === "upload")!;
    const liked = REELS_NAV_APPS.find((i) => i.key === "liked")!;
    expect(isNavItemCurrent(upload, "/reels/create", "")).toBe(true);
    expect(isNavItemCurrent(liked, "/reels/liked", "")).toBe(true);
    expect(isNavItemCurrent(upload, "/reels", "")).toBe(false);
  });
});
