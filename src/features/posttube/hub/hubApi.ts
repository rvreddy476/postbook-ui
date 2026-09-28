import api from "@/lib/api";
import { mediaHref } from "@/features/reels/model";
import { extractCoverFrame } from "@/features/reels/data/reelsApi";
import { uploadMedia } from "@/lib/mediaUpload";
import { addPlaylistItem, createSubtitleTrack, getPlaylistItems, getSubtitleTracks, setCoverFrame, updateSchedule } from "@/features/posttube/data/posttubeApi";
import type { MediaSubtitleTrack } from "@/features/posttube/types";
import { fetchCreatorCollections } from "@/features/posttube/library/libraryApi";
import { readEndScreenPosition } from "@/features/posttube/watch/watchApi";
import type { EndScreenKind, EndScreenPosition } from "@/features/posttube/endScreenGeometry";
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
    POST   /v1/uploads/bulk                      { post_ids, patch: HubBulkPatch } (contract C: tags + tags_mode)
    POST   /v1/uploads/bulk-delete               { post_ids } (contract D)
    DELETE /v1/uploads/:postId
    GET|PUT /v1/posts/:id/private-shares         { user_ids } (contract F, owner only)
    GET    /v1/playlists/:id/items + POST /v1/playlists/:id/items  (bulk Add to collection, one POST per video)
    GET    /v1/posts/me/summary
    GET    /v1/posts/me/scheduled
    PATCH  /v1/posts/:id/schedule                { publish_at } (posttubeApi.updateSchedule)
    GET    /v1/posts/:id
    PATCH  /v1/posts/:id                         (owner edit, see HubPostPatch)
    GET|POST /v1/posts/:id/chapters              { chapters: [...] }
    GET|POST /v1/posts/:id/end-screens           { screens: [...] } (29 Sep contract: {x,y,w} positions, video_mode, stats)
    GET|POST /v1/posts/:id/cards                 { cards: [...] } (+ stats)
    GET    /v1/creators/:creatorId/playlists     (library adapter; the end-screen collection picker, public only)
    GET    /v1/search/channels?q&limit           (the end-screen channel picker; owner_id is the target)
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

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  const s = str(v).toLowerCase() as T;
  return allowed.includes(s) ? s : fallback;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x !== "") : [];
}

function nextCursor(meta: ApiResponse<unknown>["meta"] | undefined): string | undefined {
  return meta?.next_cursor || undefined;
}

/* ── Setting values (the create route's validators) ─────── */

export type HubLicense = "standard" | "creative_commons";
export const HUB_LICENSES: readonly HubLicense[] = ["standard", "creative_commons"];
export type HubRemixSetting = "allow" | "allow_audio_only" | "disallow";
export const HUB_REMIX_SETTINGS: readonly HubRemixSetting[] = ["allow", "allow_audio_only", "disallow"];
export type HubCommentModeration = "none" | "basic" | "strict" | "hold_all";
export const HUB_COMMENT_MODERATIONS: readonly HubCommentModeration[] = ["none", "basic", "strict", "hold_all"];
export type HubCommentAccess = "everyone" | "followers" | "nobody";
export const HUB_COMMENT_ACCESSES: readonly HubCommentAccess[] = ["everyone", "followers", "nobody"];
export type HubCommentSort = "top" | "newest";
export const HUB_COMMENT_SORTS: readonly HubCommentSort[] = ["top", "newest"];

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
  /** Contract E: the first 200 runes of the description ("" when none); falls back to `text`. */
  description: string;
  made_for_kids: boolean;
  age_restricted: boolean;
  hide_like_count: boolean;
  default_comment_sort: HubCommentSort;
  related_post_id: string | null;
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
    description: str(raw.description) || str(raw.text),
    made_for_kids: bool(raw.made_for_kids ?? raw.is_made_for_kids),
    age_restricted: bool(raw.age_restricted),
    hide_like_count: bool(raw.hide_like_count),
    default_comment_sort: pick(raw.default_comment_sort, HUB_COMMENT_SORTS, "top"),
    related_post_id: strOrNull(raw.related_post_id),
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

