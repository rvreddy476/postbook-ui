/*
  The post stage's model: one feed row or post read → what one full-screen
  page shows. The ONE place on the web that reads the post wire shape for
  the stage, pinned by the post-service and feed-service goldens in
  __tests__/contracts (copied byte-identical).

  Go marshals zero values, so "" and 0 arrive where a value is unset; the
  text fields fall through on empty (see the memory note on ?? fallbacks).
  Counts are the exception: 0 is a real count. A count the row does not
  carry at all is `undefined`, and the rail shows the control's name there
  instead of inventing a 0.
*/

import { POST_TEMPLATES, type PostRichText } from "@/components/studio/postStyle";
import { formatCount, mediaHref } from "@/features/reels/model";
import type { PostDetail, PostMediaItem } from "@/types/profile";

export type StageKind = "media" | "words" | "embed" | "locked";

export interface StageMedia {
  mediaId: string;
  kind: "image" | "video";
  /** Alt text; "" for a decorative image or one the author left blank. */
  alt: string;
  position: number;
  width?: number;
  height?: number;
  /** Video only: the HLS manifest (absolute against the API base), or null. */
  hlsUrl: string | null;
  /** Video only: the progressive file. Always set for a video. */
  fileUrl: string;
}

export interface StageCounts {
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
}

export interface StagePost {
  id: string;
  authorId: string;
  /** From the row's author block; "" when the row has none (the post read). */
  authorName: string;
  authorHandle: string;
  /** A plain `/v1/media/:id/serve` URL or the row's own avatar URL; "" when none. */
  authorAvatar: string;
  createdAt: string;
  title: string;
  caption: string;
  hashtags: string[];
  /** Declared labels, in display order. */
  labels: string[];
  sound: { title: string; artist: string } | null;
  kind: StageKind;
  media: StageMedia[];
  counts: StageCounts;
  viewerLiked: boolean;
  viewerSaved: boolean;
  commentsOff: boolean;
  likesOff: boolean;
  shareHidden: boolean;
  linkUrl: string;
  language: string;
  commentAccess: string;
  remixSetting: string;
  rich: PostRichText | null;
  hasPoll: boolean;
}

const VIDEO_KINDS = new Set(["video"]);
const IMAGE_KINDS = new Set(["image", "photo", "gif"]);

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const count = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : undefined);

/** The first candidate that is a count; a positive one wins over a zero alias. */
function firstCount(...candidates: unknown[]): number | undefined {
  const counts = candidates.map(count).filter((c): c is number => c !== undefined);
  return counts.find((c) => c > 0) ?? counts[0];
}

/** Declared labels, in this order: paid promotion, brand, AI. Our wording. */
export function declaredLabels(row: Pick<PostDetail, "paid_promotion" | "is_branded" | "ai_generated">): string[] {
  const out: string[] = [];
  if (row.paid_promotion === true) out.push("Paid partnership");
  if (row.is_branded === true) out.push("Brand");
  if (row.ai_generated === true) out.push("AI-generated");
  return out;
}

/** The media in the author's order (position), photos and videos only. */
export function stageMedia(media: PostMediaItem[] | null | undefined): StageMedia[] {
  return (media ?? [])
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => Boolean(m?.media_id) && (VIDEO_KINDS.has(m.kind) || IMAGE_KINDS.has(m.kind)))
    .sort((a, b) => (a.m.position ?? a.i) - (b.m.position ?? b.i))
    .map(({ m, i }) => {
      const video = VIDEO_KINDS.has(m.kind);
      const hls = video
        ? (m.playback_kind === "hls" && text(m.playback_url)) || text(m.hls_url) || null
        : null;
      return {
        mediaId: m.media_id,
        kind: video ? "video" : "image",
        alt: m.alt_decorative ? "" : text(m.alt_text),
        position: m.position ?? i,
        width: count(m.width) || undefined,
        height: count(m.height) || undefined,
        hlsUrl: hls ? mediaHref(hls) : null,
        fileUrl: video ? mediaHref(`/v1/media/${m.media_id}/serve`) : "",
      } satisfies StageMedia;
    });
}

