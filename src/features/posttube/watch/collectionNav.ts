/*
  Playing through a collection (`?list=<playlistId>`): the order is the
  collection's, prev/next wrap at the ends, and a video that is not in
  the list (opened by a stale link) has no prev and starts the list from
  its first item. Pure.
*/

export interface CollectionNeighbours {
  /** -1 when the current video is not in the list. */
  index: number;
  prev: string | null;
  next: string | null;
  count: number;
}

export function collectionNeighbours(ids: readonly string[], currentId: string): CollectionNeighbours {
  const list = ids.filter((id, i) => typeof id === "string" && id.length > 0 && ids.indexOf(id) === i);
  const count = list.length;
  const index = list.indexOf(currentId);
  if (count === 0) return { index: -1, prev: null, next: null, count: 0 };
  if (index === -1) return { index: -1, prev: null, next: list[0], count };
  if (count === 1) return { index, prev: null, next: null, count };
  return {
    index,
    prev: list[(index - 1 + count) % count],
    next: list[(index + 1) % count],
    count,
  };
}

/** `/posttube/watch/<id>?list=<listId>` — the href that keeps the collection in play. */
export function collectionWatchHref(postId: string, listId: string | null | undefined): string {
  const base = `/posttube/watch/${encodeURIComponent(postId)}`;
  return listId ? `${base}?list=${encodeURIComponent(listId)}` : base;
}
