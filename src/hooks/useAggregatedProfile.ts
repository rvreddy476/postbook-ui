"use client"

import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import type { UserProfile, UserLink, GraphCounts, ContentCounts, Relationship } from "@/types/profile"

interface AggregatedProfileData {
    profile: UserProfile
    links: UserLink[]
    stats: GraphCounts & ContentCounts
    relationship: Relationship | null
}

export function useAggregatedProfile(username: string) {
    return useQuery({
        queryKey: ["aggregated-profile", username],
        queryFn: async () => {
            const res = await api.get<{ data: AggregatedProfileData }>(
                `/api/profile/${encodeURIComponent(username)}`
            )
            return res.data.data
        },
        staleTime: 10 * 1000,
        enabled: !!username,
    })
}
