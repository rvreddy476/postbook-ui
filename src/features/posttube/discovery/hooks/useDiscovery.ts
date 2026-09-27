"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useLiveStreams } from "@/hooks/useLiveV2";
import { useBatchProfiles } from "@/hooks/useProfile";
import {
  getStripFeed,
  getTopicFeed,
  getTopics,
  getTrendingPage,
  searchChannels,
  searchCollections,
  searchVideos,
  tubeTopics,
  type SearchFilters,
  type TopicSort,
} from "../discoveryApi";
import { splitLiveStreams } from "../discoveryModel";

const KEY = ["posttube", "discovery"] as const;

/** `GET /v1/posts/trending?content_type=long_video`, paged by cursor. The period is applied by the page. */
export function useTrendingPage(limit = 24) {
  return useInfiniteQuery({
    queryKey: [...KEY, "trending", limit],
    queryFn: ({ pageParam }) => getTrendingPage({ limit, cursor: pageParam || undefined }),
    initialPageParam: "" as string,
    getNextPageParam: (last) => last.next_cursor,
    staleTime: 5 * 60 * 1000,
  });
}

/** `GET /v1/posts/categories`, narrowed to what a long-video screen shows. */
export function useTopics() {
  const query = useQuery({
    queryKey: [...KEY, "topics"],
    queryFn: getTopics,
    staleTime: 10 * 60 * 1000,
  });
  const topics = useMemo(() => tubeTopics(query.data ?? []), [query.data]);
  return { ...query, topics };
}

/** `GET /v1/feed/videos?category=<slug>&sort=`, paged by cursor. */
export function useTopicFeed(slug: string, sort: TopicSort, limit = 20) {
  return useInfiniteQuery({
    queryKey: [...KEY, "topic", slug, sort, limit],
    queryFn: ({ pageParam }) => getTopicFeed({ slug, sort, limit, cursor: pageParam || undefined }),
    initialPageParam: "" as string,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !!slug,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * The home grid behind the topic strip: the same page shape as
 * usePosttubeHome.useLongVideosFeed, with the strip's Fresh / Seen /
 * New to you sent as `chip=` instead of `category=`.
 */
export function useStripFeed(value: string, limit = 20, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["feed", "longVideos", "strip", value, limit],
    queryFn: ({ pageParam }) => getStripFeed(value, { limit, cursor: pageParam || undefined }),
    initialPageParam: "" as string,
    getNextPageParam: (last) => last.next_cursor,
    staleTime: 2 * 60 * 1000,
    enabled,
  });
}

/**
 * The three search requests, each only when its tab is showing and there
 * is a query. Switching tabs starts the next one; the others keep their
 * cached page so a second switch is instant.
 */
export function useTubeSearch(filters: SearchFilters) {
  const q = filters.q.trim();
  const videos = useQuery({
    queryKey: [...KEY, "search", "videos", q, filters.sort, filters.length, filters.when],
    queryFn: () => searchVideos({ ...filters, q }),
    enabled: !!q && filters.tab === "videos",
    staleTime: 60 * 1000,
  });
  const channels = useQuery({
    queryKey: [...KEY, "search", "channels", q],
    queryFn: () => searchChannels(q),
    enabled: !!q && filters.tab === "channels",
    staleTime: 60 * 1000,
  });
  const collections = useQuery({
    queryKey: [...KEY, "search", "collections", q],
    queryFn: () => searchCollections(q),
    enabled: !!q && filters.tab === "collections",
    staleTime: 60 * 1000,
  });
  return { videos, channels, collections };
}

/** Live now + upcoming from live-service-v2, with the creators' names. */
export function useLiveDiscovery(limit = 24) {
  const streams = useLiveStreams(limit);
  const all = useMemo(() => streams.data?.pages.flatMap((p) => p.items) ?? [], [streams.data]);
  const split = useMemo(() => splitLiveStreams(all), [all]);
  const creatorIds = useMemo(() => Array.from(new Set(all.map((s) => s.creator_user_id))), [all]);
  const profiles = useBatchProfiles(creatorIds);
  const creatorNames = useMemo(() => {
    const out: Record<string, string> = {};
    const map = profiles.data instanceof Map ? profiles.data : null;
    if (map) for (const [id, p] of map) out[id] = p.display_name || p.username || "";
    return out;
  }, [profiles.data]);
  return { streams, ...split, creatorNames };
}
