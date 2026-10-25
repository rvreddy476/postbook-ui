"use client";

/*
  The search page's calls. Request shapes come from searchModel (tested);
  this file only sends them and reads the answers.
*/

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";
import { fetchPostsBatch } from "@/features/reels/data/reelFeedApi";
import { likedReelsToItems } from "@/features/reels/liked";
import { reelSearchIds } from "@/features/reels/search";
import type { ReelItem, ReelSound } from "@/features/reels/model";
import type { VideoResult } from "@/features/posttube/discovery/discoveryApi";
import {
  HISTORY_PATH,
  POPULAR_LIMIT,
  POPULAR_PATH,
  RECENTS_SHOWN,
  buildTabRequest,
  historyItemPath,
  parseHashtags,
  parseHistory,
  parsePeople,
  parsePopular,
  parseSounds,
  parseTop,
  parseVideos,
  unwrap,
  type HashtagResult,
  type PersonResult,
  type RecentSearch,
  type SearchTabId,
  type TopResults,
} from "./searchModel";

export type TabResults =
  | { tab: "top"; top: TopResults }
  | { tab: "people"; people: PersonResult[] }
  | { tab: "videos"; videos: VideoResult[] }
  | { tab: "reels"; reels: ReelItem[] }
  | { tab: "sounds"; sounds: ReelSound[] }
  | { tab: "hashtags"; hashtags: HashtagResult[] };

/** The two things this file sends through: the API client and the posts batch. Injected in tests. */
export interface SearchHttp {
  get(url: string, config?: { params?: Record<string, string | number>; signal?: AbortSignal }): Promise<{ data: unknown }>;
  delete(url: string): Promise<unknown>;
}

export interface SearchDeps {
  http: SearchHttp;
  batch: (ids: string[], signal?: AbortSignal) => ReturnType<typeof fetchPostsBatch>;
}

const DEFAULT_DEPS: SearchDeps = { http: api, batch: fetchPostsBatch };

export async function fetchTabResults(
  tab: SearchTabId,
  query: string,
  signal?: AbortSignal,
  deps: SearchDeps = DEFAULT_DEPS,
): Promise<TabResults> {
  const req = buildTabRequest(tab, query);
  const res = await deps.http.get(req.path, { params: req.params, signal });
  const data = unwrap(res.data);
  switch (tab) {
    case "top":
      return { tab, top: parseTop(data) };
    case "people":
      return { tab, people: parsePeople(data) };
    case "videos":
      return { tab, videos: parseVideos(data) };
    case "reels": {
      // The search rows carry no playable cover; the batch does (same path
      // as the liked page and /reels/search).
      const ids = reelSearchIds((data as { items?: [] } | null)?.items ?? (Array.isArray(data) ? data : []));
      if (ids.length === 0) return { tab, reels: [] };
      const batch = await deps.batch(ids, signal);
      return { tab, reels: likedReelsToItems(ids, batch) };
    }
    case "sounds":
      return { tab, sounds: parseSounds(data) };
    case "hashtags":
      return { tab, hashtags: parseHashtags(data) };
  }
}

export function useTabResults(tab: SearchTabId, query: string) {
  const q = query.trim();
  return useQuery<TabResults>({
    queryKey: ["search-page", tab, q],
    enabled: q.length > 0,
    staleTime: 60_000,
    retry: 1,
    queryFn: ({ signal }) => fetchTabResults(tab, q, signal),
  });
}

/* ── recents ───────────────────────────────────────────────── */

const RECENTS_KEY = ["search-page", "history"] as const;

export async function fetchRecents(http: SearchHttp = api): Promise<RecentSearch[]> {
  const res = await http.get(HISTORY_PATH, { params: { limit: RECENTS_SHOWN } });
  return parseHistory(unwrap(res.data)).slice(0, RECENTS_SHOWN);
}

/** One entry: DELETE /v1/search/history/:id. Never the bare path, which clears everything. */
export async function deleteRecent(id: string, http: SearchHttp = api): Promise<void> {
  await http.delete(historyItemPath(id));
}

export async function clearRecents(http: SearchHttp = api): Promise<void> {
  await http.delete(HISTORY_PATH);
}

export async function fetchPopular(http: SearchHttp = api): Promise<string[]> {
  const res = await http.get(POPULAR_PATH, { params: { limit: POPULAR_LIMIT } });
  return parsePopular(unwrap(res.data));
}

/** Signed-out viewers have no history: the query never runs for them. */
export function useRecents(signedIn: boolean) {
  return useQuery<RecentSearch[]>({
    queryKey: RECENTS_KEY,
    enabled: signedIn,
    // Searches are recorded server-side after the fact; read fresh each time
    // the empty state comes back.
    staleTime: 0,
    refetchOnMount: "always",
    retry: 1,
    queryFn: () => fetchRecents(),
  });
}

export function useRemoveRecent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRecent(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: RECENTS_KEY });
      const prev = qc.getQueryData<RecentSearch[]>(RECENTS_KEY);
      qc.setQueryData<RecentSearch[]>(RECENTS_KEY, (list) => (list ?? []).filter((r) => r.id !== id));
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(RECENTS_KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: RECENTS_KEY }),
  });
}

export function useClearRecents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => clearRecents(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: RECENTS_KEY });
      const prev = qc.getQueryData<RecentSearch[]>(RECENTS_KEY);
      qc.setQueryData<RecentSearch[]>(RECENTS_KEY, []);
      return { prev };
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(RECENTS_KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: RECENTS_KEY }),
  });
}

export function usePopular() {
  return useQuery<string[]>({
    queryKey: ["search-page", "popular"],
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: () => fetchPopular(),
  });
}
