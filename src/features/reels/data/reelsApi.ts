import api from "@/lib/api";

import type { PostDetail, CommentItem } from "@/types/profile";
import type {
  Reel,
  ReelComment,
  ReelDraft,
  AudioTrack,
  Topic,
  CoverFrameResult,
  ProcessingStatusResult,
  ViewEvent,
  CursorPage,
  CommentsAroundResponse,
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

export function commentItemToReelComment(item: CommentItem): ReelComment {
  return {
    comment_id: item.id,
    author_id: item.author_id,
    author_name: item.author_id,
    text: item.body || item.text || "",
    created_at: item.created_at,
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

export async function getReelsPage(params?: {
  cursor?: string;
  limit?: number;
}): Promise<CursorPage<Reel>> {
  const queryParams: Record<string, string> = {
    limit: String(params?.limit ?? 8),
  };
  if (params?.cursor) {
    queryParams.cursor = params.cursor;
  }

  const res = await api.get<ApiResponse<PostDetail[]>>("/v1/feed/reels", {
    params: queryParams,
  });

  const posts = res.data.data ?? [];
  return {
    items: posts.map(postDetailToReel),
    next_cursor: res.data.meta?.next_cursor || undefined,
  };
}

/* ── Single reel ─────────────────────────────────────────── */

export async function getReelById(reelId: string): Promise<Reel | null> {
  try {
    const res = await api.get<ApiResponse<PostDetail>>(`/v1/posts/${reelId}`);
    return postDetailToReel(res.data.data);
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
   COMMENTS
   ═══════════════════════════════════════════════════════════ */

export async function getCommentsPage(params: {
  reelId: string;
  cursor?: string;
  limit?: number;
}): Promise<CursorPage<ReelComment>> {
  const queryParams: Record<string, string> = {
    limit: String(params.limit ?? 40),
  };
  if (params.cursor) {
    queryParams.cursor = params.cursor;
  }

  const res = await api.get<ApiResponse<CommentItem[]>>(
    `/v1/posts/${params.reelId}/comments`,
    { params: queryParams }
  );

  const items = Array.isArray(res.data.data) ? res.data.data : [];
  return {
    items: items.map(commentItemToReelComment),
    next_cursor: res.data.meta?.next_cursor || undefined,
  };
}

export async function getCommentsAroundByCommentId(params: {
  comment_id: string;
  reel_id: string;
}): Promise<CommentsAroundResponse> {
  const res = await api.get<ApiResponse<CommentItem[]>>(
    `/v1/posts/${params.reel_id}/comments/around/${params.comment_id}`,
    { params: { limit: "40" } }
  );

  const items = Array.isArray(res.data.data) ? res.data.data : [];
  const comments = items.map(commentItemToReelComment);
  const focusIndex = comments.findIndex((c) => c.comment_id === params.comment_id);

  return {
    reel_id: params.reel_id,
    focus_comment_id: params.comment_id,
    comments,
    focus_index: Math.max(0, focusIndex),
  };
}

export async function createComment(params: {
  reelId: string;
  text: string;
}): Promise<ReelComment> {
  const res = await api.post<ApiResponse<CommentItem>>(
    `/v1/posts/${params.reelId}/comments`,
    { text: params.text },
    { headers: { "Idempotency-Key": crypto.randomUUID() } }
  );
  return commentItemToReelComment(res.data.data);
}

/* ═══════════════════════════════════════════════════════════
   ENGAGEMENT ACTIONS
   ═══════════════════════════════════════════════════════════ */

export async function toggleLike(postId: string): Promise<{ liked: boolean; count: number }> {
  const res = await api.post<ApiResponse<{ liked: boolean; count: number }>>(
    `/v1/posts/${postId}/like`
  );
  return res.data.data;
}

export async function toggleBookmark(postId: string): Promise<{ bookmarked: boolean }> {
  const res = await api.post<ApiResponse<{ bookmarked: boolean }>>(
    `/v1/posts/${postId}/bookmark`
  );
  return res.data.data;
}

export async function sharePost(
  postId: string,
  shareType: "repost" | "quote" | "external" = "external"
): Promise<{ shared: boolean; count: number }> {
  const res = await api.post<ApiResponse<{ shared: boolean; count: number }>>(
    `/v1/posts/${postId}/share`,
    { share_type: shareType, quote_text: "" }
  );
  return res.data.data;
}

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

/**
 * Records a finished reel view. Posts a `play_end` event to the generic
 * analytics ingest endpoint (`POST /v1/analytics/events`), which batches
 * it to Kafka where the VideoViewConsumer applies the display-view rules
 * and increments the Redis view counter.
 *
 * `viewer_id` is intentionally left blank — the server attributes the
 * view to the authenticated X-User-Id the gateway stamps on the event.
 */
export async function trackView(event: ViewEvent): Promise<void> {
  const percentViewed =
    event.duration_ms > 0
      ? Math.min(100, (event.watched_ms / event.duration_ms) * 100)
      : 0;
  const payload = {
    content_id: event.reel_id,
    creator_id: event.creator_id,
    viewer_id: "",
    session_id: analyticsSession(),
    content_type: event.content_type ?? "reel",
    content_duration_ms: event.duration_ms,
    watched_ms_total: event.watched_ms,
    max_continuous_watch_ms: event.watched_ms,
    percent_viewed: percentViewed,
    loop_count: 0,
    end_reason: event.completed ? "ended" : "swipe_next",
    surface: event.source,
    country: "",
    device_id_hash: "",
    is_autoplay: true,
  };
  await api
    .post("/v1/analytics/events", {
      events: [
        { type: "play_end", payload, timestamp: new Date().toISOString() },
      ],
    })
    .catch(() => {});
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
  const res = await api.get<ApiResponse<ProcessingStatusResult>>(`/v1/media/${mediaId}`);
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

export async function getTrendingAudio(params?: {
  limit?: number;
  cursor?: string;
}): Promise<CursorPage<AudioTrack>> {
  const res = await api.get<ApiResponse<AudioTrack[]>>("/v1/audio/trending", {
    params: { limit: String(params?.limit ?? 20), cursor: params?.cursor ?? "" },
  });
  return {
    items: res.data.data ?? [],
    next_cursor: res.data.meta?.next_cursor,
  };
}

export async function searchAudio(params: {
  query: string;
  limit?: number;
  cursor?: string;
}): Promise<CursorPage<AudioTrack>> {
  const res = await api.post<ApiResponse<AudioTrack[]>>("/v1/audio/search", {
    query: params.query,
    limit: params.limit ?? 20,
    cursor: params.cursor,
  });
  return {
    items: res.data.data ?? [],
    next_cursor: res.data.meta?.next_cursor,
  };
}

export async function extractAudio(mediaId: string): Promise<AudioTrack> {
  const res = await api.post<ApiResponse<AudioTrack>>("/v1/audio/extract", {
    media_id: mediaId,
  });
  return res.data.data;
}

export async function getReelsByAudio(
  audioId: string,
  params?: { limit?: number; cursor?: string }
): Promise<CursorPage<Reel>> {
  const res = await api.get<ApiResponse<PostDetail[]>>(`/v1/audio/${audioId}/reels`, {
    params: { limit: String(params?.limit ?? 20), cursor: params?.cursor ?? "" },
  });
  return {
    items: (res.data.data ?? []).map(postDetailToReel),
    next_cursor: res.data.meta?.next_cursor,
  };
}

/* ═══════════════════════════════════════════════════════════
   TOPICS
   ═══════════════════════════════════════════════════════════ */

export async function getTopics(): Promise<Topic[]> {
  const res = await api.get<ApiResponse<Topic[]>>("/v1/reels/topics");
  return res.data.data ?? [];
}

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

export async function getDraft(draftId: string): Promise<ReelDraft> {
  const res = await api.get<ApiResponse<ReelDraft>>(`/v1/reels/drafts/${draftId}`);
  return res.data.data;
}

export async function listDrafts(params?: {
  limit?: number;
  cursor?: string;
}): Promise<CursorPage<ReelDraft>> {
  const res = await api.get<ApiResponse<ReelDraft[]>>("/v1/reels/drafts", {
    params: { limit: String(params?.limit ?? 20), cursor: params?.cursor ?? "" },
  });
  return {
    items: res.data.data ?? [],
    next_cursor: res.data.meta?.next_cursor,
  };
}

export async function deleteDraft(draftId: string): Promise<void> {
  await api.delete(`/v1/reels/drafts/${draftId}`);
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
  const res = await api.post<ApiResponse<PostDetail>>("/v1/posts", body);
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
