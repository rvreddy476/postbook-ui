import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  channelCollections,
  normalizeChannel,
  normalizeLinks,
  safeExternalUrl,
  thinChannel,
  toPostCard,
  type ChannelLinkView,
  type ChannelView,
} from "../channelApi";
import { aboutNeedsToggle, filterByText, liveOnly, resolveTab, sortVideos, splitLinks, visibleTabs } from "../channelModel";
import { ChannelMasthead } from "../components/ChannelMasthead";
import { ChannelLinks } from "../components/ChannelLinks";
import { ChannelTabs } from "../components/ChannelTabs";
import { channelMoreRows } from "../components/ChannelMoreMenu";
import { CollectionGrid, emptyCopy, PanelFrame, PostList, ShortGrid } from "../components/ChannelPanels";
import { FeaturedVideo, NoChannelCard } from "../components/ChannelScreen";
import { normalizePlaylist } from "../../library/libraryApi";
import type { PostTubeVideo } from "../../types";

/* post-service internal/http/testdata/contracts/mtube/channel.json, verbatim. */
const FIXTURE = {
  user_id: "22222222-2222-4222-8222-222222222222",
  name: "Raghu Builds",
  handle: "raghu.builds",
  about: "Weekly builds",
  avatar_media_id: null,
  avatar_url: null,
  video_count: 12,
  subscriber_count: 1200,
  is_subscribed: true,
  notify_on: "all",
  created_at: "2026-09-24T12:00:00Z",
  updated_at: "2026-09-27T12:00:00Z",
  banner_media_id: "99999999-9999-4999-8999-999999999999",
  banner_url: "/v1/media/99999999-9999-4999-8999-999999999999/original",
  links: [
    {
      title: "Site",
      url: "https://example.com",
    },
  ],
  contact_email: "hello@example.com",
  featured_post_id: "11111111-1111-4111-8111-111111111111",
  short_count: 30,
  live_count: 2,
  collection_count: 3,
};

/* A channel row from before the branding migration. */
const OLD_SHAPE = { user_id: "33333333-3333-4333-8333-333333333333", name: "Old Timer", handle: "old", description: "From before", subscriber_count: 5 };

const router: AppRouterInstance = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {} };

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <QueryClientProvider client={qc}>{node}</QueryClientProvider>
    </AppRouterContext.Provider>,
  );
}

function textOf(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
}

const fixture = normalizeChannel(FIXTURE) as ChannelView;

function video(id: string, over: Partial<PostTubeVideo & { source?: string }> = {}): PostTubeVideo & { source?: string } {
  return {
    id,
    author_id: FIXTURE.user_id,
    title: `Video ${id}`,
    description: "",
    video_url: "",
    thumbnail_url: "",
    channel_id: FIXTURE.user_id,
    channel_name: "Raghu Builds",
    channel_avatar_url: "",
    channel_subscriber_count: 0,
    view_count: 0,
    like_count: 0,
    dislike_count: 0,
    comment_count: 0,
    share_count: 0,
    hashtags: [],
    published_at: "2026-09-20T00:00:00Z",
    duration_seconds: 600,
    viewer_has_liked: false,
    viewer_has_disliked: false,
    viewer_has_saved: false,
    viewer_has_subscribed: false,
    ...over,
  };
}

