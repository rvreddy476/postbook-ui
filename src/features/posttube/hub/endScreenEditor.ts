import {
  boxOf,
  boxesOverlapTooMuch,
  clampPosition,
  defaultWidth,
  positionInBounds,
  slotPosition,
  snapPosition,
  type EndScreenPosition,
} from "../endScreenGeometry";
import { formatCount } from "../model";
import {
  HUB_CARD_MAX,
  HUB_END_SCREEN_MAX,
  isShortType,
  type HubCard,
  type HubCardType,
  type HubElementStats,
  type HubEndScreen,
  type HubEndScreenType,
  type HubPostDetail,
  type HubVideoMode,
} from "./hubApi";

/*
  The Creator Hub's end-screen and cards editor, minus the React: what a
  new element looks like, the templates, moving and sizing on the 5 %
  grid, and client validation that mirrors the server's 422 codes (same
  order, same rules) with sentences a creator can act on.
*/

export const END_WINDOW_MS = 20_000;
export const MIN_LEAD_MS = 5_000;
export const MIN_END_SCREEN_DURATION_MS = 25_000;
export const END_SLACK_MS = 500;
export const LINK_MAX = 2048;
export const LINK_TITLE_MAX = 60;

/* ── eligibility ────────────────────────────────────────── */

export type EndScreenBlock = "not_long" | "not_ready" | "short_video" | "kids";

const NOT_READY = new Set(["pending", "processing", "uploading", "uploaded", "queued", "transcoding", "failed", "error"]);

export function durationMsOf(post: Pick<HubPostDetail, "duration_seconds">): number {
  return Math.max(0, Math.round((post.duration_seconds || 0) * 1000));
}

/** Why the end-screen editor is replaced by a notice; null = it can be edited. The server's NOT_ELIGIBLE / KIDS rules. */
export function endScreenBlock(post: Pick<HubPostDetail, "content_type" | "duration_seconds" | "made_for_kids" | "processing_status">): EndScreenBlock | null {
  if (post.made_for_kids) return "kids";
  const ct = (post.content_type || "").toLowerCase();
  if (isShortType(ct) || ct === "post") return "not_long";
  const d = durationMsOf(post);
  if (d <= 0 || NOT_READY.has((post.processing_status || "").toLowerCase())) return "not_ready";
  if (d < MIN_END_SCREEN_DURATION_MS) return "short_video";
  return null;
}

export const END_SCREEN_BLOCK_TEXT: Record<EndScreenBlock, string> = {
  kids: "End screens are off for videos made for kids.",
  not_long: "End screens are for long videos only.",
  not_ready: "The end screen opens once the video has finished processing.",
  short_video: "End screens need a video of at least 25 seconds.",
};

/** Cards are off for made-for-kids videos (CARD_KIDS). */
export function cardsBlocked(post: Pick<HubPostDetail, "made_for_kids">): boolean {
  return post.made_for_kids;
}

export const CARDS_KIDS_TEXT = "Cards are off for videos made for kids.";

/* ── labels (lists are alphabetical) ─────────────────────── */

export const END_SCREEN_TYPE_LABEL: Record<HubEndScreenType, string> = {
  channel: "Channel",
  channel_subscribe: "Subscribe",
  external_link: "Link",
  playlist: "Collection",
  video: "Video",
};

export const END_SCREEN_TYPE_OPTIONS: readonly HubEndScreenType[] = (Object.keys(END_SCREEN_TYPE_LABEL) as HubEndScreenType[]).sort((a, b) =>
  END_SCREEN_TYPE_LABEL[a].localeCompare(END_SCREEN_TYPE_LABEL[b]),
);

export const VIDEO_MODE_LABEL: Record<HubVideoMode, string> = {
  specific: "Choose a video",
  latest: "Latest upload",
  popular: "Most popular",
};

export const VIDEO_MODE_OPTIONS: readonly HubVideoMode[] = (Object.keys(VIDEO_MODE_LABEL) as HubVideoMode[]).sort((a, b) => VIDEO_MODE_LABEL[a].localeCompare(VIDEO_MODE_LABEL[b]));

export const CARD_TYPE_LABEL: Record<HubCardType, string> = {
  external_link: "Link",
  playlist: "Collection",
  poll: "Poll",
  video: "Video",
};

export const CARD_TYPE_OPTIONS: readonly HubCardType[] = (Object.keys(CARD_TYPE_LABEL) as HubCardType[]).sort((a, b) => CARD_TYPE_LABEL[a].localeCompare(CARD_TYPE_LABEL[b]));

