import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { CardRow, EndScreenElement, VideoElementsOverlay, type VideoElementsOverlayProps } from "../components/VideoElementsOverlay";
import {
  CARD_TEASER_MS,
  countdownSpot,
  endBoxesAtEnd,
  endScreenTarget,
  endScreensAllowed,
  ImpressionLog,
  teaserCardAt,
  visibleEndScreenElements,
} from "../endScreenView";
import {
  elementEventPath,
  normalizeViewerCards,
  normalizeViewerEndScreens,
  normalizeWatchDetail,
  readEndScreenPosition,
  safeHttpsUrl,
  type ViewerCard,
  type WatchPostRow,
} from "../watchApi";
import { rowToVideo } from "../../model";

/* The viewer's side of the 29 Sep end screens and cards contract. */

const D = 600_000; // a 10-minute video

const wire = [
  {
    id: "e-video",
    type: "video",
    position: { x: 0.05, y: 0.1, w: 0.4 },
    start_ms: D - 20_000,
    end_ms: D,
    video: { id: "v2", title: "Part two", thumbnail_url: "/v1/media/t2/serve", duration_seconds: 754, channel_name: "Ravi", view_count: 12_400 },
  },
  {
    id: "e-list",
    type: "playlist",
    position: '{"x":0.55,"y":0.1,"w":0.4}',
    start_ms: D - 15_000,
    end_ms: D,
    playlist: { id: "c1", title: "Builds", thumbnail_url: "https://cdn.example/c1.jpg", item_count: 7 },
  },
  {
    id: "e-sub",
    type: "channel_subscribe",
    position: { slot: 2 },
    start_ms: D - 20_000,
    end_ms: D - 8_000,
    channel: { user_id: "a1", handle: "ravi", name: "Ravi", avatar_url: "", subscriber_count: 900, is_subscribed: false },
  },
  {
    id: "e-link",
    type: "external_link",
    position: { x: 0.4, y: 0.55, w: 0.2 },
    start_ms: D - 10_000,
    end_ms: D,
    link: { url: "https://shop.example.com/kit", title: "", domain: "" },
  },
];

