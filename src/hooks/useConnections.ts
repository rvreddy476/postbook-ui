"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { Relationship, RelationshipBatchResponse } from "@/types/profile"

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
    score?: number
    reason_codes?: string[]
    explain_text?: string
    source_bucket?: string
    mutual_friend_count?: number
    mutual_friend_ids?: string[]
    is_fresh?: boolean
    generated_at?: string
}

interface SuggestionsApiResponse {
    type: string
    items: Array<{
        candidate_user_id: string
        username?: string
        display_name: string
        avatar_media_id?: string
        score: number
        reason_codes: string[]
        explain_text: string
        source_bucket: string
        mutual_friend_count: number
        mutual_friend_ids?: string[]
        is_fresh?: boolean
        generated_at?: string
    }>
    next_cursor?: string
    surface?: string
    experiment_id?: string
    variant_id?: string
    generated_at?: string
}

export function useFriendSuggestions(userId: string | undefined, limit = 5) {
    return useQuery({
        queryKey: ["friend-suggestions", userId, limit],
        queryFn: async () => {
            const res = await api.get<{ data: SuggestionsApiResponse }>(
                "/v1/suggestions",
                { params: { type: "friend", limit } }
            )
            const items = res.data?.data?.items ?? []
            return items.map((item): SuggestionUser => ({
                user_id: item.candidate_user_id,
                username: item.username,
                display_name: item.display_name,
                avatar_media_id: item.avatar_media_id,
                score: item.score,
                reason_codes: item.reason_codes,
                explain_text: item.explain_text,
                source_bucket: item.source_bucket,
                mutual_friend_count: item.mutual_friend_count,
                mutual_friend_ids: item.mutual_friend_ids,
                is_fresh: item.is_fresh,
                generated_at: item.generated_at,
            }))
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
    })
}

export function useHideSuggestion() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ candidateUserId, type = "friend" }: { candidateUserId: string; type?: string }) => {
            await api.post("/v1/suggestions/action", {
                type,
                surface: "circle",
                candidate_user_id: candidateUserId,
                action: "hide",
            })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["friend-suggestions"] })
        },
    })
}

export function useSendFriendRequest() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (usernameOrId: string) => {
            if (!usernameOrId) throw new Error("Username or user ID is required")
            await api.post(`/v1/profiles/${usernameOrId}/friend-request`, { status: "pending" })
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
        mutationFn: async (usernameOrId: string) => {
            if (!usernameOrId) throw new Error("Username or user ID is required")
            await api.delete(`/v1/profiles/${usernameOrId}/friend`)
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

// ---------- Follow Suggestions ----------

export function useFollowSuggestions(userId: string | undefined, limit = 5) {
    return useQuery({
        queryKey: ["follow-suggestions", userId, limit],
        queryFn: async () => {
            const res = await api.get<{ data: SuggestionsApiResponse }>(
                "/v1/suggestions",
                { params: { type: "follow", limit, surface: "home" } }
            )
            const items = res.data?.data?.items ?? []
            return items.map((item): SuggestionUser => ({
                user_id: item.candidate_user_id,
                username: item.username,
                display_name: item.display_name,
                avatar_media_id: item.avatar_media_id,
                score: item.score,
                reason_codes: item.reason_codes,
                explain_text: item.explain_text,
                source_bucket: item.source_bucket,
                mutual_friend_count: item.mutual_friend_count,
            }))
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
    })
}

// ---------- Interstitial Suggestions ----------

export function useInterstitialSuggestions(triggerType: string, triggerUserId: string, limit = 5) {
    return useQuery({
        queryKey: ["interstitial-suggestions", triggerType, triggerUserId, limit],
        queryFn: async () => {
            const res = await api.get<{ data: SuggestionsApiResponse }>(
                "/v1/suggestions/interstitial",
                { params: { trigger_type: triggerType, trigger_user_id: triggerUserId, limit } }
            )
            const items = res.data?.data?.items ?? []
            return items.map((item): SuggestionUser => ({
                user_id: item.candidate_user_id,
                username: item.username,
                display_name: item.display_name,
                avatar_media_id: item.avatar_media_id,
                score: item.score,
                reason_codes: item.reason_codes,
                explain_text: item.explain_text,
                source_bucket: item.source_bucket,
                mutual_friend_count: item.mutual_friend_count,
            }))
        },
        enabled: !!triggerType && !!triggerUserId,
        staleTime: 60 * 1000,
    })
}

// ---------- Dismiss Category ----------

export function useDismissCategory() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ candidateUserId, signalType, type = "friend" }: { candidateUserId: string; signalType: string; type?: string }) => {
            await api.post("/v1/suggestions/action", {
                type,
                surface: "circle",
                candidate_user_id: candidateUserId,
                action: "dismiss_category",
                signal_type: signalType,
            })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["friend-suggestions"] })
            qc.invalidateQueries({ queryKey: ["follow-suggestions"] })
        },
    })
}

export function useBatchRelationships(viewerId: string, targetIds: string[]) {
    const capped = targetIds.slice(0, 100)
    return useQuery({
        queryKey: ["relationships", "batch", viewerId, ...capped.slice().sort()],
        queryFn: async () => {
            const res = await api.post<RelationshipBatchResponse>("/v1/graph/relationships/batch", {
                viewer_id: viewerId,
                target_ids: capped,
            })
            const map = new Map<string, Relationship>()
            for (const [userId, rel] of Object.entries(res.data.relationships)) {
                map.set(userId, rel)
            }
            return map
        },
        staleTime: 30_000,
        enabled: !!viewerId && capped.length > 0,
    })
}
