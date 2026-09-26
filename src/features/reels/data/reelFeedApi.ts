import api from "@/lib/api";
import { isAxiosError } from 'axios';

import { toReelItem, toReelItems, type FeedReelPost, type ReelItem } from "@/features/reels/model";

interface Envelope<T> {
  data: T;
  meta?: { next_cursor?: string } | null;
}

export interface ReelPage {
  items: ReelItem[];
  nextCursor: string | undefined;
}

export const REEL_PAGE_SIZE = 8;

/** GET /v1/feed/reels — the only feed this page reads; long video never comes back. */
export async function fetchReelsPage(params: {
  cursor?: string;
  following?: boolean;
  limit?: number;
  signal?: AbortSignal;
}): Promise<ReelPage> {
  const query: Record<string, string> = { limit: String(params.limit ?? REEL_PAGE_SIZE) };
  if (params.cursor) query.cursor = params.cursor;
  if (params.following) query.following_only = "true";
  const res = await api.get<Envelope<FeedReelPost[] | null>>("/v1/feed/reels", {
    params: query,
    signal: params.signal,
  });
  return {
    items: toReelItems(res.data.data),
    // Go zero values: an empty string must fall through like an absent one.
    nextCursor: res.data.meta?.next_cursor || undefined,
  };
}

/** One reel by id, for deep links. null when it is missing or not a reel. */
export async function fetchReel(id: string, signal?: AbortSignal): Promise<ReelItem | null> {
  try {
    const res = await api.get<Envelope<FeedReelPost>>(`/v1/posts/${id}`, {signal});
    return toReelItem(res.data.data);
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

/** Canonical, idempotent like: POST/DELETE /v1/posts/:id/reactions. */
export async function setLike(postId: string, liked: boolean): Promise<void> {
  if (liked) {
    await api.post(`/v1/posts/${postId}/reactions`, { reaction: "like" });
  } else {
    await api.delete(`/v1/posts/${postId}/reactions`);
  }
}

export async function setSaved(postId: string, saved: boolean): Promise<void> {
  if (saved) {
    await api.post(`/v1/posts/${postId}/bookmark`);
  } else {
    await api.delete(`/v1/posts/${postId}/bookmark`);
  }
}

export async function recordShare(postId: string): Promise<number | undefined> {
  const res = await api.post<Envelope<{ shared?: boolean; count?: number }>>(
    `/v1/posts/${postId}/share`,
    { share_type: "external" },
  );
  return res.data.data?.count;
}

export type FeedbackSignal = "interested" | "not_interested";

export async function sendPostFeedback(postId: string, signal: FeedbackSignal): Promise<void> {
  await api.post("/v1/feed/feedback", { post_id: postId, signal });
}

export async function sendAuthorFeedback(authorId: string, signal: FeedbackSignal): Promise<void> {
  await api.post("/v1/feed/feedback", { author_id: authorId, signal });
}

/** POST /v1/graph/block { user_id } — the author's reels leave the feed on success. */
export async function blockUser(userId: string): Promise<void> {
  await api.post("/v1/graph/block", { user_id: userId });
}

/** DELETE /v1/posts/:id — soft delete; POST /v1/posts/:id/restore brings it back. */
export async function deletePost(postId: string): Promise<void> {
  await api.delete(`/v1/posts/${postId}`);
}

export async function restorePost(postId: string): Promise<void> {
  await api.post(`/v1/posts/${postId}/restore`, {});
}

/** GET /v1/reels/liked?limit= → { data: [id, …] } in liked order; no cursor. */
export async function fetchLikedReelIds(limit = 60, signal?: AbortSignal): Promise<string[]> {
  const res = await api.get<Envelope<string[] | null>>("/v1/reels/liked", { params: { limit: String(limit) }, signal });
  return (res.data.data ?? []).filter((id): id is string => typeof id === "string" && id.length > 0);
}

/**
 * POST /v1/posts/batch { ids } → { data: { [id]: PostDetail } }. post-service
 * answers with a map keyed by id (an array is tolerated by the mapper). Max
 * 100 ids per call.
 */
export async function fetchPostsBatch(
  ids: string[],
  signal?: AbortSignal,
): Promise<Record<string, FeedReelPost | null> | FeedReelPost[] | null> {
  if (ids.length === 0) return {};
  const res = await api.post<Envelope<Record<string, FeedReelPost | null> | FeedReelPost[] | null>>(
    "/v1/posts/batch",
    { ids: ids.slice(0, 100) },
    { signal },
  );
  return res.data.data ?? {};
}

/* ── channel subscription (reels posted through a Tube channel) ─── */

/** GET /v1/channels/:handle/subscription → { subscribed }. 404 = not subscribed. */
export async function fetchChannelSubscribed(handle: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await api.get<Envelope<{ subscribed?: boolean; is_subscribed?: boolean } | null>>(
      `/v1/channels/${encodeURIComponent(handle)}/subscription`,
      { signal },
    );
    return res.data.data?.subscribed === true || res.data.data?.is_subscribed === true;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return false;
    throw error;
  }
}

/** POST / DELETE /v1/channels/:handle/subscribe. */
export async function setChannelSubscribed(handle: string, subscribed: boolean): Promise<void> {
  if (subscribed) await api.post(`/v1/channels/${encodeURIComponent(handle)}/subscribe`, {});
  else await api.delete(`/v1/channels/${encodeURIComponent(handle)}/subscribe`);
}

export interface SubtitleTrack {
  language: string;
  format: string;
  content_url?: string;
  content?: string;
}

/** GET /v1/subtitles/:mediaId → the transcript rows media-service holds. */
export async function fetchSubtitles(mediaId: string): Promise<SubtitleTrack[]> {
  try {
    const res = await api.get<Envelope<{ subtitles?: SubtitleTrack[] }>>(`/v1/subtitles/${mediaId}`);
    return res.data.data?.subtitles ?? [];
  } catch {
    return [];
  }
}
