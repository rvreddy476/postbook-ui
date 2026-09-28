import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { boxOf, boxesOverlapTooMuch, positionInBounds } from "../../endScreenGeometry";
import { CardsEditor, EndScreenEditor, type CardsEditorProps, type EndScreenEditorProps } from "../components/EndScreenEditor";
import {
  END_SCREEN_TEMPLATES,
  END_SCREEN_TYPE_OPTIONS,
  END_SCREEN_TYPE_LABEL,
  CARD_TYPE_OPTIONS,
  CARD_TYPE_LABEL,
  VIDEO_MODE_OPTIONS,
  VIDEO_MODE_LABEL,
  clickRateText,
  dragTo,
  endScreenBlock,
  freeSlot,
  newElement,
  nudge,
  validateCards,
  validateEndScreens,
  withTiming,
  withType,
  withVideoMode,
  withWidth,
} from "../endScreenEditor";
import {
  cardsBody,
  endScreensBody,
  normalizeCards,
  normalizeChannelOption,
  normalizeElementStats,
  normalizeEndScreens,
  normalizePostDetail,
  type HubCard,
  type HubEndScreen,
} from "../hubApi";
import { readableHubError } from "../hubModel";

/* The Creator Hub side of the 29 Sep end screens and cards contract. */

const D = 600_000;
const POST = "p-self";
const targets = { videoIds: ["v1", "v2"], collectionIds: ["c1"] };

function row(patch: Partial<HubEndScreen> = {}): HubEndScreen {
  return {
    type: "video",
    video_mode: "specific",
    target_id: "v1",
    target_url: null,
    title: null,
    position: { x: 0.05, y: 0.1, w: 0.3 },
    start_ms: D - 20_000,
    end_ms: D,
    stats: null,
    target_label: null,
    ...patch,
  };
}

const ctx = { durationMs: D, block: null, postId: POST };
const codes = (rows: HubEndScreen[], c: Partial<typeof ctx> & { block?: ReturnType<typeof endScreenBlock> } = {}) => validateEndScreens(rows, { ...ctx, ...c }).map((p) => p.code);

