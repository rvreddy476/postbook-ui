import api from "@/lib/api";
import { mediaHref } from "@/features/reels/model";
import { extractCoverFrame } from "@/features/reels/data/reelsApi";
import { uploadMedia } from "@/lib/mediaUpload";
import { createSubtitleTrack, getSubtitleTracks, setCoverFrame, updateSchedule } from "@/features/posttube/data/posttubeApi";
import type { MediaSubtitleTrack } from "@/features/posttube/types";
import type { CommentItem } from "@/types/profile";

/*
  The Creator Hub's one adapter. Every request the hub sends and every
  response shape it reads is declared here, so a contract change is one
  edit. The normalisers are pure and exported for the tests; they tolerate
  the older row shapes (no `flags`, `notices[]` instead, playlists instead
  of collections) and Go zero values (an empty string is "absent", not a
  value — see the `||` fall-throughs).

  Requests (all through `@/lib/api`, the gateway):
    GET    /v1/uploads/videos|flicks?limit&cursor
    GET    /v1/uploads/counts
    POST   /v1/uploads/bulk                      { post_ids, patch: { visibility } }
    DELETE /v1/uploads/:postId
    GET    /v1/posts/me/summary
    GET    /v1/posts/me/scheduled
    PATCH  /v1/posts/:id/schedule                { publish_at } (posttubeApi.updateSchedule)
    GET    /v1/posts/:id
    PATCH  /v1/posts/:id                         (owner edit, see HubPostPatch)
    GET|POST /v1/posts/:id/chapters              { chapters: [...] }
    GET|POST /v1/posts/:id/end-screens           { screens: [...] }
    GET|POST /v1/posts/:id/cards                 { cards: [...] }
    GET    /v1/posts/categories
    GET    /v1/comments/inbox?status&content&sort&cursor&limit
    POST|DELETE /v1/comments/:id/heart
    PUT|DELETE  /v1/comments/:id/pin
    GET    /v1/subtitles/mine?status&cursor&limit
    PATCH  /v1/subtitles/:mediaId/:language      { published }
    POST   /v1/subtitles/:mediaId                (posttubeApi.createSubtitleTrack)
    POST   /v1/subtitles/:mediaId/auto           { language }
    GET    /v1/subtitles/:mediaId                (posttubeApi.getSubtitleTracks)
    GET    /v1/analytics/creator/me?period
    GET    /v1/analytics/content/:id?period
    POST   /v1/media/:mediaId/frames?count=1     (reelsApi.extractCoverFrame) + POST /v1/videos/:id/cover-frame
    POST   /v1/media/init + PUT upload + POST /v1/media/confirm (lib/mediaUpload.uploadMedia)
    GET    /v1/media/:id/download                (link only, when allow_download)
*/

interface ApiResponse<T> {
  data: T;
  meta?: { next_cursor?: string | null };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x !== "") : [];
}

function nextCursor(meta: ApiResponse<unknown>["meta"] | undefined): string | undefined {
  return meta?.next_cursor || undefined;
}

/* ── Library rows ───────────────────────────────────────── */

export type HubVisibility = "public" | "unlisted" | "private" | "scheduled";
export const HUB_VISIBILITIES: readonly HubVisibility[] = ["public", "unlisted", "private", "scheduled"];

export type HubFlag = "processing_failed" | "review_hold" | "made_for_kids" | "scheduled";
export const HUB_FLAGS: readonly HubFlag[] = ["processing_failed", "review_hold", "made_for_kids", "scheduled"];

export type HubLibraryKind = "videos" | "flicks";

/** A row of `GET /v1/uploads/videos|flicks` after normalisation. */
export interface HubLibraryRow {
  id: string;
  title: string;
  text: string;
  content_type: string;
  cover_media_id: string | null;
  thumbnail_url: string;
  /** The video asset the row plays; captions and cover frames key on it. */
  media_id: string | null;
  duration_seconds: number;
  visibility: HubVisibility;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  view_count: number;
  comment_count: number;
  like_count: number;
  processing_status: string;
  flags: HubFlag[];
  allow_download: boolean;
  /** "live" when the row was born from a stream recording; null when the row does not say. */
  source: string | null;
}

export function normalizeVisibility(raw: unknown, scheduledAt?: string | null): HubVisibility {
  const v = str(raw).toLowerCase();
  if (v === "public" || v === "unlisted" || v === "private" || v === "scheduled") return v;
  if (scheduledAt) return "scheduled";
  return "public";
}

