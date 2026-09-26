import { toReelItem, type FeedReelPost, type ReelItem } from "@/features/reels/model";

/*
  The liked page joins two calls: GET /v1/reels/liked answers with ids in
  the order they were liked (newest first), and POST /v1/posts/batch
  answers with the rows keyed by id — a map, though an array is tolerated.
  The liked order is the order the grid shows; anything the batch did not
  return, or that is not short-form, is dropped (toReelItem applies
  isShortForm).
*/

export type PostBatchData = Record<string, FeedReelPost | null> | FeedReelPost[] | null | undefined;

export function indexBatch(batch: PostBatchData): Map<string, FeedReelPost> {
  const map = new Map<string, FeedReelPost>();
  if (!batch) return map;
  const rows = Array.isArray(batch) ? batch : Object.values(batch);
  for (const row of rows) {
    if (row && typeof row === "object" && typeof row.id === "string") map.set(row.id, row);
  }
  return map;
}

/** Liked ids → reel items, in liked order, short-form only. */
export function likedReelsToItems(ids: readonly string[], batch: PostBatchData): ReelItem[] {
  const rows = indexBatch(batch);
  const out: ReelItem[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const row = rows.get(id);
    if (!row) continue;
    const item = toReelItem(row);
    if (item) out.push(item);
  }
  return out;
}
