"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import api from "@/lib/api";
import { getVideoPost } from "@/features/posttube/data/posttubeApi";
import { useAuthorVideos } from "@/features/posttube/hooks/usePosttubeHome";
import type { PostTubeVideo } from "@/features/posttube/types";

import { isValidHandle, normalizeHandleInput } from "./model";
import type { HandleAvailability, VideoRow } from "./view";

/* ── Handle availability ────────────────────────────────── */

/** `GET /v1/channels/handle-available?handle=` → {available, suggestion}. */
export async function checkHandleAvailable(handle: string): Promise<{ available: boolean; suggestion?: string }> {
  const res = await api.get<{ data: { available: boolean; suggestion?: string } }>("/v1/channels/handle-available", { params: { handle } });
  const d = res.data.data;
  return { available: !!d?.available, suggestion: d?.suggestion || undefined };
}

/**
 * Debounced availability for the handle being typed. `currentHandle` is the
 * saved one: typing it back is "idle", not a lookup. A failed lookup is
 * "idle" too — the server is the authority on Save.
 */
export function useHandleAvailability(handle: string, currentHandle: string): HandleAvailability {
  const normalized = normalizeHandleInput(handle);
  const [debounced, setDebounced] = useState(normalized);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(normalized), 400);
    return () => clearTimeout(t);
  }, [normalized]);

  const same = normalized === normalizeHandleInput(currentHandle);
  const valid = isValidHandle(normalized);
  const q = useQuery({
    queryKey: ["channel-handle-available", debounced],
    queryFn: () => checkHandleAvailable(debounced),
    enabled: valid && !same && debounced === normalized,
    staleTime: 30_000,
    retry: false,
  });

  if (!normalized || same) return { state: "idle" };
  if (!valid) return { state: "invalid" };
  if (debounced !== normalized || q.isPending) return { state: "checking" };
  if (q.isError || !q.data) return { state: "idle" };
  return q.data.available ? { state: "available" } : { state: "taken", suggestion: q.data.suggestion };
}

/* ── Featured video picker ──────────────────────────────── */

export function toVideoRow(v: PostTubeVideo): VideoRow {
  return {
    id: v.id,
    title: v.title || "",
    thumbnail_url: v.thumbnail_url || "",
    duration_seconds: v.duration_seconds || 0,
    published_at: v.published_at || "",
    view_count: v.view_count || 0,
  };
}

/**
 * The caller's long videos for the Featured picker
 * (`GET /v1/posts/by-author/:me?type=long_video`) plus the selected one when
 * it is not in the loaded pages yet.
 */
export function useFeaturedPicker(userId: string | undefined, selectedId: string | null) {
  const videosQuery = useAuthorVideos(userId, "long_video", 30);
  const videos = useMemo(() => (videosQuery.data?.pages.flatMap((p) => p.items) ?? []).map(toVideoRow), [videosQuery.data]);
  const inList = selectedId ? videos.find((v) => v.id === selectedId) ?? null : null;

  const selectedQuery = useQuery({
    queryKey: ["posttube", "video-post", selectedId],
    queryFn: () => getVideoPost(selectedId!),
    enabled: !!selectedId && !inList,
    staleTime: 60_000,
    retry: false,
  });

  const selected: VideoRow | null = inList ?? (selectedQuery.data ? toVideoRow(selectedQuery.data) : null);

  return {
    videos,
    selected,
    loading: videosQuery.isPending || videosQuery.isFetchingNextPage,
    hasMore: !!videosQuery.hasNextPage,
    loadMore: () => void videosQuery.fetchNextPage(),
    error: videosQuery.isError ? "Could not load your videos." : undefined,
  };
}

/* ── Section scroll spy ─────────────────────────────────── */

/** Which of the given section ids is in the reading band of the viewport. */
export function useActiveSection<T extends string>(ids: readonly T[], initial: T): T {
  const [active, setActive] = useState<T>(initial);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top);
          else visible.delete(e.target.id);
        }
        if (!visible.size) return;
        // The topmost visible section wins.
        const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0][0] as T;
        setActive(top);
      },
      { rootMargin: "-15% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return active;
}
