import type { Relationship } from "@/types/profile"

/*
  Pure rules for the Followers / Following / Connections lists on a profile:
  which follow pill a row shows, and the optimistic following_count bump.
  No React and no client imports, so the tab and its tests read the same rules.
*/

export type ConnectionListType = "friends" | "followers" | "following"

/** The pill on a row. "none" draws nothing (the viewer's own row, or not known yet). */
export type RowPill = "none" | "follow" | "follow_back" | "following" | "requested"

/**
 * What the viewer just did to a row's person on this screen. It wins over the
 * server's relationship until the batch refetch agrees.
 */
export type RowOverride = "following" | "requested" | "not_following"

export const ROW_PILL_LABELS: Record<Exclude<RowPill, "none">, string> = {
    follow: "Follow",
    follow_back: "Follow back",
    following: "Following",
    requested: "Requested",
}

/**
 * The viewer's own relationship to the person on a row.
 *
 * - The viewer's own row never has a pill, and neither does a blocked pair.
 * - Your own Followers list offers "Follow back" to people you do not follow.
 * - Your own Following list is "Following" by definition, even before the
 *   relationship batch answers.
 * - Anywhere else, an unknown relationship draws nothing rather than guess.
 */
export function connectionRowPill({
    rowUserId,
    viewerId,
    list,
    isOwn,
    relationship,
    override,
}: {
    rowUserId: string
    viewerId: string | null | undefined
    list: ConnectionListType
    isOwn: boolean
    relationship: Relationship | null | undefined
    override?: RowOverride
}): RowPill {
    if (!viewerId || rowUserId === viewerId) return "none"
    if (relationship?.blocked || relationship?.blocked_by) return "none"
    const notFollowing: RowPill = isOwn && list === "followers" ? "follow_back" : "follow"
    if (override === "following") return "following"
    if (override === "requested") return "requested"
    if (override === "not_following") return notFollowing
    if (relationship) {
        if (relationship.following) return "following"
        if (relationship.follow_request_status === "pending_sent") return "requested"
        return notFollowing
    }
    if (isOwn && list === "following") return "following"
    return "none"
}

/** The cached aggregated profile, as far as the count bump needs it. */
export interface CountedProfile {
    profile?: { id?: string } | null
    stats?: { following_count?: number } | null
}

/**
 * The viewer's aggregated profile with following_count moved by `delta`
 * (never below zero). Any other profile in the cache is returned untouched,
 * so it can be applied to every ["aggregated-profile", *] entry at once.
 */
export function bumpFollowingCount<T extends CountedProfile | undefined>(data: T, viewerId: string, delta: number): T {
    if (!data || !data.stats || data.profile?.id !== viewerId) return data
    const current = data.stats.following_count ?? 0
    return { ...data, stats: { ...data.stats, following_count: Math.max(0, current + delta) } }
}