describe("channelApi adapter", () => {
  test("reads the contract fixture", () => {
    expect(fixture.userId).toBe(FIXTURE.user_id);
    expect(fixture.name).toBe("Raghu Builds");
    expect(fixture.handle).toBe("raghu.builds");
    expect(fixture.about).toBe("Weekly builds");
    expect(fixture.avatarUrl).toBeUndefined();
    expect(fixture.bannerUrl?.endsWith("/v1/media/99999999-9999-4999-8999-999999999999/original")).toBe(true);
    expect(fixture.links).toEqual([
      { label: "Site", href: "https://example.com/", external: true },
      { label: "Email", href: "mailto:hello@example.com", external: false },
    ]);
    expect(fixture.contactEmail).toBe("hello@example.com");
    expect(fixture.featuredPostId).toBe("11111111-1111-4111-8111-111111111111");
    expect(fixture.followerCount).toBe(1200);
    expect(fixture.counts).toEqual({ videos: 12, shorts: 30, live: 2, collections: 3 });
    expect(fixture.isFollowing).toBe(true);
    expect(fixture.notifyOn).toBe("all");
  });

  test("tolerates the minimal old shape: description, no counts, no links, no banner", () => {
    const c = normalizeChannel(OLD_SHAPE) as ChannelView;
    expect(c.about).toBe("From before");
    expect(c.counts).toEqual({ videos: undefined, shorts: undefined, live: undefined, collections: undefined });
    expect(c.links).toEqual([]);
    expect(c.bannerUrl).toBeUndefined();
    expect(c.featuredPostId).toBeNull();
    expect(c.isFollowing).toBe(false);
    expect(c.notifyOn).toBeNull();
    expect(normalizeChannel({ ...OLD_SHAPE, playlist_count: 4 })?.counts.collections).toBe(4);
    expect(normalizeChannel({ ...OLD_SHAPE, banner_media_id: "b1" })?.bannerUrl).toContain("/v1/media/b1/serve");
  });

  test("drops junk: no id, unsafe links, duplicate links, bad counts", () => {
    expect(normalizeChannel(null)).toBeNull();
    expect(normalizeChannel({ name: "No id" })).toBeNull();
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("example.com")).toBeNull();
    const links = normalizeLinks(
      [{ title: "", url: "https://www.shop.example.com/a" }, { title: "Bad", url: "javascript:alert(1)" }, { title: "Dup", url: "https://www.shop.example.com/a" }, null],
      "not-an-email",
    );
    expect(links).toEqual([{ label: "shop.example.com", href: "https://www.shop.example.com/a", external: true }]);
    expect(normalizeChannel({ ...OLD_SHAPE, video_count: -1, short_count: "3" })?.counts).toMatchObject({ videos: undefined, shorts: undefined });
  });

  test("post rows become compact cards; collections keep public user lists for visitors", () => {
    expect(toPostCard({ id: "p1", author_id: "a", text: " Hello ", created_at: "2026-09-01T00:00:00Z", counts: { likes: 3, comments: 1 }, media: [{ media_id: "i1", kind: "image" }] })).toEqual({
      id: "p1",
      text: "Hello",
      createdAt: "2026-09-01T00:00:00Z",
      loves: 3,
      comments: 1,
      imageUrl: expect.stringContaining("/v1/media/i1/serve"),
    });
    const all = [
      normalizePlaylist({ id: "a", creator_id: "u", title: "Public", visibility: "public" }),
      normalizePlaylist({ id: "b", creator_id: "u", title: "Hidden", visibility: "private" }),
      normalizePlaylist({ id: "c", creator_id: "u", kind: "watch_later", title: "Watch later", visibility: "public" }),
      normalizePlaylist({ id: "d", creator_id: "u", title: "Legacy", is_public: true }),
    ];
    expect(channelCollections(all, false).map((c) => c.id)).toEqual(["a", "d"]);
    expect(channelCollections(all, true).map((c) => c.id)).toEqual(["a", "b", "d"]);
  });
});

