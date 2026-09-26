import type { QueryClient } from '@tanstack/react-query';
import { patchReelEverywhere } from '@/features/reels/hooks/useReelFeed';
import type { ReelItem } from '@/features/reels/model';
import type { PostDetail } from '@/types/profile';
import { isCommentCount } from './postThreadLive';

/** Absolute server totals, including zero and replies; never derived from a loaded page. */
export function applyPostCommentCount(qc: QueryClient, postId: string, count: unknown) {
  if (!isCommentCount(count)) return;
  patchReelEverywhere(qc, postId, { commentCount: count });
  qc.setQueryData<ReelItem | null>(['reels', 'live', postId], old => old ? { ...old, commentCount: count } : old);
  const replace = (post: PostDetail): PostDetail => post.id === postId
    ? { ...post, counts: { ...post.counts, likes: post.counts?.likes ?? 0, comments: count } } : post;
  for (const [key] of qc.getQueriesData({ predicate: q =>
    ['home-feed', 'profile-posts', 'post-detail', 'saved-posts'].includes(String(q.queryKey[0])) })) {
    qc.setQueryData(key, (old: any) => !old ? old : Array.isArray(old) ? old.map(replace)
      : old.pages ? { ...old, pages: old.pages.map((page: any) => ({ ...page, data: page.data?.map(replace) })) }
      : old.id ? replace(old) : old);
  }
}

/** One invalidation path for create, reply, edit, delete and comment reactions. */
export function refreshCommentSurfaces(qc: QueryClient, postId: string) {
  for (const key of [
    ['comments', postId], ['comments-around', postId], ['post-detail', postId],
    ['reels', 'live', postId], ['reels', 'pinned', postId],
    ['home-feed'], ['profile-posts'],
  ]) void qc.invalidateQueries({queryKey:key});
}
