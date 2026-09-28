import api from "@/lib/api";

import { fetchCollection, fetchCollectionItems, type Collection, type CollectionItem } from "@/features/posttube/library";
import { mediaHref } from "@/features/reels/model";

import { clampPosition, defaultWidth, slotPosition, type EndScreenKind, type EndScreenPosition } from "../endScreenGeometry";
import { getPostDetail, hydrateRows, type HydratedPostRow } from "../data/posttubeApi";
import { mapRelatedRows } from "../model";
import type { MediaSubtitleTrack, PostTubeVideo } from "../types";
import { normalizeChapters, type Chapter } from "./chapters";
import { parseStoryboardVtt, type StoryboardCue } from "./storyboard";
import { normalizeSupport, type CreatorSupport } from "./thanks";
import { upNextChipQuery, type UpNextChip } from "./upNext";

/*
  The watch page's adapter: every request the page makes that is not
  already a hook elsewhere, and every wire shape the page reads, in one
  file — a fixture difference is one edit here.

  Pinned contracts (plan §3, 27 Sep):
    GET    /v1/posts/:id                       viewer_disliked, viewer_queued, chapters[], allow_download, source, like_count, tier_required_id,
                                               age_restricted, hide_like_count (like_count: null for non-owners), default_comment_sort,
                                               related_post_id, related_post {id,title,thumbnail_url,duration_seconds,channel_name} | null;
                                               401 AGE_RESTRICTED_SIGN_IN / 403 AGE_RESTRICTED / 403 AGE_UNVERIFIED → ageGateFromError
    POST   /v1/posts/:id/like                  (hooks/usePostReaction — the toggle clears the dislike)
    POST|DELETE /v1/posts/:id/tune             Pass, the private dislike (clears the like)
    POST|DELETE /v1/comments/:id/heart         creator heart
    PUT|DELETE  /v1/comments/:id/pin           creator pin (one per post)
    GET    /v1/posts/:id/comments?sort=top|newest  (hooks/usePostComments with `sort`)
    GET    /v1/feed/videos/:postId/related?chip=topic:<slug>|fresh|seen
    GET    /v1/media/:mediaId/download         307 → signed attachment; 403 DOWNLOAD_NOT_ALLOWED
    GET    /v1/media/:mediaId/serve/storyboard_vtt|storyboard_jpg   (404 = none)
    GET    /v1/media/:mediaId/audio-tracks     (features/reels/hooks/useAudioTracks)
    GET    /v1/playlists/:id, /v1/playlists/:id/items  (features/posttube/library)
    GET    /v1/monetization/creators/:creatorId/support   {tips_enabled, min_tip_paise, currency, membership_tiers}
    POST   /v1/monetization/tips               Thanks { creator_id, post_id?, amount_paise, message? } (thanksBody)
    GET|POST /v1/videos/:id/progress           (data/posttubeApi; POST only when !isHistoryPaused())
    GET    /v1/posts/:id/end-screens           resolved for this viewer (see normalizeViewerEndScreens); [] for made-for-kids
    GET    /v1/posts/:id/cards                 resolved cards (see normalizeViewerCards)
    POST   /v1/posts/:id/end-screens/:elementId/impression|click   204, fire-and-forget
    POST   /v1/posts/:id/cards/:cardId/impression|click            204, fire-and-forget
*/

interface Envelope<T> {
  data: T;
  meta?: { next_cursor?: string | null };
}

export function isNotFound(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 404;
}

export function isForbidden(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 403;
}

/* ── Post detail ────────────────────────────────────────── */

export type WatchSource = "upload" | "live";

/** The post detail row with the watch-page keys; every new one is optional so an older fixture still renders. */
export interface WatchPostRow extends HydratedPostRow {
  viewer_disliked?: boolean | null;
  viewer_queued?: boolean | null;
  chapters?: { start_ms: number; title: string }[] | null;
  allow_download?: boolean | null;
  source?: string | null;
  like_count?: number | null;
  tier_required_id?: string | null;
  no_comments?: boolean | null;
  hide_share?: boolean | null;
  /** The topic slug (posts.category after the migration; free text before it). */
  category?: string | null;
  /* Hub batch, contract B (every viewer) */
  age_restricted?: boolean | null;
  hide_like_count?: boolean | null;
  default_comment_sort?: string | null;
  related_post_id?: string | null;
  /** End screens and cards are off for made-for-kids videos (either key). */
  made_for_kids?: boolean | null;
  is_made_for_kids?: boolean | null;
  related_post?: {
    id?: string | null;
    title?: string | null;
    thumbnail_url?: string | null;
    duration_seconds?: number | null;
    channel_name?: string | null;
  } | null;
}