export function elementLabel(row: Pick<HubEndScreen, "type" | "video_mode">, index: number): string {
  const kind = row.type === "video" && row.video_mode !== "specific" ? VIDEO_MODE_LABEL[row.video_mode] : END_SCREEN_TYPE_LABEL[row.type];
  return `${index + 1}. ${kind}`;
}

/** "4.2% click rate · 1.2K shown"; "Not shown yet" with no impressions; "" for an unsaved element. */
export function clickRateText(stats: HubElementStats | null | undefined): string {
  if (!stats) return "";
  if (stats.impressions <= 0) return "Not shown yet";
  const pct = stats.click_rate * 100;
  const rate = pct === 0 ? "0" : pct < 10 ? pct.toFixed(1).replace(/\.0$/, "") : String(Math.round(pct));
  return `${rate}% click rate · ${formatCount(stats.impressions)} shown`;
}

/* ── building elements ──────────────────────────────────── */

export function defaultWindow(durationMs: number): { start_ms: number; end_ms: number } {
  return { start_ms: Math.max(0, durationMs - END_WINDOW_MS), end_ms: Math.max(0, durationMs) };
}

/** The first corner where an element of this kind does not collide with the others. */
export function freeSlot(type: HubEndScreenType, others: readonly Pick<HubEndScreen, "type" | "position">[]): EndScreenPosition {
  for (let slot = 0; slot < 4; slot += 1) {
    const pos = slotPosition(slot, type);
    const box = boxOf(type, pos);
    if (!others.some((o) => boxesOverlapTooMuch(box, boxOf(o.type, o.position)))) return pos;
  }
  return slotPosition(others.length, type);
}

export interface EditorTargets {
  /** The creator's other long videos (the uploads list), newest first. */
  videoIds: readonly string[];
  /** The creator's public collections. */
  collectionIds: readonly string[];
}

export function newElement(type: HubEndScreenType, durationMs: number, others: readonly HubEndScreen[], targets: EditorTargets): HubEndScreen {
  return {
    type,
    video_mode: "specific",
    target_id: type === "video" ? targets.videoIds[0] ?? null : type === "playlist" ? targets.collectionIds[0] ?? null : null,
    target_url: null,
    title: null,
    position: freeSlot(type, others),
    ...defaultWindow(durationMs),
    stats: null,
    target_label: null,
  };
}

/** A new type: the target is cleared, the box keeps its corner and is resized to the kind. */
export function withType(row: HubEndScreen, type: HubEndScreenType, targets: EditorTargets): HubEndScreen {
  if (row.type === type) return row;
  return {
    ...row,
    type,
    video_mode: "specific",
    target_id: type === "video" ? targets.videoIds[0] ?? null : type === "playlist" ? targets.collectionIds[0] ?? null : null,
    target_url: null,
    title: null,
    target_label: null,
    position: clampPosition(type, { ...row.position, w: defaultWidth(type) }),
  };
}

export function withVideoMode(row: HubEndScreen, mode: HubVideoMode, targets: EditorTargets): HubEndScreen {
  return { ...row, video_mode: mode, target_id: mode === "specific" ? row.target_id ?? targets.videoIds[0] ?? null : null, target_label: mode === "specific" ? row.target_label : null };
}

/** Drag: from where the drag began, by a frame-fraction delta, snapped to the 5 % grid, inside the frame. */
export function dragTo(row: HubEndScreen, from: EndScreenPosition, dx: number, dy: number): HubEndScreen {
  return { ...row, position: snapPosition(row.type, { x: from.x + dx, y: from.y + dy, w: from.w }) };
}

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/** Arrow keys nudge one grid step (Shift: two); null for any other key. */
export function nudge(row: HubEndScreen, key: string, shift = false): HubEndScreen | null {
  const d = ARROWS[key];
  if (!d) return null;
  const step = shift ? 0.1 : 0.05;
  return { ...row, position: snapPosition(row.type, { x: row.position.x + d[0] * step, y: row.position.y + d[1] * step, w: row.position.w }) };
}

/** Width from the slider (a percentage), then back inside the frame. */
export function withWidth(row: HubEndScreen, percent: number): HubEndScreen {
  return { ...row, position: clampPosition(row.type, { ...row.position, w: percent / 100 }) };
}