describe("tab rules", () => {
  test("owner sees every tab, even at zero", () => {
    expect(visibleTabs({ videos: 0, shorts: 0, live: 0, collections: 0 }, true)).toEqual(["videos", "shorts", "live", "collections", "posts"]);
  });
  test("a visitor loses a tab whose count is 0, keeps one whose count is unknown", () => {
    expect(visibleTabs(fixture.counts, false)).toEqual(["videos", "shorts", "live", "collections", "posts"]);
    expect(visibleTabs({ videos: 4, shorts: 0, live: 0, collections: 2 }, false)).toEqual(["videos", "collections", "posts"]);
    expect(visibleTabs({ videos: 0, shorts: 0, live: 0, collections: 0 }, false)).toEqual(["posts"]);
    expect(visibleTabs({}, false)).toEqual(["videos", "shorts", "live", "collections", "posts"]);
  });
  test("?tab= lands on a visible tab, else the first", () => {
    const tabs = visibleTabs({ videos: 4, shorts: 0, live: 0, collections: 2 }, false);
    expect(resolveTab("collections", tabs)).toBe("collections");
    expect(resolveTab("Collections", tabs)).toBe("collections");
    expect(resolveTab("shorts", tabs)).toBe("videos");
    expect(resolveTab(null, tabs)).toBe("videos");
    expect(resolveTab("videos", [])).toBeNull();
  });
  test("tabs render counts and mark the current one; visitor-hidden tabs are absent", () => {
    const tabs = visibleTabs({ videos: 12, shorts: 0, live: 0, collections: 3 }, false);
    const html = wrap(<ChannelTabs pathname="/posttube/channel/raghu.builds" tabs={tabs} active="collections" counts={{ videos: 12, shorts: 0, live: 0, collections: 3 }} query="" onQuery={() => undefined} />);
    expect(html).toContain('href="/posttube/channel/raghu.builds?tab=videos"');
    expect(html).toMatch(/aria-current="page"[^>]*>Collections<span class="tube-chan-tabs__count">3</);
    expect(html).not.toContain(">Shorts<");
    expect(html).not.toContain(">Live<");
    expect(html).toContain(">Posts<");
    expect(html).toContain('aria-label="Search this channel&#x27;s collections"');
  });
});

describe("sort, live and search", () => {
  const rows = [video("a", { view_count: 5 }), video("b", { view_count: 50, source: "live" }), video("c", { view_count: 5, title: "Router build" })];
  test("popular orders loaded rows by views, ties keep server order; latest is untouched", () => {
    expect(sortVideos(rows, "popular").map((v) => v.id)).toEqual(["b", "a", "c"]);
    expect(sortVideos(rows, "latest").map((v) => v.id)).toEqual(["a", "b", "c"]);
  });
  test("live keeps stream recordings only; search is a case-insensitive title match", () => {
    expect(liveOnly(rows).map((v) => v.id)).toEqual(["b"]);
    expect(filterByText(rows, "  ROUTER ", (v) => v.title).map((v) => v.id)).toEqual(["c"]);
    expect(filterByText(rows, "", (v) => v.title)).toHaveLength(3);
  });
});

describe("links", () => {
  const four: ChannelLinkView[] = [
    { label: "Site", href: "https://example.com/", external: true },
    { label: "Shop", href: "https://shop.example.com/", external: true },
    { label: "Blog", href: "https://blog.example.com/", external: true },
    { label: "Email", href: "mailto:hello@example.com", external: false },
  ];
  test("the first two show, the rest sit behind +N more", () => {
    expect(splitLinks(four)).toEqual({ shown: four.slice(0, 2), more: 2 });
    expect(splitLinks(four.slice(0, 2)).more).toBe(0);
    const html = wrap(<ChannelLinks links={four} />);
    expect(html).toContain(">+2 more<");
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('href="https://example.com/" class="tube-chan-links__pill" title="https://example.com/" target="_blank" rel="noopener noreferrer"');
    expect(html).not.toContain("blog.example.com"); // behind the popover until opened
  });
  test("two links: no more pill; none: nothing", () => {
    expect(wrap(<ChannelLinks links={four.slice(0, 2)} />)).not.toContain("more<");
    expect(wrap(<ChannelLinks links={[]} />)).toBe("");
  });
});

