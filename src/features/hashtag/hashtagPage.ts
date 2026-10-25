import { formatCount, mediaHref } from "@/features/reels/model";
import type { PostDetail } from "@/types/profile";

/*
  The hashtag page as data (audit T-34): the tile each post becomes, the
  count line under the title, and the address the Share sheet hands out.

  The count comes from the list's meta `total` when post-service sends it
  (package 2-B2 adds it). Until then — or if it is ever missing or not a
  number — the line falls back to what is loaded ("20+ posts"), so the page
  never claims a total it was not given.
*/

export type HashtagTab = "all" | "posts" | "reels" | "videos";

export interface HashtagPageMeta {
  next_cursor?: string | null;
  total?: number | null;
}

/** The server's total for this tag (and tab), or null when it did not send a usable one. */
export function hashtagTotal(meta: HashtagPageMeta | null | undefined): number | null {
  const total = meta?.total;
  return typeof total === "number" && Number.isFinite(total) && total >= 0 ? Math.floor(total) : null;
}

const NOUN: Record<HashtagTab, string> = { all: "post", posts: "post", reels: "reel", videos: "video" };

/** "1.2K posts", "1 reel", "20+ posts" (loaded, more to come), or "No posts yet". */
export function hashtagCountLabel(total: number | null, loaded: number, hasMore: boolean, tab: HashtagTab = "all"): string {
  const noun = NOUN[tab];
  if (total !== null) {
    if (total === 0 && loaded === 0) return `No ${noun}s yet`;
    // A total below what is already on screen is stale; trust what is loaded.
    const n = Math.max(total, loaded);
    return `${formatCount(n)} ${noun}${n === 1 ? "" : "s"}`;
  }
  if (loaded === 0 && !hasMore) return `No ${noun}s yet`;
  return `${loaded}${hasMore ? "+" : ""} ${noun}${loaded === 1 && !hasMore ? "" : "s"}`;
}

/** The address the page's Share sheet hands out. */
export function hashtagShareUrl(tag: string, origin: string): string {
  return `${origin}/hashtag/${encodeURIComponent(tag.replace(/^#/, ""))}`;
}

export interface HashtagTile {
  id: string;
  href: string;
  kind: "reel" | "video" | "post";
  posterUrl: string | null;
  /** The caption a text tile shows (and every tile's accessible name starts with). */
  text: string;
  likes: number;
  label: string;
}

const REEL_TYPES = new Set(["flick", "short", "reel", "shorts"]);
const VIDEO_TYPES = new Set(["long_video", "video"]);

function poster(post: PostDetail): string | null {
  const thumb = post.video_metadata?.thumbnail_url;
  if (thumb) return mediaHref(thumb);
  if (post.cover_media_id) return mediaHref(`/v1/media/${post.cover_media_id}/serve`);
  // Only an image is a poster; a video's own file is not.
  const image = (post.media ?? []).find((m) => m.kind === "image" && m.media_id);
  return image ? mediaHref(`/v1/media/${image.media_id}/serve`) : null;
}

/** One post as a grid tile: reels open on the stage, videos on the watch page, the rest on /post/<id>. */
export function hashtagTile(post: PostDetail): HashtagTile {
  const type = (post.content_type || post.feed_content_type || "").toLowerCase();
  const kind: HashtagTile["kind"] = REEL_TYPES.has(type) ? "reel" : VIDEO_TYPES.has(type) ? "video" : "post";
  const id = encodeURIComponent(post.id);
  const href = kind === "reel" ? `/reels?reelId=${id}` : kind === "video" ? `/posttube/watch/${id}` : `/post/${id}`;
  const text = (post.title || post.text || "").trim();
  const likes = post.counts?.likes ?? 0;
  const noun = kind === "reel" ? "Reel" : kind === "video" ? "Video" : "Post";
  return {
    id: post.id,
    href,
    kind,
    posterUrl: poster(post),
    text,
    likes,
    label: `${noun}${text ? `: ${text.slice(0, 80)}` : ""}, ${formatCount(likes)} likes`,
  };
}