/** Timing inputs are seconds before the end; start stays earlier than end. */
export function withTiming(row: HubEndScreen, durationMs: number, which: "start" | "end", secondsBeforeEnd: number): HubEndScreen {
  if (!Number.isFinite(secondsBeforeEnd)) return row;
  const ms = Math.round(Math.max(0, Math.min(END_WINDOW_MS, secondsBeforeEnd * 1000)));
  const at = Math.max(0, durationMs - ms);
  return which === "start" ? { ...row, start_ms: at } : { ...row, end_ms: at };
}

export function secondsBeforeEnd(ms: number, durationMs: number): number {
  return Math.round(Math.max(0, durationMs - ms) / 100) / 10;
}

/* ── templates ──────────────────────────────────────────── */

export interface EndScreenTemplate {
  id: string;
  label: string;
  build: (durationMs: number, targets: EditorTargets) => HubEndScreen[];
}

function el(type: HubEndScreenType, pos: EndScreenPosition, durationMs: number, patch: Partial<HubEndScreen> = {}): HubEndScreen {
  return {
    type,
    video_mode: "specific",
    target_id: null,
    target_url: null,
    title: null,
    position: clampPosition(type, pos),
    ...defaultWindow(durationMs),
    stats: null,
    target_label: null,
    ...patch,
  };
}

/* Two tiles across the top, the subscribe circle centred under them; all on the 5 % grid, none overlapping. */
const LEFT_TILE = { x: 0.05, y: 0.1, w: 0.4 };
const RIGHT_TILE = { x: 0.55, y: 0.1, w: 0.4 };
const SUB_UNDER = { x: 0.4, y: 0.55, w: 0.2 };

export const END_SCREEN_TEMPLATES: readonly EndScreenTemplate[] = [
  {
    id: "two-videos-subscribe",
    label: "2 videos + Subscribe",
    build: (d, t) => [
      el("video", LEFT_TILE, d, { target_id: t.videoIds[0] ?? null }),
      el("video", RIGHT_TILE, d, { target_id: t.videoIds[1] ?? null }),
      el("channel_subscribe", SUB_UNDER, d),
    ],
  },
  {
    id: "latest-popular-subscribe",
    label: "Latest + Popular + Subscribe",
    build: (d) => [el("video", LEFT_TILE, d, { video_mode: "latest" }), el("video", RIGHT_TILE, d, { video_mode: "popular" }), el("channel_subscribe", SUB_UNDER, d)],
  },
  {
    id: "video-collection-subscribe",
    label: "Video + Collection + Subscribe",
    build: (d, t) => [
      el("video", LEFT_TILE, d, { target_id: t.videoIds[0] ?? null }),
      el("playlist", RIGHT_TILE, d, { target_id: t.collectionIds[0] ?? null }),
      el("channel_subscribe", SUB_UNDER, d),
    ],
  },
  {
    id: "video-subscribe",
    label: "Video + Subscribe",
    build: (d, t) => [el("video", { x: 0.1, y: 0.3, w: 0.45 }, d, { target_id: t.videoIds[0] ?? null }), el("channel_subscribe", { x: 0.65, y: 0.3, w: 0.2 }, d)],
  },
];

/* ── validation (the server's order) ────────────────────── */

export interface EditorProblem {
  code: string;
  /** The element (0-based); null for the whole screen. */
  index: number | null;
  message: string;
}

export function isHttpsUrl(v: string | null | undefined): boolean {
  const raw = (v ?? "").trim();
  if (!raw || raw.length > LINK_MAX) return false;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !!u.hostname;
  } catch {
    return false;
  }
}

function nth(i: number): string {
  return `Element ${i + 1}`;
}

