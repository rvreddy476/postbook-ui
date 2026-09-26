import api from "@/lib/api";

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
export async function fetchReel(id: string): Promise<ReelItem | null> {
  try {
    const res = await api.get<Envelope<FeedReelPost>>(`/v1/posts/${id}`);
    return toReelItem(res.data.data);
  } catch {
    return null;
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