/** A row's `error`: a code string, or `{code, message}` (the service envelope) → the code first. */
function errorText(v: unknown): string | undefined {
  if (typeof v === "string") return v || undefined;
  if (isRecord(v)) return str(v.code) || str(v.message) || undefined;
  return undefined;
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
        error: errorText(r.error),
      }))
      .filter((r) => r.post_id);
    if (out.length > 0) return out;
  }
  if (isRecord(data) && !Array.isArray(data)) {
    const entries = Object.entries(data).filter(([k]) => requested.includes(k));
    if (entries.length > 0) {
      return entries.map(([post_id, v]) => {
        if (isRecord(v)) return { post_id, ok: typeof v.ok === "boolean" ? v.ok : !v.error, error: errorText(v.error) };
        const s = str(v).toLowerCase();
        return { post_id, ok: v === true || s === "ok" || s === "updated" || s === "success" };
      });
    }
  }
  // No per-id detail: a 2xx means every id went through.
  return requested.map((post_id) => ({ post_id, ok: true }));
}

/**
  Contract C: the bulk-editable subset. Title and description are not in
  it. `tags` goes with `tags_mode` ("add" is the server default; the hub
  always sends the mode it means).
*/
export interface HubBulkPatch {
  visibility?: Exclude<HubVisibility, "scheduled">;
  category?: string;
  language?: string;
  made_for_kids?: boolean;
  age_restricted?: boolean;
  no_comments?: boolean;
  comment_moderation?: HubCommentModeration;
  comment_access?: HubCommentAccess;
  default_comment_sort?: HubCommentSort;
  allow_embedding?: boolean;
  license?: HubLicense;
  remix_setting?: HubRemixSetting;
  recording_date?: string;
  hide_like_count?: boolean;
  altered_content?: boolean;
  paid_promotion?: boolean;
  tags?: string[];
  tags_mode?: HubTagsMode;
}

export type HubTagsMode = "add" | "replace" | "remove";

/** `{post_ids, patch}` — ids deduped in order, undefined keys dropped, `tags_mode` only with `tags`. */
export function bulkEditBody(postIds: string[], patch: HubBulkPatch): { post_ids: string[]; patch: Record<string, unknown> } {
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) body[k] = v;
  if (body.tags === undefined) delete body.tags_mode;
  else if (body.tags_mode === undefined) body.tags_mode = "add";
  return { post_ids: dedupeIds(postIds), patch: body };
}

export function bulkDeleteBody(postIds: string[]): { post_ids: string[] } {
  return { post_ids: dedupeIds(postIds) };
}

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids.filter((id) => typeof id === "string" && id !== ""))];
}

export async function bulkEdit(postIds: string[], patch: HubBulkPatch): Promise<HubBulkOutcome[]> {
  const body = bulkEditBody(postIds, patch);
  const res = await api.post<ApiResponse<unknown>>("/v1/uploads/bulk", body);
  return normalizeBulkOutcomes(res.data?.data ?? res.data, body.post_ids);
}

export async function bulkSetVisibility(postIds: string[], visibility: HubVisibility): Promise<HubBulkOutcome[]> {
  return bulkEdit(postIds, { visibility: visibility === "scheduled" ? undefined : visibility });
}

/** Contract D: each id through the owner delete path; one bad id never stops the rest. */
export async function bulkDelete(postIds: string[]): Promise<HubBulkOutcome[]> {
  const body = bulkDeleteBody(postIds);
  const res = await api.post<ApiResponse<unknown>>("/v1/uploads/bulk-delete", body);
  return normalizeBulkOutcomes(res.data?.data ?? res.data, body.post_ids);
}

/* ── Bulk: add to one collection (the existing per-item route) ── */

