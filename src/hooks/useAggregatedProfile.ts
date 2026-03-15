"use client"

import { useQuery } from "@tanstack/react-query"
import type { UserProfile, UserLink, GraphCounts, ContentCounts, Relationship } from "@/types/profile"

interface AggregatedProfileData {
    profile: UserProfile
    links: UserLink[]
    stats: GraphCounts & ContentCounts
    relationship: Relationship | null
}

/**
 * Fetch the aggregated profile via the Next.js BFF route (/api/profile/...).
 * We use native fetch instead of the `api` axios client because `api` has
 * baseURL = API gateway (localhost:8080), but /api/profile is a Next.js
 * server route that must resolve to the Next.js origin (localhost:3000).
 */
export function useAggregatedProfile(username: string) {
    return useQuery({
        queryKey: ["aggregated-profile", username],
        queryFn: async () => {
            // Read auth headers from localStorage to forward to BFF
            const headers: Record<string, string> = { "Content-Type": "application/json" }
            try {
                const tokenRaw = localStorage.getItem("postbook_auth_tokens")
                if (tokenRaw) {
                    const tokens = JSON.parse(tokenRaw) as { accessToken?: string }
                    if (tokens.accessToken) headers["Authorization"] = `Bearer ${tokens.accessToken}`
                }
                const sessionRaw = localStorage.getItem("postbook_session")
                if (sessionRaw) {
                    const session = JSON.parse(sessionRaw) as { id?: string }
                    if (session.id) headers["X-User-Id"] = session.id
                }
            } catch { /* ignore */ }

            const res = await fetch(`/api/profile/${encodeURIComponent(username)}`, { headers })
            if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`)
            const body = await res.json()
            return body.data as AggregatedProfileData
        },
        staleTime: 10 * 1000,
        enabled: !!username,
    })
}