describe("owner normalisers", () => {
  test("the owner row: raw fields, {x,y,w}, video_mode, stats and a label from the resolved object", () => {
    const [a, b, c, d] = normalizeEndScreens([
      { id: "e1", type: "video", video_mode: "specific", target_id: "v1", position: { x: 0.1, y: 0.2, w: 0.35 }, start_ms: 580_000, end_ms: 600_000, video: { id: "v1", title: "Part two" }, stats: { impressions: 200, clicks: 9, click_rate: 0.045 } },
      { id: "e2", type: "video", video_mode: "latest", target_id: "should-drop", position: { slot: 1 }, start_ms: 580_000, end_ms: 600_000 },
      { id: "e3", type: "channel", target_id: "u9", position: '{"x":0.6,"y":0.5,"w":0.2}', start_ms: 585_000, end_ms: 600_000, channel: { user_id: "u9", handle: "maya", name: "" } },
      { id: "e4", type: "external_link", target_url: "", title: "", position: {}, start_ms: 590_000, end_ms: 600_000, link: { url: "https://x.example", title: "Kit" } },
    ]);
    expect(a).toMatchObject({ id: "e1", type: "video", video_mode: "specific", target_id: "v1", position: { x: 0.1, y: 0.2, w: 0.35 }, target_label: "Part two" });
    expect(a.stats).toEqual({ impressions: 200, clicks: 9, click_rate: 0.045 });
    expect(b.video_mode).toBe("latest");
    expect(b.target_id).toBeNull(); // latest never carries a target
    expect(b.position).toEqual({ x: 0.65, y: 0.1, w: 0.3 }); // slot 1 = top-right
    expect(c.type).toBe("channel");
    expect(c.position).toEqual({ x: 0.6, y: 0.5, w: 0.2 }); // the circle is 0.356 tall, so it fits
    expect(c.target_label).toBe("@maya");
    expect(d.target_url).toBe("https://x.example"); // "" fell through to the resolved link
    expect(d.title).toBeNull();
    expect(d.position).toEqual({ x: 0.65, y: 0.6, w: 0.3 }); // {} → slot of index 3 (bottom-right)
    expect(d.stats).toBeNull();
  });

  test("an unknown video_mode and a non-video type are specific; null targets stay null", () => {
    const [a, b] = normalizeEndScreens({ screens: [{ type: "video", video_mode: "weird", target_id: null }, { type: "playlist", video_mode: "latest", target_id: "" }] });
    expect(a.video_mode).toBe("specific");
    expect(a.target_id).toBeNull();
    expect(b.video_mode).toBe("specific");
    expect(b.target_id).toBeNull();
  });

  test("stats: the rate is clicks / impressions; with none shown a percentage reads as a fraction", () => {
    expect(normalizeElementStats({ impressions: 400, clicks: 10, click_rate: 99 })).toEqual({ impressions: 400, clicks: 10, click_rate: 0.025 });
    expect(normalizeElementStats({ impressions: 0, clicks: 0, click_rate: 12.5 })).toEqual({ impressions: 0, clicks: 0, click_rate: 0.125 });
    expect(normalizeElementStats(null)).toBeNull();
    expect(clickRateText({ impressions: 400, clicks: 10, click_rate: 0.025 })).toBe("2.5% click rate · 400 shown");
    expect(clickRateText({ impressions: 2000, clicks: 300, click_rate: 0.15 })).toBe("15% click rate · 2K shown");
    expect(clickRateText({ impressions: 0, clicks: 0, click_rate: 0 })).toBe("Not shown yet");
    expect(clickRateText(null)).toBe("");
  });

  test("cards carry stats and a resolved label; a channel search row needs an owner id", () => {
    const [c] = normalizeCards([{ id: "k1", type: "video", target_id: "v1", title: "T", appear_at_ms: 1000, video: { id: "v1", title: "Part two" }, stats: { impressions: 10, clicks: 1 } }]);
    expect(c.stats).toEqual({ impressions: 10, clicks: 1, click_rate: 0.1 });
    expect(c.target_label).toBe("Part two");
    expect(normalizeChannelOption({ id: "ch1", owner_id: "u9", name: "", handle: "@maya", avatar_media_id: "m1" })).toEqual({
      user_id: "u9",
      name: "@maya",
      handle: "maya",
      avatar_url: expect.stringContaining("/v1/media/m1/serve"),
    });
    expect(normalizeChannelOption({ id: "ch1", name: "No owner" })).toBeNull();
  });

  test("the detail carries the author and the processing state (media fallback)", () => {
    const d = normalizePostDetail({ id: "p1", author_id: "u1", media: [{ media_id: "m1", kind: "video", processing_status: "Processing", duration_ms: 60_000 }] })!;
    expect(d.author_id).toBe("u1");
    expect(d.processing_status).toBe("processing");
  });
});

describe("the save bodies", () => {
  test("end screens: {x,y,w} rounded, video_mode on videos only, targets only where the type takes one", () => {
    const body = endScreensBody([
      row({ id: "e1", position: { x: 0.123456, y: 0.1, w: 0.3 }, stats: { impressions: 1, clicks: 0, click_rate: 0 }, target_label: "x" }),
      row({ video_mode: "latest", target_id: "stale" }),
      row({ type: "playlist", target_id: "c1", video_mode: "specific" }),
      row({ type: "channel_subscribe", target_id: "junk" }),
    ]);
    expect(body).toEqual({
      screens: [
        { type: "video", video_mode: "specific", target_id: "v1", position: { x: 0.1235, y: 0.1, w: 0.3 }, start_ms: D - 20_000, end_ms: D },
        { type: "video", video_mode: "latest", position: { x: 0.05, y: 0.1, w: 0.3 }, start_ms: D - 20_000, end_ms: D },
        { type: "playlist", target_id: "c1", position: { x: 0.05, y: 0.1, w: 0.3 }, start_ms: D - 20_000, end_ms: D },
        { type: "channel_subscribe", position: { x: 0.05, y: 0.1, w: 0.3 }, start_ms: D - 20_000, end_ms: D },
      ],
    });
    const link = endScreensBody([row({ type: "external_link", target_id: null, target_url: " https://x.example ", title: "  Kit " })]).screens[0];
    expect(link).toEqual({ type: "external_link", target_url: "https://x.example", title: "Kit", position: { x: 0.05, y: 0.1, w: 0.3 }, start_ms: D - 20_000, end_ms: D });
    expect(endScreensBody([]).screens).toEqual([]); // clears
    expect(endScreensBody(Array.from({ length: 6 }, () => row())).screens.length).toBe(4);
  });

  test("cards: blank titles skipped, at most five, a link sends target_url only", () => {
    const cards: HubCard[] = [
      { type: "external_link", target_id: "x", target_url: "https://x.example", title: " Kit ", teaser_text: " ", appear_at_ms: 1000.4 },
      { type: "video", target_id: "v1", target_url: "junk", title: "", teaser_text: null, appear_at_ms: 0 },
      { type: "video", target_id: "v1", target_url: "junk", title: "Two", teaser_text: "Go", appear_at_ms: 2000 },
    ];
    expect(cardsBody(cards)).toEqual({
      cards: [
        { type: "external_link", target_id: undefined, target_url: "https://x.example", title: "Kit", teaser_text: undefined, appear_at_ms: 1000 },
        { type: "video", target_id: "v1", target_url: undefined, title: "Two", teaser_text: "Go", appear_at_ms: 2000 },
      ],
    });
  });
});

