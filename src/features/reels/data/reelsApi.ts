import api from "@/lib/api";
import {
  RESUMABLE_UPLOAD_THRESHOLD,
  durationMsField,
  isUseResumableUpload,
  uploadResumable,
  type RestartReason,
  type ResumeStore,
} from "@/lib/resumableUpload";

import type { PostDetail } from "@/types/profile";
import type {
  Reel,
  ReelDraft,
  ProcessingStatusResult,
  ReelVisibility,
  LicenseType,
  CommentModeration,
  RemixSetting,
  CommentAccess,
} from "@/features/reels/types";

/* ── Mapping helpers ─────────────────────────────────────── */

function mediaUrl(mediaId: string): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  return `${base}/v1/media/${mediaId}/serve`;
}

function avatarUrl(_authorId: string): string {
  // Return empty — the Avatar component will render a LetterAvatar fallback.
  // The real avatar URL is resolved later via profile lookup in ReelsPage.
  return "";
}

export function postDetailToReel(post: PostDetail): Reel {
  const videoMedia = post.media?.find((m) => m.kind === "video");
  const thumbnailMedia = post.media?.find((m) => m.kind === "image");

  // Cover image priority: explicit cover_media_id > image in media array > empty
  const thumbnailId = post.cover_media_id || thumbnailMedia?.media_id;

  return {
    reel_id: post.id,
    author_id: post.author_id,
    author_name: post.author_id,
    author_avatar_url: avatarUrl(post.author_id),
    video_url: videoMedia ? mediaUrl(videoMedia.media_id) : "",
    thumbnail_url: thumbnailId ? mediaUrl(thumbnailId) : "",
    caption: post.text || "",
    hashtags: post.hashtags ?? [],
    like_count: post.counts?.likes ?? 0,
    comment_count: post.counts?.comments ?? 0,
    share_count: post.counts?.shares ?? 0,
    view_count: post.view_count ?? 0,
    viewer_has_boosted: !!post.viewer_reaction,
    viewer_has_saved: !!post.is_bookmarked,
    ...(typeof post.age_restricted === "boolean" ? { age_restricted: post.age_restricted } : {}),
  };
}

/* ── API response types (backend envelope) ───────────────── */

interface ApiResponse<T> {
  data: T;
  meta?: { next_cursor?: string };
}

/* ═══════════════════════════════════════════════════════════
   REELS FEED
   ═══════════════════════════════════════════════════════════ */

/* ── Single reel ─────────────────────────────────────────── */

/* ═══════════════════════════════════════════════════════════
   COMMENTS
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   ENGAGEMENT ACTIONS
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   VIEW TRACKING
   ═══════════════════════════════════════════════════════════ */

// One analytics session per browser tab. The backend dedups a "view"
// per (session_id, content_id), so a stable id means re-watching the
// same reel in one session counts once — and a loop feed that recycles
// the same reels never inflates the count.
let analyticsSessionId: string | null = null;
function analyticsSession(): string {
  if (analyticsSessionId) return analyticsSessionId;
  try {
    const stored = sessionStorage.getItem("vchat_av_session");
    if (stored) {
      analyticsSessionId = stored;
      return stored;
    }
    const fresh = crypto.randomUUID();
    sessionStorage.setItem("vchat_av_session", fresh);
    analyticsSessionId = fresh;
    return fresh;
  } catch {
    // sessionStorage unavailable (SSR / privacy mode) — fall back to
    // a process-lifetime id.
    analyticsSessionId = crypto.randomUUID();
    return analyticsSessionId;
  }
}

/* ═══════════════════════════════════════════════════════════
   MEDIA UPLOAD (3-step: init -> presigned PUT -> confirm)
   ═══════════════════════════════════════════════════════════ */

export interface InitUploadResult {
  media_id: string;
  upload_url: string;
  object_key: string;
}

/**
 * What the studio passes with a video upload.
 * - durationMs: the length the browser read; sent at init as duration_ms so
 *   an over-long file is refused (413 VIDEO_TOO_LONG) before any bytes move.
 *   Unknown (null) is left out.
 * - resume / draftId / onRestart: the resumable path's kept session
 *   (lib/resumableUpload.ts), so a reload does not start from 0 %.
 */
export interface StudioUploadOptions {
  durationMs?: number | null;
  resume?: ResumeStore | null;
  draftId?: string | null;
  onRestart?: (reason: RestartReason) => void;
}

