"use client"

import axios from "axios"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { BroadcastChannel, ChannelUpdate, ChannelMember } from "@/types/channels"

interface ChannelsResponse { data: BroadcastChannel[] }
interface ChannelResponse { data: BroadcastChannel }
interface UpdatesResponse { data: ChannelUpdate[] }
interface UpdateResponse { data: ChannelUpdate }
interface MembersResponse { data: ChannelMember[] }

// === QUERIES ===

export function useMyBroadcastChannels() {
  return useQuery({
    queryKey: ["my-broadcast-channels"],
    queryFn: async () => {
      const res = await api.get<ChannelsResponse>("/v1/broadcast-channels/my")
      return res.data.data
    },
  })
}

export function useDiscoverChannels(limit = 20) {
  return useQuery({
    queryKey: ["discover-channels", limit],
    queryFn: async () => {
      const res = await api.get<ChannelsResponse>("/v1/broadcast-channels/discover", { params: { limit } })
      return res.data.data
    },
  })
}

export function useBroadcastChannel(channelId: string | undefined) {
  return useQuery({
    queryKey: ["broadcast-channel", channelId],
    queryFn: async () => {
      const res = await api.get<ChannelResponse>(`/v1/broadcast-channels/${channelId}`)
      return res.data.data
    },
    enabled: !!channelId,
    staleTime: 60_000,
  })
}

export function useChannelUpdates(channelId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ["channel-updates", channelId, limit],
    queryFn: async () => {
      const res = await api.get<UpdatesResponse>(`/v1/broadcast-channels/${channelId}/updates`, { params: { limit } })
      return res.data.data
    },
    enabled: !!channelId,
    refetchInterval: 15_000, // Poll every 15s for new updates
    refetchOnWindowFocus: true,
  })
}

export function useMyBroadcasts() {
  return useQuery({
    queryKey: ["my-broadcasts"],
    queryFn: async () => {
      const res = await api.get<ChannelsResponse>("/v1/broadcast-channels/my")
      return res.data.data
    },
  })
}

export function useChannelSubscribers(channelId: string | undefined) {
  return useQuery({
    queryKey: ["channel-subscribers", channelId],
    queryFn: async () => {
      const res = await api.get<MembersResponse>(`/v1/broadcast-channels/${channelId}/subscribers`)
      return res.data.data
    },
    enabled: !!channelId,
  })
}

/**
 * The channel's owner and admins, owner first.
 *
 * A separate call from useChannelSubscribers on purpose: /subscribers is a
 * page of everybody, so on a large channel the people who run it are not
 * necessarily in it, and the owner is not guaranteed to hold a subscriber
 * row at all. /admins answers the question directly, and channel-service
 * already returns owner-then-admins ordered by join date.
 */
export function useChannelAdmins(channelId: string | undefined) {
  return useQuery({
    queryKey: ["channel-admins", channelId],
    queryFn: async () => {
      const res = await api.get<MembersResponse>(`/v1/broadcast-channels/${channelId}/admins`)
      return res.data.data
    },
    enabled: !!channelId,
    staleTime: 60_000,
  })
}

export function useCheckHandleAvailability(handle: string) {
  return useQuery({
    queryKey: ["channel-handle-check", handle],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: { available: boolean } }>(`/v1/broadcast-channels/check-handle`, { params: { handle } })
        return res.data.data.available
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return null
        }
        throw error
      }
    },
    enabled: handle.length >= 3,
    staleTime: 10_000,
  })
}

// === MUTATIONS ===

export function useCreateBroadcastChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      name: string
      handle: string
      description: string
      /**
       * Omit it and the server chooses. Under the invite-only pilot that is
       * private, and any publicly visible type is refused outright -- so a
       * caller that asks for public is asking for a 403.
       */
      channel_type?: string
      comment_mode?: string
      paid_access?: boolean
      subscription_price_cents?: number
      category?: string
      language?: string
      reaction_mode?: string
      forward_allowed?: boolean
      avatar_media_id?: string
      banner_media_id?: string
    }) => {
      const res = await api.post<ChannelResponse>("/v1/broadcast-channels", payload)
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-broadcast-channels"] })
      qc.invalidateQueries({ queryKey: ["my-broadcasts"] })
      qc.invalidateQueries({ queryKey: ["discover-channels"] })
    },
  })
}

