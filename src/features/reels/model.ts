/*
  Reels domain model — the ONE place that knows the feed wire shape.

  GET /v1/feed/reels returns feed-service HydratedPost rows. Only short-form
  belongs on this page: the server already limits candidates to flick/reel,
  but the 5-minute cap is enforced on the client too (exactly as the Android
  reels screen does), because post-service only checks the cap on a category
  override, not on create. A long video or a feed post never reaches the
  stage, whatever the server sends.
*/

export const REEL_MAX_DURATION_MS = 5 * 60 * 1000;
export const SHORT_FORM_TYPES = new Set(["flick", "reel", "short"]);

/** A media row as feed-service hydrates it. Only the fields the stage reads. */
export interface FeedMedia {
  media_id: string;
  kind: string;
  position?: number;
  status?: string;
  width?: number;
  height?: number;
  blurhash?: string;
  duration_ms?: number;
  variants?: Record<string, string>;
  hls_url?: string | null;
  playback_url?: string | null;
  playback_kind?: "hls" | "original" | string | null;
  processing_status?: string;
}

export interface FeedAuthor {
  id: string;
  display_name?: string;
  username?: string;
  avatar_media_id?: string | null;
  avatar_url?: string | null;
}

/** The subset of HydratedPost the reels page consumes. */
export interface FeedReelPost {
  id: string;
  author_id: string;
  text?: string;
  content_type?: string;
  feed_content_type?: string;
  created_at?: string;
  cover_media_id?: string | null;
  media?: FeedMedia[] | null;
  counts?: { likes?: number; comments?: number; shares?: number } | null;
  view_count?: number;
  has_reacted?: boolean;
  viewer_reaction?: string | null;
  is_bookmarked?: boolean;
  hashtags?: string[] | null;
  no_comments?: boolean;
  hide_share?: boolean;
  allow_download?: boolean;
  is_processing?: boolean;
  author?: FeedAuthor | null;
  channel?: { user_id: string; name?: string; handle?: string; avatar_url?: string | null } | null;
  reason?: string | null;
  reason_text?: string | null;
}

export interface ReelItem {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  channelHandle: string | null;
  caption: string;
  hashtags: string[];
  createdAt: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  viewerLiked: boolean;
  viewerSaved: boolean;
  commentsDisabled: boolean;
  shareHidden: boolean;
  downloadAllowed: boolean;
  isProcessing: boolean;
  reasonText: string | null;
  media: {
    mediaId: string;
    width: number;
    height: number;
    durationMs: number;
    /** HLS manifest, gateway-relative, or null when only the original exists. */
    hlsUrl: string | null;
    /** Progressive fallback, gateway-relative. Always set. */
    fileUrl: string;
    downloadUrl: string;
    posterUrl: string | null;
    /** Rung labels the server has transcoded (e.g. ["360p","480p","720p"]). */
    qualities: string[];
  };
}

/** The API base every media URL is prefixed with ("" = same-origin proxy). */
export function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "";
}

/** Gateway-relative → absolute against the API base; absolute stays as is. */
export function mediaHref(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${apiBase()}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export function primaryVideo(post: FeedReelPost): FeedMedia | null {
  const media = (post.media ?? []).filter((m) => m && m.kind === "video");
  if (media.length === 0) return null;
  return media.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
}

/**
  isShortForm decides whether a row belongs on the reels stage: a video, of a
  short-form content type, at most five minutes long. `content_type` wins
  over `feed_content_type` because it is the post's own classification.
*/
export function isShortForm(post: FeedReelPost): boolean {
  const type = (post.content_type || post.feed_content_type || "").toLowerCase();
  if (!SHORT_FORM_TYPES.has(type)) return false;
  const video = primaryVideo(post);
  if (!video) return false;
  const duration = video.duration_ms ?? 0;
  if (duration > REEL_MAX_DURATION_MS) return false;
  return true;
}

const RUNG = /^(\d{3,4})p$/;

export function toReelItem(post: FeedReelPost): ReelItem | null {
  if (!isShortForm(post)) return null;
  const video = primaryVideo(post)!;
  const author = post.author ?? null;
  const hls =
    video.playback_kind === "hls" && video.playback_url
      ? video.playback_url
      : video.hls_url || null;
  const qualities = Object.keys(video.variants ?? {})
    .filter((k) => RUNG.test(k))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  return {
    id: post.id,
    authorId: post.author_id,
    authorName: author?.display_name || author?.username || "Someone",
    authorUsername: author?.username || "",
    authorAvatarUrl: author?.avatar_url ? mediaHref(author.avatar_url) : null,
    channelHandle: post.channel?.handle || null,
    caption: post.text || "",
    hashtags: post.hashtags ?? [],
    createdAt: post.created_at || "",
    likeCount: post.counts?.likes ?? 0,
    commentCount: post.counts?.comments ?? 0,
    shareCount: post.counts?.shares ?? 0,
    viewCount: post.view_count ?? 0,
    viewerLiked: post.has_reacted === true || !!post.viewer_reaction,
    viewerSaved: post.is_bookmarked === true,
    commentsDisabled: post.no_comments === true,
    shareHidden: post.hide_share === true,
    downloadAllowed: post.allow_download === true,
    isProcessing: post.is_processing === true || video.status === "processing",
    reasonText: post.reason_text || null,
    media: {
      mediaId: video.media_id,
      width: video.width ?? 1080,
      height: video.height ?? 1920,
      durationMs: video.duration_ms ?? 0,
      hlsUrl: hls ? mediaHref(hls) : null,
      fileUrl: mediaHref(`/v1/media/${video.media_id}/serve`),
      downloadUrl: mediaHref(`/v1/media/${video.media_id}/serve`),
      posterUrl: post.cover_media_id ? mediaHref(`/v1/media/${post.cover_media_id}/serve`) : null,
      qualities,
    },
  };
}

/** Maps a page of rows, dropping anything that is not a reel. */
export function toReelItems(rows: FeedReelPost[] | null | undefined): ReelItem[] {
  const out: ReelItem[] = [];
  for (const row of rows ?? []) {
    const item = toReelItem(row);
    if (item) out.push(item);
  }
  return out;
}

/* ── display helpers ───────────────────────────────────────── */

export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${trim(n / 1000)}K`;
  if (n < 1_000_000_000) return `${trim(n / 1_000_000)}M`;
  return `${trim(n / 1_000_000_000)}B`;
}

function trim(x: number): string {
  const s = x.toFixed(x < 10 ? 1 : 0);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function reelPermalink(id: string): string {
  if (typeof window === "undefined") return `/reels/${id}`;
  return `${window.location.origin}/reels/${id}`;
}
