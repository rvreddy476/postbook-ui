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

            let res: Response
            try {
                res = await fetch(`/api/profile/${encodeURIComponent(username)}`, { headers })
            } catch {
                throw new ProfileFetchError(0)
            }
            if (!res.ok) throw new ProfileFetchError(res.status)
            const body = await res.json()
            return body.data as AggregatedProfileData
        },
        staleTime: 10 * 1000,
        enabled: !!username,
        // A 404 is an answer (missing, or blocked either way — the same page),
        // not a blip; retrying it only delays the not-found view.
        retry: (failureCount, error) =>
            !(error instanceof ProfileFetchError && error.status === 404) && failureCount < 2,
    })
}

/** A failed profile read; `status` is the HTTP status, 0 for a network failure. */
export class ProfileFetchError extends Error {
    constructor(public readonly status: number) {
        super(`Profile fetch failed: ${status}`)
        this.name = "ProfileFetchError"
    }
}

/** The HTTP status of a failed profile read (0 = network), or undefined when it did not fail. */
export function profileErrorStatus(error: unknown): number | undefined {
    if (!error) return undefined
    return error instanceof ProfileFetchError ? error.status : 0
}
