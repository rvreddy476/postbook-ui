import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import {
  getHomeFeed,
  getFlicksFeed,
  getLongVideosFeed,
  getContinueWatchingVideos,
} from "../data/posttubeApi";

/**
 * Single API call on mount — fetches all videos (longVideos + flicks) from /v1/feed/home.
 * Backend classifies and splits; frontend only renders.
 */
export function useHomeFeed(limit = 30) {
  return useQuery({
    queryKey: ["feed", "home"],
    queryFn: () => getHomeFeed({ limit }),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Infinite query for flicks — disabled by default, only fires when user clicks "Load more".
 */
export function useFlicksFeed(limit = 20, enabled = false) {
  return useInfiniteQuery({
    queryKey: ["feed", "flicks"],
    queryFn: ({ pageParam }) => getFlicksFeed({ cursor: pageParam, limit }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    staleTime: 2 * 60 * 1000,
    enabled,
  });
}

/**
 * Infinite query for long videos — disabled by default, only fires when user clicks "Load more".
 */
export function useLongVideosFeed(limit = 20, enabled = false) {
  return useInfiniteQuery({
    queryKey: ["feed", "longVideos"],
    queryFn: ({ pageParam }) => getLongVideosFeed({ cursor: pageParam, limit }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    staleTime: 2 * 60 * 1000,
    enabled,
  });
}

export function useContinueWatchingFeed(limit = 10) {
  return useQuery({
    queryKey: ["feed", "continueWatching", limit],
    queryFn: () => getContinueWatchingVideos(limit),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