describe("masthead", () => {
  test("visitor: banner strip, name, meta line, Follow + bell, More", () => {
    const html = wrap(<ChannelMasthead channel={fixture} isOwner={false} signedIn followerCount={1200} />);
    expect(html).toContain('class="tube-chan-head__banner"');
    expect(html).toContain('<h1 class="tube-chan-head__name">Raghu Builds</h1>');
    expect(textOf(html)).toContain("@raghu.builds · 1.2K followers · 12 videos");
    expect(html).toContain(">Following<"); // is_subscribed in the fixture
    expect(html).toContain('aria-label="Turn off notifications"');
    expect(html).toContain('aria-label="More"');
    expect(html).not.toContain("Creator Hub");
    expect(html).not.toContain("tube-chan-head__toggle"); // short about, no toggle
  });
  test("owner: Branding and Creator Hub, no Follow, no More", () => {
    const html = wrap(<ChannelMasthead channel={fixture} isOwner signedIn followerCount={1} />);
    expect(html).toContain('href="/settings/channel"');
    expect(html).toContain('href="/posttube/hub"');
    expect(html).toContain(">Branding<");
    expect(html).toContain(">Creator Hub<");
    expect(html).not.toContain(">Follow");
    expect(html).not.toContain('aria-label="More"');
    expect(textOf(html)).toContain("1 follower ·");
  });
  test("long description gets the more toggle; signed-out visitor gets no Follow; old shape has no banner", () => {
    const long = { ...fixture, about: "x".repeat(200) };
    expect(aboutNeedsToggle(long.about)).toBe(true);
    const html = wrap(<ChannelMasthead channel={long} isOwner={false} signedIn={false} followerCount={0} />);
    expect(html).toContain('aria-expanded="false" aria-controls="tube-chan-about"');
    expect(html).not.toContain(">Follow<");
    const old = wrap(<ChannelMasthead channel={normalizeChannel(OLD_SHAPE) as ChannelView} isOwner={false} signedIn followerCount={5} />);
    expect(old).not.toContain("tube-chan-head__banner");
    expect(textOf(old)).toContain("@old · 5 followers");
    expect(textOf(old)).not.toContain("videos");
  });
  test("a thin channel (user id without a channel row) has no Follow and no follower count", () => {
    const html = wrap(<ChannelMasthead channel={thinChannel("u-1", "Someone")} isOwner={false} signedIn followerCount={0} />);
    expect(html).toContain(">Someone<");
    expect(html).not.toContain("follower");
    expect(html).not.toContain(">Follow<");
  });
  test("More rows are alphabetical; Report only when signed in", () => {
    expect(channelMoreRows(true).map((r) => r.label)).toEqual(["Report", "Share channel"]);
    expect(channelMoreRows(false).map((r) => r.label)).toEqual(["Share channel"]);
  });
});

describe("panels and states", () => {
  const frame = { count: 0, total: 0, query: "", hasMore: false, loadingMore: false, onLoadMore: () => undefined, onRetry: () => undefined, what: "videos" };
  test("loading, error, empty (owner and visitor), no match", () => {
    expect(wrap(<PanelFrame {...frame} status="loading" empty={emptyCopy("videos", false)}>x</PanelFrame>)).toContain("tube-tile is-skeleton");
    const err = wrap(<PanelFrame {...frame} status="error" empty={emptyCopy("videos", false)}>x</PanelFrame>);
    expect(err).toContain("Could not load videos");
    expect(err).toContain(">Retry<");
    const owner = wrap(<PanelFrame {...frame} status="ready" empty={emptyCopy("videos", true)}>x</PanelFrame>);
    expect(owner).toContain("No videos yet");
    expect(owner).toContain('href="/posttube/upload?type=long"');
    expect(wrap(<PanelFrame {...frame} status="ready" empty={emptyCopy("live", false)}>x</PanelFrame>)).not.toContain("href=");
    const miss = wrap(<PanelFrame {...frame} status="ready" total={3} query="zzz" empty={emptyCopy("videos", false)}>x</PanelFrame>);
    expect(miss).toContain("Nothing here matches “zzz”");
    const more = wrap(<PanelFrame {...frame} status="ready" total={3} query="zzz" hasMore empty={emptyCopy("videos", false)}>x</PanelFrame>);
    expect(more).toContain("Only what is loaded is searched");
    expect(more).toContain("Show more");
  });
  test("shorts open in Reels as 9:16 tiles; collections link to the collection page; posts are compact cards", () => {
    const shorts = wrap(<ShortGrid shorts={[video("s1", { view_count: 1500 })]} />);
    expect(shorts).toContain('href="/reels?reelId=s1"');
    expect(shorts).toContain("tube-chan-short__poster");
    expect(shorts).toContain(">1.5K<");
    const colls = wrap(<CollectionGrid isOwner={false} collections={[normalizePlaylist({ id: "pl-1", creator_id: "u", title: "Late builds", visibility: "public", item_count: 1 })]} />);
    expect(colls).toContain('href="/posttube/playlists/pl-1"');
    expect(textOf(colls)).toContain("1 video");
    expect(colls).not.toContain("Public"); // visibility is the owner's detail
    const posts = wrap(<PostList posts={[{ id: "p1", text: "Shipping day", createdAt: "", loves: 2, comments: 0 }]} />);
    expect(posts).toContain('href="/post/p1"');
    expect(posts).toContain('aria-label="2 loves"');
  });
  test("featured video is one wide tile under a Featured label; no-channel card opens the create gate", () => {
    const html = wrap(<FeaturedVideo video={video("f1")} />);
    expect(html).toContain(">Featured</h2>");
    expect(html).toContain("tube-tile tube-tile--wide");
    expect(html).toContain('href="/posttube/watch/f1"');
    const none = wrap(<NoChannelCard />);
    expect(none).toContain('href="/posttube/upload?type=long"');
    expect(none).toContain("Create your channel");
  });
});