describe("viewer normalisers", () => {
  test("every element shape; old slot positions map to the corners; JSON-string positions read", () => {
    const els = normalizeViewerEndScreens({ screens: wire });
    expect(els.map((e) => e.id)).toEqual(["e-video", "e-list", "e-sub", "e-link"]);
    expect(els[0].video).toEqual({ id: "v2", title: "Part two", thumbnailUrl: expect.stringContaining("/v1/media/t2/serve"), durationSeconds: 754, channelName: "Ravi", viewCount: 12_400 });
    expect(els[1].position).toEqual({ x: 0.55, y: 0.1, w: 0.4 });
    expect(els[1].playlist?.itemCount).toBe(7);
    expect(els[2].position).toEqual({ x: 0.05, y: 0.5444, w: 0.2 }); // slot 2 = bottom-left
    expect(els[2].channel).toEqual({ userId: "a1", handle: "ravi", name: "Ravi", avatarUrl: "", subscriberCount: 900, isSubscribed: false });
    expect(els[3].link).toEqual({ url: "https://shop.example.com/kit", title: "shop.example.com", domain: "shop.example.com" });
  });

  test("dropped and null targets, unknown types, no id and empty windows are left out; at most four", () => {
    const els = normalizeViewerEndScreens([
      { id: "a", type: "video", position: { x: 0, y: 0, w: 0.3 }, start_ms: 1, end_ms: 2, video: null },
      { id: "b", type: "playlist", position: null, start_ms: 1, end_ms: 2, playlist: { id: "" } },
      { id: "c", type: "channel", start_ms: 1, end_ms: 2, channel: null },
      { id: "d", type: "external_link", start_ms: 1, end_ms: 2, link: { url: "http://plain.example" } },
      { id: "e", type: "external_link", start_ms: 1, end_ms: 2, link: { url: "javascript:alert(1)" } },
      { id: "f", type: "poll", start_ms: 1, end_ms: 2 },
      { id: "", type: "video", start_ms: 1, end_ms: 2, video: { id: "v" } },
      { id: "g", type: "video", start_ms: 5, end_ms: 5, video: { id: "v" } },
      null,
      "junk",
    ]);
    expect(els).toEqual([]);
    const five = normalizeViewerEndScreens(Array.from({ length: 5 }, (_, i) => ({ id: `x${i}`, type: "video", start_ms: 0, end_ms: 1, video: { id: `v${i}` } })));
    expect(five.length).toBe(4);
    expect(normalizeViewerEndScreens(null)).toEqual([]);
    expect(normalizeViewerEndScreens({})).toEqual([]);
  });

  test("Go zero values fall through: empty strings and missing numbers", () => {
    const [e] = normalizeViewerEndScreens([{ id: "z", type: "video", position: { x: "", y: null }, start_ms: "", end_ms: 3000, video: { id: "v9", title: "", thumbnail_url: "", duration_seconds: null, channel_name: "", view_count: "" } }]);
    expect(e.startMs).toBe(0);
    expect(e.position).toEqual({ x: 0.05, y: 0.1, w: 0.3 }); // no x/y → slot of index 0
    expect(e.video).toEqual({ id: "v9", title: "Untitled", thumbnailUrl: "", durationSeconds: 0, channelName: "", viewCount: 0 });
  });

  test("positions: {x,y,w}; a missing w takes the kind's default; out-of-frame positions are clamped", () => {
    expect(readEndScreenPosition({ x: 0.2, y: 0.3 }, "video", 0)).toEqual({ x: 0.2, y: 0.3, w: 0.3 });
    expect(readEndScreenPosition({ x: 0.2, y: 0.3, w: 0 }, "channel", 0)).toEqual({ x: 0.2, y: 0.3, w: 0.2 });
    expect(readEndScreenPosition({ x: 0.9, y: 0.9, w: 0.3 }, "video", 0)).toEqual({ x: 0.7, y: 0.7, w: 0.3 });
    expect(readEndScreenPosition({ slot: 1 }, "video", 3)).toEqual({ x: 0.65, y: 0.1, w: 0.3 });
    expect(readEndScreenPosition("not json", "video", 3)).toEqual({ x: 0.65, y: 0.6, w: 0.3 }); // slot 3
  });

  test("https only for links", () => {
    expect(safeHttpsUrl("https://a.example/x?y=1")).toBe("https://a.example/x?y=1");
    expect(safeHttpsUrl("http://a.example")).toBe("");
    expect(safeHttpsUrl("javascript:alert(1)")).toBe("");
    expect(safeHttpsUrl("")).toBe("");
    expect(safeHttpsUrl(null)).toBe("");
  });

  test("cards: resolved, sorted, polls and unresolved targets dropped, the teaser falls back to the title, at most five", () => {
    const cards = normalizeViewerCards({
      cards: [
        { id: "k2", type: "external_link", appear_at_ms: 90_000, title: "The kit", teaser_text: "", link: { url: "https://shop.example.com" } },
        { id: "k1", type: "video", appear_at_ms: 30_000, title: "", teaser_text: "Watch the build", video: { id: "v2", title: "Part two" } },
        { id: "k3", type: "poll", appear_at_ms: 10_000, title: "Vote", poll: { id: "p1" } },
        { id: "k4", type: "playlist", appear_at_ms: 20_000, title: "Builds", playlist: null },
      ],
    });
    expect(cards.map((c) => c.id)).toEqual(["k1", "k2"]);
    expect(cards[0].title).toBe("Part two");
    expect(cards[0].teaser).toBe("Watch the build");
    expect(cards[1].teaser).toBe("The kit");
    expect(normalizeViewerCards(Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, type: "video", appear_at_ms: i, video: { id: "v" } }))).length).toBe(5);
  });

  test("made-for-kids on the detail (either key) turns the fetch off", () => {
    const base: WatchPostRow = {
      id: "v1",
      author_id: "a1",
      title: "A long one",
      text: "",
      content_type: "long_video",
      created_at: "2026-09-01T00:00:00Z",
      media: [{ media_id: "m1", kind: "video", duration_ms: 600_000 }],
      counts: { likes: 1, comments: 0, shares: 0 },
      view_count: 1,
      author: { id: "a1", display_name: "Ravi" },
      video_metadata: { media_asset_id: "m1", duration_seconds: 600 },
    };
    expect(normalizeWatchDetail(base, rowToVideo(base)).madeForKids).toBe(false);
    expect(normalizeWatchDetail({ ...base, made_for_kids: true }, rowToVideo(base)).madeForKids).toBe(true);
    expect(normalizeWatchDetail({ ...base, is_made_for_kids: true }, rowToVideo(base)).madeForKids).toBe(true);
  });

  test("impression and click routes", () => {
    expect(elementEventPath("p1", "end-screens", "e1", "impression")).toBe("/v1/posts/p1/end-screens/e1/impression");
    expect(elementEventPath("p1", "cards", "k1", "click")).toBe("/v1/posts/p1/cards/k1/click");
  });
});

