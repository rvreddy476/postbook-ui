import type { QueryClient } from "@tanstack/react-query";

import type { PostDetail } from "@/types/profile";

/*
  Every cache that holds a post row: the home feeds (For You and
  Following), a profile's posts, the post read and the saved list. The same
  prefixes useFeedReaction patches, so a like or a save shows the same state
  wherever the post is on screen — without refetching a ranked feed, which
  would reorder what the viewer is looking at.
*/
export const POST_CACHE_PREFIXES = ["home-feed", "profile-posts", "post-detail", "saved-posts"];

type PageLike = { data?: PostDetail[] | null };

/** Applies `fn` to the post with this id in one cached value (a list, an infinite feed, or a single post). */
export function patchCachedValue(old: unknown, postId: string, fn: (post: PostDetail) => PostDetail): unknown {
  if (!old) return old;
  const replace = (post: PostDetail) => (post?.id === postId ? fn(post) : post);
  if (Array.isArray(old)) return old.map(replace);
  const o = old as { pages?: PageLike[]; id?: string };
  if (Array.isArray(o.pages)) {
    return { ...o, pages: o.pages.map((page) => (page && Array.isArray(page.data) ? { ...page, data: page.data.map(replace) } : page)) };
  }
  if (typeof o.id === "string") return replace(old as PostDetail);
  return old;
}

export function patchPostEverywhere(qc: QueryClient, postId: string, fn: (post: PostDetail) => PostDetail): void {
  for (const [key] of qc.getQueriesData({ predicate: (q) => POST_CACHE_PREFIXES.includes(String(q.queryKey[0])) })) {
    qc.setQueryData(key, (old: unknown) => patchCachedValue(old, postId, fn));
  }
}

/** The saved flag and the save count, moved together; the count never goes below 0 and is left absent when it was. */
export function withSaved(post: PostDetail, saved: boolean): PostDetail {
  if (Boolean(post.is_bookmarked) === saved) return post;
  const counts = post.counts;
  const current = typeof counts?.saves === "number" ? counts.saves : undefined;
  return {
    ...post,
    is_bookmarked: saved,
    ...(counts && current !== undefined ? { counts: { ...counts, saves: Math.max(0, current + (saved ? 1 : -1)) } } : {}),
  };
}
