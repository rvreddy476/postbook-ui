import type { PostDetail } from "@/types/profile";

export type FeedPage = {
  data: PostDetail[] | null;
  meta?: { next_cursor: string };
};

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