describe("our words, our tokens", () => {
  test("no YouTube vocabulary anywhere in the rendered page parts", () => {
    const html = [
      wrap(<ChannelMasthead channel={fixture} isOwner={false} signedIn followerCount={1200} />),
      wrap(<ChannelMasthead channel={{ ...fixture, isFollowing: false }} isOwner={false} signedIn followerCount={1200} />),
      wrap(<ChannelMasthead channel={fixture} isOwner signedIn followerCount={1200} />),
      wrap(<ChannelTabs pathname="/posttube/channel" tabs={visibleTabs({}, true)} active="videos" counts={fixture.counts} query="" onQuery={() => undefined} />),
      ...(["videos", "shorts", "live", "collections", "posts"] as const).flatMap((t) => [true, false].map((o) => wrap(<PanelFrame status="ready" count={0} total={0} query="" hasMore={false} loadingMore={false} onLoadMore={() => undefined} onRetry={() => undefined} what={t} empty={emptyCopy(t, o)}>x</PanelFrame>))),
      wrap(<NoChannelCard />),
      channelMoreRows(true).map((r) => r.label).join(" "),
    ].join("\n");
    // Case-sensitive on words a person reads; URLs (/posttube/playlists) stay the API's.
    expect(textOf(html)).not.toMatch(/Subscribe|Subscriber|subscriber|Playlist|playlist|Community|Home tab|Studio/);
    expect(html).not.toMatch(/"[^"]*(Subscribe|Subscriber|Playlist|Community)[^"]*"/); // no attribute text either (aria-label, title, placeholder)
    expect(html).toContain(">Follow<");
  });

  test("channel.css: tokens only, small type", () => {
    const css = readFileSync(resolve(import.meta.dir, "../channel.css"), "utf8");
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(rules).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(rules).not.toMatch(/rgba?\(\s*\d/); // colour only as rgb(var(--token))
    expect(rules).not.toMatch(/hsla?\(/);
    expect(rules).not.toMatch(/:\s*(white|black|red|blue|gray|grey)\b/i);
    const sizes = [...rules.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(22);
    expect(rules).toContain(".tube-chan-head__name { margin: 0; font-size: 18px; font-weight: 700;");
    expect(rules).toContain("aspect-ratio: 3 / 1");
    expect(rules).toContain("aspect-ratio: 9 / 16");
  });

  test("components keep colour in the CSS: no hex and no raw palette classes", () => {
    for (const f of ["ChannelMasthead.tsx", "ChannelLinks.tsx", "ChannelTabs.tsx", "ChannelPanels.tsx", "ChannelScreen.tsx", "ChannelMoreMenu.tsx", "ReportChannelDialog.tsx"]) {
      const src = readFileSync(resolve(import.meta.dir, "../components", f), "utf8");
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(src).not.toMatch(/\b(bg|text|border)-(white|black|red|blue|gray|slate|zinc|emerald|sky)(-\d+)?\b/);
    }
  });
});
