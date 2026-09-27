/*
  Reel-only search: the pure bits. The gap search on the stage sends the
  viewer to /reels/search?q=…, a results page that only ever shows reels
  (search-service `type=flicks`), and every result opens the stage pinned
  on that reel.
*/

export const REEL_SEARCH_PATH = "/reels/search";
export const REEL_SEARCH_LIMIT = 60;

/** Where a query goes; an empty query stays on the stage (null). */
export function reelSearchHref(query: string): string | null {
  const q = query.trim();
  if (!q) return null;
  return `${REEL_SEARCH_PATH}?q=${encodeURIComponent(q)}`;
}

/** Ids from search-service's post results, in rank order, short-form only, deduped. */
export function reelSearchIds(items: ReadonlyArray<{ id?: string; post_id?: string; content_type?: string; post_type?: string }> | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const it of items ?? []) {
    const id = it.id || it.post_id;
    if (!id || seen.has(id)) continue;
    const type = it.content_type || it.post_type || "";
    if (type && !["flick", "reel", "short"].includes(type)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
