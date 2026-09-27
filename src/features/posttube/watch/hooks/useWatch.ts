"use client";

import { useCallback, useEffect, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { fetchStoryboard, getCollectionPlayback, getUpNext, getWatchDetail } from "../watchApi";
import { DEFAULT_WATCH_PREFS, parseWatchPrefs, WATCH_PREFS_KEY, type WatchPrefs } from "../watchPrefs";
import type { UpNextChip } from "../upNext";

export const WATCH_KEYS = {
  detail: (id?: string) => ["posttube", "watch", "detail", id] as const,
  upNext: (id?: string, chip?: UpNextChip, topic?: string | null) => ["posttube", "watch", "up-next", id, chip, topic ?? null] as const,
  collection: (id?: string) => ["posttube", "watch", "collection", id] as const,
  storyboard: (mediaId?: string) => ["posttube", "watch", "storyboard", mediaId] as const,
};

export function useWatchDetail(videoId: string | undefined) {
  return useQuery({
    queryKey: WATCH_KEYS.detail(videoId),
    queryFn: () => getWatchDetail(videoId!),
    enabled: !!videoId,
    staleTime: 60_000,
  });
}

export function useUpNext(videoId: string | undefined, chip: UpNextChip, topicSlug: string | null, limit = 16) {
  return useInfiniteQuery({
    queryKey: WATCH_KEYS.upNext(videoId, chip, topicSlug),
    queryFn: ({ pageParam }) => getUpNext(videoId!, { chip, topicSlug, cursor: pageParam || undefined, limit }),
    initialPageParam: "" as string,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: !!videoId,
    staleTime: 60_000,
  });
}

export function useCollectionPlayback(listId: string | null | undefined) {
  return useQuery({
    queryKey: WATCH_KEYS.collection(listId ?? undefined),
    queryFn: () => getCollectionPlayback(listId!),
    enabled: !!listId,
    staleTime: 30_000,
  });
}

export function useStoryboard(mediaId: string | null | undefined) {
  return useQuery({
    queryKey: WATCH_KEYS.storyboard(mediaId ?? undefined),
    queryFn: () => fetchStoryboard(mediaId!),
    enabled: !!mediaId,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

/** Ambient / Stable volume / audio language, in localStorage under `posttube_watch_prefs_v1`. */
export function useWatchPrefs() {
  const [prefs, setPrefs] = useState<WatchPrefs>(DEFAULT_WATCH_PREFS);

  useEffect(() => {
    try {
      setPrefs(parseWatchPrefs(window.localStorage.getItem(WATCH_PREFS_KEY)));
    } catch {
      /* private mode */
    }
  }, []);

  const update = useCallback((patch: Partial<WatchPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(WATCH_PREFS_KEY, JSON.stringify(next));
      } catch {
        /* quota */
      }
      return next;
    });
  }, []);

  return { prefs, update };
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

/** ≥1024px: the comments column; below it, the sheet. */
export function useWideLayout(): boolean {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return wide;
}
