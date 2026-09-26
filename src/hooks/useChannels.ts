"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { Channel, ChannelDetail } from "@/types/profile"
import {
    getChannel,
    getChannelSubscription,
    getMyChannel,
    invalidateAuthorCache,
    setChannelNotify,
    subscribeChannel,
    unsubscribeChannel,
    type ChannelInfo,
    type ChannelSubscriptionState as RefSubscriptionState,
} from "@/features/posttube/data/posttubeApi"

interface ChannelsResponse { data: Channel[] }
interface ChannelDetailResponse { data: ChannelDetail }
interface ChannelResponse { data: Channel }
interface ChannelSubscriptionState {
    subscribed: boolean
    subscription?: {
        channel_id: string
        user_id: string
        notify_on: string
        subscribed_at: string
    }
}
interface ChannelSubscriptionResponse { data: ChannelSubscriptionState }

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

export function useChannelSubscription(channelId: string | undefined) {
    return useQuery({
        queryKey: ["channel-subscription", channelId],
        queryFn: async () => {
            const res = await api.get<ChannelSubscriptionResponse>(`/v1/channels/${channelId}/subscription`)
            return res.data.data
        },
        enabled: !!channelId,
        staleTime: 30_000,
        retry: false,
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

export function useToggleChannelSubscription() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ channelId, subscribe }: { channelId: string; subscribe: boolean }) => {
            if (subscribe) {
                await api.post(`/v1/channels/${channelId}/subscribe`, { notify_on: "all" })
            } else {
                await api.delete(`/v1/channels/${channelId}/subscribe`)
            }
            return { channelId, subscribed: subscribe }
        },
        onSuccess: ({ channelId, subscribed }) => {
            qc.setQueryData<ChannelSubscriptionState | undefined>(
                ["channel-subscription", channelId],
                (current) => ({ ...(current ?? {}), subscribed })
            )
            qc.invalidateQueries({ queryKey: ["channel-subscription", channelId] })
            qc.invalidateQueries({ queryKey: ["user-channels"] })
            qc.invalidateQueries({ queryKey: ["my-channels"] })
            qc.invalidateQueries({ queryKey: ["channel"] })
        },
    })
}

// === PostTube: ref-based channel + subscription (handle or user id) ===


export type { ChannelInfo }

export const CHANNEL_REF_KEYS = {
    channel: (ref?: string) => ["channel-ref", ref] as const,
    subscription: (ref?: string) => ["channel-ref-subscription", ref] as const,
    mine: ["channel-ref", "me"] as const,
}

/** `GET /v1/channels/:ref` — `subscriber_count`, `is_subscribed?`, `notify_on?`. 404 → null. */
export function useChannelByRef(ref: string | undefined) {
    return useQuery({
        queryKey: CHANNEL_REF_KEYS.channel(ref),
        queryFn: () => getChannel(ref!),
        enabled: !!ref,
        staleTime: 60_000,
        retry: false,
    })
}

/** `GET /v1/channels/me` — 404 NO_CHANNEL → null. */
export function useMyChannel() {
    return useQuery({
        queryKey: CHANNEL_REF_KEYS.mine,
        queryFn: () => getMyChannel(),
        staleTime: 60_000,
        retry: false,
    })
}

/** `GET /v1/channels/:ref/subscription` — subscribed + notify_on. */
export function useChannelSubscriptionByRef(ref: string | undefined, enabled = true) {
    return useQuery<RefSubscriptionState>({
        queryKey: CHANNEL_REF_KEYS.subscription(ref),
        queryFn: () => getChannelSubscription(ref!),
        enabled: !!ref && enabled,
        staleTime: 30_000,
        retry: false,
    })
}

function invalidateChannelRef(qc: ReturnType<typeof useQueryClient>, ref: string) {
    invalidateAuthorCache(ref)
    qc.invalidateQueries({ queryKey: CHANNEL_REF_KEYS.channel(ref) })
    qc.invalidateQueries({ queryKey: CHANNEL_REF_KEYS.subscription(ref) })
    qc.invalidateQueries({ queryKey: ["posttube", "my-subscriptions"] })
    qc.invalidateQueries({ queryKey: ["video-shell", "channel-subscriptions"] })
    qc.invalidateQueries({ queryKey: ["channel-subscription", ref] })
}

/** `POST` / `DELETE /v1/channels/:ref/subscribe`. */
export function useSubscribeChannel() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ ref, subscribe, notifyOn }: { ref: string; subscribe: boolean; notifyOn?: "all" | "none" }) => {
            if (subscribe) await subscribeChannel(ref, notifyOn ?? "all")
            else await unsubscribeChannel(ref)
            return { ref, subscribed: subscribe }
        },
        onSuccess: ({ ref, subscribed }) => {
            qc.setQueryData<RefSubscriptionState | undefined>(CHANNEL_REF_KEYS.subscription(ref), (cur) => ({
                ...(cur ?? { subscribed }),
                subscribed,
                notify_on: subscribed ? cur?.notify_on ?? "all" : null,
            }))
            invalidateChannelRef(qc, ref)
        },
    })
}

/** The bell: `PATCH /v1/channels/:ref/subscription { notify_on }`. */
export function useSetChannelNotify() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ ref, notifyOn }: { ref: string; notifyOn: "all" | "none" }) => {
            await setChannelNotify(ref, notifyOn)
            return { ref, notifyOn }
        },
        onSuccess: ({ ref, notifyOn }) => {
            qc.setQueryData<RefSubscriptionState | undefined>(CHANNEL_REF_KEYS.subscription(ref), (cur) => ({
                ...(cur ?? { subscribed: true }),
                subscribed: true,
                notify_on: notifyOn,
            }))
            invalidateChannelRef(qc, ref)
        },
    })
}
