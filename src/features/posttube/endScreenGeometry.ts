/*
  End-screen geometry, shared by the watch overlay and the Creator Hub
  editor. No wire shapes here (those live in hub/hubApi.ts and
  watch/watchApi.ts) — only the frame maths the contract pins:

  - A position is {x, y, w}: fractions of the 16:9 frame, top-left corner
    and width. The height follows from the kind: a video / collection /
    link tile is 16:9 of its width, a subscribe / channel circle has a
    diameter of w. In frame fractions a 16:9 tile of width w is w tall
    (the frame itself is 16:9); a circle of diameter w is w × 16/9 tall.
  - 0.12 ≤ w ≤ 0.5, and the box stays inside the frame.
  - Two boxes may overlap by at most 10 % of the smaller one's area.
  - Old rows carry {slot: n}; slot 0 is top-left, 1 top-right, 2
    bottom-left, 3 bottom-right.
*/

export type EndScreenKind = "video" | "playlist" | "channel_subscribe" | "channel" | "external_link";

export interface EndScreenPosition {
  x: number;
  y: number;
  w: number;
}

export interface FrameBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FRAME_ASPECT = 16 / 9;
export const MIN_ELEMENT_W = 0.12;
export const MAX_ELEMENT_W = 0.5;
export const GRID_STEP = 0.05;
export const MAX_OVERLAP = 0.1;
/** The corner inset the slot defaults use. */
const SLOT_INSET_X = 0.05;
const SLOT_INSET_Y = 0.1;

export function isCircleKind(kind: EndScreenKind): boolean {
  return kind === "channel_subscribe" || kind === "channel";
}

/** The width a new element of this kind starts at. */
export function defaultWidth(kind: EndScreenKind): number {
  return isCircleKind(kind) ? 0.2 : 0.3;
}

/** The element's height as a fraction of the frame height. */
export function heightFraction(kind: EndScreenKind, w: number): number {
  return isCircleKind(kind) ? w * FRAME_ASPECT : w;
}

export function boxOf(kind: EndScreenKind, pos: EndScreenPosition): FrameBox {
  return { x: pos.x, y: pos.y, w: pos.w, h: heightFraction(kind, pos.w) };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Where an old `{slot:n}` row sits (n mod 4), sized for its kind. */
export function slotPosition(slot: number, kind: EndScreenKind): EndScreenPosition {
  const s = ((Math.trunc(slot) % 4) + 4) % 4;
  const w = defaultWidth(kind);
  const h = heightFraction(kind, w);
  const right = s === 1 || s === 3;
  const bottom = s === 2 || s === 3;
  return {
    x: round4(right ? 1 - SLOT_INSET_X - w : SLOT_INSET_X),
    y: round4(bottom ? Math.max(0, 1 - SLOT_INSET_Y - h) : SLOT_INSET_Y),
    w,
  };
}

/** Width into 0.12..0.5 (and short enough that the kind's height fits), then the corner inside the frame. */
export function clampPosition(kind: EndScreenKind, pos: EndScreenPosition): EndScreenPosition {
  const maxW = isCircleKind(kind) ? Math.min(MAX_ELEMENT_W, 1 / FRAME_ASPECT) : MAX_ELEMENT_W;
  const w = clamp(Number.isFinite(pos.w) ? pos.w : defaultWidth(kind), MIN_ELEMENT_W, maxW);
  const h = heightFraction(kind, w);
  return {
    x: round4(clamp(Number.isFinite(pos.x) ? pos.x : 0, 0, 1 - w)),
    y: round4(clamp(Number.isFinite(pos.y) ? pos.y : 0, 0, 1 - h)),
    w: round4(w),
  };
}

/** Snap a fraction to the 5 % grid. */
export function snapToGrid(n: number, step = GRID_STEP): number {
  return round4(Math.round(n / step) * step);
}

/** Snap x and y to the grid, then keep the box inside the frame. */
export function snapPosition(kind: EndScreenKind, pos: EndScreenPosition): EndScreenPosition {
  return clampPosition(kind, { x: snapToGrid(pos.x), y: snapToGrid(pos.y), w: pos.w });
}

/** The contract's bounds rule, verbatim (no clamping). */
export function positionInBounds(kind: EndScreenKind, pos: EndScreenPosition): boolean {
  const eps = 1e-6;
  const { x, y, w } = pos;
  if (![x, y, w].every((n) => Number.isFinite(n) && n >= -eps && n <= 1 + eps)) return false;
  if (w < MIN_ELEMENT_W - eps || w > MAX_ELEMENT_W + eps) return false;
  if (x + w > 1 + eps) return false;
  if (y + heightFraction(kind, w) > 1 + eps) return false;
  return true;
}

export function intersectionArea(a: FrameBox, b: FrameBox): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** The overlap as a share of the smaller box (0..1). */
export function overlapShare(a: FrameBox, b: FrameBox): number {
  const smaller = Math.min(a.w * a.h, b.w * b.h);
  if (smaller <= 0) return 0;
  return intersectionArea(a, b) / smaller;
}

export function boxesOverlapTooMuch(a: FrameBox, b: FrameBox): boolean {
  return overlapShare(a, b) > MAX_OVERLAP + 1e-9;
}

/** The biggest 16:9 box that fits a W×H area, centred (pixels). */
export function fitFrame(width: number, height: number): { left: number; top: number; width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { left: 0, top: 0, width: 0, height: 0 };
  const w = Math.min(width, height * FRAME_ASPECT);
  const h = w / FRAME_ASPECT;
  return { left: (width - w) / 2, top: (height - h) / 2, width: w, height: h };
}

/** A box → CSS percentages inside the 16:9 frame (scales with the frame, fullscreen and theater included). */
export function boxStyle(box: FrameBox): { left: string; top: string; width: string; height: string } {
  const pct = (n: number) => `${round4(n * 100)}%`;
  return { left: pct(box.x), top: pct(box.y), width: pct(box.w), height: pct(box.h) };
}
