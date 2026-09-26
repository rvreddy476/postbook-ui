/*
  The PostTube home is one long-video grid with horizontal shelves woven in,
  the way a video platform's front page reads: two rows of videos, then a
  shelf (Reels), two more rows, then the next shelf (Trending), and so on.

  This is the pure layout rule. The page tells it how many columns the grid
  has right now and which shelves actually have content; it answers with the
  sequence of blocks to render. A shelf with nothing in it is skipped, never
  rendered empty, and a trailing partial chunk gets no shelf after it — a
  shelf sits between rows, not at the end of the page.
*/

export type ShelfKey = "reels" | "trending" | "continue";

/** The rotation: after each two-row chunk, the next shelf in this order. */
export const SHELF_ROTATION: readonly ShelfKey[] = ["reels", "trending", "continue"];

export const ROWS_PER_CHUNK = 2;

export type HomeBlock<T> = { type: "videos"; key: string; items: T[] } | { type: "shelf"; key: string; shelf: ShelfKey };

export function chunkSize(columns: number): number {
  return Math.max(1, Math.floor(columns)) * ROWS_PER_CHUNK;
}

/**
 * Splits `videos` into two-row chunks for a grid of `columns` and inserts
 * the next available shelf after every full chunk. `available` says which
 * shelves have content; unavailable ones are skipped in the rotation so
 * the page never shows a heading with nothing under it.
 */
export function interleaveShelves<T>(videos: readonly T[], columns: number, available: Record<ShelfKey, boolean>, rotation: readonly ShelfKey[] = SHELF_ROTATION): HomeBlock<T>[] {
  const per = chunkSize(columns);
  const usable = rotation.filter((s) => available[s]);
  const blocks: HomeBlock<T>[] = [];
  let shelfIdx = 0;
  for (let i = 0; i < videos.length; i += per) {
    const items = videos.slice(i, i + per);
    blocks.push({ type: "videos", key: `videos-${i}`, items });
    const full = items.length === per;
    if (full && usable.length > 0) {
      const shelf = usable[shelfIdx % usable.length];
      blocks.push({ type: "shelf", key: `shelf-${i}-${shelf}`, shelf });
      shelfIdx += 1;
    }
  }
  return blocks;
}

/** Grid columns for a viewport width; mirrors the Tailwind classes on the grid. */
export function gridColumnsFor(viewportWidth: number): number {
  if (viewportWidth >= 1536) return 4;
  if (viewportWidth >= 1280) return 3;
  if (viewportWidth >= 640) return 2;
  return 1;
}