/** The creator's pick shown in the about card; only present when the viewer may see it. */
export interface WatchRelatedPost {
  id: string;
  title: string;
  thumbnailUrl: string;
  durationSeconds: number;
  channelName: string;
}

export function normalizeRelatedPost(raw: unknown): WatchRelatedPost | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  if (!id) return null;
  const thumb = typeof r.thumbnail_url === "string" ? r.thumbnail_url : "";
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const duration = typeof r.duration_seconds === "number" && Number.isFinite(r.duration_seconds) ? Math.max(0, r.duration_seconds) : 0;
  return {
    id,
    title: title || "Untitled",
    thumbnailUrl: thumb ? (thumb.startsWith("/v1/") ? mediaHref(thumb) : thumb) : "",
    durationSeconds: duration,
    channelName: typeof r.channel_name === "string" ? r.channel_name : "",
  };
}

export interface WatchDetail {
  video: PostTubeVideo;
  viewerDisliked: boolean;
  viewerQueued: boolean;
  chapters: Chapter[];
  allowDownload: boolean;
  source: WatchSource;
  likeCount: number;
  /** The membership tier the post is gated behind; null = open. */
  tierRequiredId: string | null;
  commentsOff: boolean;
  shareHidden: boolean;
  topicSlug: string | null;
  mediaId: string | null;
  /** The creator hid the count and this viewer is not the owner (the server sent like_count: null). */
  likeCountHidden: boolean;
  /** What the comments open on. */
  defaultCommentSort: "top" | "newest";
  relatedPost: WatchRelatedPost | null;
  ageRestricted: boolean;
  /** No end screen or cards are fetched for it. */
  madeForKids: boolean;
}

/** A row + its card model → what the page reads. Missing keys fall back to what the card already knew. */
export function normalizeWatchDetail(row: WatchPostRow, video: PostTubeVideo): WatchDetail {
  const videoMedia = (row.media ?? []).find((m) => m && m.kind === "video");
  const likeCount =
    typeof row.like_count === "number" && Number.isFinite(row.like_count) && row.like_count >= 0 ? row.like_count : video.like_count;
  const slug = typeof row.category === "string" ? row.category.trim() : "";
  return {
    video: { ...video, like_count: likeCount, viewer_has_disliked: row.viewer_disliked === true },
    viewerDisliked: row.viewer_disliked === true,
    viewerQueued: row.viewer_queued === true,
    chapters: normalizeChapters(row.chapters),
    allowDownload: row.allow_download === true,
    source: row.source === "live" ? "live" : "upload",
    likeCount,
    tierRequiredId: typeof row.tier_required_id === "string" && row.tier_required_id ? row.tier_required_id : null,
    commentsOff: row.no_comments === true,
    shareHidden: row.hide_share === true,
    topicSlug: slug && /^[a-z0-9-]{2,40}$/.test(slug) ? slug : null,
    mediaId: row.video_metadata?.media_asset_id || videoMedia?.media_id || null,
    likeCountHidden: row.hide_like_count === true && typeof row.like_count !== "number",
    defaultCommentSort: typeof row.default_comment_sort === "string" && row.default_comment_sort.toLowerCase() === "newest" ? "newest" : "top",
    relatedPost: row.related_post_id === row.id ? null : normalizeRelatedPost(row.related_post),
    ageRestricted: row.age_restricted === true,
    madeForKids: row.made_for_kids === true || row.is_made_for_kids === true,
  };
}

/* ── Age restriction (server-enforced; contract B) ──────── */

export type AgeGate = "sign_in" | "restricted" | "unverified";

