import { describe, expect, test } from "bun:test";

import { isNavItemCurrent, videoNav, VIDEO_NAV_FOOTER, VIDEO_NAV_TOP, VIDEO_NAV_YOU } from "../nav";

describe("videoNav", () => {
  test("top group is Home, Reels, PostTube, Explore and highlights the current app", () => {
    const reels = videoNav("reels");
    const top = reels.find((s) => s.key === "top")!;
    expect(top.items.map((i) => i.label)).toEqual(["Home", "Reels", "PostTube", "Explore"]);
    expect(top.items.map((i) => i.href ?? i.action)).toEqual(["/", "/reels", "/posttube", "explore"]);
    expect(top.items.find((i) => i.key === "reels")!.active).toBe(true);
    expect(top.items.find((i) => i.key === "tube")!.active).toBe(false);

    const tube = videoNav("tube").find((s) => s.key === "top")!;
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
    const footer = videoNav("reels").find((s) => s.key === "footer")!;
    expect(footer.rail).toBe(false);
    expect(footer.items.map((i) => [i.label, i.href])).toEqual([
      ["Settings", "/settings"], ["Help", "/help"], ["Terms", "/terms"], ["Privacy", "/privacy"],
    ]);
    expect(videoNav("reels").filter((s) => s.rail).map((s) => s.key)).toEqual(["top", "you"]);
  });

  test("every item has an icon, a unique key, and exactly one of href or action", () => {
    const all = [...VIDEO_NAV_TOP, ...VIDEO_NAV_YOU, ...VIDEO_NAV_FOOTER];
    expect(new Set(all.map((i) => i.key)).size).toBe(all.length);
    for (const item of all) {
      expect(typeof item.icon).not.toBe("undefined");
      const hasHref = typeof item.href === "string" && item.href.startsWith("/");
      const hasAction = item.action === "explore";
      expect(hasHref !== hasAction).toBe(true);
    }
  });

  test("videoNav returns fresh arrays so callers cannot mutate the registry", () => {
    const a = videoNav("reels");
    a[1].items.pop();
    expect(videoNav("reels")[1].items.length).toBe(VIDEO_NAV_YOU.length);
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
});
