"use client";

import { useInfiniteQuery, type InfiniteData, type QueryClient } from "@tanstack/react-query";

import { fetchReelsPage, REEL_PAGE_SIZE, type ReelPage } from "@/features/reels/data/reelFeedApi";
import type { ReelItem } from "@/features/reels/model";

export const REEL_FEED_KEY = ["reels", "feed"] as const;

export function reelFeedKey(following: boolean) {
  return [...REEL_FEED_KEY, { following }] as const;
}

export function useReelFeed(following: boolean) {
  return useInfiniteQuery({
    queryKey: reelFeedKey(following),
    queryFn: ({ pageParam, signal }) =>
      fetchReelsPage({ cursor: pageParam, following, limit: REEL_PAGE_SIZE, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
}

/* ── cache patching (pure over the cached shape) ───────────── */

export type ReelPatch = Partial<ReelItem> | ((item: ReelItem) => Partial<ReelItem>);

export function applyReelPatch(
  data: InfiniteData<ReelPage> | undefined,
  reelId: string,
  patch: ReelPatch,
): InfiniteData<ReelPage> | undefined {
  if (!data) return data;
  let touched = false;
  const pages = data.pages.map((page) => {
    const items = page.items.map((item) => {
      if (item.id !== reelId) return item;
      touched = true;
      const delta = typeof patch === "function" ? patch(item) : patch;
      return { ...item, ...delta };
    });
    return touched ? { ...page, items } : page;
  });
  return touched ? { ...data, pages } : data;
}

export function removeReel(
  data: InfiniteData<ReelPage> | undefined,
  reelId: string,
): InfiniteData<ReelPage> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item.id !== reelId),
    })),
  };
}

/** Patches a reel in every reels feed variant (for you + following). */
export function patchReelEverywhere(qc: QueryClient, reelId: string, patch: ReelPatch) {
  qc.setQueriesData<InfiniteData<ReelPage>>({ queryKey: REEL_FEED_KEY }, (old) =>
    applyReelPatch(old, reelId, patch),
  );
}

export function removeReelEverywhere(qc: QueryClient, reelId: string) {
  qc.setQueriesData<InfiniteData<ReelPage>>({ queryKey: REEL_FEED_KEY }, (old) =>
    removeReel(old, reelId),
  );
}
