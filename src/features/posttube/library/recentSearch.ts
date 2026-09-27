import type { WatchProgress } from "../model";

/** Case-insensitive match on title or channel name over the rows already loaded; an empty query keeps everything. */
export function filterRecent<T extends Pick<WatchProgress, "post" | "postId">>(rows: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows as T[];
  return rows.filter((r) => {
    const post = r.post as { title?: string | null; text?: string | null; author?: { display_name?: string; username?: string } | null; channel?: { name?: string; handle?: string } | null } | null | undefined;
    const hay = [post?.title, post?.text, post?.channel?.name, post?.channel?.handle, post?.author?.display_name, post?.author?.username]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