/**
  Every problem, in the server's order: TOO_MANY, NOT_ELIGIBLE, KIDS,
  TIMING, POSITION, OVERLAP, TARGET, then the one-subscribe rule.
  An empty list means the save should pass.
*/
export function validateEndScreens(
  rows: readonly HubEndScreen[],
  ctx: { durationMs: number; block: EndScreenBlock | null; postId: string },
): EditorProblem[] {
  const out: EditorProblem[] = [];
  const d = ctx.durationMs;
  if (rows.length > HUB_END_SCREEN_MAX) out.push({ code: "END_SCREEN_TOO_MANY", index: null, message: `An end screen holds ${HUB_END_SCREEN_MAX} elements at most. Remove ${rows.length - HUB_END_SCREEN_MAX}.` });
  if (ctx.block === "kids") out.push({ code: "END_SCREEN_KIDS", index: null, message: END_SCREEN_BLOCK_TEXT.kids });
  else if (ctx.block) out.push({ code: "END_SCREEN_NOT_ELIGIBLE", index: null, message: END_SCREEN_BLOCK_TEXT[ctx.block] });
  if (rows.length === 0) return out;

  rows.forEach((r, i) => {
    if (r.start_ms < d - END_WINDOW_MS) out.push({ code: "END_SCREEN_TIMING", index: i, message: `${nth(i)} starts too early: it can show in the last 20 seconds only.` });
    else if (r.start_ms > d - MIN_LEAD_MS) out.push({ code: "END_SCREEN_TIMING", index: i, message: `${nth(i)} starts too late: start it at least 5 seconds before the end.` });
    if (r.end_ms <= r.start_ms) out.push({ code: "END_SCREEN_TIMING", index: i, message: `${nth(i)} ends before it starts.` });
    else if (r.end_ms > d + END_SLACK_MS) out.push({ code: "END_SCREEN_TIMING", index: i, message: `${nth(i)} ends after the video does.` });
  });

  rows.forEach((r, i) => {
    if (!positionInBounds(r.type, r.position)) out.push({ code: "END_SCREEN_POSITION", index: i, message: `${nth(i)} runs past the frame or is outside 12–50% wide.` });
  });

  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      if (boxesOverlapTooMuch(boxOf(rows[i].type, rows[i].position), boxOf(rows[j].type, rows[j].position))) {
        out.push({ code: "END_SCREEN_OVERLAP", index: j, message: `Elements ${i + 1} and ${j + 1} overlap. Move one so both can be seen.` });
      }
    }
  }

  rows.forEach((r, i) => {
    const problem = targetProblem(r, ctx.postId);
    if (problem) out.push({ code: "END_SCREEN_TARGET", index: i, message: `${nth(i)}: ${problem}` });
  });

  const subs = rows.filter((r) => r.type === "channel_subscribe").length;
  if (subs > 1) out.push({ code: "END_SCREEN_SUBSCRIBE", index: null, message: "Use one Subscribe element at most." });
  return out;
}

function targetProblem(r: Pick<HubEndScreen, "type" | "video_mode" | "target_id" | "target_url" | "title">, postId: string): string | null {
  switch (r.type) {
    case "video":
      if (r.video_mode !== "specific") return r.target_id ? "latest and most popular pick the video themselves." : null;
      if (!r.target_id) return "choose one of your videos.";
      if (r.target_id === postId) return "choose a different video than this one.";
      return null;
    case "playlist":
      return r.target_id ? null : "choose one of your public collections.";
    case "channel":
      return r.target_id ? null : "search for a channel and pick it.";
    case "external_link":
      if (!isHttpsUrl(r.target_url)) return "enter a link that starts with https:// (2048 characters at most).";
      if ((r.title ?? "").trim().length > LINK_TITLE_MAX) return `keep the link title to ${LINK_TITLE_MAX} characters.`;
      return null;
    default:
      return null;
  }
}

/** Cards: at most five, inside the video, a target each, a title each, none on made-for-kids. */
export function validateCards(cards: readonly HubCard[], ctx: { durationMs: number; madeForKids: boolean; postId: string }): EditorProblem[] {
  const out: EditorProblem[] = [];
  if (cards.length > HUB_CARD_MAX) out.push({ code: "CARD_TOO_MANY", index: null, message: `A video holds ${HUB_CARD_MAX} cards at most. Remove ${cards.length - HUB_CARD_MAX}.` });
  if (ctx.madeForKids) out.push({ code: "CARD_KIDS", index: null, message: CARDS_KIDS_TEXT });
  cards.forEach((c, i) => {
    if (c.appear_at_ms < 0 || (ctx.durationMs > 0 && c.appear_at_ms > ctx.durationMs)) out.push({ code: "CARD_TIMING", index: i, message: `Card ${i + 1} appears after the video ends.` });
  });
  cards.forEach((c, i) => {
    const problem =
      c.type === "video"
        ? !c.target_id
          ? "choose one of your videos."
          : c.target_id === ctx.postId
            ? "choose a different video than this one."
            : null
        : c.type === "playlist"
          ? c.target_id
            ? null
            : "choose one of your public collections."
          : c.type === "external_link"
            ? isHttpsUrl(c.target_url)
              ? null
              : "enter a link that starts with https://."
            : c.target_id
              ? null
              : "enter the poll id.";
    if (problem) out.push({ code: "CARD_TARGET", index: i, message: `Card ${i + 1}: ${problem}` });
  });
  cards.forEach((c, i) => {
    if (!c.title.trim()) out.push({ code: "CARD_TITLE", index: i, message: `Card ${i + 1} needs a title.` });
  });
  return out;
}