/** Hashtags from the server list; parsed from the text only when the list is absent. */
export function stageHashtags(row: Pick<PostDetail, "hashtags" | "text">): string[] {
  const listed = (row.hashtags ?? []).map(text).filter(Boolean);
  if (listed.length) return Array.from(new Set(listed));
  const found = (row.text ?? "").match(/#[\p{L}\p{M}\p{N}_]+/gu) ?? [];
  return Array.from(new Set(found.map((t) => t.slice(1))));
}

/** The hashtags the caption does not already show inline, to append after it. */
export function trailingHashtags(caption: string, hashtags: string[]): string[] {
  const inline = new Set((caption.match(/#[\p{L}\p{M}\p{N}_]+/gu) ?? []).map((t) => t.slice(1).toLowerCase()));
  return hashtags.filter((t) => !inline.has(t.toLowerCase()));
}

function stageKind(row: PostDetail, media: StageMedia[]): StageKind {
  if (row.body_redacted) return "locked";
  if (row.content_type === "video_embed" || row.content_type === "flick_embed") return "embed";
  return media.length > 0 ? "media" : "words";
}

export function toStagePost(row: PostDetail): StagePost {
  const media = stageMedia(row.media);
  const author = row.author ?? null;
  const avatarUrl = text(author?.avatar_url);
  const avatarId = text(author?.avatar_media_id);
  const sound = row.sound && text(row.sound.id) ? { title: text(row.sound.title) || "Original sound", artist: text(row.sound.artist) } : null;
  return {
    id: row.id,
    authorId: text(author?.id) || row.author_id,
    authorName: text(author?.display_name) || text(author?.username),
    authorHandle: text(author?.username),
    authorAvatar: avatarUrl || (avatarId ? `/v1/media/${avatarId}/serve` : ""),
    createdAt: row.created_at || "",
    title: text(row.title),
    caption: (row.text ?? "").trim(),
    hashtags: stageHashtags(row),
    labels: declaredLabels(row),
    sound,
    kind: stageKind(row, media),
    media,
    counts: {
      likes: count(row.counts?.likes),
      comments: count(row.counts?.comments),
      shares: count(row.counts?.shares),
      saves: firstCount(row.counts?.saves, row.counts?.bookmarks),
    },
    viewerLiked: Boolean(row.viewer_reaction) || row.has_reacted === true,
    viewerSaved: row.is_bookmarked === true,
    commentsOff: row.no_comments === true,
    likesOff: row.no_likes === true,
    shareHidden: row.hide_share === true,
    linkUrl: text(row.link_url),
    language: text(row.language),
    commentAccess: text(row.comment_access),
    remixSetting: text(row.remix_setting),
    rich: row.rich_text ?? null,
    hasPoll: Boolean(row.poll) || row.content_type === "poll",
  };
}

/* ── the rail ─────────────────────────────────────────────── */

/**
 * What a rail control shows under its icon: the count when the row carries
 * one — 0 shows "0", never a word — and the control's own name when the row
 * carries none.
 */
export function railCountText(name: string, value: number | undefined): string {
  return typeof value === "number" ? formatCount(value) : name;
}

/** What a rail control announces: "Like, 3"; just "Like" when the count is unknown. */
export function railAriaLabel(name: string, value: number | undefined): string {
  return typeof value === "number" ? `${name}, ${formatCount(value)}` : name;
}

/* ── the caption ─────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "just now", "5m", "3h", "2d", then "18 Oct", and "18 Oct 2025" in another year. */
export function relativeDate(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const sec = Math.max(0, Math.floor((now - then) / 1000));
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  const d = new Date(then);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? "" : ` ${d.getFullYear()}`}`;
}

/** A caption long enough that two lines might not hold it (refined by measuring on the client). */
export function captionMayOverflow(caption: string): boolean {
  return caption.length > 90 || caption.includes("\n");
}

/* ── words on a colour ───────────────────────────────────── */

/**
 * The presets that carry a colour AND white words; the stage picks one for an
 * unstyled text post. The pale presets (cream, mint) read as a washed-out card
 * under the stage's dark top and bottom shades, so they stay the author's own
 * choice and are never picked for them.
 */
const SWATCHES = POST_TEMPLATES.filter((t) => Boolean(t.style.background) && isWhite(t.style.text_color)).map((t) => ({
  background: t.style.background as string,
  text_color: t.style.text_color,
}));

function isWhite(colour: string | undefined): boolean {
  return /^#?f{3}(?:f{3})?$/i.test((colour ?? "").trim());
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The same colour for the same post, every time, from the composer's own presets. */
export function stageSwatch(postId: string): { background: string; text_color?: string } {
  return SWATCHES[hash(postId) % SWATCHES.length];
}

/** The style a text post shows on the stage: its own when it has one, else its swatch. */
export function stageWordsStyle(post: Pick<StagePost, "id" | "rich">): PostRichText {
  if (post.rich?.background || post.rich?.background_media_id) return post.rich;
  const swatch = stageSwatch(post.id);
  return { ...(post.rich ?? {}), background: swatch.background, text_color: swatch.text_color, align: post.rich?.align ?? "center", valign: "middle" };
}

/* ── the frame ───────────────────────────────────────────── */

export const STAGE_ASPECT = 9 / 16;

/** The frame's width/height: 9:16, widened for a landscape video up to 16:9. */
export function frameAspect(post: Pick<StagePost, "media" | "kind">): number {
  const first = post.media[0];
  if (post.kind !== "media" || !first || first.kind !== "video" || !first.width || !first.height) return STAGE_ASPECT;
  return Math.min(16 / 9, Math.max(STAGE_ASPECT, first.width / first.height));
}

/** True when the click went to a Feed nav link while /feed is already open. */
export function isFeedReselect(href: string | null | undefined, currentPath: string, origin: string): boolean {
  if (!href) return false;
  try {
    const url = new URL(href, origin);
    return url.origin === origin && url.pathname === "/feed" && currentPath === "/feed";
  } catch {
    return false;
  }
}
