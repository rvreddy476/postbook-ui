"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { upcomingOnly } from "@/features/live/discovery";
import { useLiveCategories, useLiveNow, useUpcomingStreams } from "@/hooks/useLiveV2";
import { LIVE_PAGE_ORIENTATION, splitHero, type LiveFilter } from "../../live/liveModel";
import {
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
 * The Live page's lists, each paged and failing on its own:
 *   Live now      GET /v1/livestream/streams?status=live&orientation=landscape&sort=viewers[&following=true]
 *   Upcoming      GET /v1/livestream/streams/upcoming?orientation=landscape[&following=true]
 *   Topic rails   GET /v1/livestream/categories/live (the rails fetch their own rows)
 *   Past streams  GET /v1/posts/live-recordings (recordings that became videos)
 * The hero is the most-watched live row and is taken out of the grid.
 * Following needs an account: signed out, nothing is requested for it.
 */
export function useLiveDiscovery({ filter, signedIn, limit = 24 }: { filter: LiveFilter; signedIn: boolean; limit?: number }) {
  const following = filter === "following";
  const enabled = !following || signedIn;
  const streams = useLiveNow({ orientation: LIVE_PAGE_ORIENTATION, following, sort: "viewers", limit }, { enabled, refetchMs: 60_000 });
  const scheduled = useUpcomingStreams({ orientation: LIVE_PAGE_ORIENTATION, following, limit: 12 }, { enabled });
  const liveCategories = useLiveCategories(!following);
  const past = useInfiniteQuery({
    queryKey: [...KEY, "live", "past"],
    queryFn: ({ pageParam }) => getPastStreams({ limit: 12, cursor: pageParam || undefined }),
    initialPageParam: "" as string,
    getNextPageParam: (last) => last.next_cursor,
    staleTime: 2 * 60 * 1000,
    enabled: !following,
  });
  const topicsQuery = useTopics();
  const { hero, rest } = useMemo(() => splitHero(streams.data?.pages.flatMap((p) => p.items) ?? []), [streams.data]);
  const upcoming = useMemo(() => upcomingOnly(scheduled.data?.pages.flatMap((p) => p.items) ?? []), [scheduled.data]);
  const pastVideos = useMemo(() => {
    const seen = new Set<string>();
    return (past.data?.pages.flatMap((p) => p.items) ?? []).filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true)));
  }, [past.data]);
  return { streams, scheduled, past, hero, live: rest, upcoming, pastVideos, categories: liveCategories.data ?? [], topics: topicsQuery.data ?? [] };
}