const LEGACY_NOTICES: Record<string, HubFlag> = {
  processing_failed: "processing_failed",
  "processing failed": "processing_failed",
  copyright_hold: "review_hold",
  "copyright hold": "review_hold",
  review_hold: "review_hold",
  made_for_kids: "made_for_kids",
  "made-for-kids": "made_for_kids",
  scheduled: "scheduled",
};

export function normalizeFlags(raw: unknown, extra?: { scheduledAt?: string | null; madeForKids?: unknown; processingStatus?: string }): HubFlag[] {
  const out = new Set<HubFlag>();
  const list = Array.isArray(raw) ? raw : [];
  for (const entry of list) {
    const key = typeof entry === "string" ? entry : isRecord(entry) ? str(entry.kind ?? entry.type ?? entry.code) : "";
    const mapped = LEGACY_NOTICES[key.toLowerCase()];
    if (mapped) out.add(mapped);
  }
  if (extra?.scheduledAt) out.add("scheduled");
  if (extra?.madeForKids === true) out.add("made_for_kids");
  if (extra?.processingStatus === "failed") out.add("processing_failed");
  return HUB_FLAGS.filter((f) => out.has(f));
}

export function normalizeLibraryRow(raw: unknown): HubLibraryRow | null {
  if (!isRecord(raw) || typeof raw.id !== "string") return null;
  const media = Array.isArray(raw.media) ? raw.media.filter(isRecord) : [];
  const videoMedia = media.find((m) => m.kind === "video");
  const vm = isRecord(raw.video_metadata) ? raw.video_metadata : {};
  const counts = isRecord(raw.counts) ? raw.counts : {};
  const scheduledAt = strOrNull(raw.scheduled_at) ?? strOrNull(raw.publish_at);
  const coverId = strOrNull(raw.cover_media_id);
  const processingStatus = str(raw.processing_status) || str(vm.upload_status) || "";
  const durationMs = num(videoMedia?.duration_ms);
  return {
    id: raw.id,
    title: str(raw.title).trim() || firstLine(str(raw.text)) || "Untitled",
    text: str(raw.text),
    content_type: str(raw.content_type) || str(vm.final_category),
    cover_media_id: coverId,
    thumbnail_url: str(vm.thumbnail_url) || (coverId ? mediaHref(`/v1/media/${coverId}/serve`) : ""),
    media_id: strOrNull(videoMedia?.media_id) ?? strOrNull(vm.media_asset_id),
    duration_seconds: num(vm.effective_duration_seconds) || num(vm.duration_seconds) || (durationMs ? durationMs / 1000 : 0),
    visibility: normalizeVisibility(raw.visibility, scheduledAt),
    scheduled_at: scheduledAt,
    published_at: strOrNull(raw.published_at),
    created_at: str(raw.created_at),
    view_count: num(raw.view_count),
    comment_count: num(raw.comment_count) || num(counts.comments),
    like_count: num(raw.like_count) || num(counts.likes),
    processing_status: processingStatus,
    flags: normalizeFlags(raw.flags ?? raw.notices, { scheduledAt, madeForKids: raw.made_for_kids, processingStatus }),
    allow_download: bool(raw.allow_download),
    source: strOrNull(raw.source),
  };
}

function firstLine(text: string): string {
  return text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? "";
}

export interface HubLibraryPage {
  items: HubLibraryRow[];
  next_cursor?: string;
}

export async function listLibrary(kind: HubLibraryKind, params?: { cursor?: string; limit?: number }): Promise<HubLibraryPage> {
  const res = await api.get<ApiResponse<unknown[]>>(`/v1/uploads/${kind}`, {
    params: { limit: String(params?.limit ?? 30), ...(params?.cursor ? { cursor: params.cursor } : {}) },
  });
  const rows = Array.isArray(res.data.data) ? res.data.data : [];
  return { items: rows.map(normalizeLibraryRow).filter((r): r is HubLibraryRow => r !== null), next_cursor: nextCursor(res.data.meta) };
}

export interface HubUploadCounts {
  videos: number;
  flicks: number;
  posts: number;
}

export async function getUploadCounts(): Promise<HubUploadCounts> {
  const res = await api.get<ApiResponse<Partial<HubUploadCounts>>>("/v1/uploads/counts");
  const d = res.data.data ?? {};
  return { videos: num(d.videos), flicks: num(d.flicks), posts: num(d.posts) };
}

export async function deleteUpload(postId: string): Promise<void> {
  await api.delete(`/v1/uploads/${postId}`);
}

/* ── Bulk visibility ────────────────────────────────────── */

export interface HubBulkOutcome {
  post_id: string;
  ok: boolean;
  error?: string;
}

