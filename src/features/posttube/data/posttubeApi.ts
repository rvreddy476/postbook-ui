import api from "@/lib/api";
import type { PostDetail } from "@/types/profile";
import type { PostTubeVideo, VideoFeedItem, VideoMetadataDTO, FeedPage } from "../types";

/* ── Mapping: PostDetail → PostTubeVideo ─────────────────── */

function mediaUrl(mediaId: string): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  return `${base}/v1/media/${mediaId}/serve`;
}

// In-memory author cache to avoid repeated lookups within the same session
const authorCache = new Map<string, { name: string; avatarUrl: string; subscriberCount: number }>();

export async function resolveAuthor(authorId: string): Promise<{ name: string; avatarUrl: string; subscriberCount: number }> {
  if (authorCache.has(authorId)) return authorCache.get(authorId)!;
  const fallback = { name: authorId.slice(0, 8), avatarUrl: `https://api.dicebear.com/9.x/lorelei/svg?seed=${authorId}`, subscriberCount: 0 };
  try {
    // Fetch user's channels — the channel name is what shows on videos
    const [userRes, chRes] = await Promise.all([
      api.get<{ data: { display_name?: string; avatar_media_id?: string; username?: string } }>(`/v1/users/${authorId}`).catch(() => null),
      api.get<{ data: { id: string; name: string; avatar_media_id?: string; subscriber_count?: number }[] }>(`/v1/users/${authorId}/channels`).catch(() => null),
    ]);
    const user = userRes?.data?.data;
    const channels = chRes?.data?.data ?? [];
    const channel = channels[0];

    // Prefer channel name > display_name > username
    const name = channel?.name || user?.display_name || user?.username || fallback.name;
    const avatarMediaId = channel?.avatar_media_id || user?.avatar_media_id;
    const avatarUrl = avatarMediaId ? mediaUrl(avatarMediaId) : fallback.avatarUrl;
    const subscriberCount = channel?.subscriber_count ?? 0;

    const result = { name, avatarUrl, subscriberCount };
    authorCache.set(authorId, result);
    return result;
  } catch {
    return fallback;
  }
}

export function postDetailToVideo(post: PostDetail, authorInfo?: { name: string; avatarUrl: string; subscriberCount: number }): PostTubeVideo {
  const videoMedia = post.media?.find((m) => m.kind === "video");
  const imageMedia = post.media?.find((m) => m.kind === "image");

  // Cover image priority: explicit cover_media_id > image in media array > empty
  const thumbnailId = post.cover_media_id || imageMedia?.media_id;

  // Engagement mapping: internal → atpost vocabulary (Spark/Echo/Stash)
  const sparkCount = post.counts?.likes ?? 0;
  const echoCount = post.counts?.shares ?? 0;

  // Effective duration from video_metadata if available
  const vm = (post as unknown as Record<string, unknown>).video_metadata as
    | Partial<VideoMetadataDTO>
    | undefined;

  const durationSeconds = vm?.duration_seconds ?? 0;
  const effectiveDuration = vm?.effective_duration_seconds ?? durationSeconds;

  // Use backend's final_category as source of truth per spec v2.1
  // Fallback: classify by duration + orientation if backend didn't provide it
  let resolvedCategory = vm?.final_category || vm?.computed_category || "";
  if (!resolvedCategory && durationSeconds > 0) {
    const orientation = vm?.orientation ?? "";
    const isLandscape = orientation === "landscape" ||
      ((vm?.width ?? 0) > (vm?.height ?? 0));
    resolvedCategory = (durationSeconds <= 180 && !isLandscape)
      ? "flick"
      : "long_video";
  }

  return {
    id: post.id,
    title: post.text?.split("\n")[0] || "Untitled",
    description: post.text || "",
    video_url: vm?.playback_url || (videoMedia ? mediaUrl(videoMedia.media_id) : ""),
    thumbnail_url: vm?.thumbnail_url || (thumbnailId ? mediaUrl(thumbnailId) : ""),
    content_type: resolvedCategory || post.content_type,
    channel_id: post.author_id,
    channel_name: authorInfo?.name || post.author_id,
    channel_avatar_url: authorInfo?.avatarUrl || `https://api.dicebear.com/9.x/lorelei/svg?seed=${post.author_id}`,
    channel_subscriber_count: authorInfo?.subscriberCount ?? 0,
    view_count: post.counts?.likes ?? 0,
    like_count: sparkCount,
    dislike_count: 0,
    comment_count: post.counts?.comments ?? 0,
    share_count: echoCount,
    hashtags: post.hashtags ?? [],
    published_at: post.created_at,
    duration_seconds: effectiveDuration || durationSeconds,
    viewer_has_liked: !!post.viewer_reaction,
    viewer_has_disliked: false,
    viewer_has_saved: !!post.is_bookmarked,
    viewer_has_subscribed: false,
  };
}

/* ── Hydrate posts with author info ──────────────────────── */

async function hydratePosts(posts: PostDetail[]): Promise<PostTubeVideo[]> {
  // Resolve unique authors in parallel
  const authorIds = [...new Set(posts.map((p) => p.author_id))];
  const authorMap = new Map<string, { name: string; avatarUrl: string; subscriberCount: number }>();
  await Promise.all(
    authorIds.map(async (id) => {
      const info = await resolveAuthor(id);
      authorMap.set(id, info);
    })
  );
  return posts.map((p) => postDetailToVideo(p, authorMap.get(p.author_id)));
}

/* ── API response envelope ───────────────────────────────── */

interface ApiResponse<T> {
  data: T;
  meta?: { next_cursor?: string };
}

