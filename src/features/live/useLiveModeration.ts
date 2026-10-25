"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { AxiosError } from "axios"

import api from "@/lib/api"
import { liveModerationPaths as paths, parseMuteList, parsePinned, parseWordFilters } from "./moderation"
import type { LivePinned } from "./chat"

// Hooks over the chat moderation routes live-service-v2 already serves
// (features/live/moderation.ts lists them). The room's ChatState holds the
// mute list and the pin; these hooks seed it and act.

export const liveModerationKeys = {
  mutes: (id: string) => ["liveV2", "mutes", id] as const,
  wordFilters: (id: string) => ["liveV2", "wordFilters", id] as const,
  pinned: (id: string) => ["liveV2", "pinned", id] as const,
}

/** GET /chat/mutes: host and moderators only. */
export function useStreamMutes(streamId: string, enabled: boolean) {
  return useQuery<string[]>({
    queryKey: liveModerationKeys.mutes(streamId),
    queryFn: async () => parseMuteList((await api.get(paths.mutes(streamId))).data),
    enabled: !!streamId && enabled,
    staleTime: 30_000,
    retry: false,
  })
}

export function useMuteUser(streamId: string) {
  const qc = useQueryClient()
  return useMutation<void, AxiosError, string>({
    mutationFn: async (userId) => {
      await api.post(paths.mute(streamId), { user_id: userId })
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: liveModerationKeys.mutes(streamId) }),
  })
}

export function useUnmuteUser(streamId: string) {
  const qc = useQueryClient()
  return useMutation<void, AxiosError, string>({
    mutationFn: async (userId) => {
      await api.delete(paths.unmute(streamId, userId))
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: liveModerationKeys.mutes(streamId) }),
  })
}

/** GET /chat/word-filters: the host only. */
export function useWordFilters(streamId: string, enabled: boolean) {
  return useQuery<string[]>({
    queryKey: liveModerationKeys.wordFilters(streamId),
    queryFn: async () => parseWordFilters((await api.get(paths.wordFilters(streamId))).data),
    enabled: !!streamId && enabled,
    staleTime: 60_000,
    retry: false,
  })
}

export function useAddWordFilter(streamId: string) {
  const qc = useQueryClient()
  return useMutation<void, AxiosError, string>({
    mutationFn: async (word) => {
      await api.post(paths.wordFilters(streamId), { word })
    },
    onSuccess: (_void, word) => {
      qc.setQueryData<string[]>(liveModerationKeys.wordFilters(streamId), (prev) =>
        Array.from(new Set([...(prev ?? []), word])).sort((a, b) => a.localeCompare(b)))
      void qc.invalidateQueries({ queryKey: liveModerationKeys.wordFilters(streamId) })
    },
  })
}

export function useRemoveWordFilter(streamId: string) {
  const qc = useQueryClient()
  return useMutation<void, AxiosError, string>({
    mutationFn: async (word) => {
      await api.delete(paths.wordFilter(streamId, word))
    },
    onSuccess: (_void, word) => {
      qc.setQueryData<string[]>(liveModerationKeys.wordFilters(streamId), (prev) => (prev ?? []).filter((w) => w !== word))
      void qc.invalidateQueries({ queryKey: liveModerationKeys.wordFilters(streamId) })
    },
  })
}

/** GET /chat/pinned: anyone who can see the stream. */
export function usePinnedMessage(streamId: string, enabled = true) {
  return useQuery<LivePinned | null>({
    queryKey: liveModerationKeys.pinned(streamId),
    queryFn: async () => parsePinned((await api.get(paths.pinned(streamId))).data),
    enabled: !!streamId && enabled,
    staleTime: 60_000,
    retry: false,
  })
}

export function usePinMessage(streamId: string) {
  return useMutation<void, AxiosError, string>({
    mutationFn: async (messageId) => {
      await api.post(paths.pin(streamId), { message_id: messageId })
    },
  })
}

export function useUnpinMessage(streamId: string) {
  return useMutation<void, AxiosError, string>({
    mutationFn: async (messageId) => {
      await api.delete(paths.pin(streamId), { params: { message_id: messageId } })
    },
  })
}
