import type { PostDetail } from "@/types/profile";

export type FeedPage = {
  data: PostDetail[] | null;
  meta?: { next_cursor: string };
};

/**
 * The created_at of the newest post on the page (the original string, which
 * is what the delta endpoint takes as its anchor), or undefined when no post
 * has a parseable one. Ranked pages are not in time order, so this is a max,
 * not posts[0].
 */
export function newestCreatedAtOf(posts: PostDetail[]): string | undefined {
  let newest: string | undefined;
  let newestMs = -Infinity;
  for (const post of posts) {
    const ms = Date.parse(post?.created_at ?? "");
    if (!Number.isNaN(ms) && ms > newestMs) {
      newestMs = ms;
      newest = post.created_at;
    }
  }
  return newest;
}

/** Keep server ranking; tolerate empty lists and overlap between cursor pages. */
export function uniqueFeedPosts(pages: FeedPage[] | undefined): PostDetail[] {
  const seen = new Set<string>();
  return (pages ?? [])
    .flatMap((page) => page.data ?? [])
    .filter((post) => {
      if (!post?.id || seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });
}
