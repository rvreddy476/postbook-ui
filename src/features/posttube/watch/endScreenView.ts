import { boxOf, intersectionArea, type FrameBox } from "../endScreenGeometry";
import type { ViewerCard, ViewerEndScreenElement } from "./watchApi";

/*
  What the watch overlay shows, and when — pure, so the tests can pin it.
  Wire shapes stay in watchApi.ts; this only reads the normalised rows.
*/

/** End screens are not drawn on frames narrower than this (phones, the miniplayer dock); cards still are. */
export const END_SCREEN_MIN_FRAME_WIDTH = 480;
/** A card's teaser chip stays up this long from its appear time. */
export const CARD_TEASER_MS = 5000;
/** The player's duration and the post's differ by a frame or two; the contract allows end_ms ≤ duration + 500. */
export const END_TOLERANCE_MS = 500;

export function endScreensAllowed(frameWidth: number): boolean {
  return frameWidth >= END_SCREEN_MIN_FRAME_WIDTH;
}

/**
  The elements on screen at `positionMs` (start ≤ t < end). Once the
  video has ended the clock sits on the duration, so an element that runs
  to the end (end ≥ duration − 500 ms) stays up over the last frame.
*/
export function visibleEndScreenElements(
  elements: readonly ViewerEndScreenElement[],
  positionMs: number,
  opts: { ended?: boolean; durationMs?: number } = {},
): ViewerEndScreenElement[] {
  if (opts.ended) {
    const d = opts.durationMs && opts.durationMs > 0 ? opts.durationMs : positionMs;
    return elements.filter((e) => e.startMs <= d + END_TOLERANCE_MS && e.endMs >= d - END_TOLERANCE_MS);
  }
  return elements.filter((e) => positionMs >= e.startMs && positionMs < e.endMs);
}

/** The boxes still up once the video ends: the Up next card is placed so it does not cover them. */
export function endBoxesAtEnd(elements: readonly ViewerEndScreenElement[], durationMs: number): FrameBox[] {
  return visibleEndScreenElements(elements, durationMs, { ended: true, durationMs }).map((e) => boxOf(e.type, e.position));
}

export interface ElementTarget {
  href: string;
  /** Opens in a new tab with rel="noopener noreferrer". */
  external: boolean;
}

export function channelHref(channel: { handle: string; userId: string }): string {
  return channel.handle ? `/posttube/channel/${encodeURIComponent(channel.handle)}` : `/posttube/channel/${encodeURIComponent(channel.userId)}`;
}

export function endScreenTarget(el: ViewerEndScreenElement): ElementTarget | null {
  if (el.video) return { href: `/posttube/watch/${encodeURIComponent(el.video.id)}`, external: false };
  if (el.playlist) return { href: `/posttube/playlists/${encodeURIComponent(el.playlist.id)}`, external: false };
  if (el.channel) return { href: channelHref(el.channel), external: false };
  if (el.link) return { href: el.link.url, external: true };
  return null;
}

export function cardTarget(card: ViewerCard): ElementTarget | null {
  if (card.video) return { href: `/posttube/watch/${encodeURIComponent(card.video.id)}`, external: false };
  if (card.playlist) return { href: `/posttube/playlists/${encodeURIComponent(card.playlist.id)}`, external: false };
  if (card.link) return { href: card.link.url, external: true };
  return null;
}

/** The card whose teaser is up at `positionMs`: the latest one with appear ≤ t < appear + 5 s. */
export function teaserCardAt(cards: readonly ViewerCard[], positionMs: number): ViewerCard | null {
  let hit: ViewerCard | null = null;
  for (const c of cards) {
    if (positionMs >= c.appearAtMs && positionMs < c.appearAtMs + CARD_TEASER_MS) {
      if (!hit || c.appearAtMs >= hit.appearAtMs) hit = c;
    }
  }
  return hit;
}

/**
  One impression per element per view: `take` returns only the ids not
  seen before and remembers them.
*/
export class ImpressionLog {
  private seen = new Set<string>();

  take(ids: readonly string[]): string[] {
    const fresh: string[] = [];
    for (const id of ids) {
      if (!id || this.seen.has(id)) continue;
      this.seen.add(id);
      fresh.push(id);
    }
    return fresh;
  }

  has(id: string): boolean {
    return this.seen.has(id);
  }
}

/** The compact Up next card: pixel size and the band the player controls take at the bottom. */
export const COMPACT_CARD = { width: 288, height: 112, margin: 12, controls: 64 };

/**
  Where the compact Up next card goes (pixels inside the 16:9 frame) so it
  covers none of `avoid` (frame fractions): the first free candidate in
  the order centre, bottom centre, top centre, then the corners; when
  every one collides, the one covering least (the elements are painted
  above it anyway, so it never hides them).
*/
export function countdownSpot(
  avoid: readonly FrameBox[],
  frame: { width: number; height: number },
  card: { width: number; height: number } = COMPACT_CARD,
): { left: number; top: number } {
  const W = Math.max(0, frame.width);
  const H = Math.max(0, frame.height);
  const cw = Math.min(card.width, W);
  const ch = Math.min(card.height, H);
  const m = COMPACT_CARD.margin;
  const bottom = Math.max(0, H - ch - Math.max(m, Math.min(COMPACT_CARD.controls, H - ch)));
  const cx = (W - cw) / 2;
  const candidates = [
    { left: cx, top: (H - ch) / 2 },
    { left: cx, top: bottom },
    { left: cx, top: m },
    { left: m, top: m },
    { left: W - cw - m, top: m },
    { left: m, top: bottom },
    { left: W - cw - m, top: bottom },
  ].map((c) => ({ left: Math.max(0, Math.round(c.left)), top: Math.max(0, Math.round(c.top)) }));
  if (W === 0 || H === 0) return candidates[0];
  const px = avoid.map((b) => ({ x: b.x * W, y: b.y * H, w: b.w * W, h: b.h * H }));
  let best = candidates[0];
  let bestArea = Infinity;
  for (const c of candidates) {
    const box = { x: c.left, y: c.top, w: cw, h: ch };
    const area = px.reduce((sum, b) => sum + intersectionArea(box, b), 0);
    if (area === 0) return c;
    if (area < bestArea) {
      bestArea = area;
      best = c;
    }
  }
  return best;
}

