import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CLUSTER_EXTRA,
  COMMENTS_COLUMN_MARGIN,
  COMMENTS_COLUMN_WIDTH,
  COMMENTS_TRACK_WIDTH,
  RAIL_GAP,
  RAIL_WIDTH,
  RESERVED_RIGHT,
  STAGE_DEFAULT_ASPECT,
  STAGE_MAX_ASPECT,
  STAGE_MIN_ASPECT,
  clusterWidth,
  frameLeft,
  maxFrameWidth,
  stageAspect,
} from "../stage";
import { feedFromSearch } from "../feed";

const css = readFileSync(resolve(import.meta.dir, "../components/reels-screen.css"), "utf8");

describe("comments column", () => {
  test("is TikTok's 352px card with a 16px margin, so a 368px track", () => {
    expect(COMMENTS_COLUMN_WIDTH).toBe(352);
    expect(COMMENTS_COLUMN_MARGIN).toBe(16);
    expect(COMMENTS_TRACK_WIDTH).toBe(368);
    expect(css).toContain("grid-template-columns: minmax(0,1fr) var(--reel-comments-w, 368px)");
    expect(css).toContain(".reel-comments-column { display: none; min-width: 0; min-height: 0; height: 100%; overflow: hidden; padding: 0; }");
    expect(css).toContain(".reel-comments-panel.is-column { border: 1px solid var(--brand-divider); border-radius: 12px; }");
  });
});

describe("the placement rule", () => {
  test("the cluster is frame + 15 (gap) + 48 (rail) + 117 (reserved)", () => {
    expect(RAIL_GAP).toBe(15);
    expect(RAIL_WIDTH).toBe(48);
    expect(RESERVED_RIGHT).toBe(117);
    expect(CLUSTER_EXTRA).toBe(180);
    expect(clusterWidth(455)).toBe(635);
    expect(clusterWidth(0)).toBe(180);
  });

  test("centring the cluster puts the frame where TikTok puts it", () => {
    // 1440×840, 240px menu, no comments: area 240..1384 (1144), 455-wide frame → x 494–497.
    const at1440 = frameLeft(240, 1144, 455);
    expect(Math.abs(at1440 - 495.5)).toBeLessThanOrEqual(4);
    // 1920×827, 240px menu: area 240..1864 (1624), 447-wide frame → x 736–738.
    const at1920 = frameLeft(240, 1624, 447);
    expect(Math.abs(at1920 - 737)).toBeLessThanOrEqual(4);
    // Comments open: the same rule re-centres the cluster in what is left of the column. The brief's
    // reading was area 240..1072 with the frame at ≈361; with the corrected 117px reserve the formula
    // lands 22.5px left of that (338.5) — the rule, not the reading, is what the CSS implements.
    const withComments = frameLeft(240, 832, 455);
    expect(withComments).toBe(338.5);
    expect(Math.abs(withComments - 361)).toBeLessThanOrEqual(25);
    expect(withComments).toBeLessThan(at1440);
    // At 1440 our own track is 368, so the area is 776 wide and the frame moves further left still.
    expect(frameLeft(240, 1144 - COMMENTS_TRACK_WIDTH, 455)).toBe(310.5);
    // The rail's left edge follows the frame by the gap: 964.5, against TikTok's rail at x 967.
    expect(at1440 + 455 + RAIL_GAP).toBe(964.5);
    expect(Math.abs(at1440 + 455 + RAIL_GAP - 967)).toBeLessThanOrEqual(4);
  });

  test("the widest frame leaves room for the rail and the reserve", () => {
    expect(maxFrameWidth(1144)).toBe(964);
    expect(maxFrameWidth(100)).toBe(0);
  });

  test("the CSS implements it: full-width cluster, centred content, rail margin, fixed reserve, frame capped by the extra", () => {
    expect(css).toContain(".reel-stage-cluster { position: relative; display: flex; align-items: flex-end; justify-content: center; width: 100%; min-width: 0; }");
    expect(css).toContain("--reel-rail-w: 48px; --reel-rail-gap: 15px; --reel-reserve-w: 117px;");
    expect(css).toContain(".reel-desktop-rail { display: none; flex: 0 0 var(--reel-rail-w); width: var(--reel-rail-w); margin-left: var(--reel-rail-gap); }");
    expect(css).toContain(".reel-stage-reserve { display: none; flex: 0 0 var(--reel-reserve-w); width: var(--reel-reserve-w); }");
    expect(css).toContain("calc(100% - var(--reel-cluster-extra))");
    expect(css).not.toContain("reel-rail-spacer");
    expect(css).not.toContain("reel-side-w");
    // Frame: 16px from the top, 100dvh − 32 tall, radius 8 on desktop, no border or shadow.
    expect(css).toContain("--reel-viewport: calc(100dvh - 32px)");
    expect(css).toContain(".reel-stage-area { padding: 16px 56px 16px 0; }");
    expect(css).toContain(".reel-stage { border-radius: 8px;");
    // Arrows: 40px circles, 16px from the edge, 16px apart, centred on the viewport.
    expect(css).toContain(".reels-navigation { display: none; flex-direction: column; gap: 16px; }");
    expect(css).toContain(".reels-navigation.is-edge { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); }");
    expect(css).toContain(".reel-nav-button { display: flex; width: 40px; height: 40px; align-items: center; justify-content: center; border-radius: 999px; background: rgb(var(--brand-text) / .13); color: rgb(var(--brand-text));");
  });
});

