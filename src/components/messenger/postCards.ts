import { useQuery } from '@tanstack/react-query';

import { fetchPostsBatch } from '@/features/reels/data/reelFeedApi';
import { indexBatch, type PostBatchData } from '@/features/reels/liked';
import { mediaHref, type FeedReelPost } from '@/features/reels/model';

/*
  A shared post in a chat thread (message type "post", audit T-25).

  The message carries only post_id. The thread hydrates every post card on
  screen with ONE POST /v1/posts/batch, sent as the viewer: post-service
  enforces visibility there, so an id it does not return — deleted, hidden,
  private, or by someone the viewer blocked — renders "This post isn't
  available" and nothing else. The card never shows what the sender saw.
*/

export const POST_UNAVAILABLE_TEXT = "This post isn't available";

/** The distinct post ids of the post messages in a thread, in order. */
export function postCardIds(messages: ReadonlyArray<{ type?: string; postId?: string; isDeleted?: boolean }>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of messages) {
    if (m.type !== 'post' || !m.postId || m.isDeleted || seen.has(m.postId)) continue;
    seen.add(m.postId);
    out.push(m.postId);
  }
  return out;
}

export type PostCardView =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'unavailable'; text: string }
  | {
      state: 'ready';
      href: string;
      title: string;
      kindLabel: 'Reel' | 'Video' | 'Post';
      authorName: string | null;
      posterUrl: string | null;
    };

const REEL_TYPES = new Set(['short', 'flick', 'reel', 'shorts']);
const VIDEO_TYPES = new Set(['long_video', 'video']);

function kindLabel(post: FeedReelPost): 'Reel' | 'Video' | 'Post' {
  const type = (post.content_type || post.feed_content_type || '').toLowerCase();
  if (REEL_TYPES.has(type)) return 'Reel';
  if (VIDEO_TYPES.has(type)) return 'Video';
  return 'Post';
}

function posterOf(post: FeedReelPost): string | null {
  if (post.cover_media_id) return mediaHref(`/v1/media/${post.cover_media_id}/serve`);
  const image = (post.media ?? []).find((m) => m && m.kind === 'image' && m.media_id);
  return image ? mediaHref(`/v1/media/${image.media_id}/serve`) : null;
}

/** What one card draws, from the batch result. Pure. */
export function postCardView(
  postId: string,
  batch: { status: 'pending' | 'error' | 'success'; posts?: Map<string, FeedReelPost> },
): PostCardView {
  if (batch.status === 'pending') return { state: 'loading' };
  if (batch.status === 'error') return { state: 'error' };
  const post = batch.posts?.get(postId);
  if (!post) return { state: 'unavailable', text: POST_UNAVAILABLE_TEXT };
  const text = (post.title || post.text || '').trim();
  const kind = kindLabel(post);
  return {
    state: 'ready',
    // The one permalink: /post/<id> opens every kind, and 404s what the reader may not see.
    href: `/post/${encodeURIComponent(post.id)}`,
    title: text.length > 120 ? `${text.slice(0, 119)}…` : text || kind,
    kindLabel: kind,
    authorName: post.author?.display_name || (post.author?.username ? `@${post.author.username}` : null),
    posterUrl: posterOf(post),
  };
}

/** One batch read for every post card in a thread. */
export function usePostCards(ids: string[]) {
  const key = [...ids].sort();
  return useQuery({
    queryKey: ['chat-post-cards', key],
    queryFn: async ({ signal }) => indexBatch((await fetchPostsBatch(key, signal)) as PostBatchData),
    enabled: key.length > 0,
    staleTime: 60_000,
    retry: false,
  });
}
