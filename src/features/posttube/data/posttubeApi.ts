import api from "@/lib/api";
import type { PostDetail } from "@/types/profile";
import type { MediaSubtitleTrack, PostTubeVideo, VideoFeedItem, VideoMetadataDTO, FeedPage } from "../types";

/* ── Mapping: PostDetail → PostTubeVideo ─────────────────── */

function mediaUrl(mediaId: string): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  return `${base}/v1/media/${mediaId}/serve`;
}

interface ResolvedAuthorInfo {
  channelId?: string;
  channelHandle?: string;
  name: string;
  avatarUrl: string;
  subscriberCount: number;
}

// In-memory author cache to avoid repeated lookups within the same session.
// PostTube creator identity currently comes from the user-service channel model.
const authorCache = new Map<string, ResolvedAuthorInfo>();

export async function resolveAuthor(authorId: string): Promise<ResolvedAuthorInfo> {
  if (authorCache.has(authorId)) return authorCache.get(authorId)!;
  const fallback: ResolvedAuthorInfo = {
    name: authorId.slice(0, 8),
    avatarUrl: `https://api.dicebear.com/9.x/lorelei/svg?seed=${authorId}`,
    subscriberCount: 0,
  };
  try {
    // Fetch user's channels — the channel name is what shows on videos
    const [userRes, chRes] = await Promise.all([
      api.get<{ data: { display_name?: string; avatar_media_id?: string; username?: string } }>(`/v1/users/${authorId}`).catch(() => null),
      api.get<{ data: { id: string; handle?: string; name: string; avatar_media_id?: string; subscriber_count?: number }[] }>(`/v1/users/${authorId}/channels`).catch(() => null),
    ]);
    const user = userRes?.data?.data;
    const channels = chRes?.data?.data ?? [];
    const channel = channels[0];

    // Prefer channel name > display_name > username
    const name = channel?.name || user?.display_name || user?.username || fallback.name;
    const avatarMediaId = channel?.avatar_media_id || user?.avatar_media_id;
    const avatarUrl = avatarMediaId ? mediaUrl(avatarMediaId) : fallback.avatarUrl;
    const subscriberCount = channel?.subscriber_count ?? 0;

    const result: ResolvedAuthorInfo = {
      channelId: channel?.id,
      channelHandle: channel?.handle,
      name,
      avatarUrl,
      subscriberCount,
    };
    authorCache.set(authorId, result);
    return result;
  } catch {
    return fallback;
  }
}