/**
  Loops `POST /v1/playlists/:id/items` one video at a time, appending after
  what is already there; a video already in it counts as done. Each
  video's outcome is its own — one failure never stops the rest.
*/
export async function addVideosToCollection(collectionId: string, postIds: string[]): Promise<HubBulkOutcome[]> {
  const ids = dedupeIds(postIds);
  const existing: { post_id?: string }[] = await getPlaylistItems(collectionId).catch(() => []);
  const present = new Set(existing.map((i) => i.post_id).filter((x): x is string => !!x));
  let position = existing.length;
  const out: HubBulkOutcome[] = [];
  for (const id of ids) {
    if (present.has(id)) {
      out.push({ post_id: id, ok: true });
      continue;
    }
    try {
      await addPlaylistItem(collectionId, id, position);
      position += 1;
      out.push({ post_id: id, ok: true });
    } catch (err) {
      out.push({ post_id: id, ok: false, error: hubErrorCode(err) ?? "FAILED" });
    }
  }
  return out;
}

/* ── Errors ─────────────────────────────────────────────── */

/** The service envelope `{"error":{"code","message"}}` (or a bare `{code}` / `{error:"CODE"}`) → the code. */
export function hubErrorCode(err: unknown): string | null {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (!isRecord(data)) return null;
  if (isRecord(data.error)) return str(data.error.code) || null;
  if (typeof data.error === "string" && /^[A-Z0-9_]+$/.test(data.error)) return data.error;
  return str(data.code) || null;
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
  /** "draft" / "scheduled" / "published"…; "" when the detail does not say. */
  status: string;
  /** The creator (whose public collections the end-screen picker lists); "" when absent. */
  author_id: string;
  /** The video asset's processing state ("ready", "processing", …); "" when the detail does not say. */
  processing_status: string;
  published_at: string | null;
  /* Contract A/B — every viewer */
  age_restricted: boolean;
  hide_like_count: boolean;
  default_comment_sort: HubCommentSort;
  related_post_id: string | null;
  related_post: HubRelatedPost | null;
  /* Contract A/B — owner only; the defaults are the create route's */
  paid_promotion: boolean;
  altered_content: boolean;
  license: HubLicense;
  allow_embedding: boolean;
  /** "YYYY-MM-DD" or "". */
  recording_date: string;
  recording_location: string;
  remix_setting: HubRemixSetting;
  comment_moderation: HubCommentModeration;
  comment_access: HubCommentAccess;
  notify_subscribers: boolean;
}

/** `related_post` on the detail: `{id, title, thumbnail_url, duration_seconds, channel_name}` or null. */
export interface HubRelatedPost {
  id: string;
  title: string;
  thumbnail_url: string;
  duration_seconds: number;
  channel_name: string;
}

export function normalizeRelatedPost(raw: unknown): HubRelatedPost | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const thumb = str(raw.thumbnail_url);
  return {
    id,
    title: str(raw.title).trim() || "Untitled",
    thumbnail_url: thumb ? (thumb.startsWith("/v1/") ? mediaHref(thumb) : thumb) : "",
    duration_seconds: Math.max(0, num(raw.duration_seconds)),
    channel_name: str(raw.channel_name),
  };
}

/** `recording_date` is a DATE column Go may marshal as a full timestamp; the sheet keeps the day. */
export function normalizeRecordingDate(raw: unknown): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(str(raw));
  return m ? m[1] : "";
}