/** Tolerates `{results:[…]}`, a bare array, or a `{id: "ok" | {error}}` map. */
export function normalizeBulkOutcomes(raw: unknown, requested: string[]): HubBulkOutcome[] {
  const data = isRecord(raw) && Array.isArray(raw.results) ? raw.results : raw;
  if (Array.isArray(data)) {
    const out = data
      .filter(isRecord)
      .map((r) => ({
        post_id: str(r.post_id ?? r.id),
        ok: typeof r.ok === "boolean" ? r.ok : !r.error && str(r.status).toLowerCase() !== "failed",
        error: strOrNull(r.error) ?? undefined,
      }))
      .filter((r) => r.post_id);
    if (out.length > 0) return out;
  }
  if (isRecord(data) && !Array.isArray(data)) {
    const entries = Object.entries(data).filter(([k]) => requested.includes(k));
    if (entries.length > 0) {
      return entries.map(([post_id, v]) => {
        if (isRecord(v)) return { post_id, ok: typeof v.ok === "boolean" ? v.ok : !v.error, error: strOrNull(v.error) ?? undefined };
        const s = str(v).toLowerCase();
        return { post_id, ok: v === true || s === "ok" || s === "updated" || s === "success" };
      });
    }
  }
  // No per-id detail: a 2xx means every id went through.
  return requested.map((post_id) => ({ post_id, ok: true }));
}

export async function bulkSetVisibility(postIds: string[], visibility: HubVisibility): Promise<HubBulkOutcome[]> {
  const res = await api.post<ApiResponse<unknown>>("/v1/uploads/bulk", { post_ids: postIds, patch: { visibility } });
  return normalizeBulkOutcomes(res.data?.data ?? res.data, postIds);
}

/* ── Summary ────────────────────────────────────────────── */

export interface HubSummary {
  videos: number;
  shorts: number;
  live: number;
  collections: number;
  followers: number;
}

/** `GET /v1/posts/me/summary`; the older names (playlists, subscribers) still read. */
export function normalizeSummary(raw: unknown): HubSummary {
  const d = isRecord(raw) ? raw : {};
  return {
    videos: num(d.videos),
    shorts: num(d.shorts) || num(d.flicks),
    live: num(d.live),
    collections: num(d.collections) || num(d.playlists),
    followers: num(d.followers) || num(d.subscribers),
  };
}

export async function getMySummary(): Promise<HubSummary> {
  const res = await api.get<ApiResponse<unknown>>("/v1/posts/me/summary");
  return normalizeSummary(res.data.data ?? res.data);
}

/* ── Post detail and the owner patch ────────────────────── */

export interface HubPostDetail {
  id: string;
  title: string;
  text: string;
  content_type: string;
  visibility: HubVisibility;
  scheduled_at: string | null;
  cover_media_id: string | null;
  thumbnail_url: string;
  media_id: string | null;
  duration_seconds: number;
  tags: string[];
  hashtags: string[];
  category: string;
  language: string;
  allow_download: boolean;
  no_comments: boolean;
  made_for_kids: boolean;
}

export function normalizePostDetail(raw: unknown): HubPostDetail | null {
  if (!isRecord(raw) || typeof raw.id !== "string") return null;
  const row = normalizeLibraryRow(raw);
  if (!row) return null;
  return {
    id: row.id,
    title: str(raw.title),
    text: row.text,
    content_type: row.content_type,
    visibility: row.visibility,
    scheduled_at: row.scheduled_at,
    cover_media_id: row.cover_media_id,
    thumbnail_url: row.thumbnail_url,
    media_id: row.media_id,
    duration_seconds: row.duration_seconds,
    tags: strArray(raw.tags),
    hashtags: strArray(raw.hashtags),
    category: str(raw.category) || str(raw.category_slug),
    language: str(raw.language),
    allow_download: row.allow_download,
    no_comments: bool(raw.no_comments),
    made_for_kids: bool(raw.made_for_kids),
  };
}

export async function getPost(postId: string): Promise<HubPostDetail | null> {
  const res = await api.get<ApiResponse<unknown>>(`/v1/posts/${postId}`);
  return normalizePostDetail(res.data.data);
}

/** The owner patch (post-service contract 2). Only the keys present are sent. */
export interface HubPostPatch {
  title?: string;
  text?: string;
  tags?: string[];
  hashtags?: string[];
  category?: string;
  visibility?: HubVisibility;
  cover_media_id?: string;
  allow_download?: boolean;
  no_comments?: boolean;
  made_for_kids?: boolean;
  language?: string;
}

export async function updatePost(postId: string, patch: HubPostPatch): Promise<HubPostDetail | null> {
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) body[k] = v;
  const res = await api.patch<ApiResponse<unknown>>(`/v1/posts/${postId}`, body);
  return normalizePostDetail(res.data?.data);
}