export function postDetailToVideo(post: PostDetail, authorInfo?: ResolvedAuthorInfo): PostTubeVideo {
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
    author_id: post.author_id,
    title: post.text?.split("\n")[0] || "Untitled",
    description: post.text || "",
    video_url: vm?.playback_url || (videoMedia ? mediaUrl(videoMedia.media_id) : ""),
    thumbnail_url: vm?.thumbnail_url || (thumbnailId ? mediaUrl(thumbnailId) : ""),
    content_type: resolvedCategory || post.content_type,
    channel_id: authorInfo?.channelId || post.author_id,
    subscription_channel_id: authorInfo?.channelId,
    channel_handle: authorInfo?.channelHandle,
    channel_name: authorInfo?.name || post.author_id,
    channel_avatar_url: authorInfo?.avatarUrl || `https://api.dicebear.com/9.x/lorelei/svg?seed=${post.author_id}`,
    channel_subscriber_count: authorInfo?.subscriberCount ?? 0,
    view_count: post.view_count ?? 0,
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
  const authorMap = new Map<string, ResolvedAuthorInfo>();
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

async function getPostDetailById(postId: string): Promise<PostDetail | null> {
  try {
    const res = await api.get<ApiResponse<PostDetail>>(`/v1/posts/${postId}`);
    return res.data.data;
  } catch {
    return null;
  }
}

function convertSrtToVtt(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "WEBVTT\n\n";
  if (normalized.startsWith("WEBVTT")) return `${normalized}\n`;
  const body = normalized.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${body}\n`;
}

/* ── Category feed types ─────────────────────────────────── */

export type FeedCategory =
  | "trending"
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

/** Fetch the PostTube home feed: long videos + flicks via dedicated endpoints.
 *  Never calls /v1/feed/home (which is Postbook's social feed). */
export async function getHomeFeed(params?: {
  limit?: number;
}): Promise<{ longVideos: PostTubeVideo[]; flicks: PostTubeVideo[] }> {
  const limit = params?.limit ?? 20;
  try {
    const [longVideosResult, flicksResult] = await Promise.all([
      getLongVideosFeed({ limit }),
      getFlicksFeed({ limit }),
    ]);
    return {
      longVideos: longVideosResult.items,
      flicks: flicksResult.items,
    };
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
export async function getVideoDetail(videoId: string): Promise<VideoMetadataDTO> {
  const res = await api.get<ApiResponse<VideoMetadataDTO>>(`/v1/videos/${videoId}`);
  return res.data.data;
}

export async function getSubtitleTracks(mediaId: string): Promise<MediaSubtitleTrack[]> {
  try {
    const res = await api.get<ApiResponse<{ subtitles: MediaSubtitleTrack[] }>>(`/v1/subtitles/${mediaId}`);
    return res.data.data?.subtitles ?? [];
  } catch {
    return [];
  }
}

export async function createSubtitleTrack(
  mediaId: string,
  params: { language: string; file: File; source?: string },
): Promise<MediaSubtitleTrack> {
  const fileName = params.file.name.toLowerCase();
  const rawContent = await params.file.text();
  const vttContent = fileName.endsWith(".srt") ? convertSrtToVtt(rawContent) : rawContent;
  const contentUrl = `data:text/vtt;charset=utf-8,${encodeURIComponent(vttContent)}`;

  const res = await api.post<ApiResponse<MediaSubtitleTrack>>(`/v1/subtitles/${mediaId}`, {
    language: params.language,
    source: params.source ?? "manual_upload",
    format: "vtt",
    content_url: contentUrl,
  });
  return res.data.data;
}

export interface VideoWatchProgress {
  user_id: string;
  post_id: string;
  position_ms: number;
  duration_ms: number;
  percent_watched: number;
  completed: boolean;
  last_watched_at: string;
}

export async function getContinueWatchingProgress(limit = 20): Promise<VideoWatchProgress[]> {
  try {
    const res = await api.get<ApiResponse<VideoWatchProgress[]>>("/v1/videos/continue-watching", {
      params: { limit },
    });
    return res.data.data ?? [];
  } catch {
    return [];
  }
}

export async function getWatchProgressForVideo(videoId: string): Promise<VideoWatchProgress | null> {
  const items = await getContinueWatchingProgress(100);
  return items.find((item) => item.post_id === videoId) ?? null;
}

export async function getContinueWatchingVideos(limit = 12): Promise<PostTubeVideo[]> {
  const progressItems = await getContinueWatchingProgress(limit);
  if (progressItems.length === 0) return [];

  const postEntries = await Promise.all(
    progressItems.map(async (progress) => {
      const post = await getPostDetailById(progress.post_id);
      return post ? { post, progress } : null;
    })
  );

  const resolvedEntries = postEntries.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  if (resolvedEntries.length === 0) return [];

  const hydratedVideos = await hydratePosts(resolvedEntries.map((entry) => entry.post));
  return hydratedVideos.map((video, index) => {
    const progress = resolvedEntries[index].progress;
    return {
      ...video,
      resume_position_ms: progress.position_ms,
      resume_duration_ms: progress.duration_ms,
      resume_percent_watched: progress.percent_watched,
      last_watched_at: progress.last_watched_at,
    };
  });
}

export async function saveVideoWatchProgress(
  videoId: string,
  params: { positionMs: number; durationMs: number },
): Promise<VideoWatchProgress> {
  const res = await api.post<ApiResponse<VideoWatchProgress>>(`/v1/videos/${videoId}/progress`, {
    position_ms: params.positionMs,
    duration_ms: params.durationMs,
  });
  return res.data.data;
}

export async function deleteVideoWatchProgress(videoId: string): Promise<void> {
  await api.delete(`/v1/videos/${videoId}/progress`);
}