export function useUpdateBroadcastChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, ...payload }: {
      channelId: string
      name?: string
      description?: string
      channel_type?: string
      category?: string
      language?: string
      comment_mode?: string
      reaction_mode?: string
      forward_allowed?: boolean
      paid_access?: boolean
      subscription_price_cents?: number
      avatar_media_id?: string
      banner_media_id?: string
    }) => {
      const res = await api.put<ChannelResponse>(`/v1/broadcast-channels/${channelId}`, payload)
      return res.data.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["broadcast-channel", vars.channelId] })
      qc.invalidateQueries({ queryKey: ["my-broadcast-channels"] })
      qc.invalidateQueries({ queryKey: ["my-broadcasts"] })
      qc.invalidateQueries({ queryKey: ["discover-channels"] })
    },
  })
}

export function useDeleteBroadcastChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (channelId: string) => {
      await api.delete(`/v1/broadcast-channels/${channelId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-broadcast-channels"] })
      qc.invalidateQueries({ queryKey: ["discover-channels"] })
    },
  })
}

/**
 * React to an update with an emoji, or change the one you reacted with.
 *
 * A viewer has at most ONE reaction per update: the server replaces it
 * rather than adding a second. It answers with the decorated update, so
 * `reactions` and `viewer_reaction` come back correct.
 */
export function useReactToUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, updateId, emoji }: { channelId: string; updateId: string; emoji: string }) => {
      const res = await api.put<UpdateResponse>(
        `/v1/broadcast-channels/${channelId}/updates/${updateId}/reaction`,
        { emoji },
      )
      return res.data.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["channel-updates", vars.channelId] })
    },
  })
}

export function useUnreactToUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, updateId }: { channelId: string; updateId: string }) => {
      await api.delete(`/v1/broadcast-channels/${channelId}/updates/${updateId}/reaction`)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["channel-updates", vars.channelId] })
    },
  })
}

/**
 * Mute or unmute a channel for the signed-in viewer.
 *
 * A subscriber's own setting, not the channel's: it changes their member row
 * and nobody else's. Separate from unsubscribing on purpose — "stop pinging
 * me" and "I am no longer part of this" are different intentions, and
 * collapsing them makes the quiet option cost the membership.
 */
export function useSetChannelMuted() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, muted }: { channelId: string; muted: boolean }) => {
      if (muted) await api.put(`/v1/broadcast-channels/${channelId}/subscribe/mute`, {})
      else await api.delete(`/v1/broadcast-channels/${channelId}/subscribe/mute`)
      return muted
    },
    onSuccess: (_, { channelId }) => {
      qc.invalidateQueries({ queryKey: ["broadcast-channel", channelId] })
    },
  })
}

export function useSubscribeChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (channelId: string) => {
      await api.post(`/v1/broadcast-channels/${channelId}/subscribe`)
    },
    onSuccess: (_, channelId) => {
      qc.invalidateQueries({ queryKey: ["broadcast-channel", channelId] })
      qc.invalidateQueries({ queryKey: ["my-broadcast-channels"] })
      qc.invalidateQueries({ queryKey: ["discover-channels"] })
    },
  })
}

export function useUnsubscribeChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (channelId: string) => {
      await api.delete(`/v1/broadcast-channels/${channelId}/subscribe`)
    },
    onSuccess: (_, channelId) => {
      qc.invalidateQueries({ queryKey: ["broadcast-channel", channelId] })
      qc.invalidateQueries({ queryKey: ["my-broadcast-channels"] })
      qc.invalidateQueries({ queryKey: ["discover-channels"] })
    },
  })
}

export function useCreateChannelUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, ...payload }: {
      channelId: string
      update_type: string
      title?: string
      body: string
      media_ids?: string[]
      is_urgent?: boolean
      is_pinned?: boolean
      metadata?: Record<string, unknown>
      scheduled_at?: string
    }) => {
      const res = await api.post<UpdateResponse>(`/v1/broadcast-channels/${channelId}/updates`, payload)
      return res.data.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["channel-updates", vars.channelId] })
      qc.invalidateQueries({ queryKey: ["broadcast-channel", vars.channelId] })
    },
  })
}

export function useDeleteChannelUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, updateId }: { channelId: string; updateId: string }) => {
      await api.delete(`/v1/broadcast-channels/${channelId}/updates/${updateId}`)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["channel-updates", vars.channelId] })
    },
  })
}

export function usePinChannelUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, updateId, pinned }: { channelId: string; updateId: string; pinned: boolean }) => {
      await api.put(`/v1/broadcast-channels/${channelId}/updates/${updateId}/pin`, { pinned })
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["channel-updates", vars.channelId] })
    },
  })
}

// === ENGAGEMENT MUTATIONS ===

export function useSparkUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, updateId, isSupernova }: { channelId: string; updateId: string; isSupernova?: boolean }) => {
      await api.post(`/v1/broadcast-channels/${channelId}/updates/${updateId}/spark`, { is_supernova: isSupernova || false })
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["channel-updates", vars.channelId] })
    },
    retry: false,
  })
}

export function useUnsparkUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, updateId }: { channelId: string; updateId: string }) => {
      await api.delete(`/v1/broadcast-channels/${channelId}/updates/${updateId}/spark`)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["channel-updates", vars.channelId] })
    },
    retry: false,
  })
}

export function useStashUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, updateId }: { channelId: string; updateId: string }) => {
      await api.post(`/v1/broadcast-channels/${channelId}/updates/${updateId}/stash`)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["channel-updates", vars.channelId] })
    },
  })
}

export function useUnstashUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, updateId }: { channelId: string; updateId: string }) => {
      await api.delete(`/v1/broadcast-channels/${channelId}/updates/${updateId}/stash`)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["channel-updates", vars.channelId] })
    },
  })
}

export function useEchoUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, updateId, echoType }: { channelId: string; updateId: string; echoType?: string }) => {
      await api.post(`/v1/broadcast-channels/${channelId}/updates/${updateId}/echo`, { echo_type: echoType || 'feed' })
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["channel-updates", vars.channelId] })
    },
  })
}

export function useUnechoUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, updateId }: { channelId: string; updateId: string }) => {
      await api.delete(`/v1/broadcast-channels/${channelId}/updates/${updateId}/echo`)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["channel-updates", vars.channelId] })
    },
  })
}

export function useRecordView() {
  return useMutation({
    mutationFn: async ({ channelId, updateId }: { channelId: string; updateId: string }) => {
      await api.post(`/v1/broadcast-channels/${channelId}/updates/${updateId}/view`)
    },
    retry: false, // fire-and-forget, no retries
  })
}

export function useChannelComments(channelId: string | undefined, updateId: string | undefined) {
  return useQuery({
    queryKey: ["channel-comments", channelId, updateId],
    queryFn: async () => {
      const res = await api.get(`/v1/broadcast-channels/${channelId}/updates/${updateId}/comments`)
      return res.data.data
    },
    enabled: !!channelId && !!updateId,
  })
}

export function useAddComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, updateId, body, parentId }: { channelId: string; updateId: string; body: string; parentId?: string }) => {
      const res = await api.post(`/v1/broadcast-channels/${channelId}/updates/${updateId}/comments`, { body, parent_id: parentId || undefined })
      return res.data.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["channel-comments", vars.channelId, vars.updateId] })
      qc.invalidateQueries({ queryKey: ["channel-updates", vars.channelId] })
    },
  })
}

export function useDeleteComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, updateId, commentId }: { channelId: string; updateId: string; commentId: string }) => {
      await api.delete(`/v1/broadcast-channels/${channelId}/updates/${updateId}/comments/${commentId}`)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["channel-comments", vars.channelId, vars.updateId] })
      qc.invalidateQueries({ queryKey: ["channel-updates", vars.channelId] })
    },
  })
}

// === POLLS ===
//
// channel-service owns poll votes in its own `poll_votes` table and serves
// real per-option counts. Both routes are under the `/v1/broadcast-channels`
// prefix, which the api-gateway routes to channel-service:8106:
//   POST /v1/broadcast-channels/:channelId/updates/:updateId/vote
//        body { option_indexes: number[] }
//   GET  /v1/broadcast-channels/:channelId/updates/:updateId/results
//        → { results: [{ option_index, vote_count }], user_voted }
//
// Options that nobody has voted for are absent from `results` (the query is a
// GROUP BY over cast votes), so a consumer must default a missing index to 0.

export interface PollOptionResult {
  option_index: number
  vote_count: number
}

export interface PollResults {
  results: PollOptionResult[]
  user_voted: boolean
}

export function usePollResults(
  channelId: string | undefined,
  updateId: string | undefined,
  enabled = true,
) {
  return useQuery<PollResults>({
    queryKey: ["channel-poll-results", channelId, updateId],
    queryFn: async () => {
      const res = await api.get<{ data: PollResults }>(
        `/v1/broadcast-channels/${channelId}/updates/${updateId}/results`,
      )
      return {
        results: res.data.data?.results ?? [],
        user_voted: !!res.data.data?.user_voted,
      }
    },
    enabled: !!channelId && !!updateId && enabled,
  })
}

export function useVoteOnPoll() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      channelId,
      updateId,
      optionIndexes,
    }: {
      channelId: string
      updateId: string
      optionIndexes: number[]
    }) => {
      await api.post(
        `/v1/broadcast-channels/${channelId}/updates/${updateId}/vote`,
        { option_indexes: optionIndexes },
      )
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ["channel-poll-results", vars.channelId, vars.updateId],
      })
    },
  })
}
