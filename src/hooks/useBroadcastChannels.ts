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
      channel_type: string
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

export function useSubscribeChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (channelId: string) => {
      await api.post(`/v1/broadcast-channels/${channelId}/subscribe`)
    },
    onSuccess: (_, channelId) => {
      qc.invalidateQueries({ queryKey: ["broadcast-channel", channelId] })
      qc.invalidateQueries({ queryKey: ["my-broadcast-channels"] })
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