/* ── Category feed types ─────────────────────────────────── */

export type FeedCategory =
  | "trending"
  | "continue_watching"
  | "live"
  | "recommended"
  | "recent"
  | "subscriptions"
  | "popular";

/* ── Fetch a category feed page ──────────────────────────── */

export async function getCategoryFeed(
  category: FeedCategory,
  params?: { cursor?: string; limit?: number },
): Promise<FeedPage> {
  const queryParams: Record<string, string> = {
    limit: String(params?.limit ?? 12),
  };
  if (params?.cursor) {
    queryParams.cursor = params.cursor;
  }

  // Map categories to available API endpoints
  // The feed service supports /v1/feed/reels with optional category filter
  let endpoint = "/v1/feed/reels";

  switch (category) {
    case "trending":
      queryParams.sort = "trending";
      break;
    case "continue_watching":
      queryParams.filter = "history";
      break;
    case "live":
      queryParams.filter = "live";
      break;
    case "recommended":
      queryParams.sort = "recommended";
      break;
    case "recent":
      queryParams.sort = "recent";
      break;
    case "subscriptions":
      endpoint = "/v1/feed/reels";
      queryParams.filter = "subscriptions";
      break;
    case "popular":
      queryParams.sort = "popular";
      break;
  }

  try {
    const res = await api.get<ApiResponse<PostDetail[]>>(endpoint, {
      params: queryParams,
    });

    const posts = res.data.data ?? [];
    const items = await hydratePosts(posts);
    return {
      items,
      next_cursor: res.data.meta?.next_cursor || undefined,
    };
  } catch {
    // Return empty on failure — home page gracefully degrades
    return { items: [] };
  }
}

/* ── Separated Feed Endpoints ────────────────────────────── */

/** Fetch the home feed which returns split long_videos and flicks arrays */
export async function getHomeFeed(params?: {
  limit?: number;
}): Promise<{ longVideos: PostTubeVideo[]; flicks: PostTubeVideo[] }> {
  try {
    const res = await api.get<ApiResponse<PostDetail[]> & {
      long_videos?: PostDetail[];
      flicks?: PostDetail[];
    }>("/v1/feed/home", {
      params: { limit: String(params?.limit ?? 20) },
    });

    // Backend returns long_videos and flicks as separate arrays on first page
    const longVideos = await hydratePosts(res.data.long_videos ?? []);
    const flicks = await hydratePosts(res.data.flicks ?? []);

    // Fallback: if backend doesn't provide split arrays, classify from main data
    // Per spec v2.1: Flick = ≤180s AND (portrait/square); LongVideo = everything else
    if (longVideos.length === 0 && flicks.length === 0) {
      const allPosts = await hydratePosts(res.data.data ?? []);
      return {
        longVideos: allPosts.filter((v) => v.content_type !== "flick"),
        flicks: allPosts.filter((v) => v.content_type === "flick"),
      };
    }

    return { longVideos, flicks };
  } catch {
    return { longVideos: [], flicks: [] };
  }
}

/** Fetch flicks-only feed with cursor pagination */
export async function getFlicksFeed(params?: {
  cursor?: string;
  limit?: number;
}): Promise<FeedPage> {
  try {
    const res = await api.get<ApiResponse<PostDetail[]>>("/v1/feed/flicks", {
      params: {
        limit: String(params?.limit ?? 20),
        ...(params?.cursor ? { cursor: params.cursor } : {}),
      },
    });
    const posts = res.data.data ?? [];
    return {
      items: await hydratePosts(posts),
      next_cursor: res.data.meta?.next_cursor || undefined,
    };
  } catch {
    return { items: [] };
  }
}

/** Fetch long-videos-only feed with cursor pagination */
export async function getLongVideosFeed(params?: {
  cursor?: string;
  limit?: number;
}): Promise<FeedPage> {
  try {
    const res = await api.get<ApiResponse<PostDetail[]>>("/v1/feed/videos", {
      params: {
        limit: String(params?.limit ?? 20),
        ...(params?.cursor ? { cursor: params.cursor } : {}),
      },
    });
    const posts = res.data.data ?? [];
    return {
      items: await hydratePosts(posts),
      next_cursor: res.data.meta?.next_cursor || undefined,
    };
  } catch {
    return { items: [] };
  }
}

/* ── Video Creator Tools ─────────────────────────────────── */

/** Update video trim points */
export async function updateVideoTrim(
  videoId: string,
  trimStartMs: number,
  trimEndMs?: number,
): Promise<void> {
  await api.patch(`/v1/videos/${videoId}/trim`, {
    trim_start_ms: trimStartMs,
    trim_end_ms: trimEndMs ?? null,
  });
}

/** Override video category */
export async function overrideVideoCategory(
  videoId: string,
  category: "flick" | "long_video",
): Promise<void> {
  await api.patch(`/v1/videos/${videoId}/category`, { category });
}

/** Set cover frame for a video */
export async function setCoverFrame(
  videoId: string,
  params: { cover_media_id?: string; thumbnail_url?: string; timestamp_ms?: number },
): Promise<void> {
  await api.post(`/v1/videos/${videoId}/cover-frame`, params);
}

/** Publish a video (must be in "ready" status) */
export async function publishVideo(videoId: string): Promise<void> {
  await api.post(`/v1/videos/${videoId}/publish`);
}

/** Get video metadata */
export async function getVideoDetail(videoId: string) {
  const res = await api.get<ApiResponse<Record<string, unknown>>>(`/v1/videos/${videoId}`);
  return res.data.data;
}