/** The service envelope's code on an axios error (`{"error":{"code"}}`, or a bare `{code}`). */
export function errorCode(err: unknown): string | null {
  const data = (err as { response?: { data?: unknown } })?.response?.data as { error?: unknown; code?: unknown } | undefined;
  if (!data || typeof data !== "object") return null;
  const e = data.error;
  if (e && typeof e === "object" && typeof (e as { code?: unknown }).code === "string") return (e as { code: string }).code || null;
  if (typeof e === "string" && /^[A-Z0-9_]+$/.test(e)) return e;
  return typeof data.code === "string" && data.code ? data.code : null;
}

/**
  A failed detail read → the interstitial that replaces the player:
  401 AGE_RESTRICTED_SIGN_IN (anonymous), 403 AGE_RESTRICTED (under 18),
  403 AGE_UNVERIFIED (no date of birth, or the lookup failed). Anything
  else is not an age gate (null).
*/
export function ageGateFromError(err: unknown): AgeGate | null {
  switch (errorCode(err)) {
    case "AGE_RESTRICTED_SIGN_IN":
      return "sign_in";
    case "AGE_RESTRICTED":
      return "restricted";
    case "AGE_UNVERIFIED":
      return "unverified";
    default:
      return null;
  }
}

/** GET /v1/posts/:id → the card plus the watch keys; null on 404. */
export async function getWatchDetail(postId: string): Promise<WatchDetail | null> {
  const row = (await getPostDetail(postId)) as WatchPostRow | null;
  if (!row) return null;
  const [video] = await hydrateRows([row]);
  if (!video) return null;
  return normalizeWatchDetail(row, video);
}

/* ── Pass (the private dislike) ─────────────────────────── */

export async function setPass(postId: string, on: boolean): Promise<void> {
  if (on) await api.post(`/v1/posts/${postId}/tune`);
  else await api.delete(`/v1/posts/${postId}/tune`);
}

/* ── Creator heart / pin on comments ────────────────────── */

export async function setCommentHeart(commentId: string, on: boolean): Promise<void> {
  if (on) await api.post(`/v1/comments/${commentId}/heart`);
  else await api.delete(`/v1/comments/${commentId}/heart`);
}

export async function setCommentPin(commentId: string, on: boolean): Promise<void> {
  if (on) await api.put(`/v1/comments/${commentId}/pin`);
  else await api.delete(`/v1/comments/${commentId}/pin`);
}

/* ── Up next ────────────────────────────────────────────── */

export interface UpNextPage {
  items: PostTubeVideo[];
  next_cursor?: string;
}

/** GET /v1/feed/videos/:postId/related with the pill's `chip=`; a failure is an empty page, never an error card. */
export async function getUpNext(
  postId: string,
  params: { chip: UpNextChip; topicSlug?: string | null; cursor?: string; limit?: number },
): Promise<UpNextPage> {
  try {
    const res = await api.get<Envelope<HydratedPostRow[]>>(`/v1/feed/videos/${postId}/related`, {
      params: {
        limit: String(params.limit ?? 16),
        ...(params.cursor ? { cursor: params.cursor } : {}),
        ...upNextChipQuery(params.chip, params.topicSlug),
      },
    });
    return { items: mapRelatedRows(res.data.data, postId), next_cursor: res.data.meta?.next_cursor || undefined };
  } catch {
    return { items: [] };
  }
}

/* ── Keep (download) ────────────────────────────────────── */

/** The 307 route; opened in a new tab so the redirect lands on the signed attachment. */
export function downloadHref(mediaId: string): string {
  return mediaHref(`/v1/media/${encodeURIComponent(mediaId)}/download`);
}

/* ── Storyboard ─────────────────────────────────────────── */

export function storyboardVttUrl(mediaId: string): string {
  return mediaHref(`/v1/media/${encodeURIComponent(mediaId)}/serve/storyboard_vtt`);
}

export function storyboardJpgUrl(mediaId: string): string {
  return mediaHref(`/v1/media/${encodeURIComponent(mediaId)}/serve/storyboard_jpg`);
}

/**
 * The cues, every one pointing at the served (signed) sheet. null when the
 * media has no storyboard (404: ≤60 s or not reprocessed yet) or on any
 * other failure — the seek bar simply has no preview.
 */