describe("client validation mirrors the 422 codes", () => {
  test("a clean screen passes", () => {
    expect(codes([row(), row({ type: "channel_subscribe", target_id: null, position: { x: 0.6, y: 0.1, w: 0.2 } })])).toEqual([]);
  });

  test("TOO_MANY: more than four", () => {
    const five = [0, 1, 2, 3, 4].map((i) => row({ position: { x: (i % 3) * 0.33, y: i < 3 ? 0 : 0.5, w: 0.3 } }));
    expect(codes(five)).toContain("END_SCREEN_TOO_MANY");
  });

  test("NOT_ELIGIBLE and KIDS come from the post", () => {
    expect(codes([row()], { block: "short_video" })).toContain("END_SCREEN_NOT_ELIGIBLE");
    expect(codes([row()], { block: "not_ready" })).toContain("END_SCREEN_NOT_ELIGIBLE");
    expect(codes([row()], { block: "kids" })).toContain("END_SCREEN_KIDS");
    expect(endScreenBlock({ content_type: "long_video", duration_seconds: 24, made_for_kids: false, processing_status: "ready" })).toBe("short_video");
    expect(endScreenBlock({ content_type: "long_video", duration_seconds: 25, made_for_kids: false, processing_status: "ready" })).toBeNull();
    expect(endScreenBlock({ content_type: "long_video", duration_seconds: 0, made_for_kids: false, processing_status: "" })).toBe("not_ready");
    expect(endScreenBlock({ content_type: "long_video", duration_seconds: 600, made_for_kids: false, processing_status: "processing" })).toBe("not_ready");
    expect(endScreenBlock({ content_type: "long_video", duration_seconds: 600, made_for_kids: true, processing_status: "ready" })).toBe("kids");
    expect(endScreenBlock({ content_type: "reel", duration_seconds: 60, made_for_kids: false, processing_status: "ready" })).toBe("not_long");
  });

  test("TIMING: the last 20 s, at least 5 s before the end, end after start, not past the end (+500 ms)", () => {
    expect(codes([row({ start_ms: D - 20_001 })])).toEqual(["END_SCREEN_TIMING"]);
    expect(codes([row({ start_ms: D - 4_999 })])).toEqual(["END_SCREEN_TIMING"]);
    expect(codes([row({ start_ms: D - 10_000, end_ms: D - 10_000 })])).toEqual(["END_SCREEN_TIMING"]);
    expect(codes([row({ end_ms: D + 501 })])).toEqual(["END_SCREEN_TIMING"]);
    expect(codes([row({ end_ms: D + 500 })])).toEqual([]);
    expect(codes([row({ start_ms: D - 5_000 })])).toEqual([]);
  });

  test("POSITION: outside the frame, too narrow or too wide", () => {
    expect(codes([row({ position: { x: 0.8, y: 0, w: 0.3 } })])).toEqual(["END_SCREEN_POSITION"]);
    expect(codes([row({ position: { x: 0, y: 0, w: 0.1 } })])).toEqual(["END_SCREEN_POSITION"]);
    expect(codes([row({ position: { x: 0, y: 0, w: 0.51 } })])).toEqual(["END_SCREEN_POSITION"]);
    expect(codes([row({ type: "channel_subscribe", target_id: null, position: { x: 0, y: 0.6, w: 0.3 } })])).toEqual(["END_SCREEN_POSITION"]);
  });

  test("OVERLAP: more than 10 % of the smaller box", () => {
    expect(codes([row(), row({ position: { x: 0.2, y: 0.1, w: 0.3 } })])).toEqual(["END_SCREEN_OVERLAP"]);
    expect(codes([row(), row({ position: { x: 0.33, y: 0.1, w: 0.3 } })])).toEqual([]); // 2/30 = 6.7 %
  });

  test("TARGET: missing video, the post itself, latest with a target, collection, channel, https links, link title length", () => {
    expect(codes([row({ target_id: null })])).toEqual(["END_SCREEN_TARGET"]);
    expect(codes([row({ target_id: POST })])).toEqual(["END_SCREEN_TARGET"]);
    expect(codes([row({ video_mode: "latest", target_id: "v1" })])).toEqual(["END_SCREEN_TARGET"]);
    expect(codes([row({ video_mode: "popular", target_id: null })])).toEqual([]);
    expect(codes([row({ type: "playlist", target_id: null })])).toEqual(["END_SCREEN_TARGET"]);
    expect(codes([row({ type: "channel", target_id: null, position: { x: 0, y: 0, w: 0.2 } })])).toEqual(["END_SCREEN_TARGET"]);
    expect(codes([row({ type: "external_link", target_id: null, target_url: "http://x.example" })])).toEqual(["END_SCREEN_TARGET"]);
    expect(codes([row({ type: "external_link", target_id: null, target_url: `https://x.example/${"a".repeat(2050)}` })])).toEqual(["END_SCREEN_TARGET"]);
    expect(codes([row({ type: "external_link", target_id: null, target_url: "https://x.example", title: "t".repeat(61) })])).toEqual(["END_SCREEN_TARGET"]);
    expect(codes([row({ type: "external_link", target_id: null, target_url: "https://x.example", title: "Kit" })])).toEqual([]);
  });

  test("one Subscribe at most", () => {
    const two = [row({ type: "channel_subscribe", target_id: null, position: { x: 0, y: 0, w: 0.2 } }), row({ type: "channel_subscribe", target_id: null, position: { x: 0.6, y: 0, w: 0.2 } })];
    expect(codes(two)).toEqual(["END_SCREEN_SUBSCRIBE"]);
  });

  test("the order is the server's and every message is a sentence", () => {
    const bad = [row({ start_ms: 0, position: { x: 0.9, y: 0, w: 0.3 }, target_id: null })];
    const problems = validateEndScreens(bad, { ...ctx, block: "kids" });
    expect(problems.map((p) => p.code)).toEqual(["END_SCREEN_KIDS", "END_SCREEN_TIMING", "END_SCREEN_POSITION", "END_SCREEN_TARGET"]);
    for (const p of problems) expect(p.message).toMatch(/^[A-Z].*\.$/);
  });

  test("cards: ≤ 5, inside the video, a target and a title each, none for kids", () => {
    const card = (p: Partial<HubCard> = {}): HubCard => ({ type: "video", target_id: "v1", target_url: null, title: "T", teaser_text: null, appear_at_ms: 1000, ...p });
    const v = (cs: HubCard[], kids = false) => validateCards(cs, { durationMs: D, madeForKids: kids, postId: POST }).map((p) => p.code);
    expect(v([card()])).toEqual([]);
    expect(v(Array.from({ length: 6 }, () => card()))).toContain("CARD_TOO_MANY");
    expect(v([card()], true)).toEqual(["CARD_KIDS"]);
    expect(v([card({ appear_at_ms: D + 1 })])).toEqual(["CARD_TIMING"]);
    expect(v([card({ target_id: null })])).toEqual(["CARD_TARGET"]);
    expect(v([card({ target_id: POST })])).toEqual(["CARD_TARGET"]);
    expect(v([card({ type: "external_link", target_id: null, target_url: "ftp://x" })])).toEqual(["CARD_TARGET"]);
    expect(v([card({ type: "playlist", target_id: null })])).toEqual(["CARD_TARGET"]);
    expect(v([card({ title: " " })])).toEqual(["CARD_TITLE"]);
  });

  test("server 422 codes read as sentences", () => {
    for (const code of ["END_SCREEN_TOO_MANY", "END_SCREEN_NOT_ELIGIBLE", "END_SCREEN_KIDS", "END_SCREEN_TIMING", "END_SCREEN_POSITION", "END_SCREEN_OVERLAP", "END_SCREEN_TARGET", "CARD_TOO_MANY", "CARD_TIMING", "CARD_TARGET", "CARD_KIDS"]) {
      const text = readableHubError(code, "FALLBACK");
      expect(text).not.toBe("FALLBACK");
      expect(text).toMatch(/\.$/);
    }
    expect(readableHubError("END_SCREEN_OVERLAP")).toContain("overlap");
  });
});

