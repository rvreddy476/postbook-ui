"use client";

import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";

import {
  fetchSound,
  fetchSoundList,
  fetchSoundReels,
  resolveReelSound,
  soundSearchTerm,
  SOUND_REELS_PAGE_SIZE,
  type SoundListKind,
} from "@/features/reels/data/soundsApi";

export const SOUND_KEY = ["reels", "sound"] as const;

export function soundReelsKey(soundId: string) {
  return [...SOUND_KEY, "reels", soundId] as const;
}

/**
 * The reels that play a sound, a page at a time. A page of null means the
 * sound is missing or may not be heard; there is nothing after it.
 */
export function useSoundReels(soundId: string) {
  return useInfiniteQuery({
    queryKey: soundReelsKey(soundId),
    queryFn: ({ pageParam, signal }) => fetchSoundReels({ soundId, cursor: pageParam, limit: SOUND_REELS_PAGE_SIZE, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last?.nextCursor,
    enabled: Boolean(soundId),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
}

/** One sound by id (the studio's preselected sound). data is null when it cannot be used. */
export function useSoundInfo(soundId: string | null | undefined) {
  return useQuery({
    queryKey: [...SOUND_KEY, "info", soundId ?? ""],
    queryFn: ({ signal }) => fetchSound(soundId!, signal),
    enabled: Boolean(soundId),
    staleTime: 60_000,
    retry: false,
  });
}

/** "Use this sound" on a reel: the sound it plays, made from its own audio on first use. */
export function useUseSound() {
  return useMutation({ mutationFn: (postId: string) => resolveReelSound(postId) });
}

/**
 * Trending sounds, or the sounds matching a search term, a page at a time
 * (the studio's sound picker). A search under two characters asks nothing.
 */
export function useSoundList(kind: SoundListKind, query: string | null = null) {
  const q = kind === "search" ? soundSearchTerm(query) : null;
  return useInfiniteQuery({
    queryKey: [...SOUND_KEY, "list", kind, q ?? ""],
    queryFn: ({ pageParam, signal }) => fetchSoundList(kind, { q, offset: pageParam, signal }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset,
    enabled: kind === "trending" || q !== null,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    retry: false,
  });
}
