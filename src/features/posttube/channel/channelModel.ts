import type { ChannelCounts, ChannelLinkView } from "./channelApi";

/*
  The channel page's pure rules: which tabs a viewer sees, which one the
  URL lands on, the Latest / Popular order, the in-channel search, the
  "+N more" split of the links and the masthead's meta line. No React, no
  requests; the tests pin them.
*/

export type ChannelTab = "videos" | "shorts" | "live" | "collections" | "posts";
export const CHANNEL_TABS: readonly ChannelTab[] = ["videos", "shorts", "live", "collections", "posts"];

export const TAB_LABELS: Record<ChannelTab, string> = {
  videos: "Videos",
  shorts: "Shorts",
  live: "Live",
  collections: "Collections",
  posts: "Posts",
};

/** The count the channel response carries for a tab; Posts has none. */
export function tabCount(tab: ChannelTab, counts: ChannelCounts): number | undefined {
  switch (tab) {
    case "videos":
      return counts.videos;
    case "shorts":
      return counts.shorts;
    case "live":
      return counts.live;
    case "collections":
      return counts.collections;
    default:
      return undefined;
  }
}

/**
 * The owner sees every tab. A visitor does not see a tab the channel says
 * is empty (count exactly 0); a tab whose count the response did not carry
 * (older rows, Posts) stays, and its empty state answers.
 */
export function visibleTabs(counts: ChannelCounts, isOwner: boolean): ChannelTab[] {
  if (isOwner) return [...CHANNEL_TABS];
  return CHANNEL_TABS.filter((t) => tabCount(t, counts) !== 0);
}

/** `?tab=` when it names a visible tab, else the first visible one. */
export function resolveTab(requested: string | null | undefined, visible: readonly ChannelTab[]): ChannelTab | null {
  const want = (requested ?? "").toLowerCase();
  const hit = visible.find((t) => t === want);
  return hit ?? visible[0] ?? null;
}

export type VideoSort = "latest" | "popular";

/**
 * Popular: post-service `GET /v1/posts/by-author/:id` has no sort
 * parameter, so the pages already loaded are ordered by view_count here
 * (ties keep the server's newest-first order). Latest is the server order.
 */
export function sortVideos<T extends { view_count: number }>(items: readonly T[], sort: VideoSort): T[] {
  if (sort === "latest") return [...items];
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => (b.item.view_count ?? 0) - (a.item.view_count ?? 0) || a.i - b.i)
    .map((x) => x.item);
}

/** Live: long videos that came from a stream (post-service `source = "live"`). */
export function liveOnly<T extends { source?: string }>(items: readonly T[]): T[] {
  return items.filter((v) => v.source === "live");
}

/**
 * The in-channel search: a case-insensitive match on the rows this tab has
 * already loaded, on the client. It does not search the server, so older
 * pages not yet loaded are not searched until "Load more" brings them in.
 */
export function filterByText<T>(items: readonly T[], query: string, pick: (item: T) => string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter((item) => pick(item).toLowerCase().includes(q));
}

/** The first `visible` links as pills; the rest behind "+N more". */
export function splitLinks(links: readonly ChannelLinkView[], visible = 2): { shown: ChannelLinkView[]; more: number } {
  const shown = links.slice(0, visible);
  return { shown, more: Math.max(0, links.length - shown.length) };
}

export function plural(n: number, one: string, many: string, format: (n: number) => string = String): string {
  return `${format(n)} ${n === 1 ? one : many}`;
}

/** Descriptions longer than this, or with a line break, get the "more" toggle. */
export function aboutNeedsToggle(about: string): boolean {
  return about.length > 140 || about.includes("\n");
}

export function tabHref(pathname: string, tab: ChannelTab): string {
  return `${pathname}?tab=${tab}`;
}