export async function initMediaUpload(file: File, durationMs?: number | null): Promise<InitUploadResult> {
  const fileType = file.type.startsWith("video/") ? "video" : "image";
  const body: Record<string, unknown> = {
    file_type: fileType,
    media_subtype: "reel",
    mime_type: file.type,
    file_size_bytes: file.size,
  };
  const duration = fileType === "video" ? durationMsField(durationMs) : undefined;
  if (duration !== undefined) body.duration_ms = duration;
  const res = await api.post<ApiResponse<InitUploadResult>>("/v1/media/init", body);
  return res.data.data;
}

export async function uploadToPresignedUrl(
  uploadUrl: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<void> {
  if (onProgress) {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("Upload network error"));
      xhr.send(file);
    });
    return;
  }

  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
}

export async function confirmUpload(mediaId: string): Promise<void> {
  await api.post("/v1/media/confirm", { media_id: mediaId });
}

/**
 * The single-shot path (init → presigned PUT → confirm). A video the server
 * would rather take in parts (413 USE_RESUMABLE_UPLOAD on init) goes up
 * resumably instead, so no size is ever refused here.
 */
export async function uploadMedia(
  file: File,
  onProgress?: (pct: number) => void,
  options: StudioUploadOptions = {},
): Promise<string> {
  let init: InitUploadResult;
  try {
    init = await initMediaUpload(file, options.durationMs);
  } catch (err) {
    if (file.type.startsWith("video/") && isUseResumableUpload(err)) return uploadMediaResumable(file, onProgress, options);
    throw err;
  }
  await uploadToPresignedUrl(init.upload_url, file, onProgress);
  await confirmUpload(init.media_id);
  return init.media_id;
}

/* ── Resumable (chunked) upload ───────────────────────────── */

// Files at or above RESUMABLE_UPLOAD_THRESHOLD use the resumable multipart
// path; smaller ones the single-shot presigned PUT (one round trip). The
// loop itself — server-sized parts, per-part retry with backoff, byte
// progress, no buffering — lives in lib/resumableUpload.ts.
export { RESUMABLE_UPLOAD_THRESHOLD };

/**
 * Uploads a file via the resumable multipart API: init → upload each
 * part (with per-part retry) → complete. Resilient to dropped
 * connections — only the failed part is re-sent, not the whole file.
 */
export function uploadMediaResumable(
  file: File,
  onProgress?: (pct: number) => void,
  options: StudioUploadOptions = {},
): Promise<string> {
  return uploadResumable(file, {
    onProgress,
    durationMs: options.durationMs,
    store: options.resume,
    draftId: options.draftId,
    onRestart: options.onRestart,
  });
}

/** Upload a data URL (e.g. canvas-extracted cover frame) as an image and return the media ID. */
export async function uploadCoverDataUrl(dataUrl: string): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], "cover.jpg", { type: "image/jpeg" });
  return uploadMedia(file);
}

/* ═══════════════════════════════════════════════════════════
   PROCESSING STATUS (poll after upload)
   ═══════════════════════════════════════════════════════════ */

export async function getProcessingStatus(mediaId: string): Promise<ProcessingStatusResult> {
  // The rendition-status endpoint is the one that returns `all_ready`; the plain
  // GET /v1/media/:id returns the asset record without it (which left uploads
  // stuck on "Video processing must finish" forever).
  const res = await api.get<ApiResponse<ProcessingStatusResult>>(`/v1/media/${mediaId}/renditions`);
  return res.data.data;
}

/* ═══════════════════════════════════════════════════════════
   AUDIO / MUSIC
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   TOPICS
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   DRAFT CRUD
   ═══════════════════════════════════════════════════════════ */

export async function createDraft(params: {
  media_id: string;
  caption?: string;
  hashtags?: string[];
  visibility?: ReelVisibility;
}): Promise<ReelDraft> {
  const res = await api.post<ApiResponse<ReelDraft>>("/v1/reels/drafts", params);
  return res.data.data;
}

