"use client"

import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { relationshipFromGraph } from "@/lib/graphApi"
import type { UserProfile, UserLink, GraphCounts, ContentCounts, Relationship, UserProfileBatchResponse } from "@/types/profile"

// Backend returns user_id, frontend expects id
function normalizeProfile(raw: Record<string, unknown>): UserProfile {
    if (raw.user_id && !raw.id) {
        raw.id = raw.user_id
    }
    return raw as unknown as UserProfile
}

export function useProfile(username: string) {
    return useQuery({
        queryKey: ["profile", username],
        queryFn: async () => {
            const res = await api.get<{ data: Record<string, unknown> }>(`/v1/profiles/by-username/${username}`)
            return normalizeProfile(res.data.data)
        },
        staleTime: 5 * 60 * 1000,
        enabled: !!username,
    })
}

export function useUserLinks(userId: string | undefined) {
    return useQuery({
        queryKey: ["user-links", userId],
        queryFn: async () => {
            const res = await api.get<{ data: UserLink[] }>(`/v1/profiles/${userId}/links`)
            return res.data.data ?? []
        },
        staleTime: 5 * 60 * 1000,
        enabled: !!userId,
    })
}

export function useGraphCounts(userId: string | undefined) {
    return useQuery({
        queryKey: ["graph-counts", userId],
        queryFn: async () => {
            const res = await api.get<{ data: GraphCounts }>(`/v1/graph/counts/${userId}`)
            return res.data.data
        },
        staleTime: 60 * 1000,
        enabled: !!userId,
    })
}

export function useContentCounts(userId: string | undefined) {
    return useQuery({
        queryKey: ["content-counts", userId],
        queryFn: async () => {
            const res = await api.get<{ data: ContentCounts }>(`/v1/posts/by-author/${userId}/counts`)
            return res.data.data
        },
        staleTime: 2 * 60 * 1000,
        enabled: !!userId,
    })
}

export function useRelationship(viewerId: string | null, targetId: string | undefined) {
    return useQuery({
        queryKey: ["relationship", viewerId, targetId],
        queryFn: async () => {
            // Only other_id: the viewer is the token's user, and graph refuses
            // a user_id naming anyone else (400 VIEWER_BOUND). `viewerId`
            // keys the cache and gates the call. The wire shape (`follows`,
            // crossed legacy block fields) maps to the UI Relationship.
            const res = await api.get<{ data: Record<string, unknown> }>(`/v1/graph/relationship`, {
                params: { other_id: targetId },
            })
            return relationshipFromGraph(res.data.data)
        },
        staleTime: 60 * 1000,
        enabled: !!viewerId && !!targetId && viewerId !== targetId,
    })
}

export function useBatchProfiles(userIds: string[]) {
    const capped = userIds.slice(0, 100)
    return useQuery({
        queryKey: ["profiles", "batch", ...capped.slice().sort()],
        queryFn: async () => {
            const res = await api.post("/v1/profiles/batch", {
                user_ids: capped,
            })
            const map = new Map<string, UserProfile>()
            const data = res.data
            // API returns either { profiles: [...] } or { "uuid": {...}, ... }
            if (data && typeof data === 'object') {
                if (Array.isArray(data.profiles)) {
                    for (const profile of data.profiles) {
                        const normalized = normalizeProfile(profile as Record<string, unknown>)
                        map.set(normalized.id, normalized)
                    }
                } else {
                    // Map format: { "uuid1": {profile}, "uuid2": {profile} }
                    for (const [key, value] of Object.entries(data)) {
                        if (value && typeof value === 'object' && 'user_id' in (value as Record<string, unknown>)) {
                            const normalized = normalizeProfile(value as Record<string, unknown>)
                            map.set(key, normalized)
                        }
                    }
                }
            }
            return map
        },
        staleTime: 60_000,
        enabled: capped.length > 0,
    })
}
