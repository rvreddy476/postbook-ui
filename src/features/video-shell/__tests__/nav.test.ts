import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  isNavItemCurrent,
  videoNav,
  REELS_MORE_PANEL,
  REELS_NAV_APPS,
  REELS_NAV_MORE,
  REELS_NAV_TOP,
  REELS_SIDEBAR_COPYRIGHT,
  REELS_SIDEBAR_FOOTER,
  REELS_SIDEBAR_METRICS,
  VIDEO_NAV_FOOTER,
  VIDEO_NAV_TOP,
  VIDEO_NAV_YOU,
} from "../nav";

/** Whether `src/app<href>/page.tsx` exists — the nav's coming-soon flag is checked against it. */
const appDir = resolve(import.meta.dir, "../../../app");
const routeExists = (href: string) => existsSync(resolve(appDir, `.${href}/page.tsx`)) || existsSync(resolve(appDir, `.${href}/[[...path]]/page.tsx`));

describe("videoNav (tube)", () => {
  test("top group reads Watch, Reels, Subscriptions, Live, Trending, Topics — the RUTUBE words, no app highlight", () => {
    const tube = videoNav("tube").find((s) => s.key === "top")!;
    expect(tube.items.map((i) => i.label)).toEqual(["Watch", "Reels", "Subscriptions", "Live", "Trending", "Topics"]);
    expect(tube.items.map((i) => i.href)).toEqual(["/posttube", "/reels", "/posttube/subscriptions", "/live", "/posttube/trending", "/posttube/topics"]);
    for (const i of tube.items) expect(Boolean(i.active)).toBe(false);
    expect(tube.items.find((i) => i.key === "watch")!.exact).toBe(true);
  });

  test("Watch is current on the home grid only; Subscriptions on its page", () => {
    const watch = VIDEO_NAV_TOP.find((i) => i.key === "watch")!;
    expect(isNavItemCurrent(watch, "/posttube", "")).toBe(true);
    expect(isNavItemCurrent(watch, "/posttube/watch/abc", "")).toBe(false);
    expect(isNavItemCurrent(watch, "/posttube/history", "")).toBe(false);
    const following = VIDEO_NAV_TOP.find((i) => i.key === "following")!;
    expect(isNavItemCurrent(following, "/posttube/subscriptions", "")).toBe(true);
    expect(isNavItemCurrent(following, "/posttube", "")).toBe(false);
  });

  test("the You section reads Your channel, History, Watch later, Liked videos, Collections, Your videos, Scheduled, Creator Hub", () => {
    const you = videoNav("tube").find((s) => s.key === "you")!;
    expect(you.title).toBe("You");
    expect(you.items.map((i) => i.href)).toEqual([
      "/posttube/channel",
      "/posttube/history",
      "/posttube/queue",
      "/posttube/loved",
      "/posttube/playlists",
      "/posttube/uploads",
      "/posttube/scheduled",
      "/posttube/hub",
    ]);
    expect(you.items.map((i) => i.label)).toEqual([
      "Your channel", "History", "Watch later", "Liked videos", "Collections", "Your videos", "Scheduled", "Creator Hub",
    ]);
  });

  test("the tube menu speaks RUTUBE's words (founder, 28 Sep): none of the retired ones", () => {
    const labels = videoNav("tube").flatMap((s) => s.items.map((i) => i.label));
    for (const retired of ["Following", "Queue", "Loved", "Recent", "Liked reels", "PostTube"]) {
      expect(labels).not.toContain(retired);
    }
  });

  test("coming-soon rows are exactly the routes that have no page yet, and every other row has one", () => {
    // The rail groups only: the footer's Help / Terms links are the app's, not this menu's.
    const rows = videoNav("tube").filter((s) => s.rail).flatMap((s) => s.items).filter((i) => i.href);
    const soon = rows.filter((i) => i.comingSoon).map((i) => i.href);
    // Every tube page has landed; nothing is flagged. A new flagged row must be added here on purpose.
    expect(soon).toEqual([]);
    for (const item of rows) {
      // A flagged row whose page has landed means the flag was forgotten; an
      // unflagged row without a page is a dead link.
      expect([item.href, routeExists(item.href!)]).toEqual([item.href, !item.comingSoon]);
    }
  });

  test("the sidebar CSS draws a coming-soon row dimmed with a tag that the rail hides", () => {
    const css = readFileSync(resolve(import.meta.dir, "../video-shell.css"), "utf8");
    expect(css).toContain(".video-nav__item.is-soon { color: rgb(var(--brand-text) / .45); cursor: default; }");
    expect(css).toContain(".video-nav__tag {");
    expect(css).toContain(".video-nav.is-rail .video-nav__tag { display: none; }");
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

  test("the footer reads About · Help / Terms & Policies · Privacy, then © 2026 VChat, and stays out of the rail", () => {
    const footer = sections[1];
    expect(footer.rail).toBe(false);
    expect(footer.items.map((i) => [i.label, i.href])).toEqual([
      ["About", "/about"], ["Help", "/help"], ["Terms & Policies", "/terms"], ["Privacy", "/privacy"],
    ]);
    expect(REELS_SIDEBAR_COPYRIGHT).toBe("© 2026 VChat");
  });

  test("TikTok's menu geometry, and the CSS that draws it", () => {
    expect(REELS_SIDEBAR_METRICS).toEqual({
      expandedWidth: 240,
      railWidth: 72,
      morePanelWidth: 320,
      logoTop: 20,
      logoHeight: 28,
      searchTop: 64,
      searchHeight: 40,
      listTop: 128,
      rowHeight: 40,
      rowGap: 4,
      moreRowHeight: 48,
      themeRowHeight: 60,
      segmentWidth: 32,
      segmentHeight: 25,
      footerPadding: 24,
    });
    const m = REELS_SIDEBAR_METRICS;
    // The pill sits 16px under the 28px logo row that starts at 20; the list 24px under the pill.
    expect(m.logoTop + m.logoHeight + 16).toBe(m.searchTop);
    expect(m.searchTop + m.searchHeight + 24).toBe(m.listTop);
    // Ten rows (For You … Profile, More) on a 44px pitch from 128: TikTok's rows are not on one pitch
    // (133, 177, 216, 265, 292, 336, 380, 443, 485, 512), so this is the agreed approximation — the
    // first row is within 5px of For You and the last within 12px of More.
    const rowTop = (i: number) => m.listTop + i * (m.rowHeight + m.rowGap);
    expect(rowTop(0)).toBe(128);
    expect(rowTop(1) - rowTop(0)).toBe(44);
    expect(Math.abs(rowTop(0) - 133)).toBeLessThanOrEqual(5);
    expect(rowTop(9)).toBe(524);
    expect(Math.abs(rowTop(9) - 512)).toBeLessThanOrEqual(12);
    expect(m.railWidth + m.morePanelWidth).toBe(392);

    const css = readFileSync(resolve(import.meta.dir, "../video-shell.css"), "utf8");
    expect(css).toContain(".video-shell__sidebar { flex: 0 0 240px; width: 240px;");
    expect(css).toContain('.video-shell[data-sidebar="rail"] .video-shell__sidebar { flex-basis: 72px; width: 72px; }');
    expect(css).toContain(".video-shell__sidebar:has(> .video-nav.is-more) { flex-basis: 392px; width: 392px; }");
    expect(css).toContain('.video-nav[data-chrome="sidebar"] .video-nav__top { padding: 20px 16px 0 24px;');
    expect(css).toContain('.video-nav[data-chrome="sidebar"] .video-nav__brand { height: 28px;');
    expect(css).toContain('.video-nav[data-chrome="sidebar"] .video-nav__scroll { padding: 24px 16px 8px; }');
    expect(css).toContain('.video-nav[data-chrome="sidebar"] .video-nav__list { gap: 4px; }');
    expect(css).toContain('.video-nav[data-chrome="sidebar"] .video-nav__item { height: 40px; padding: 0 16px; gap: 12px; border-radius: 6px; font-size: 16px; font-weight: 600; color: rgb(var(--brand-text)); }');
    expect(css).toContain('.video-nav[data-chrome="sidebar"] .video-nav__item.is-current { background: transparent; color: rgb(var(--brand-accent)); font-weight: 700; }');
    expect(css).toContain('.video-nav[data-chrome="sidebar"].is-rail .video-nav__label { display: none; }');
    expect(css).toContain('.video-nav[data-chrome="sidebar"] .video-nav__footer { padding: 0 24px 24px; border-top: 0; }');
    expect(css).toContain('.video-nav[data-chrome="sidebar"] .video-nav__footer-links a { font-size: 12px; font-weight: 600; color: rgb(var(--brand-text) / .5); }');
    expect(css).toContain(".video-nav__column { display: flex; flex: 0 0 72px; width: 72px;");
    expect(css).toContain(".video-nav.is-more .video-more { flex: 0 0 320px; width: 320px;");
    expect(css).toContain('.video-nav[data-chrome="sidebar"] .video-more .video-nav__item { height: 48px; padding: 0 16px; gap: 12px; border-radius: 0; font-size: 15px; font-weight: 500;');
    expect(css).toContain('.video-nav[data-chrome="sidebar"] .video-more .video-nav__heading { margin: 0; padding: 8px 16px 4px; font-size: 14px; font-weight: 400;');
    expect(css).toContain("height: 60px; padding: 0 16px; }");
    expect(css).toContain("grid-template-columns: repeat(3, 32px)");
    expect(css).toContain("width: 32px; height: 25px;");
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