describe("editing", () => {
  test("templates lay out valid, non-overlapping screens on the grid", () => {
    expect(END_SCREEN_TEMPLATES.map((t) => t.label)).toEqual(["2 videos + Subscribe", "Latest + Popular + Subscribe", "Video + Collection + Subscribe", "Video + Subscribe"]);
    for (const t of END_SCREEN_TEMPLATES) {
      const rows = t.build(D, targets);
      expect(validateEndScreens(rows, ctx)).toEqual([]);
      for (const r of rows) {
        expect(positionInBounds(r.type, r.position)).toBe(true);
        for (const n of [r.position.x, r.position.y]) expect(Math.abs(n / 0.05 - Math.round(n / 0.05))).toBeLessThan(1e-9);
      }
      expect(rows.filter((r) => r.type === "channel_subscribe").length).toBe(1);
    }
    const [latest, popular] = END_SCREEN_TEMPLATES[1].build(D, targets);
    expect([latest.video_mode, popular.video_mode]).toEqual(["latest", "popular"]);
    expect(END_SCREEN_TEMPLATES[2].build(D, targets)[1]).toMatchObject({ type: "playlist", target_id: "c1" });
  });

  test("drag snaps to 5 % and stays inside; arrows nudge one step (Shift two)", () => {
    const r = row({ position: { x: 0.1, y: 0.1, w: 0.3 } });
    expect(dragTo(r, r.position, 0.13, 0.02).position).toEqual({ x: 0.25, y: 0.1, w: 0.3 });
    expect(dragTo(r, r.position, 2, 2).position).toEqual({ x: 0.7, y: 0.7, w: 0.3 });
    expect(nudge(r, "ArrowRight")!.position.x).toBe(0.15);
    expect(nudge(r, "ArrowDown", true)!.position.y).toBe(0.2);
    expect(nudge(r, "ArrowLeft")!.position.x).toBe(0.05);
    expect(nudge(row({ position: { x: 0, y: 0, w: 0.3 } }), "ArrowUp")!.position.y).toBe(0);
    expect(nudge(r, "a")).toBeNull();
  });

  test("width, type and mode changes keep the element valid", () => {
    const wide = withWidth(row({ position: { x: 0.6, y: 0.6, w: 0.3 } }), 45);
    expect(wide.position).toEqual({ x: 0.55, y: 0.55, w: 0.45 });
    expect(withWidth(row(), 5).position.w).toBe(0.12);
    const sub = withType(row({ position: { x: 0.6, y: 0.6, w: 0.3 } }), "channel_subscribe", targets);
    expect(sub).toMatchObject({ type: "channel_subscribe", target_id: null, video_mode: "specific" });
    expect(positionInBounds("channel_subscribe", sub.position)).toBe(true);
    expect(withType(row(), "playlist", targets).target_id).toBe("c1");
    expect(withVideoMode(row(), "latest", targets).target_id).toBeNull();
    expect(withVideoMode(row({ video_mode: "latest", target_id: null }), "specific", targets).target_id).toBe("v1");
    expect(withTiming(row(), D, "start", 12).start_ms).toBe(D - 12_000);
    expect(withTiming(row(), D, "start", 99).start_ms).toBe(D - 20_000);
    expect(withTiming(row(), D, "end", 0).end_ms).toBe(D);
  });

  test("a new element takes a free corner and a default target", () => {
    const first = newElement("video", D, [], targets);
    expect(first).toMatchObject({ type: "video", target_id: "v1", start_ms: D - 20_000, end_ms: D });
    const second = newElement("playlist", D, [first], targets);
    expect(second.target_id).toBe("c1");
    expect(boxesOverlapTooMuch(boxOf(first.type, first.position), boxOf(second.type, second.position))).toBe(false);
    expect(freeSlot("video", [first, second]).y).toBeGreaterThan(0.5);
  });

  test("lists are alphabetical; our words", () => {
    const labels = END_SCREEN_TYPE_OPTIONS.map((t) => END_SCREEN_TYPE_LABEL[t]);
    expect(labels).toEqual(["Channel", "Collection", "Link", "Subscribe", "Video"]);
    expect(VIDEO_MODE_OPTIONS.map((m) => VIDEO_MODE_LABEL[m])).toEqual(["Choose a video", "Latest upload", "Most popular"]);
    expect(CARD_TYPE_OPTIONS.map((t) => CARD_TYPE_LABEL[t])).toEqual(["Collection", "Link", "Poll", "Video"]);
  });
});