export async function fetchStoryboard(mediaId: string): Promise<StoryboardCue[] | null> {
  try {
    const res = await api.get<string>(storyboardVttUrl(mediaId), { responseType: "text", transformResponse: (r) => r });
    const text = typeof res.data === "string" ? res.data : "";
    const sheet = storyboardJpgUrl(mediaId);
    const cues = parseStoryboardVtt(text, () => sheet);
    return cues.length > 0 ? cues : null;
  } catch {
    return null;
  }
}

/* ── Captions ───────────────────────────────────────────── */

/** Subtitle rows gained `published`; auto-caption drafts are `published:false` and are not for viewers. */
export type SubtitleRow = MediaSubtitleTrack & { published?: boolean | null };

export function viewerSubtitleTracks(rows: SubtitleRow[] | null | undefined): SubtitleRow[] {
  return (rows ?? []).filter((t) => !!t && t.published !== false);
}

/* ── Collection playback (?list=) ───────────────────────── */

export interface CollectionPlayback {
  collection: Collection;
  items: CollectionItem[];
  ids: string[];
}

/** GET /v1/playlists/:id + /items; null when the list is gone (the page then plays the video on its own). */
export async function getCollectionPlayback(listId: string): Promise<CollectionPlayback | null> {
  const collection = await fetchCollection(listId);
  if (!collection) return null;
  const items = await fetchCollectionItems(listId);
  return { collection, items, ids: items.map((i) => i.postId) };
}

/* ── Thanks (tip) ───────────────────────────────────────── */

/**
 * GET /v1/monetization/creators/:creatorId/support. null on any failure
 * (the route not deployed yet, a 404 for a creator with no row): the rail
 * then simply has no Thanks button.
 */
export async function getCreatorSupport(creatorId: string): Promise<CreatorSupport | null> {
  try {
    const res = await api.get<Envelope<unknown>>(`/v1/monetization/creators/${encodeURIComponent(creatorId)}/support`);
    return normalizeSupport(res.data?.data ?? res.data);
  } catch {
    return null;
  }
}

export interface ThanksInput {
  creatorId: string;
  postId?: string | null;
  amountPaise: number;
  message?: string | null;
}

/**
 * The one place the tip body lives (the monetization lane pinned
 * `{ creator_id, post_id?, amount_paise, message? }`; if it confirms a
 * different key, this is the only edit). `post_id` and `message` go only
 * when present.
 */
export function thanksBody(input: ThanksInput): Record<string, unknown> {
  const message = input.message?.trim() ?? "";
  return {
    creator_id: input.creatorId,
    ...(input.postId ? { post_id: input.postId } : {}),
    amount_paise: Math.round(input.amountPaise),
    ...(message ? { message } : {}),
  };
}

/** POST /v1/monetization/tips. Throws the axios error; thanksErrorMessage reads it. */
export async function sendThanks(input: ThanksInput): Promise<void> {
  await api.post("/v1/monetization/tips", thanksBody(input));
}

/** A 4xx → the server's own message; anything else → a generic line. */
export function thanksErrorMessage(err: unknown): string {
  const res = (err as { response?: { status?: number; data?: unknown } })?.response;
  const status = res?.status ?? 0;
  if (status >= 400 && status < 500) {
    const body = res?.data as { error?: { message?: string } | string; message?: string } | undefined;
    const msg = body?.error && typeof body.error === "object" ? body.error.message : typeof body?.error === "string" ? body.error : body?.message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  return "Could not send your thanks. Try again.";
}

/* ── End screens and cards (what the viewer sees) ───────── */

type Rec = Record<string, unknown>;

function asRec(v: unknown): Rec | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null;
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** A finite number, or a numeric string; null for "", null, missing and anything else. */
function finite(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function count(v: unknown): number {
  const n = finite(v);
  return n !== null && n > 0 ? n : 0;
}

function mediaUrl(v: unknown): string {
  const raw = text(v);
  return raw ? (raw.startsWith("/v1/") ? mediaHref(raw) : raw) : "";
}

function listFrom(raw: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(raw)) return raw;
  const r = asRec(raw);
  if (!r) return [];
  for (const k of keys) if (Array.isArray(r[k])) return r[k] as unknown[];
  return [];
}

export const END_SCREEN_KINDS: readonly EndScreenKind[] = ["video", "playlist", "channel_subscribe", "channel", "external_link"];


/**
  A stored position → {x, y, w}. Accepts the object or its JSON string.
  {x, y, w} is read as is (a missing / zero w takes the kind's default);
  an old {slot: n} row sits in that corner (0 top-left, 1 top-right,
  2 bottom-left, 3 bottom-right); anything else falls back to the slot of
  its index. The result is kept inside the frame.
*/
export function readEndScreenPosition(raw: unknown, kind: EndScreenKind, index: number): EndScreenPosition {
  let parsed: unknown = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }
  const r = asRec(parsed);
  if (r) {
    const x = finite(r.x);
    const y = finite(r.y);
    const w = finite(r.w);
    if (x !== null && y !== null) return clampPosition(kind, { x, y, w: w !== null && w > 0 ? w : defaultWidth(kind) });
    const slot = finite(r.slot);
    if (slot !== null) return slotPosition(slot, kind);
  }
  return slotPosition(index, kind);
}

