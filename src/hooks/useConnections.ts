"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"

export interface ConnectionUser {
    user_id: string
    display_name: string
    username: string
    avatar_media_id?: string
    followed_at?: string
    friend_since?: string
    created_at?: string
}

export interface PaginatedMeta {
    limit: number
    offset: number
    total: number
    has_next: boolean
}

export interface PaginatedResponse<T> {
    items: T[]
    meta: PaginatedMeta
}

export interface FriendRequestEntry {
    friendship_id: string
    user_id: string
    display_name: string
    username?: string
    avatar_media_id?: string
    created_at: string
}

export function useFollowers(userId: string | undefined, limit = 20) {
    return useQuery({
        queryKey: ["connections", "followers", userId, limit],
        queryFn: async () => {
            const res = await api.get<{ data: PaginatedResponse<ConnectionUser> }>(
                `/v1/profiles/${userId}/followers`,
                { params: { limit, offset: 0 } }
            )
            return res.data.data
        },
        enabled: !!userId,
    })
}

export function useFollowing(userId: string | undefined, limit = 20) {
    return useQuery({
        queryKey: ["connections", "following", userId, limit],
        queryFn: async () => {
            const res = await api.get<{ data: PaginatedResponse<ConnectionUser> }>(
                `/v1/profiles/${userId}/following`,
                { params: { limit, offset: 0 } }
            )
            return res.data.data
        },
        enabled: !!userId,
    })
}

export function useFriends(userId: string | undefined, limit = 20) {
    return useQuery({
        queryKey: ["connections", "friends", userId, limit],
        queryFn: async () => {
            const res = await api.get<{ data: PaginatedResponse<ConnectionUser> }>(
                `/v1/profiles/${userId}/friends`,
                { params: { limit, offset: 0 } }
            )
            return res.data.data
        },
        enabled: !!userId,
    })
}

export function usePendingFriendRequests() {
    return useQuery({
        queryKey: ["friend-requests", "pending"],
        queryFn: async () => {
            const res = await api.get<{ data: PaginatedResponse<FriendRequestEntry> }>(
                "/v1/profiles/me/friend-requests",
                { params: { limit: 20, offset: 0 } }
            )
            return res.data.data
        },
    })
}

export function useAcceptFriendRequest() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (friendshipId: string) => {
            await api.patch(`/v1/profiles/friend-requests/${friendshipId}`, { accept: true })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["friend-requests"] })
            qc.invalidateQueries({ queryKey: ["friend-suggestions"] })
            qc.invalidateQueries({ queryKey: ["connections"] })
            qc.invalidateQueries({ queryKey: ["relationship"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        },
        onError: (error) => {
            console.error("[Connections] Failed to accept friend request", error)
        },
    })
}

export function useRejectFriendRequest() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (friendshipId: string) => {
            await api.patch(`/v1/profiles/friend-requests/${friendshipId}`, { accept: false })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["friend-requests"] })
            qc.invalidateQueries({ queryKey: ["friend-suggestions"] })
            qc.invalidateQueries({ queryKey: ["connections"] })
            qc.invalidateQueries({ queryKey: ["relationship"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        },
        onError: (error) => {
            console.error("[Connections] Failed to reject friend request", error)
        },
    })
}

export interface SuggestionUser {
    user_id: string
    username?: string
    display_name: string
    avatar_media_id?: string
}

export function useFriendSuggestions(userId: string | undefined, limit = 5) {
    return useQuery({
        queryKey: ["friend-suggestions", userId, limit],
        queryFn: async () => {
            // Fetch discoverable users
            const discoverRes = await api.get<{ data: { items: SuggestionUser[] } }>(
                "/v1/profiles/discover",
                { params: { limit: 30, offset: 0 } }
            )
            const allUsers: SuggestionUser[] = discoverRes.data?.data?.items ?? []

            // Fetch current friends to exclude them
            const excludeIds = new Set<string>()
            try {
                const friendsRes = await api.get<{ data: PaginatedResponse<ConnectionUser> }>(
                    `/v1/profiles/${userId}/friends`,
                    { params: { limit: 100, offset: 0 } }
                )
                for (const f of friendsRes.data?.data?.items ?? []) {
                    excludeIds.add(f.user_id)
                }
            } catch {
                // Friends fetch might fail if no friends yet, that's ok
            }

            // Also exclude users with pending sent requests
            try {
                const sentRes = await api.get<{ data: PaginatedResponse<FriendRequestEntry> }>(
                    "/v1/profiles/me/sent-friend-requests",
                    { params: { limit: 100, offset: 0 } }
                )
                for (const r of sentRes.data?.data?.items ?? []) {
                    excludeIds.add(r.user_id)
                }
            } catch {
                // Sent requests fetch might fail, that's ok
            }

            // Also exclude users who have sent us pending requests
            try {
                const pendingRes = await api.get<{ data: PaginatedResponse<FriendRequestEntry> }>(
                    "/v1/profiles/me/friend-requests",
                    { params: { limit: 100, offset: 0 } }
                )
                for (const r of pendingRes.data?.data?.items ?? []) {
                    excludeIds.add(r.user_id)
                }
            } catch {
                // Pending requests fetch might fail, that's ok
            }

            return allUsers
                .filter((u) => u.user_id !== userId && !excludeIds.has(u.user_id))
                .slice(0, limit)
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
    })
}

export function useSendFriendRequest() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (username: string) => {
            await api.post(`/v1/profiles/${username}/friend-request`, { status: "pending" })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["friend-suggestions"] })
            qc.invalidateQueries({ queryKey: ["friend-requests"] })
            qc.invalidateQueries({ queryKey: ["connections"] })
            qc.invalidateQueries({ queryKey: ["relationship"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        },
        onError: (error) => {
            console.error("[Connections] Failed to send friend request", error)
        },
    })
}

// ---------- Circle: Sent Requests ----------

export function useSentFriendRequests() {
    return useQuery({
        queryKey: ["friend-requests", "sent"],
        queryFn: async () => {
            const res = await api.get<{ data: PaginatedResponse<FriendRequestEntry> }>(
                "/v1/profiles/me/sent-friend-requests",
                { params: { limit: 20, offset: 0 } }
            )
            return res.data.data
        },
    })
}

export function useCancelFriendRequest() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (friendshipId: string) => {
            await api.delete(`/v1/profiles/friend-requests/${friendshipId}`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["friend-requests"] })
            qc.invalidateQueries({ queryKey: ["friend-suggestions"] })
            qc.invalidateQueries({ queryKey: ["connections"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        },
        onError: (error) => {
            console.error("[Connections] Failed to cancel friend request", error)
        },
    })
}

export function useRemoveFriend() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (username: string) => {
            await api.delete(`/v1/profiles/${username}/friend`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["connections"] })
            qc.invalidateQueries({ queryKey: ["friend-requests"] })
            qc.invalidateQueries({ queryKey: ["relationship"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        },
        onError: (error) => {
            console.error("[Connections] Failed to remove friend", error)
        },
    })
}