describe("stageAspect", () => {
  test("portrait and landscape media keep their own ratio", () => {
    expect(stageAspect(1080, 1920)).toBeCloseTo(9 / 16, 6);
    expect(stageAspect(1920, 1080)).toBeCloseTo(16 / 9, 6);
    expect(stageAspect(1080, 1350)).toBeCloseTo(0.8, 6);
    expect(stageAspect(1000, 1000)).toBe(1);
  });

  test("phone-tall and ultrawide files keep their own shape; only absurd strips clamp", () => {
    expect(stageAspect(1080, 2340)).toBeCloseTo(1080 / 2340, 6);
    expect(stageAspect(2560, 1080)).toBeCloseTo(2560 / 1080, 6);
    expect(stageAspect(100, 2000)).toBe(STAGE_MIN_ASPECT);
    expect(stageAspect(4000, 100)).toBe(STAGE_MAX_ASPECT);
  });

  test("unknown or broken dimensions fall back to 9:16", () => {
    expect(stageAspect()).toBe(STAGE_DEFAULT_ASPECT);
    expect(stageAspect(undefined, 1920)).toBe(STAGE_DEFAULT_ASPECT);
    expect(stageAspect(1080, undefined)).toBe(STAGE_DEFAULT_ASPECT);
    expect(stageAspect(0, 1920)).toBe(STAGE_DEFAULT_ASPECT);
    expect(stageAspect(1080, 0)).toBe(STAGE_DEFAULT_ASPECT);
    expect(stageAspect(-1, 1)).toBe(STAGE_DEFAULT_ASPECT);
    expect(stageAspect(Number.NaN, 1)).toBe(STAGE_DEFAULT_ASPECT);
    expect(stageAspect(Number.POSITIVE_INFINITY, 1)).toBe(STAGE_DEFAULT_ASPECT);
  });
});

describe("feedFromSearch", () => {
  test("?feed=following is Following; anything else is For You", () => {
    expect(feedFromSearch(new URLSearchParams("feed=following"))).toBe("following");
    expect(feedFromSearch(new URLSearchParams("reelId=x&feed=following"))).toBe("following");
    expect(feedFromSearch(new URLSearchParams(""))).toBe("for-you");
    expect(feedFromSearch(new URLSearchParams("feed=foryou"))).toBe("for-you");
    expect(feedFromSearch(new URLSearchParams("feed=Following"))).toBe("for-you");
    expect(feedFromSearch(null)).toBe("for-you");
    expect(feedFromSearch(undefined)).toBe("for-you");
  });
});