export async function setVisibility(postId: string, visibility: HubVisibility): Promise<HubPostDetail | null> {
  return updatePost(postId, { visibility });
}

/** `PATCH /v1/posts/:id/schedule` — an ISO timestamp, or nothing for "publish now". */
export async function reschedule(postId: string, publishAt?: string): Promise<void> {
  await updateSchedule(postId, publishAt);
}

/* ── Cover: frame pick or custom image ──────────────────── */

/** Picks the frame at `timestampMs` (media-service frames) and records it as the video's cover. */
export async function pickCoverFrame(postId: string, mediaId: string, timestampMs: number): Promise<string> {
  const frame = await extractCoverFrame({ mediaId, timestampMs });
  await setCoverFrame(postId, { cover_media_id: frame.cover_media_id, thumbnail_url: frame.preview_url, timestamp_ms: timestampMs });
  return frame.preview_url;
}

/** Uploads an image as a cover asset and sets it through the owner patch. */
export async function uploadCoverImage(postId: string, file: File): Promise<string> {
  const mediaId = await uploadMedia(file, "image", "cover");
  await updatePost(postId, { cover_media_id: mediaId });
  return mediaId;
}

/* ── Chapters, end screens, cards (post-service video_series_handler.go) ── */

/**
  `POST /v1/posts/:postId/chapters` body, verbatim from
  post-service `internal/http/video_series_handler.go`:
    type chapterInput struct {
      ChapterIndex int     `json:"chapter_index"`
      Title        string  `json:"title" binding:"required"`
      StartMs      int     `json:"start_ms"`
      ThumbnailURL *string `json:"thumbnail_url"`
      Source       string  `json:"source"`        // "manual" | "ai_generated" | ""
    }
    type saveChaptersRequest struct { Chapters []chapterInput `json:"chapters" binding:"required"` }
  Replies `{ saved: n }`. `GET` returns rows `{post_id, chapter_index, title, start_ms, thumbnail_url?, source, created_at}`.
*/
export interface HubChapter {
  chapter_index: number;
  title: string;
  start_ms: number;
  thumbnail_url?: string | null;
  source: "manual" | "ai_generated";
}

export function normalizeChapters(raw: unknown): HubChapter[] {
  const list = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.chapters) ? raw.chapters : [];
  return list
    .filter(isRecord)
    .map((c, i) => ({
      chapter_index: num(c.chapter_index, i),
      title: str(c.title),
      start_ms: num(c.start_ms),
      thumbnail_url: strOrNull(c.thumbnail_url),
      source: str(c.source) === "ai_generated" ? ("ai_generated" as const) : ("manual" as const),
    }))
    .sort((a, b) => a.start_ms - b.start_ms || a.chapter_index - b.chapter_index);
}

export async function getChapters(postId: string): Promise<HubChapter[]> {
  const res = await api.get<ApiResponse<unknown>>(`/v1/posts/${postId}/chapters`);
  return normalizeChapters(res.data.data);
}

export async function saveChapters(postId: string, chapters: Pick<HubChapter, "title" | "start_ms">[]): Promise<number> {
  const sorted = chapters.slice().sort((a, b) => a.start_ms - b.start_ms);
  const body = {
    chapters: sorted.map((c, i) => ({ chapter_index: i, title: c.title, start_ms: Math.max(0, Math.round(c.start_ms)), source: "manual" })),
  };
  const res = await api.post<ApiResponse<{ saved?: number }>>(`/v1/posts/${postId}/chapters`, body);
  return num(res.data?.data?.saved, sorted.length);
}

/**
  `POST /v1/posts/:postId/end-screens`, verbatim:
    type endScreenInput struct {
      Type      string          `json:"type" binding:"required"`   // video | playlist | channel_subscribe | external_link
      TargetID  *string         `json:"target_id"`                 // UUID when set
      TargetURL *string         `json:"target_url"`
      Title     *string         `json:"title"`
      Position  json.RawMessage `json:"position" binding:"required"`
      StartMs   int             `json:"start_ms"`
      EndMs     int             `json:"end_ms"`                    // must be > start_ms
    }
    type saveEndScreensRequest struct { Screens []endScreenInput `json:"screens" binding:"required"` }
*/
export type HubEndScreenType = "video" | "playlist" | "channel_subscribe" | "external_link";
export const HUB_END_SCREEN_TYPES: readonly HubEndScreenType[] = ["video", "playlist", "channel_subscribe", "external_link"];
export const HUB_END_SCREEN_MAX = 4;

