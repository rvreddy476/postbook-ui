import { formatCount, mediaHref } from "@/features/reels/model";

/*
  GET /v1/posts/trending rows → what the right-column card draws. Pure, so
  the title fallback and the per-type link are pinned by tests rather than
  discovered in the browser.
*/

export type TrendingKind = "flick" | "long_video";

/** The subset of PostDetail the card reads. Author enrichment may be absent. */
export interface TrendingPost {
  id: string;
  author_id: string;
  text?: string | null;
  title?: string | null;
  content_type?: string | null;
  cover_media_id?: string | null;
  counts?: { likes?: number; comments?: number; shares?: number } | null;
  view_count?: number | null;
  media?: { media_id: string; kind: string; duration_ms?: number }[] | null;
  author?: { display_name?: string; username?: string } | null;
}

export interface TrendingRow {
  id: string;
  authorId: string;
  title: string;
  href: string;
  /** Absolute poster URL, or null when the post has no cover. */
  posterUrl: string | null;
  views: number;
  likes: number;
  /** "12K views · 1.2K likes" */
  stats: string;
  /** Name from the row's own enrichment; the card fills it from a batch lookup otherwise. */
  authorName: string | null;
  durationMs: number | null;
}

export const TRENDING_TITLE_MAX = 80;
export const TRENDING_UNTITLED = "Untitled";

/** `title` → first line of `text`, capped at 80 chars → "Untitled". */
export function trendingTitle(post: Pick<TrendingPost, "title" | "text">): string {
  const title = post.title?.trim();
  if (title) return title;
  const firstLine = (post.text ?? "").split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  if (!firstLine) return TRENDING_UNTITLED;
  return firstLine.length > TRENDING_TITLE_MAX ? `${firstLine.slice(0, TRENDING_TITLE_MAX).trimEnd()}…` : firstLine;
}

/** Where a trending row goes: the reels stage for a flick, the watch page otherwise. */
export function trendingHref(post: Pick<TrendingPost, "id" | "content_type">, kind?: TrendingKind): string {
  const type = post.content_type ?? kind ?? "long_video";
  if (type === "flick" || type === "reel" || type === "short") return `/reels?reelId=${encodeURIComponent(post.id)}`;
  return `/posttube/watch/${encodeURIComponent(post.id)}`;
}

export function trendingStats(views: number, likes: number): string {
  return `${formatCount(views)} views · ${formatCount(likes)} likes`;
}

export function trendingRow(post: TrendingPost, kind?: TrendingKind): TrendingRow {
  const views = Math.max(0, post.view_count ?? 0);
  const likes = Math.max(0, post.counts?.likes ?? 0);
  const video = (post.media ?? []).find((m) => m && m.kind === "video");
  return {
    id: post.id,
    authorId: post.author_id,
    title: trendingTitle(post),
    href: trendingHref(post, kind),
    posterUrl: post.cover_media_id ? mediaHref(`/v1/media/${post.cover_media_id}/serve`) : null,
    views,
    likes,
    stats: trendingStats(views, likes),
    authorName: post.author?.display_name?.trim() || post.author?.username?.trim() || null,
    durationMs: typeof video?.duration_ms === "number" ? video.duration_ms : null,
  };
}

export function trendingHeading(kind: TrendingKind): string {
  return kind === "flick" ? "Trending reels" : "Trending videos";
}