function videoProcessingStatus(raw: Record<string, unknown>): string {
  const media = Array.isArray(raw.media) ? raw.media.filter(isRecord) : [];
  return str(media.find((m) => m.kind === "video")?.processing_status);
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
    made_for_kids: bool(raw.is_made_for_kids ?? raw.made_for_kids),
    status: str(raw.status).toLowerCase(),
    author_id: str(raw.author_id) || (isRecord(raw.author) ? str(raw.author.id) : ""),
    processing_status: (row.processing_status || videoProcessingStatus(raw)).toLowerCase(),
    published_at: row.published_at,
    age_restricted: row.age_restricted,
    hide_like_count: row.hide_like_count,
    default_comment_sort: row.default_comment_sort,
    related_post_id: row.related_post_id ?? (isRecord(raw.related_post) ? strOrNull(raw.related_post.id) : null),
    related_post: normalizeRelatedPost(raw.related_post),
    paid_promotion: bool(raw.paid_promotion),
    altered_content: bool(raw.altered_content),
    license: pick(raw.license, HUB_LICENSES, "standard"),
    allow_embedding: bool(raw.allow_embedding, true),
    recording_date: normalizeRecordingDate(raw.recording_date),
    recording_location: str(raw.recording_location),
    remix_setting: pick(raw.remix_setting, HUB_REMIX_SETTINGS, "allow"),
    comment_moderation: pick(raw.comment_moderation, HUB_COMMENT_MODERATIONS, "none"),
    comment_access: pick(raw.comment_access, HUB_COMMENT_ACCESSES, "everyone"),
    notify_subscribers: bool(raw.notify_subscribers, true),
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
  /* contract A */
  paid_promotion?: boolean;
  altered_content?: boolean;
  license?: HubLicense;
  allow_embedding?: boolean;
  /** "YYYY-MM-DD", or "" to clear. */
  recording_date?: string;
  /** ≤ 100 runes; "" clears. */
  recording_location?: string;
  remix_setting?: HubRemixSetting;
  comment_moderation?: HubCommentModeration;
  comment_access?: HubCommentAccess;
  notify_subscribers?: boolean;
  age_restricted?: boolean;
  hide_like_count?: boolean;
  default_comment_sort?: HubCommentSort;
  /** A uuid of the caller's own post, or "" to clear. */
  related_post_id?: string;
}

/** The PATCH body: only the keys present (undefined dropped; "" kept — it clears). */
export function postPatchBody(patch: HubPostPatch): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) body[k] = v;
  return body;
}

