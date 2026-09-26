import { describe, expect, test } from "bun:test";

import {
  isNavItemCurrent,
  videoNav,
  REELS_MORE_PANEL,
  REELS_NAV_APPS,
  REELS_NAV_MORE,
  REELS_NAV_TOP,
  REELS_SIDEBAR_FOOTER,
  VIDEO_NAV_FOOTER,
  VIDEO_NAV_TOP,
  VIDEO_NAV_YOU,
} from "../nav";

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

  test("the sidebar chrome does not change PostTube's list", () => {
    expect(videoNav("tube", "sidebar")).toEqual(videoNav("tube", "header"));
    expect(videoNav("tube", "sidebar")).toEqual(videoNav("tube"));
  });

  test("every item has an icon, a unique key, and exactly one of href or action", () => {
    for (const all of [
      [...VIDEO_NAV_TOP, ...VIDEO_NAV_YOU, ...VIDEO_NAV_FOOTER],
      [...REELS_NAV_TOP, ...REELS_NAV_APPS, ...VIDEO_NAV_FOOTER],
      [...REELS_NAV_TOP, REELS_NAV_MORE, ...REELS_SIDEBAR_FOOTER],
    ]) {
      expect(new Set(all.map((i) => i.key)).size).toBe(all.length);
      for (const item of all) {
        expect(typeof item.icon).not.toBe("undefined");
        const hasHref = typeof item.href === "string" && item.href.startsWith("/");
        const hasAction = item.action === "explore" || item.action === "more";
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
    const s = videoNav("reels", "sidebar");
    s[0].items.pop();
    s[1].items.pop();
    expect(videoNav("reels", "sidebar")[0].items.length).toBe(REELS_NAV_TOP.length + 1);
    expect(videoNav("reels", "sidebar")[1].items.length).toBe(REELS_SIDEBAR_FOOTER.length);
  });
});

describe("videoNav (reels, header chrome)", () => {
  test("reads For You … Profile, then Home / PostTube / Liked reels, then the footer", () => {
    const sections = videoNav("reels");
    expect(sections.map((s) => s.key)).toEqual(["top", "apps", "footer"]);
    const top = sections[0];
    expect(top.items.map((i) => i.label)).toEqual(["For You", "Explore", "Following", "Friends", "LIVE", "Messages", "Activity", "Upload", "Profile"]);
    expect(top.items.map((i) => i.href ?? i.action)).toEqual([
      "/reels", "explore", "/reels?feed=following", "/connections", "/live", "/messenger", "/notifications", "/reels/create", "/profile",
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

describe("videoNav (reels, sidebar chrome)", () => {
  const sections = videoNav("reels", "sidebar");

  test("is TikTok's list: For You, Explore, Following … Profile, More — then the footer, no divider group", () => {
    expect(sections.map((s) => s.key)).toEqual(["top", "footer"]);
    expect(sections.find((s) => s.key === "apps")).toBeUndefined();
    const top = sections[0];
    expect(top.rail).toBe(true);
    expect(top.items.map((i) => i.label)).toEqual([
      "For You", "Explore", "Following", "Friends", "LIVE", "Messages", "Activity", "Upload", "Profile", "More",
    ]);
    expect(top.items.map((i) => i.href ?? i.action)).toEqual([
      "/reels", "explore", "/reels?feed=following", "/connections", "/live", "/messenger", "/notifications", "/reels/create", "/profile", "more",
    ]);
  });

  test("More is the last entry and the only one with the more action", () => {
    const top = sections[0];
    expect(top.items[top.items.length - 1]).toEqual(REELS_NAV_MORE);
    expect(top.items.filter((i) => i.action === "more")).toHaveLength(1);
    expect(REELS_NAV_MORE.href).toBeUndefined();
  });

  test("Home, PostTube and Liked reels are not in the main list; they live in the More panel", () => {
    const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).not.toContain("/");
    expect(hrefs).not.toContain("/posttube");
    expect(hrefs).not.toContain("/reels/liked");
    const apps = REELS_MORE_PANEL.find((s) => s.key === "apps")!;
    expect(apps.items.map((i) => i.href ?? i.action)).toEqual(["/", "/posttube", "/reels/liked", "explore"]);
  });

  test("the footer is About, Terms, Privacy, Help and stays out of the rail", () => {
    const footer = sections[1];
    expect(footer.rail).toBe(false);
    expect(footer.items.map((i) => [i.label, i.href])).toEqual([
      ["About", "/about"], ["Terms", "/terms"], ["Privacy", "/privacy"], ["Help", "/help"],
    ]);
  });
});

describe("REELS_MORE_PANEL", () => {
  test("Settings / Tools / Apps / Other, in that order, with the rows the screenshot shows", () => {
    expect(REELS_MORE_PANEL.map((s) => [s.key, s.title])).toEqual([
      ["settings", "Settings"], ["tools", "Tools"], ["apps", "Apps"], ["other", "Other"],
    ]);
    const rows = Object.fromEntries(REELS_MORE_PANEL.map((s) => [s.key, s.items.map((i) => [i.label, i.href ?? i.action])]));
    expect(rows.settings).toEqual([["General", "/settings"], ["Dark mode", "theme"]]);
    expect(rows.tools).toEqual([["Upload", "/reels/create"], ["Your channel", "/posttube/channel"], ["LIVE tools", "/live"]]);
    expect(rows.apps).toEqual([["Home", "/"], ["PostTube", "/posttube"], ["Liked reels", "/reels/liked"], ["Explore", "explore"]]);
    expect(rows.other).toEqual([["Help Center", "/help"], ["Log out", "logout"]]);
  });

  test("every row has an icon, a unique key, and exactly one of href or action", () => {
    const all = REELS_MORE_PANEL.flatMap((s) => s.items);
    expect(new Set(all.map((i) => i.key)).size).toBe(all.length);
    for (const item of all) {
      expect(typeof item.icon).not.toBe("undefined");
      const hasHref = typeof item.href === "string" && item.href.startsWith("/");
      const hasAction = item.action === "explore" || item.action === "theme" || item.action === "logout";
      expect(hasHref !== hasAction).toBe(true);
    }
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
    expect(isNavItemCurrent(REELS_NAV_MORE, "/reels")).toBe(false);
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