/* ── rendering ─────────────────────────────────────────── */

const noop = () => undefined;
const hubCss = readFileSync(resolve(import.meta.dir, "../hub.css"), "utf8");

function renderEditor(p: Partial<EndScreenEditorProps> = {}) {
  const props: EndScreenEditorProps = {
    postId: POST,
    thumbnailUrl: "/thumb.jpg",
    durationMs: D,
    block: null,
    rows: [],
    onChange: noop,
    videos: [],
    collections: [{ id: "c1", title: "Builds", item_count: 3 }],
    problems: [],
    serverError: null,
    dirty: false,
    saving: false,
    onSave: noop,
    ...p,
  };
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <EndScreenEditor {...props} />
    </QueryClientProvider>,
  );
}

function renderCards(p: Partial<CardsEditorProps> = {}) {
  const props: CardsEditorProps = {
    postId: POST,
    durationMs: D,
    blocked: false,
    rows: [],
    onChange: noop,
    videos: [],
    collections: [],
    problems: [],
    serverError: null,
    dirty: false,
    saving: false,
    onSave: noop,
    ...p,
  };
  return renderToStaticMarkup(<CardsEditor {...props} />);
}

describe("the editor renders", () => {
  test("templates, the 16:9 preview and an empty hint", () => {
    const html = renderEditor();
    for (const t of END_SCREEN_TEMPLATES) expect(html).toContain(`data-template="${t.id}"`);
    expect(html).toContain("2 videos + Subscribe");
    expect(html).toContain("data-es-frame");
    expect(html).toContain('src="/thumb.jpg"');
    expect(html).toContain("Pick a template or add an element.");
    expect(html).not.toMatch(/playlist/i);
  });

  test("elements as draggable boxes at their fractions, a timeline strip and per-element controls with the click rate", () => {
    const rows = [
      row({ id: "e1", stats: { impressions: 400, clicks: 10, click_rate: 0.025 } }),
      row({ id: "e2", type: "channel_subscribe", target_id: null, position: { x: 0.6, y: 0.1, w: 0.2 }, start_ms: D - 10_000 }),
    ];
    const html = renderEditor({ rows, dirty: true });
    expect(html).toContain("left:5%;top:10%;width:30%;height:30%");
    expect(html).toContain('data-kind="circle"');
    expect(html).toContain("arrow keys");
    expect(html).toContain("2.5% click rate · 400 shown");
    expect(html).toContain("Choose a video");
    expect(html).toContain("Latest upload");
    expect(html).toContain("Most popular");
    expect(html).toContain("left:50%;width:50%"); // the subscribe window: −10 s to the end
    expect(html).toContain("Save end screen");
    expect(html).toContain("Your channel.");
  });

  test("notices instead of the editor: under 25 s, not ready, made for kids", () => {
    expect(renderEditor({ block: "short_video" })).toContain("at least 25 seconds");
    expect(renderEditor({ block: "not_ready" })).toContain("finished processing");
    const kids = renderEditor({ block: "kids" });
    expect(kids).toContain("made for kids");
    expect(kids).not.toContain("data-template");
    expect(renderCards({ blocked: true })).toContain("Cards are off for videos made for kids.");
  });

  test("problems per element and the server's sentence; Save is off while any remain", () => {
    const rows = [row({ target_id: null })];
    const problems = validateEndScreens(rows, ctx);
    const html = renderEditor({ rows, problems, dirty: true, serverError: readableHubError("END_SCREEN_OVERLAP") });
    expect(html).toContain("Element 1: choose one of your videos.");
    expect(html).toContain("Two elements overlap.");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-save-end-screen/);
  });

  test("cards editor: time, target pickers, click rate, ≤ 5", () => {
    const rows: HubCard[] = [{ id: "k1", type: "external_link", target_id: null, target_url: "https://x.example", title: "Kit", teaser_text: null, appear_at_ms: 65_000, stats: { impressions: 50, clicks: 5, click_rate: 0.1 } }];
    const html = renderCards({ rows });
    expect(html).toContain('value="1:05"');
    expect(html).toContain('value="https://x.example"');
    expect(html).toContain("10% click rate · 50 shown");
    expect(html).toContain("1/5");
  });

  test("tokens only, 36px controls, 13px text", () => {
    const block = hubCss.slice(hubCss.indexOf("end screen + cards editor"));
    const esCss = block.slice(0, block.indexOf("/* ---- conversations"));
    expect(esCss).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(esCss).toMatch(/\.hub-es-control \{[^}]*height: 36px[^}]*font-size: 13px/);
    expect(esCss).toMatch(/\.hub-es-btn \{[^}]*min-height: 36px/);
    expect(esCss).toMatch(/\.hub-es-icon \{[^}]*width: 36px; height: 36px/);
  });
});