/** An https URL, normalised; "" for anything else (http, javascript:, junk). */
export function safeHttpsUrl(v: unknown): string {
  const raw = text(v);
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !!u.hostname ? u.toString() : "";
  } catch {
    return "";
  }
}

export function linkDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export interface EndScreenVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
  durationSeconds: number;
  channelName: string;
  viewCount: number;
}

export interface EndScreenCollection {
  id: string;
  title: string;
  thumbnailUrl: string;
  itemCount: number;
}

export interface EndScreenChannel {
  userId: string;
  handle: string;
  name: string;
  avatarUrl: string;
  subscriberCount: number;
  isSubscribed: boolean;
}

export interface EndScreenLink {
  url: string;
  title: string;
  domain: string;
}

/** One end-screen element as the viewer sees it: always resolved (a half-empty element is dropped). */
export interface ViewerEndScreenElement {
  id: string;
  type: EndScreenKind;
  position: EndScreenPosition;
  startMs: number;
  endMs: number;
  video: EndScreenVideo | null;
  playlist: EndScreenCollection | null;
  channel: EndScreenChannel | null;
  link: EndScreenLink | null;
}

export function normalizeEndScreenVideo(raw: unknown): EndScreenVideo | null {
  const r = asRec(raw);
  const id = text(r?.id);
  if (!r || !id) return null;
  return {
    id,
    title: text(r.title) || "Untitled",
    thumbnailUrl: mediaUrl(r.thumbnail_url),
    durationSeconds: count(r.duration_seconds),
    channelName: text(r.channel_name),
    viewCount: count(r.view_count),
  };
}

export function normalizeEndScreenCollection(raw: unknown): EndScreenCollection | null {
  const r = asRec(raw);
  const id = text(r?.id);
  if (!r || !id) return null;
  return { id, title: text(r.title) || "Untitled collection", thumbnailUrl: mediaUrl(r.thumbnail_url), itemCount: count(r.item_count) };
}

export function normalizeEndScreenChannel(raw: unknown): EndScreenChannel | null {
  const r = asRec(raw);
  if (!r) return null;
  const userId = text(r.user_id) || text(r.owner_id) || text(r.id);
  const handle = text(r.handle).replace(/^@/, "");
  if (!userId && !handle) return null;
  return {
    userId,
    handle,
    name: text(r.name) || (handle ? `@${handle}` : "Channel"),
    avatarUrl: mediaUrl(r.avatar_url),
    subscriberCount: count(r.subscriber_count),
    isSubscribed: r.is_subscribed === true,
  };
}

export function normalizeEndScreenLink(raw: unknown): EndScreenLink | null {
  const r = asRec(raw);
  const url = safeHttpsUrl(r?.url);
  if (!r || !url) return null;
  const domain = text(r.domain) || linkDomain(url);
  return { url, title: text(r.title) || domain, domain };
}