export interface HubEndScreen {
  id?: string;
  type: HubEndScreenType;
  target_id: string | null;
  target_url: string | null;
  title: string | null;
  /** Free JSON; the hub writes `{slot: 0..3}` and reads whatever is there back. */
  position: Record<string, unknown>;
  start_ms: number;
  end_ms: number;
}

export function normalizeEndScreens(raw: unknown): HubEndScreen[] {
  const list = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.screens) ? raw.screens : [];
  return list.filter(isRecord).map((s, i) => {
    let position: Record<string, unknown> = { slot: i };
    if (isRecord(s.position)) position = s.position;
    else if (typeof s.position === "string") {
      try {
        const parsed: unknown = JSON.parse(s.position);
        if (isRecord(parsed)) position = parsed;
      } catch {
        /* keep the slot */
      }
    }
    const type = str(s.type) as HubEndScreenType;
    return {
      id: strOrNull(s.id) ?? undefined,
      type: HUB_END_SCREEN_TYPES.includes(type) ? type : "video",
      target_id: strOrNull(s.target_id),
      target_url: strOrNull(s.target_url),
      title: strOrNull(s.title),
      position,
      start_ms: num(s.start_ms),
      end_ms: num(s.end_ms),
    };
  });
}

export async function getEndScreens(postId: string): Promise<HubEndScreen[]> {
  const res = await api.get<ApiResponse<unknown>>(`/v1/posts/${postId}/end-screens`);
  return normalizeEndScreens(res.data.data);
}

export async function saveEndScreens(postId: string, screens: HubEndScreen[]): Promise<number> {
  const body = {
    screens: screens.slice(0, HUB_END_SCREEN_MAX).map((s, i) => ({
      type: s.type,
      target_id: s.target_id ?? undefined,
      target_url: s.target_url ?? undefined,
      title: s.title ?? undefined,
      position: { ...s.position, slot: i },
      start_ms: Math.max(0, Math.round(s.start_ms)),
      end_ms: Math.max(Math.round(s.start_ms) + 1, Math.round(s.end_ms)),
    })),
  };
  const res = await api.post<ApiResponse<{ saved?: number }>>(`/v1/posts/${postId}/end-screens`, body);
  return num(res.data?.data?.saved, body.screens.length);
}

/**
  `POST /v1/posts/:postId/cards`, verbatim:
    type videoCardInput struct {
      Type       string  `json:"type" binding:"required"`   // video | playlist | poll | external_link
      TargetID   *string `json:"target_id"`
      TargetURL  *string `json:"target_url"`
      Title      string  `json:"title" binding:"required"`  // must not be blank
      TeaserText *string `json:"teaser_text"`
      AppearAtMs int     `json:"appear_at_ms"`              // >= 0
    }
    type saveVideoCardsRequest struct { Cards []videoCardInput `json:"cards" binding:"required"` }
*/
export type HubCardType = "video" | "playlist" | "poll" | "external_link";
export const HUB_CARD_TYPES: readonly HubCardType[] = ["video", "playlist", "poll", "external_link"];

export interface HubCard {
  id?: string;
  type: HubCardType;
  target_id: string | null;
  target_url: string | null;
  title: string;
  teaser_text: string | null;
  appear_at_ms: number;
}

export function normalizeCards(raw: unknown): HubCard[] {
  const list = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.cards) ? raw.cards : [];
  return list
    .filter(isRecord)
    .map((c) => {
      const type = str(c.type) as HubCardType;
      return {
        id: strOrNull(c.id) ?? undefined,
        type: HUB_CARD_TYPES.includes(type) ? type : "video",
        target_id: strOrNull(c.target_id),
        target_url: strOrNull(c.target_url),
        title: str(c.title),
        teaser_text: strOrNull(c.teaser_text),
        appear_at_ms: num(c.appear_at_ms),
      };
    })
    .sort((a, b) => a.appear_at_ms - b.appear_at_ms);
}

export async function getCards(postId: string): Promise<HubCard[]> {
  const res = await api.get<ApiResponse<unknown>>(`/v1/posts/${postId}/cards`);
  return normalizeCards(res.data.data);
}

export async function saveCards(postId: string, cards: HubCard[]): Promise<number> {
  const body = {
    cards: cards
      .filter((c) => c.title.trim() !== "")
      .map((c) => ({
        type: c.type,
        target_id: c.target_id ?? undefined,
        target_url: c.target_url ?? undefined,
        title: c.title.trim(),
        teaser_text: c.teaser_text ?? undefined,
        appear_at_ms: Math.max(0, Math.round(c.appear_at_ms)),
      })),
  };
  const res = await api.post<ApiResponse<{ saved?: number }>>(`/v1/posts/${postId}/cards`, body);
  return num(res.data?.data?.saved, body.cards.length);
}