const elements = normalizeViewerEndScreens(wire);
const cards: ViewerCard[] = normalizeViewerCards([
  { id: "k1", type: "video", appear_at_ms: 30_000, title: "Part two", teaser_text: "Watch the build", video: { id: "v2", title: "Part two" } },
  { id: "k2", type: "external_link", appear_at_ms: 32_000, title: "The kit", link: { url: "https://shop.example.com" } },
]);

describe("what shows when", () => {
  test("elements show inside [start, end); none before the window", () => {
    expect(visibleEndScreenElements(elements, D - 25_000)).toEqual([]);
    expect(visibleEndScreenElements(elements, D - 20_000).map((e) => e.id)).toEqual(["e-video", "e-sub"]);
    expect(visibleEndScreenElements(elements, D - 12_000).map((e) => e.id)).toEqual(["e-video", "e-list", "e-sub"]);
    expect(visibleEndScreenElements(elements, D - 8_000).map((e) => e.id)).toEqual(["e-video", "e-list", "e-link"]); // subscribe ended
    expect(visibleEndScreenElements(elements, D - 1).map((e) => e.id)).toEqual(["e-video", "e-list", "e-link"]);
  });

  test("after the video ends the ones that run to the end stay up (a 500 ms tolerance on the player's duration)", () => {
    expect(visibleEndScreenElements(elements, D + 200, { ended: true, durationMs: D + 200 }).map((e) => e.id)).toEqual(["e-video", "e-list", "e-link"]);
    expect(endBoxesAtEnd(elements, D).length).toBe(3);
    expect(endBoxesAtEnd([], D)).toEqual([]);
  });

  test("not drawn below 480px", () => {
    expect(endScreensAllowed(479)).toBe(false);
    expect(endScreensAllowed(480)).toBe(true);
  });

  test("targets: watch, collection, channel by handle, the link as an external tab", () => {
    const [v, l, s, x] = elements;
    expect(endScreenTarget(v)).toEqual({ href: "/posttube/watch/v2", external: false });
    expect(endScreenTarget(l)).toEqual({ href: "/posttube/playlists/c1", external: false });
    expect(endScreenTarget(s)).toEqual({ href: "/posttube/channel/ravi", external: false });
    expect(endScreenTarget(x)).toEqual({ href: "https://shop.example.com/kit", external: true });
  });

  test("impressions: once per element per view", () => {
    const log = new ImpressionLog();
    expect(log.take(["a", "b"])).toEqual(["a", "b"]);
    expect(log.take(["a", "b", "c"])).toEqual(["c"]);
    expect(log.take(["a"])).toEqual([]);
    expect(log.has("b")).toBe(true);
  });

  test("the card teaser is up for 5 s from its time; the later card wins an overlap", () => {
    expect(CARD_TEASER_MS).toBe(5000);
    expect(teaserCardAt(cards, 29_999)).toBeNull();
    expect(teaserCardAt(cards, 30_000)?.id).toBe("k1");
    expect(teaserCardAt(cards, 31_000)?.id).toBe("k1");
    expect(teaserCardAt(cards, 33_000)?.id).toBe("k2");
    expect(teaserCardAt(cards, 36_999)?.id).toBe("k2");
    expect(teaserCardAt(cards, 37_000)).toBeNull();
  });

  test("the compact Up next card finds a spot that covers no element; with none free it takes the least-covered one", () => {
    const frame = { width: 1280, height: 720 };
    const spot = countdownSpot([], frame);
    expect(spot).toEqual({ left: 496, top: 304 }); // centred
    // The template layout (two tiles on top, subscribe under them in the middle): the centre is taken, bottom-centre is not.
    const avoid = [
      { x: 0.05, y: 0.1, w: 0.4, h: 0.4 },
      { x: 0.55, y: 0.1, w: 0.4, h: 0.4 },
      { x: 0.4, y: 0.55, w: 0.2, h: 0.3556 },
    ];
    const s2 = countdownSpot(avoid, frame);
    const card = { x: s2.left, y: s2.top, w: 288, h: 112 };
    for (const b of avoid) {
      const px = { x: b.x * 1280, y: b.y * 720, w: b.w * 1280, h: b.h * 720 };
      const ix = Math.min(card.x + card.w, px.x + px.w) - Math.max(card.x, px.x);
      const iy = Math.min(card.y + card.h, px.y + px.h) - Math.max(card.y, px.y);
      expect(ix > 0 && iy > 0).toBe(false);
    }
    const full = countdownSpot([{ x: 0, y: 0, w: 1, h: 1 }], frame);
    expect(full).toEqual({ left: 496, top: 304 });
  });
});

