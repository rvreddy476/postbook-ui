import api from "@/lib/api";

import type { PostDetail } from "@/types/profile";
import type {
  Reel,
  ReelDraft,
  CoverFrameResult,
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

export async function initMediaUpload(file: File): Promise<InitUploadResult> {
  const fileType = file.type.startsWith("video/") ? "video" : "image";
  const res = await api.post<ApiResponse<InitUploadResult>>("/v1/media/init", {
    file_type: fileType,
    media_subtype: "reel",
    mime_type: file.type,
    file_size_bytes: file.size,
  });
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

export async function uploadMedia(
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const init = await initMediaUpload(file);
  await uploadToPresignedUrl(init.upload_url, file, onProgress);
  await confirmUpload(init.media_id);
  return init.media_id;
}

/* ── Resumable (chunked) upload ───────────────────────────── */

// Files at or above this size use the resumable multipart path; smaller
// ones use the single-shot presigned PUT (one round trip, no overhead).
export const RESUMABLE_UPLOAD_THRESHOLD = 20 * 1024 * 1024; // 20 MB

interface ResumableInitResult {
  upload_id: string;
  media_id: string;
  chunk_size: number;
  total_parts: number;
}

// POSTs one part's bytes, retrying a few times so a dropped connection
// costs a single part's re-send rather than the whole upload.
async function uploadPartWithRetry(
  uploadId: string,
  partNumber: number,
  chunk: Blob,
  maxAttempts = 3
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await api.post(`/v1/media/upload/resumable/${uploadId}/chunk`, chunk, {
        params: { part_number: partNumber },
        headers: { "Content-Type": "application/octet-stream" },
      });
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }
  throw lastErr;
}

/**
 * Uploads a file via the resumable multipart API: init → upload each
 * part (with per-part retry) → complete. Resilient to dropped
 * connections — only the failed part is re-sent, not the whole file.
 */
export async function uploadMediaResumable(
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const fileType = file.type.startsWith("video/") ? "video" : "image";
  const initRes = await api.post<ApiResponse<ResumableInitResult>>(
    "/v1/media/upload/resumable/init",
    { file_type: fileType, mime_type: file.type, total_bytes: file.size }
  );
  const { upload_id, media_id, chunk_size, total_parts } = initRes.data.data;

  for (let part = 1; part <= total_parts; part++) {
    const start = (part - 1) * chunk_size;
    const slice = file.slice(start, Math.min(start + chunk_size, file.size));
    await uploadPartWithRetry(upload_id, part, slice);
    onProgress?.(Math.round((part / total_parts) * 100));
  }

  await api.post(`/v1/media/upload/resumable/${upload_id}/complete`);
  return media_id;
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
   COVER FRAME EXTRACTION
   ═══════════════════════════════════════════════════════════ */

export async function extractCoverFrame(params: {
  mediaId: string;
  timestampMs: number;
}): Promise<CoverFrameResult> {
  // Backend endpoint: POST /v1/media/:mediaId/frames?count=1
  // Returns { media_id, frames: [{ index, object_key, url }] }
  const res = await api.post<ApiResponse<{ media_id: string; frames: { index: number; object_key: string; url: string }[] }>>(
    `/v1/media/${params.mediaId}/frames`,
    null,
    { params: { count: 1 } }
  );
  const frame = res.data.data.frames?.[0];
  return {
    cover_media_id: res.data.data.media_id ?? params.mediaId,
    object_key: frame?.object_key ?? "",
    preview_url: frame?.url ?? "",
  };
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
}

export async function createReel(input: CreateReelInput): Promise<Reel> {
  // The backend's CreatePostRequest has no `hashtags` field — post-service
  // only indexes hashtags it can extract from `text`. So append any chip-input
  // hashtags that aren't already inline before sending. Without this, the
  // chip UI in DetailsStep is silently discarded.
  const text = mergeHashtagsIntoText(input.text, input.hashtags ?? []);
  const body: Record<string, unknown> = {
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
