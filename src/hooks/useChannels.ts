"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { Channel, ChannelDetail } from "@/types/profile"

interface ChannelsResponse { data: Channel[] }
interface ChannelDetailResponse { data: ChannelDetail }
interface ChannelResponse { data: Channel }

// === QUERIES ===

export function useMyChannels() {
    return useQuery({
        queryKey: ["my-channels"],
        queryFn: async () => {
            const res = await api.get<ChannelsResponse>("/v1/users/me/channels")
            return res.data.data
        },
    })
}

export function useUserChannels(userId: string | undefined) {
    return useQuery({
        queryKey: ["user-channels", userId],
        queryFn: async () => {
            const res = await api.get<ChannelsResponse>(`/v1/users/${userId}/channels`)
            return res.data.data
        },
        enabled: !!userId,
        staleTime: 60_000,
    })
}

export function useChannel(handle: string | undefined) {
    return useQuery({
        queryKey: ["channel", handle],
        queryFn: async () => {
            const res = await api.get<ChannelDetailResponse>(`/v1/channels/${handle}`)
            return res.data.data
        },
        enabled: !!handle,
        staleTime: 60_000,
    })
}

// === MUTATIONS ===

export function useCreateChannel() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (payload: {
            handle: string
            name: string
            description?: string
            category?: string
            avatar_media_id?: string
            banner_media_id?: string
        }) => {
            const res = await api.post<ChannelResponse>("/v1/users/me/channels", payload)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["my-channels"] })
        },
    })
}

export function useUpdateChannel() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, ...payload }: {
            id: string
            handle?: string
            name?: string
            description?: string
            category?: string
            avatar_media_id?: string
            banner_media_id?: string
        }) => {
            const res = await api.patch<ChannelResponse>(`/v1/channels/${id}`, payload)
            return res.data.data
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["my-channels"] })
            qc.invalidateQueries({ queryKey: ["channel", data.handle] })
        },
    })
}

export function useDeleteChannel() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/v1/channels/${id}`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["my-channels"] })
        },
    })
}