export async function updatePost(postId: string, patch: HubPostPatch): Promise<HubPostDetail | null> {
  const body = postPatchBody(patch);
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

/*
  End screens (contract of 29 Sep, "end screens and cards that viewers see"):
    POST /v1/posts/:postId/end-screens  { screens: [...] }  replace all; [] clears
    element: { type, video_mode (video only), target_id, target_url, title,
               position: {x, y, w} (frame fractions), start_ms, end_ms }
    GET (owner) adds id, the resolved video|playlist|channel|link objects and
    stats {impressions, clicks, click_rate} over the last 28 days.
    422: END_SCREEN_TOO_MANY → _NOT_ELIGIBLE → _KIDS → _TIMING → _POSITION →
         _OVERLAP → _TARGET (hubModel.readableHubError has the sentences).
  Old rows whose position is {slot:n} read as that corner (watchApi.readEndScreenPosition)
  and are written back as {x, y, w} on the next save.
*/
export type HubEndScreenType = EndScreenKind;
export const HUB_END_SCREEN_TYPES: readonly HubEndScreenType[] = ["video", "playlist", "channel_subscribe", "channel", "external_link"];
export const HUB_END_SCREEN_MAX = 4;
export type HubVideoMode = "specific" | "latest" | "popular";
export const HUB_VIDEO_MODES: readonly HubVideoMode[] = ["specific", "latest", "popular"];

/** Owner stats: the click rate is clicks / impressions (0..1). */
export interface HubElementStats {
  impressions: number;
  clicks: number;
  click_rate: number;
}

export function normalizeElementStats(raw: unknown): HubElementStats | null {
  if (!isRecord(raw)) return null;
  const impressions = Math.max(0, num(raw.impressions));
  const clicks = Math.max(0, num(raw.clicks));
  let rate = impressions > 0 ? clicks / impressions : num(raw.click_rate);
  // With no impressions to divide by, a server percentage (12.5) reads as a fraction.
  if (impressions === 0 && rate > 1) rate = rate / 100;
  return { impressions, clicks, click_rate: Math.max(0, Math.min(1, rate)) };
}

export interface HubEndScreen {
  id?: string;
  type: HubEndScreenType;
  /** Only meaningful for type=video; "specific" otherwise. */
  video_mode: HubVideoMode;
  target_id: string | null;
  target_url: string | null;
  title: string | null;
  position: EndScreenPosition;
  start_ms: number;
  end_ms: number;
  /** The owner GET's 28-day stats; null on a new element. */
  stats: HubElementStats | null;
  /** What the owner GET resolved the target to (a name for a target outside the loaded pickers). */
  target_label: string | null;
}

/** The resolved object on an owner row → a label for the picker. */
function resolvedLabel(s: Record<string, unknown>): string | null {
  const v = isRecord(s.video) ? s.video : isRecord(s.playlist) ? s.playlist : isRecord(s.collection) ? s.collection : null;
  if (v) return strOrNull(str(v.title).trim());
  if (isRecord(s.channel)) {
    const handle = str(s.channel.handle).replace(/^@/, "");
    return strOrNull(str(s.channel.name).trim()) ?? (handle ? `@${handle}` : null);
  }
  if (isRecord(s.link)) return strOrNull(str(s.link.title).trim()) ?? strOrNull(str(s.link.domain));
  return null;
}

export function normalizeEndScreens(raw: unknown): HubEndScreen[] {
  const list = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.screens) ? raw.screens : [];
  return list.filter(isRecord).map((s, i) => {
    const type = pick(s.type, HUB_END_SCREEN_TYPES, "video");
    const mode = type === "video" ? pick(s.video_mode, HUB_VIDEO_MODES, "specific") : "specific";
    return {
      id: strOrNull(s.id) ?? undefined,
      type,
      video_mode: mode,
      target_id: mode === "specific" ? strOrNull(s.target_id) : null,
      target_url: strOrNull(s.target_url) ?? (isRecord(s.link) ? strOrNull(s.link.url) : null),
      title: strOrNull(s.title),
      position: readEndScreenPosition(s.position, type, i),
      start_ms: Math.max(0, num(s.start_ms)),
      end_ms: Math.max(0, num(s.end_ms)),
      stats: normalizeElementStats(s.stats),
      target_label: resolvedLabel(s),
    };
  });
}