/* ── Categories (topics) ────────────────────────────────── */

export interface HubCategory {
  slug: string;
  label: string;
  kind: "all" | "short" | "long";
}

/** `GET /v1/posts/categories` → `[{slug,label,kind}]`; strings and `{categories:[…]}` still read (kind = all). */
export function normalizeHubCategories(raw: unknown): HubCategory[] {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.categories)
      ? raw.categories
      : isRecord(raw) && Array.isArray(raw.items)
        ? raw.items
        : [];
  const out: HubCategory[] = [];
  const seen = new Set<string>();
  for (const entry of list) {
    let slug = "";
    let label = "";
    let kind: HubCategory["kind"] = "all";
    if (typeof entry === "string") slug = entry;
    else if (isRecord(entry)) {
      slug = str(entry.slug ?? entry.key ?? entry.id ?? entry.value);
      label = str(entry.name ?? entry.label ?? entry.title ?? entry.display_name);
      const k = str(entry.kind);
      if (k === "short" || k === "long" || k === "all") kind = k;
    }
    slug = slug.trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, label: label.trim() || titleCase(slug), kind });
  }
  return out;
}

function titleCase(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function getHubCategories(): Promise<HubCategory[]> {
  try {
    const res = await api.get<ApiResponse<unknown>>("/v1/posts/categories");
    return normalizeHubCategories(res.data.data ?? res.data);
  } catch {
    return [];
  }
}

/* ── Conversations (comments inbox) ─────────────────────── */

export type InboxStatus = "unanswered" | "all";
export type InboxContent = "videos" | "flicks" | "posts" | "all";
export type InboxSort = "newest" | "relevant";

export interface HubInboxComment extends CommentItem {
  /** Creator heart; `creator_hearted` and `hearted` both read. */
  hearted: boolean;
  /** `pinned` and `is_pinned` both read. */
  pinned: boolean;
}

export interface HubInboxRow {
  comment: HubInboxComment;
  post: { id: string; title: string; content_type: string; cover_media_id: string | null };
  author_replied: boolean;
}

export function normalizeInboxRow(raw: unknown): HubInboxRow | null {
  if (!isRecord(raw)) return null;
  const c = isRecord(raw.comment) ? raw.comment : raw;
  if (typeof c.id !== "string") return null;
  const p = isRecord(raw.post) ? raw.post : {};
  const postId = str(p.id) || str(c.post_id);
  if (!postId) return null;
  const body = str(c.body) || str(c.text);
  const comment: HubInboxComment = {
    ...(c as unknown as CommentItem),
    id: c.id,
    post_id: postId,
    author_id: str(c.author_id),
    body,
    like_count: num(c.like_count),
    dislike_count: num(c.dislike_count),
    reply_count: num(c.reply_count),
    is_reply: bool(c.is_reply),
    created_at: str(c.created_at),
    updated_at: str(c.updated_at) || str(c.created_at),
    reactions: Array.isArray(c.reactions) ? (c.reactions as CommentItem["reactions"]) : [],
    reaction_count: num(c.reaction_count) || num(c.like_count),
    viewer_reaction: strOrNull(c.viewer_reaction),
    hearted: bool(c.creator_hearted) || bool(c.hearted),
    pinned: bool(c.pinned) || bool(c.is_pinned),
  };
  return {
    comment,
    post: { id: postId, title: str(p.title).trim() || "Untitled", content_type: str(p.content_type), cover_media_id: strOrNull(p.cover_media_id) },
    author_replied: bool(raw.author_replied),
  };
}

export interface HubInboxPage {
  items: HubInboxRow[];
  next_cursor?: string;
}

export async function listInbox(params: { status: InboxStatus; content: InboxContent; sort: InboxSort; cursor?: string; limit?: number }): Promise<HubInboxPage> {
  const res = await api.get<ApiResponse<unknown[]>>("/v1/comments/inbox", {
    params: {
      status: params.status,
      content: params.content,
      sort: params.sort,
      limit: String(params.limit ?? 30),
      ...(params.cursor ? { cursor: params.cursor } : {}),
    },
  });
  const rows = Array.isArray(res.data.data) ? res.data.data : [];
  return { items: rows.map(normalizeInboxRow).filter((r): r is HubInboxRow => r !== null), next_cursor: nextCursor(res.data.meta) };
}

export async function heartComment(commentId: string, on: boolean): Promise<void> {
  if (on) await api.post(`/v1/comments/${commentId}/heart`);
  else await api.delete(`/v1/comments/${commentId}/heart`);
}

export async function pinComment(commentId: string, on: boolean): Promise<void> {
  if (on) await api.put(`/v1/comments/${commentId}/pin`);
  else await api.delete(`/v1/comments/${commentId}/pin`);
}

/* ── Captions ───────────────────────────────────────────── */

export type CaptionStatus = "all" | "draft" | "published";

export interface HubCaptionLanguage {
  language: string;
  source: string;
  published: boolean;
  updated_at: string;
}

export interface HubCaptionRow {
  media_id: string;
  /** When the row carries them; the list contract keys on media only. */
  post_id: string | null;
  title: string;
  languages: HubCaptionLanguage[];
  modified_at: string;
}

export function normalizeCaptionRow(raw: unknown): HubCaptionRow | null {
  if (!isRecord(raw)) return null;
  const mediaId = str(raw.media_id) || str(raw.media_asset_id);
  if (!mediaId) return null;
  const languages = (Array.isArray(raw.languages) ? raw.languages : [])
    .filter(isRecord)
    .map((l) => ({
      language: str(l.language),
      source: str(l.source) || "manual_upload",
      // Uploads default to published, auto to draft (media-service contract 3).
      published: typeof l.published === "boolean" ? l.published : str(l.source) !== "auto",
      updated_at: str(l.updated_at) || str(l.created_at),
    }))
    .filter((l) => l.language);
  return {
    media_id: mediaId,
    post_id: strOrNull(raw.post_id),
    title: str(raw.title).trim(),
    languages,
    modified_at: str(raw.modified_at) || str(raw.updated_at) || languages.reduce((m, l) => (l.updated_at > m ? l.updated_at : m), ""),
  };
}

export interface HubCaptionPage {
  items: HubCaptionRow[];
  next_cursor?: string;
}

/** `{data:{items:[…]}, meta:{next_cursor}}` (media-service, 73da6b13); a bare `data:[…]` still reads. */
export function normalizeCaptionPage(body: unknown): HubCaptionPage {
  const env = isRecord(body) ? body : {};
  const data = env.data;
  const rows: unknown[] = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data.items) ? data.items : [];
  const meta = isRecord(env.meta) ? env.meta : {};
  return { items: rows.map(normalizeCaptionRow).filter((r): r is HubCaptionRow => r !== null), next_cursor: strOrNull(meta.next_cursor) ?? undefined };
}