export async function updateDraft(
  draftId: string,
  params: Partial<{
    title: string;
    caption: string;
    hashtags: string[];
    tags: string[];
    visibility: ReelVisibility;
    topic_id: number;
    category: string;
    language: string;
    seo_title: string;
    audio_track_id: string;
    audio_start_ms: number;
    original_audio_volume: number;
    overlay_audio_volume: number;
    cover_media_id: string;
    cross_post_postbook: boolean;
    cross_post_posttube: boolean;
    publish_to_feed: boolean;
    is_made_for_kids: boolean;
    paid_promotion: boolean;
    altered_content: boolean;
    ai_generated: boolean;
    location_name: string;
    location_place_id: string;
    auto_chapters: boolean;
    featured_places: boolean;
    auto_concepts: boolean;
    license: LicenseType;
    allow_embedding: boolean;
    remix_setting: RemixSetting;
    likes_enabled: boolean;
    comments_enabled: boolean;
    comment_moderation: CommentModeration;
    comment_access: CommentAccess;
    recording_date: string;
    recording_location: string;
    schedule_at: string;
    content_type: string;
    /* Video credits (long videos; the lists replace what the draft holds, [] clears; null clears the year and house). */
    credits: { name: string; role: string; user_id?: string }[];
    genres: string[];
    release_year: number | null;
    production_house: string | null;
    /* The Action button (contract 23 Oct 2026): {label, url}, or null to remove it. */
    action: { label: string; url: string } | null;
    /* Members only (post-service service/drafts.go:79, migration 071): a level id sets, null clears; the publish gates the post from birth. */
    tier_required_id: string | null;
    /* 18+ (lv-9): carried so the publish can gate from birth; a server that ignores it is caught after publish. */
    age_restricted: boolean;
  }>
): Promise<ReelDraft> {
  const res = await api.patch<ApiResponse<ReelDraft>>(`/v1/reels/drafts/${draftId}`, params);
  return res.data.data;
}

/* ═══════════════════════════════════════════════════════════
   PUBLISH
   ═══════════════════════════════════════════════════════════ */

export async function publishDraft(
  draftId: string,
  params?: { schedule_at?: string }
): Promise<Reel> {
  const res = await api.post<ApiResponse<PostDetail>>(
    `/v1/reels/drafts/${draftId}/publish`,
    params ?? {}
  );
  return postDetailToReel(res.data.data);
}

/** Shortcut: create post directly (simple reel publish without draft workflow) */
export interface CreateReelInput {
  text: string;
  mediaIds: string[];
  visibility?: ReelVisibility;
  hashtags?: string[];
  cover_media_id?: string;
  content_type?: string;
  publish_to_feed?: boolean;
  /** Stable across retries of one publish; see createReel. */
  idempotencyKey?: string;
  /** More CreatePostRequest fields (title, category, settings, publish_at…); the core fields above win. */
  fields?: Record<string, unknown>;
}

export async function createReel(input: CreateReelInput): Promise<Reel> {
  // The backend's CreatePostRequest has no `hashtags` field — post-service
  // only indexes hashtags it can extract from `text`. So append any chip-input
  // hashtags that aren't already inline before sending. Without this, the
  // chip UI in DetailsStep is silently discarded.
  const text = mergeHashtagsIntoText(input.text, input.hashtags ?? []);
  const body: Record<string, unknown> = {
    ...(input.fields ?? {}),
    text,
    visibility: input.visibility ?? "public",
    content_type: input.content_type ?? "long_video",
    media_ids: input.mediaIds,
    post_type: "video",
    app_origin: "postboek-web",
    publish_to_feed: input.publish_to_feed ?? true,
  };
  if (input.cover_media_id) {
    body.cover_media_id = input.cover_media_id;
  }
  // post-service refuses a create without a UUID Idempotency-Key. Taking it
  // from the caller keeps it stable across a retry of the same publish; a
  // fresh one per attempt would publish the reel twice.
  const res = await api.post<ApiResponse<PostDetail>>("/v1/posts", body, {
    headers: { "Idempotency-Key": input.idempotencyKey ?? crypto.randomUUID() },
  });
  return postDetailToReel(res.data.data);
}

function mergeHashtagsIntoText(text: string, chips: string[]): string {
  if (chips.length === 0) return text;
  const inline = new Set(
    (text.match(/#\w+/g) ?? []).map((t) => t.toLowerCase()),
  );
  const missing = chips.filter((tag) => {
    const normalized = tag.toLowerCase().startsWith("#")
      ? tag.toLowerCase()
      : `#${tag.toLowerCase()}`;
    return !inline.has(normalized);
  });
  if (missing.length === 0) return text;
  const tagLine = missing
    .map((t) => (t.startsWith("#") ? t : `#${t}`))
    .join(" ");
  const trimmed = text.trim();
  return trimmed.length === 0 ? tagLine : `${trimmed}\n\n${tagLine}`;
}
