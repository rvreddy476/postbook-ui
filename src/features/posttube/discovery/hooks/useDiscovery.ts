"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useLiveStreams } from "@/hooks/useLiveV2";
import { useBatchProfiles } from "@/hooks/useProfile";
import {
  getLiveStreamsPage,
  getPastStreams,
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

/**
 * The Live page's three lists: Live now (useLiveStreams, shared with the
 * live screens), Upcoming (`?status=scheduled`) and Past streams
 * (`GET /v1/posts/live-recordings`), each paged on its own, plus the
 * creators' names for the stream cards. Upcoming and Past failing leave
 * Live now standing: each section reads its own query state.
 */
export function useLiveDiscovery(limit = 24) {
  const streams = useLiveStreams(limit);
  const scheduled = useInfiniteQuery({
    queryKey: [...KEY, "live", "scheduled", limit],
    queryFn: ({ pageParam }) => getLiveStreamsPage({ status: "scheduled", limit, cursor: pageParam || undefined }),
    initialPageParam: "" as string,
    getNextPageParam: (last) => last.next_cursor,
    staleTime: 60 * 1000,
  });
  const past = useInfiniteQuery({
    queryKey: [...KEY, "live", "past"],
    queryFn: ({ pageParam }) => getPastStreams({ limit: 12, cursor: pageParam || undefined }),
    initialPageParam: "" as string,
    getNextPageParam: (last) => last.next_cursor,
    staleTime: 2 * 60 * 1000,
  });
  const liveRows = useMemo(() => streams.data?.pages.flatMap((p) => p.items) ?? [], [streams.data]);
  const upcoming = useMemo(() => (scheduled.data?.pages.flatMap((p) => p.items) ?? []).filter((s) => s.status === "scheduled"), [scheduled.data]);
  const pastVideos = useMemo(() => {
    const seen = new Set<string>();
    return (past.data?.pages.flatMap((p) => p.items) ?? []).filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true)));
  }, [past.data]);
  const { live } = useMemo(() => splitLiveStreams(liveRows), [liveRows]);
  const creatorIds = useMemo(() => Array.from(new Set([...liveRows, ...upcoming].map((s) => s.creator_user_id))), [liveRows, upcoming]);
  const profiles = useBatchProfiles(creatorIds);
  const creatorNames = useMemo(() => {
    const out: Record<string, string> = {};
    const map = profiles.data instanceof Map ? profiles.data : null;
    if (map) for (const [id, p] of map) out[id] = p.display_name || p.username || "";
    return out;
  }, [profiles.data]);
  return { streams, scheduled, past, live, upcoming, pastVideos, creatorNames };
}