export async function listMyCaptions(params: { status: CaptionStatus; cursor?: string; limit?: number }): Promise<HubCaptionPage> {
  const res = await api.get<unknown>("/v1/subtitles/mine", {
    params: { status: params.status, limit: String(params.limit ?? 30), ...(params.cursor ? { cursor: params.cursor } : {}) },
  });
  return normalizeCaptionPage(res.data);
}

export async function setCaptionPublished(mediaId: string, language: string, published: boolean): Promise<void> {
  await api.patch(`/v1/subtitles/${mediaId}/${encodeURIComponent(language)}`, { published });
}

/** `POST /v1/subtitles/:mediaId` through posttubeApi (SRT → VTT, data URL body). */
export async function uploadCaption(mediaId: string, language: string, file: File): Promise<MediaSubtitleTrack> {
  return createSubtitleTrack(mediaId, { language, file, source: "manual_upload" });
}

/** `POST /v1/subtitles/:mediaId/auto {language}` — "" lets the backend detect. */
export async function requestAutoCaption(mediaId: string, language: string): Promise<void> {
  await api.post(`/v1/subtitles/${mediaId}/auto`, { language });
}

export async function listCaptionTracks(mediaId: string): Promise<HubCaptionLanguage[]> {
  const tracks = await getSubtitleTracks(mediaId);
  return tracks.map((t) => {
    const extra = t as MediaSubtitleTrack & { published?: boolean; updated_at?: string };
    return {
      language: t.language,
      source: t.source,
      published: typeof extra.published === "boolean" ? extra.published : t.source !== "auto",
      updated_at: extra.updated_at || t.created_at,
    };
  });
}

/* ── Insights ───────────────────────────────────────────── */

export type InsightsPeriod = "7d" | "28d" | "90d" | "365d";
export const INSIGHTS_PERIODS: readonly InsightsPeriod[] = ["7d", "28d", "90d", "365d"];

export interface HubDayPoint {
  day: string;
  views: number;
}

