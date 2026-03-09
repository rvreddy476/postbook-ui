import api from "@/lib/api";
import type { PostDetail } from "@/types/profile";
import type { PostTubeVideo } from "../types";

/* ── Mapping: PostDetail → PostTubeVideo ─────────────────── */

function mediaUrl(mediaId: string): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  return `${base}/v1/media/${mediaId}/serve`;
}

export function postDetailToVideo(post: PostDetail): PostTubeVideo {
  const videoMedia = post.media?.find((m) => m.kind === "video");
  const imageMedia = post.media?.find((m) => m.kind === "image");

  return {
    id: post.id,
    title: post.text?.split("\n")[0] || "Untitled",
    description: post.text || "",
    video_url: videoMedia ? mediaUrl(videoMedia.media_id) : "",
    thumbnail_url: imageMedia ? mediaUrl(imageMedia.media_id) : "",
    channel_id: post.author_id,
    channel_name: post.author_id,
    channel_avatar_url: `https://api.dicebear.com/9.x/lorelei/svg?seed=${post.author_id}`,
    channel_subscriber_count: 0,
    view_count: post.counts?.likes ?? 0,
    like_count: post.counts?.likes ?? 0,
    dislike_count: 0,
    comment_count: post.counts?.comments ?? 0,
    share_count: post.counts?.shares ?? 0,
    hashtags: post.hashtags ?? [],
    published_at: post.created_at,
    duration_seconds: 0,
    viewer_has_liked: !!post.viewer_reaction,
    viewer_has_disliked: false,
    viewer_has_saved: !!post.is_bookmarked,
    viewer_has_subscribed: false,
  };
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

interface FeedPage {
  items: PostTubeVideo[];
  next_cursor?: string;
}

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
    return {
      items: posts.map(postDetailToVideo),
      next_cursor: res.data.meta?.next_cursor || undefined,
    };
  } catch {
    // Return empty on failure — home page gracefully degrades
    return { items: [] };
  }
}