/* ── the overlay ───────────────────────────────────────── */

const noop = () => undefined;
const css = readFileSync(resolve(import.meta.dir, "../components/video-elements.css"), "utf8");

function render(props: Partial<VideoElementsOverlayProps>) {
  const qc = new QueryClient();
  const all: VideoElementsOverlayProps = {
    elements,
    cards,
    positionMs: 0,
    durationMs: D,
    ended: false,
    frameWidth: 1280,
    hidden: false,
    onHide: noop,
    onEvent: noop,
    signedIn: true,
    isOwner: false,
    ...props,
  };
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <VideoElementsOverlay {...all} />
    </QueryClientProvider>,
  );
}

describe("the overlay", () => {
  test("draws the elements up at the time, at their fractions of the frame, focusable, with Hide end screen", () => {
    const html = render({ positionMs: D - 12_000 });
    expect(html).toContain('href="/posttube/watch/v2"');
    expect(html).toContain("left:5%;top:10%;width:40%;height:40%");
    expect(html).toContain('href="/posttube/playlists/c1"');
    expect(html).toContain("left:55%;top:10%;width:40%;height:40%");
    expect(html).toContain('aria-label="Subscribe to Ravi"');
    expect(html).toContain("height:35.5556%"); // the circle
    expect(html).not.toContain("shop.example.com"); // the link starts at −10 s
    expect(html).toContain("Hide end screen");
    expect(html).toContain("Part two");
    expect(html).toContain("12:34"); // duration badge
    expect(html).toContain("Collection · 7 videos");
    expect(html).not.toContain("Playlist");
    // no cards while end-screen elements are up
    expect(html).not.toContain('aria-label="Cards"');
  });

  test("the same fractions at any frame size (theater, fullscreen): percentages, not pixels", () => {
    const small = render({ positionMs: D - 12_000, frameWidth: 640 });
    const big = render({ positionMs: D - 12_000, frameWidth: 2560 });
    expect(small).toContain("left:5%;top:10%;width:40%;height:40%");
    expect(big).toContain("left:5%;top:10%;width:40%;height:40%");
  });

  test("the link tile shows its domain and opens in a new tab with noopener noreferrer", () => {
    const html = render({ positionMs: D - 5_000 });
    expect(html).toContain('href="https://shop.example.com/kit"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("shop.example.com");
  });

  test("hidden after Hide end screen; not rendered under 480px; cards come back", () => {
    const hidden = render({ positionMs: D - 12_000, hidden: true });
    expect(hidden).not.toContain("/posttube/watch/v2");
    expect(hidden).not.toContain("Hide end screen");
    expect(hidden).toContain('aria-label="Cards"');
    const phone = render({ positionMs: D - 12_000, frameWidth: 375 });
    expect(phone).not.toContain("/posttube/watch/v2");
    expect(phone).not.toContain("Hide end screen");
    expect(phone).toContain('aria-label="Cards"'); // cards still work
  });

  test("nothing at all outside the window with no cards", () => {
    expect(render({ positionMs: 1000, cards: [] })).toBe("");
  });

  test("cards: the (i) button always, the teaser chip for 5 s at the card's time; none once the video ended", () => {
    const before = render({ positionMs: 10_000 });
    expect(before).toContain('aria-label="Cards"');
    expect(before).not.toContain("Watch the build");
    const at = render({ positionMs: 31_000 });
    expect(at).toContain("Watch the build");
    expect(at).toContain('data-card-teaser="k1"');
    expect(render({ positionMs: 40_000 })).not.toContain("data-card-teaser");
    expect(render({ positionMs: 31_000, ended: true, elements: [] })).toBe("");
  });

  test("the subscribe circle: Subscribe for a new viewer, Subscribed (a channel link) once subscribed, a channel link for the owner", () => {
    expect(render({ positionMs: D - 12_000 })).toContain(">Subscribe<");
    const subscribed = normalizeViewerEndScreens([{ ...wire[2], channel: { ...wire[2].channel, is_subscribed: true } }]);
    const html = render({ positionMs: D - 12_000, elements: subscribed });
    expect(html).toContain("Subscribed");
    expect(html).toContain('href="/posttube/channel/ravi"');
    const owner = render({ positionMs: D - 12_000, isOwner: true });
    expect(owner).not.toContain("Subscribe to Ravi");
    expect(owner).toContain('aria-label="Channel: Ravi"');
  });

  test("activating an element or a card records a click (fire-and-forget: the handler is the link's own onClick)", () => {
    const calls: string[] = [];
    const click = (id: string) => () => calls.push(id);
    const tile = EndScreenElement({ el: elements[0], onClick: click("e-video"), signedIn: true, isOwner: false }) as React.ReactElement<{ onClick: () => void; href: string }>;
    expect(tile.props.href).toBe("/posttube/watch/v2");
    tile.props.onClick();
    const link = EndScreenElement({ el: elements[3], onClick: click("e-link"), signedIn: true, isOwner: false }) as React.ReactElement<{ onClick: () => void; external: boolean }>;
    expect(link.props.external).toBe(true);
    link.props.onClick();
    const row = CardRow({ card: cards[1], onClick: click("k2") }) as React.ReactElement<{ onClick: () => void; rel: string; target: string }>;
    expect(row.props.rel).toBe("noopener noreferrer");
    expect(row.props.target).toBe("_blank");
    row.props.onClick();
    expect(calls).toEqual(["e-video", "e-link", "k2"]);
  });

  test("the player layers: the overlay sits above the end card (30) and below the controls (40); the compact card has no full-frame backdrop", () => {
    const playerCss = readFileSync(resolve(import.meta.dir, "../../components/tube-player.css"), "utf8");
    expect(playerCss).toMatch(/.tube-player__overlay {[^}]*z-index: 35/);
    expect(playerCss).toMatch(/.tube-player__end {[^}]*z-index: 30/);
    expect(playerCss).toMatch(/.tube-player__controls {[^}]*z-index: 40/);
    expect(playerCss).toMatch(/.tube-player__end-compact {[^}]*width: 288px/);
    expect(playerCss).not.toMatch(/.tube-player__end-compact {[^}]*inset: 0/);
  });

  test("tokens only, 36px controls, fade-in with a reduced-motion opt-out", () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).toMatch(/\.tube-elements__hide \{[^}]*height: 36px/);
    expect(css).toMatch(/\.tube-cards__info \{[^}]*width: 36px; height: 36px/);
    expect(css).toContain("@keyframes tube-es-in");
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{[^}]*animation: none/);
  });
});

