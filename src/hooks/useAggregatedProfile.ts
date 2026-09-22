"use client"

import { ensureAccessToken } from "@/lib/accessToken"
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
            // Auth headers forwarded to the BFF. The token comes from memory
            // now, not localStorage; the user id still comes from the cached
            // session record, which is not a credential and proves nothing on
            // its own.
            const headers: Record<string, string> = { "Content-Type": "application/json" }
            const accessToken = await ensureAccessToken()
            if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`
            try {
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