export async function getEndScreens(postId: string): Promise<HubEndScreen[]> {
  const res = await api.get<ApiResponse<unknown>>(`/v1/posts/${postId}/end-screens`);
  return normalizeEndScreens(res.data.data);
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/** A saved element's server id; echoing it keeps its click stats across edits (anything else is a new element). */
const SAVED_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The save body, exactly: targets only where the type takes one, video_mode only on videos, positions as {x, y, w}. */
export function endScreensBody(screens: HubEndScreen[]): { screens: Record<string, unknown>[] } {
  return {
    screens: screens.slice(0, HUB_END_SCREEN_MAX).map((s) => {
      const start = Math.max(0, Math.round(s.start_ms));
      const out: Record<string, unknown> = {
        type: s.type,
        position: { x: round4(s.position.x), y: round4(s.position.y), w: round4(s.position.w) },
        start_ms: start,
        end_ms: Math.max(start + 1, Math.round(s.end_ms)),
      };
      if (s.id && SAVED_ID.test(s.id)) out.id = s.id;
      if (s.type === "video") {
        out.video_mode = s.video_mode;
        if (s.video_mode === "specific" && s.target_id) out.target_id = s.target_id;
      } else if ((s.type === "playlist" || s.type === "channel") && s.target_id) {
        out.target_id = s.target_id;
      } else if (s.type === "external_link") {
        const url = s.target_url?.trim();
        if (url) out.target_url = url;
        const title = s.title?.trim();
        if (title) out.title = title;
      }
      return out;
    }),
  };
}

export async function saveEndScreens(postId: string, screens: HubEndScreen[]): Promise<number> {
  const body = endScreensBody(screens);
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
  29 Sep: ≤ 5 (CARD_TOO_MANY), appear_at_ms within the video (CARD_TIMING),
  the end-screen target rules (CARD_TARGET), none on made-for-kids (CARD_KIDS).
  The owner GET adds stats like end screens.
*/
export type HubCardType = "video" | "playlist" | "poll" | "external_link";
export const HUB_CARD_TYPES: readonly HubCardType[] = ["video", "playlist", "poll", "external_link"];
export const HUB_CARD_MAX = 5;

export interface HubCard {
  id?: string;
  type: HubCardType;
  target_id: string | null;
  target_url: string | null;
  title: string;
  teaser_text: string | null;
  appear_at_ms: number;
  stats?: HubElementStats | null;
  target_label?: string | null;
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
        target_url: strOrNull(c.target_url) ?? (isRecord(c.link) ? strOrNull(c.link.url) : null),
        title: str(c.title),
        teaser_text: strOrNull(c.teaser_text),
        appear_at_ms: Math.max(0, num(c.appear_at_ms)),
        stats: normalizeElementStats(c.stats),
        target_label: resolvedLabel(c),
      };
    })
    .sort((a, b) => a.appear_at_ms - b.appear_at_ms);
}

export async function getCards(postId: string): Promise<HubCard[]> {
  const res = await api.get<ApiResponse<unknown>>(`/v1/posts/${postId}/cards`);
  return normalizeCards(res.data.data);
}

export function cardsBody(cards: HubCard[]): { cards: Record<string, unknown>[] } {
  return {
    cards: cards
      .filter((c) => c.title.trim() !== "")
      .slice(0, HUB_CARD_MAX)
      .map((c) => ({
        ...(c.id && SAVED_ID.test(c.id) ? { id: c.id } : {}),
        type: c.type,
        target_id: c.type === "external_link" ? undefined : c.target_id ?? undefined,
        target_url: c.type === "external_link" ? c.target_url?.trim() || undefined : undefined,
        title: c.title.trim(),
        teaser_text: c.teaser_text?.trim() || undefined,
        appear_at_ms: Math.max(0, Math.round(c.appear_at_ms)),
      })),
  };
}

export async function saveCards(postId: string, cards: HubCard[]): Promise<number> {
  const body = cardsBody(cards);
  const res = await api.post<ApiResponse<{ saved?: number }>>(`/v1/posts/${postId}/cards`, body);
  return num(res.data?.data?.saved, body.cards.length);
}

/* ── Target pickers: your public collections, a channel search ── */

export interface HubCollectionOption {
  id: string;
  title: string;
  item_count: number;
}

/** GET /v1/creators/:creatorId/playlists (the library adapter), public user collections only. */
export async function listMyPublicCollections(creatorId: string): Promise<HubCollectionOption[]> {
  const rows = await fetchCreatorCollections(creatorId, { limit: 100 });
  return rows
    .filter((c) => c.kind === "user" && c.visibility === "public")
    .map((c) => ({ id: c.id, title: c.title || "Untitled collection", item_count: c.itemCount }));
}

export interface HubChannelOption {
  /** The channel owner's user id: what an end-screen channel element targets. */
  user_id: string;
  name: string;
  handle: string;
  avatar_url: string;
}

