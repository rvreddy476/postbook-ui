/*
  An empty feed checks again on its own (founder, 21 Oct: "keep Reels and
  long videos open; they should refresh and play fresh videos"). A feed that
  loaded and has nothing to show refetches every 30 s while the tab is
  visible (react-query's refetchIntervalInBackground stays false), and stops
  the moment one item arrives — a feed with items is never reshuffled under
  the viewer.
*/

export const EMPTY_FEED_POLL_MS = 30_000;

interface FeedQueryState {
  state: { status: string; data?: { pages?: ReadonlyArray<{ items?: ReadonlyArray<unknown> | null }> } | undefined };
}

/** refetchInterval for an infinite feed whose pages carry `items`. */
export function pollWhileEmpty(query: FeedQueryState): number | false {
  const { status, data } = query.state;
  if (status !== "success" || !data?.pages) return false;
  const empty = data.pages.every((page) => (page.items?.length ?? 0) === 0);
  return empty ? EMPTY_FEED_POLL_MS : false;
}
