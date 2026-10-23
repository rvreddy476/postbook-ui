"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { getAppearanceRows, getAppearances, getCreditRequests, getGenres } from "./creditsApi";

export const CREDITS_KEYS = {
  genres: ["posttube", "credits", "genres"] as const,
  requests: ["posttube", "credits", "requests"] as const,
  appearances: (userId: string) => ["posttube", "credits", "appearances", userId] as const,
  appearanceRows: (userId: string) => ["posttube", "credits", "appearances", userId, "rows"] as const,
};

/** The genre list changes with a deploy, not a session. */
export function useGenres(enabled = true) {
  return useQuery({
    queryKey: CREDITS_KEYS.genres,
    queryFn: getGenres,
    enabled,
    staleTime: 60 * 60_000,
    retry: 1,
  });
}

export function useCreditRequests(enabled = true) {
  return useInfiniteQuery({
    queryKey: CREDITS_KEYS.requests,
    queryFn: ({ pageParam }) => getCreditRequests(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled,
    staleTime: 15_000,
  });
}

/** A user's accepted appearances as PostTube cards (the channel's Appears in tab). */
export function useAppearances(userId: string | undefined, enabled = true) {
  return useInfiniteQuery({
    queryKey: CREDITS_KEYS.appearances(userId ?? ""),
    queryFn: ({ pageParam }) => getAppearances(userId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!userId && enabled,
    staleTime: 60_000,
    retry: 1,
  });
}

/** The same list as post rows (the profile's Appears in tab, which draws posts). */
export function useAppearanceRows(userId: string | undefined, enabled = true) {
  return useInfiniteQuery({
    queryKey: CREDITS_KEYS.appearanceRows(userId ?? ""),
    queryFn: ({ pageParam }) => getAppearanceRows(userId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!userId && enabled,
    staleTime: 60_000,
    retry: 1,
  });
}
