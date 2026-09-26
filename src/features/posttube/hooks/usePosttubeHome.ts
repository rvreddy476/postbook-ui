"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  getCategories,
  getContinueWatchingVideos,
  getFlicksFeed,
  getLongVideosFeed,
  getRelatedVideos,
  getTrendingVideos,
  getVideosByAuthor,
} from "../data/posttubeApi";
import { CHIP_ALL } from "../model";

/** `GET /v1/posts/categories` → chips. */
export function useVideoCategories() {
  return useQuery({
    queryKey: ["posttube", "categories"],
    queryFn: getCategories,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * The home grid: `GET /v1/feed/videos`, infinite by cursor. The chip is part
 * of the key so "Subscriptions" (`subscribed_only=true`) and each category
 * (`category=<slug>`) keep their own pages.
 */
export function useLongVideosFeed(chip: string = CHIP_ALL, limit = 20, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["feed", "longVideos", chip, limit],
    queryFn: ({ pageParam }) => getLongVideosFeed({ cursor: pageParam || undefined, limit, chip }),
    initialPageParam: "" as string,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    staleTime: 2 * 60 * 1000,
    enabled,
  });
}

/** The reels shelf: `GET /v1/feed/flicks`. */
export function useFlicksFeed(limit = 20, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["feed", "flicks", limit],
    queryFn: ({ pageParam }) => getFlicksFeed({ cursor: pageParam || undefined, limit }),
    initialPageParam: "" as string,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    staleTime: 2 * 60 * 1000,
    enabled,
  });
}

/** `GET /v1/videos/continue-watching` → cards with resume state (completed rows dropped). */
export function useContinueWatchingFeed(limit = 10) {
  return useQuery({
    queryKey: ["feed", "continueWatching", limit],
    queryFn: () => getContinueWatchingVideos(limit),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/** `GET /v1/feed/videos/:id/related` — the "Up next" column. */
export function useRelatedVideos(videoId: string | undefined, limit = 16) {
  return useInfiniteQuery({
    queryKey: ["posttube", "related", videoId, limit],
    queryFn: ({ pageParam }) => getRelatedVideos(videoId!, { cursor: pageParam || undefined, limit }),
    initialPageParam: "" as string,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled: !!videoId,
    staleTime: 2 * 60 * 1000,
  });
}

/** `GET /v1/posts/trending?content_type=long_video`. */
export function useTrendingVideos(limit = 12) {
  return useQuery({
    queryKey: ["posttube", "trending", limit],
    queryFn: () => getTrendingVideos(limit),
    staleTime: 5 * 60 * 1000,
  });
}

/** `GET /v1/posts/by-author/:id?type=long_video` — a channel's videos. */
export function useAuthorVideos(authorId: string | undefined, type = "long_video", limit = 20) {
  return useInfiniteQuery({
    queryKey: ["posttube", "by-author", authorId, type, limit],
    queryFn: ({ pageParam }) => getVideosByAuthor(authorId!, { cursor: pageParam || undefined, limit, type }),
    initialPageParam: "" as string,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled: !!authorId,
    staleTime: 60 * 1000,
  });
}