/**
  `GET /v1/analytics/creator/me` answers a BARE object (no `{data}` envelope,
  analytics-service 73da6b13); `getCreatorInsights` reads `data.data ?? data`
  so either shape works. `followers_delta` is null on the wire today.
*/
export interface HubCreatorInsights {
  period: InsightsPeriod;
  views: number;
  watch_time_ms: number;
  unique_viewers: number;
  /** null = not tracked yet (the wire sends null). */
  followers_delta: number | null;
  top_content: { content_id: string; views: number; watch_time_ms: number }[];
  realtime: { views_48h: number; series_48h: number[] };
  /** Optional on the wire; the overview chart falls back to the 48 h series when absent. */
  views_by_day: HubDayPoint[];
}

function numArray(v: unknown, length?: number): number[] {
  const arr = Array.isArray(v) ? v.map((x) => num(x)) : [];
  if (typeof length === "number" && arr.length < length) return [...new Array(length - arr.length).fill(0), ...arr];
  return arr;
}

function dayPoints(v: unknown): HubDayPoint[] {
  return (Array.isArray(v) ? v : [])
    .filter(isRecord)
    .map((p) => ({ day: str(p.day) || str(p.date), views: num(p.views) }))
    .filter((p) => p.day);
}

export function normalizeCreatorInsights(raw: unknown, period: InsightsPeriod): HubCreatorInsights {
  const d = isRecord(raw) ? raw : {};
  const rt = isRecord(d.realtime) ? d.realtime : {};
  const top = (Array.isArray(d.top_content) ? d.top_content : [])
    .filter(isRecord)
    .map((t) => ({ content_id: str(t.content_id) || str(t.post_id) || str(t.id), views: num(t.views), watch_time_ms: num(t.watch_time_ms) }))
    .filter((t) => t.content_id);
  const p = str(d.period) as InsightsPeriod;
  return {
    period: INSIGHTS_PERIODS.includes(p) ? p : period,
    views: num(d.views),
    watch_time_ms: num(d.watch_time_ms),
    unique_viewers: num(d.unique_viewers),
    followers_delta: typeof d.followers_delta === "number" ? d.followers_delta : typeof d.subscribers_delta === "number" ? d.subscribers_delta : null,
    top_content: top,
    realtime: { views_48h: num(rt.views_48h), series_48h: numArray(rt.series_48h, 48).slice(-48) },
    views_by_day: dayPoints(d.views_by_day),
  };
}

export async function getCreatorInsights(period: InsightsPeriod): Promise<HubCreatorInsights> {
  const res = await api.get<ApiResponse<unknown>>("/v1/analytics/creator/me", { params: { period } });
  return normalizeCreatorInsights(res.data.data ?? res.data, period);
}

export interface HubContentInsights {
  views_by_day: HubDayPoint[];
  average_view_duration_ms: number;
  average_percent_viewed: number;
  /** 100 points, 0..100 (or 0..1 on older writers, scaled up). */
  retention: number[];
  traffic: { surface: string; views: number }[];
  views: number;
}

export function normalizeContentInsights(raw: unknown): HubContentInsights {
  const d = isRecord(raw) ? raw : {};
  const days = dayPoints(d.views_by_day);
  let retention = numArray(d.retention);
  if (retention.length > 0 && retention.every((v) => v <= 1)) retention = retention.map((v) => v * 100);
  const traffic = (Array.isArray(d.traffic) ? d.traffic : [])
    .filter(isRecord)
    .map((t) => ({ surface: str(t.surface) || "other", views: num(t.views) }))
    .sort((a, b) => b.views - a.views);
  return {
    views_by_day: days,
    average_view_duration_ms: num(d.average_view_duration_ms),
    average_percent_viewed: num(d.average_percent_viewed),
    retention,
    traffic,
    views: num(d.views) || days.reduce((s, p) => s + p.views, 0),
  };
}

export async function getContentInsights(contentId: string, period: InsightsPeriod): Promise<HubContentInsights> {
  const res = await api.get<ApiResponse<unknown>>(`/v1/analytics/content/${contentId}`, { params: { period } });
  return normalizeContentInsights(res.data.data ?? res.data);
}

/* ── Links ──────────────────────────────────────────────── */

/** `GET /v1/media/:id/download` — a 307 to a signed attachment URL; only when `allow_download`. */
export function downloadHref(mediaId: string): string {
  return mediaHref(`/v1/media/${mediaId}/download`);
}

export function coverHref(coverMediaId: string): string {
  return mediaHref(`/v1/media/${coverMediaId}/serve`);
}

export function watchHref(row: Pick<HubLibraryRow, "id" | "content_type">): string {
  return isShortType(row.content_type) ? `/reels?reelId=${row.id}` : `/posttube/watch/${row.id}`;
}

export function isShortType(contentType: string | null | undefined): boolean {
  const t = (contentType ?? "").toLowerCase();
  return t === "reel" || t === "flick" || t === "short";
}