/**
  `GET /v1/posts/:id/end-screens` for a viewer → the elements to draw.
  Accepts a bare array or {screens|elements:[…]}. An element with no id,
  an unknown type, no window (end ≤ start) or without the resolved
  object its type needs is dropped; at most four are kept.
*/
export function normalizeViewerEndScreens(raw: unknown): ViewerEndScreenElement[] {
  const out: ViewerEndScreenElement[] = [];
  listFrom(raw, "screens", "elements", "items").forEach((item, index) => {
    const r = asRec(item);
    if (!r) return;
    const id = text(r.id);
    const type = text(r.type).toLowerCase() as EndScreenKind;
    if (!id || !END_SCREEN_KINDS.includes(type)) return;
    const startMs = count(r.start_ms);
    const endMs = count(r.end_ms);
    if (endMs <= startMs) return;
    const video = type === "video" ? normalizeEndScreenVideo(r.video) : null;
    const playlist = type === "playlist" ? normalizeEndScreenCollection(r.playlist ?? r.collection) : null;
    const channel = type === "channel" || type === "channel_subscribe" ? normalizeEndScreenChannel(r.channel) : null;
    const link = type === "external_link" ? normalizeEndScreenLink(r.link) : null;
    if (!video && !playlist && !channel && !link) return;
    out.push({ id, type, position: readEndScreenPosition(r.position, type, index), startMs, endMs, video, playlist, channel, link });
  });
  return out.slice(0, 4);
}

export type ViewerCardType = "video" | "playlist" | "external_link";

export interface ViewerCard {
  id: string;
  type: ViewerCardType;
  appearAtMs: number;
  title: string;
  teaser: string;
  video: EndScreenVideo | null;
  playlist: EndScreenCollection | null;
  link: EndScreenLink | null;
}

/**
  `GET /v1/posts/:id/cards` → the cards to show, by time. Poll cards are
  dropped (there is no poll surface on the watch page to open), as is any
  card whose target did not resolve. At most five.
*/
export function normalizeViewerCards(raw: unknown): ViewerCard[] {
  const out: ViewerCard[] = [];
  for (const item of listFrom(raw, "cards", "items")) {
    const r = asRec(item);
    if (!r) continue;
    const id = text(r.id);
    const type = text(r.type).toLowerCase();
    if (!id || (type !== "video" && type !== "playlist" && type !== "external_link")) continue;
    const video = type === "video" ? normalizeEndScreenVideo(r.video) : null;
    const playlist = type === "playlist" ? normalizeEndScreenCollection(r.playlist ?? r.collection) : null;
    const link = type === "external_link" ? normalizeEndScreenLink(r.link) : null;
    if (!video && !playlist && !link) continue;
    const title = text(r.title) || video?.title || playlist?.title || link?.title || "";
    out.push({ id, type, appearAtMs: count(r.appear_at_ms), title, teaser: text(r.teaser_text) || title, video, playlist, link });
  }
  return out.sort((a, b) => a.appearAtMs - b.appearAtMs).slice(0, 5);
}

/** Any failure (404, an age code, the route not deployed) is "none": the overlay is never an error. */
export async function getViewerEndScreens(postId: string): Promise<ViewerEndScreenElement[]> {
  try {
    const res = await api.get<Envelope<unknown>>(`/v1/posts/${encodeURIComponent(postId)}/end-screens`);
    return normalizeViewerEndScreens(res.data?.data ?? res.data);
  } catch {
    return [];
  }
}

export async function getViewerCards(postId: string): Promise<ViewerCard[]> {
  try {
    const res = await api.get<Envelope<unknown>>(`/v1/posts/${encodeURIComponent(postId)}/cards`);
    return normalizeViewerCards(res.data?.data ?? res.data);
  } catch {
    return [];
  }
}

export type ElementSurface = "end-screens" | "cards";
export type ElementEvent = "impression" | "click";

export function elementEventPath(postId: string, surface: ElementSurface, elementId: string, event: ElementEvent): string {
  return `/v1/posts/${encodeURIComponent(postId)}/${surface}/${encodeURIComponent(elementId)}/${event}`;
}

/** POST …/impression|click with an empty body. Fire-and-forget: never awaited, never throws, never blocks navigation. */
export function recordElementEvent(postId: string, surface: ElementSurface, elementId: string, event: ElementEvent): void {
  try {
    void api.post(elementEventPath(postId, surface, elementId, event)).catch(() => undefined);
  } catch {
    /* never in the way */
  }
}

export type { Chapter, StoryboardCue, Collection, CollectionItem, CreatorSupport };
