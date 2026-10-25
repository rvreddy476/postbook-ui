import type { Relationship, UserProfile } from "@/types/profile"

/*
  Pure profile decisions (parity 3-W1: T-20, T-21, T-03, share).
  No React and no client imports, so the page, the header, the action menu
  and the tests all read the same rules.
*/

export type ProfileViewState =
    | "loading"
    | "error"
    | "not_found"
    | "blocked_by_viewer"
    | "private"
    | "ready"

/**
 * Which page to render.
 *
 * - The account blocked the viewer: a neutral not-found, the same page as an
 *   account that does not exist (profile-service already answers 404 for a
 *   block either way; the relationship check covers a stale cache).
 * - The viewer blocked the account: no content, only the way to Unblock —
 *   the viewer already knows, and the page is where they undo it.
 * - Private and not followed: header, a private notice and Follow; no grid.
 * - A failed read that is not a 404 is an error with retry, not a not-found.
 */
export function profileViewState({
    isLoading,
    errorStatus,
    profile,
    relationship,
    isOwn,
}: {
    isLoading: boolean
    /** HTTP status of a failed profile read; 0 for a network failure; undefined when it did not fail. */
    errorStatus?: number
    profile: Pick<UserProfile, "is_private" | "follow_status"> | null
    relationship: Relationship | null
    isOwn: boolean
}): ProfileViewState {
    if (isLoading) return "loading"
    if (!isOwn && relationship?.blocked_by) return "not_found"
    if (!profile) {
        if (errorStatus === undefined || errorStatus === 404) return "not_found"
        return "error"
    }
    if (!isOwn && relationship?.blocked) return "blocked_by_viewer"
    if (!isOwn && profile.is_private && !isFollowingProfile(profile, relationship)) return "private"
    return "ready"
}

/** Following either per graph-service's relationship or profile-service's follow_status. */
export function isFollowingProfile(
    profile: Pick<UserProfile, "follow_status"> | null,
    relationship: Relationship | null,
): boolean {
    return !!relationship?.following || profile?.follow_status === "following"
}

export type FollowButtonState = "follow" | "follow_back" | "requested" | "following"

export function followButtonState(
    profile: Pick<UserProfile, "follow_status"> | null,
    relationship: Relationship | null,
): FollowButtonState {
    if (isFollowingProfile(profile, relationship)) return "following"
    if (relationship?.follow_request_status === "pending_sent" || profile?.follow_status === "requested") {
        return "requested"
    }
    if (relationship?.followed_by) return "follow_back"
    return "follow"
}

export const FOLLOW_BUTTON_LABELS: Record<FollowButtonState, string> = {
    follow: "Follow",
    follow_back: "Follow back",
    requested: "Requested",
    following: "Following",
}

export type ProfileMenuRowKey = "copy_link" | "mute" | "unmute" | "block" | "unblock" | "report"

export interface ProfileMenuRow {
    key: ProfileMenuRowKey
    label: string
    destructive?: boolean
}

/**
 * The ⋮ menu on a profile. The owner has none (their row is Edit · Share ·
 * Settings) — and so never a Report on their own profile. A signed-out
 * visitor can only copy the link; everything else needs an account.
 */
export function profileMenuRows({
    isOwn,
    signedIn,
    blocked,
    isMuted,
}: {
    isOwn: boolean
    signedIn: boolean
    blocked: boolean
    isMuted: boolean
}): ProfileMenuRow[] {
    if (isOwn) return []
    const rows: ProfileMenuRow[] = [{ key: "copy_link", label: "Copy profile link" }]
    if (!signedIn) return rows
    if (!blocked) {
        rows.push(isMuted ? { key: "unmute", label: "Unmute" } : { key: "mute", label: "Mute" })
    }
    rows.push(
        blocked
            ? { key: "unblock", label: "Unblock" }
            : { key: "block", label: "Block", destructive: true },
    )
    rows.push({ key: "report", label: "Report", destructive: true })
    return rows
}

/** The public profile address: /u/<username> resolves for signed-out visitors (middleware PUBLIC_PREFIXES). */
export function profileShareUrl(origin: string, profile: Pick<UserProfile, "username" | "id">): string {
    const handle = profile.username || profile.id
    return `${origin.replace(/\/+$/, "")}/u/${encodeURIComponent(handle)}`
}

/** "1.2K"-style counts for the header. */
export function formatProfileCount(n: number | null | undefined): string {
    const v = typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
    if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}K`
    return String(Math.floor(v))
}