/** A `/v1/search/channels` row → a picker option; rows without an owner id are dropped (the target is the owner). */
export function normalizeChannelOption(raw: unknown): HubChannelOption | null {
  if (!isRecord(raw)) return null;
  const userId = str(raw.owner_id) || str(raw.user_id);
  if (!userId) return null;
  const handle = str(raw.handle).replace(/^@/, "");
  const avatarId = str(raw.avatar_media_id);
  const avatar = str(raw.avatar_url);
  return {
    user_id: userId,
    name: str(raw.name).trim() || (handle ? `@${handle}` : "Channel"),
    handle,
    avatar_url: avatar ? (avatar.startsWith("/v1/") ? mediaHref(avatar) : avatar) : avatarId ? mediaHref(`/v1/media/${avatarId}/serve`) : "",
  };
}

/** GET /v1/search/channels?q&limit (the discovery route). */
export async function searchChannelTargets(q: string, limit = 8): Promise<HubChannelOption[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const res = await api.get<ApiResponse<unknown>>("/v1/search/channels", { params: { q: query, limit: String(limit) } });
  const rows = Array.isArray(res.data?.data) ? res.data.data : [];
  return rows.map(normalizeChannelOption).filter((c): c is HubChannelOption => c !== null);
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

/* ── Private sharing (contract F) ───────────────────────── */

export const PRIVATE_SHARES_MAX = 50;

export interface HubPrivateShare {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  added_at: string;
}

/** `{users:[{user_id, username, display_name, avatar_url, added_at}]}`; a bare array still reads. */
export function normalizePrivateShares(raw: unknown): HubPrivateShare[] {
  const list: unknown[] = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.users) ? raw.users : [];
  const seen = new Set<string>();
  const out: HubPrivateShare[] = [];
  for (const entry of list) {
    if (!isRecord(entry)) continue;
    const id = str(entry.user_id) || str(entry.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const username = str(entry.username);
    out.push({
      user_id: id,
      username,
      display_name: str(entry.display_name).trim() || str(entry.name).trim() || username || "Someone",
      avatar_url: str(entry.avatar_url) || str(entry.avatar),
      added_at: str(entry.added_at),
    });
  }
  return out;
}

/** `{user_ids}`: deduped, never the owner, at most 50 (the server's cap; 422 TOO_MANY_SHARES past it). */
export function privateSharesBody(userIds: string[], ownerId?: string | null): { user_ids: string[] } {
  return { user_ids: dedupeIds(userIds).filter((id) => id !== ownerId).slice(0, PRIVATE_SHARES_MAX) };
}

export async function getPrivateShares(postId: string): Promise<HubPrivateShare[]> {
  const res = await api.get<ApiResponse<unknown>>(`/v1/posts/${postId}/private-shares`);
  return normalizePrivateShares(res.data?.data ?? res.data);
}

export async function setPrivateShares(postId: string, userIds: string[], ownerId?: string | null): Promise<HubPrivateShare[]> {
  const res = await api.put<ApiResponse<unknown>>(`/v1/posts/${postId}/private-shares`, privateSharesBody(userIds, ownerId));
  return normalizePrivateShares(res.data?.data ?? res.data);
}

/* ── Links ──────────────────────────────────────────────── */

/** `GET /v1/media/:id/download` — a 307 to a signed attachment URL; only when `allow_download`. */
export function downloadHref(mediaId: string): string {
  return mediaHref(`/v1/media/${mediaId}/download`);
}

export function coverHref(coverMediaId: string): string {
  return mediaHref(`/v1/media/${coverMediaId}/serve`);
}

/** The absolute link Copy link writes: `<origin>/posttube/watch/<id>` (a short keeps its reels link). */
export function absoluteWatchUrl(row: Pick<HubLibraryRow, "id" | "content_type">, origin: string): string {
  return `${origin.replace(/\/+$/, "")}${watchHref(row)}`;
}

export function watchHref(row: Pick<HubLibraryRow, "id" | "content_type">): string {
  return isShortType(row.content_type) ? `/reels?reelId=${row.id}` : `/posttube/watch/${row.id}`;
}

export function isShortType(contentType: string | null | undefined): boolean {
  const t = (contentType ?? "").toLowerCase();
  return t === "reel" || t === "flick" || t === "short";
}
