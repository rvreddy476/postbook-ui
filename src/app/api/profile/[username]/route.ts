import { NextRequest, NextResponse } from "next/server"
import { relationshipFromGraph } from "@/lib/graphApi"
import type { Relationship } from "@/types/profile"

const PROFILE_SERVICE_URL = process.env.PROFILE_SERVICE_URL || "http://localhost:8098"
const GRAPH_SERVICE_URL = process.env.GRAPH_SERVICE_URL || "http://localhost:8083"
const POST_SERVICE_URL = process.env.POST_SERVICE_URL || "http://localhost:8084"

interface AggregatedProfile {
    profile: Record<string, unknown> | null
    links: Record<string, unknown>[]
    stats: {
        follower_count: number
        following_count: number
        friend_count: number
        post: number
        reel: number
        video: number
        total: number
    }
    relationship: Relationship | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function fetchJSON<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
    return (await fetchWithStatus<T>(url, headers)).data
}

async function fetchWithStatus<T>(
    url: string,
    headers?: Record<string, string>,
): Promise<{ data: T | null; status: number }> {
    try {
        const res = await fetch(url, {
            headers: { "Content-Type": "application/json", ...headers },
            next: { revalidate: 0 },
        })
        if (!res.ok) return { data: null, status: res.status }
        const body = await res.json()
        return { data: body.data ?? body, status: res.status }
    } catch {
        return { data: null, status: 0 }
    }
}

/**
 * The viewer's relationship to the profile, from graph-service.
 * profile-service's /v1/profiles/:id/relationship is retired (410).
 */
async function fetchRelationship(viewerId: string, userId: string) {
    const raw = await fetchJSON<Record<string, unknown>>(
        `${GRAPH_SERVICE_URL}/v1/graph/relationship?user_id=${encodeURIComponent(viewerId)}&other_id=${encodeURIComponent(userId)}`
    )
    return relationshipFromGraph(raw)
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    const { username } = await params
    const viewerId = request.headers.get("X-User-Id")

    // The viewer goes to every service call, so profile-service's block gate
    // (either direction → 404, indistinguishable from a missing account)
    // applies to this page as it does to the API.
    const fwdHeaders: Record<string, string> = {}
    if (viewerId) fwdHeaders["X-User-Id"] = viewerId

    // Step 1: Resolve username or user ID → profile
    const isUUID = UUID_RE.test(username)
    const profileUrl = isUUID
        ? `${PROFILE_SERVICE_URL}/v1/profiles/${encodeURIComponent(username)}`
        : `${PROFILE_SERVICE_URL}/v1/profiles/by-username/${encodeURIComponent(username)}`
    const { data: profile, status: profileStatus } = await fetchWithStatus<Record<string, unknown>>(
        profileUrl,
        fwdHeaders,
    )
    if (!profile) {
        // One exception to the gate's silence: the viewer blocked THIS
        // account. They already know, and the page must offer Unblock. A
        // block the other way stays a plain not-found.
        if (profileStatus === 404 && viewerId) {
            const blockedByViewer = await viewerBlockedProfile(profileUrl, viewerId)
            if (blockedByViewer) {
                return NextResponse.json({ data: blockedByViewer }, {
                    headers: { "Cache-Control": "private, no-store", "Vary": "X-User-Id, Authorization" },
                })
            }
        }
        return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userId = (profile.user_id ?? profile.id) as string
    // Normalize: backend sends user_id, frontend expects id
    if (profile.user_id && !profile.id) {
        profile.id = profile.user_id
    }

    // Step 2: Fan out all remaining calls in parallel
    const [links, graphCounts, contentCounts, relationship] = await Promise.all([
        fetchJSON<Record<string, unknown>[]>(
            `${PROFILE_SERVICE_URL}/v1/profiles/${userId}/links`,
            fwdHeaders
        ),
        // Use profile's denormalized counts as primary source; fall back to graph service
        fetchJSON<{ follower_count: number; following_count: number; friend_count: number }>(
            `${GRAPH_SERVICE_URL}/v1/graph/counts/${userId}`
        ),
        fetchJSON<Record<string, number>>(
            `${POST_SERVICE_URL}/v1/posts/by-author/${userId}/counts`
        ),
        viewerId && viewerId !== userId
            ? fetchRelationship(viewerId, userId)
            : Promise.resolve(null),
    ])

    // Use profile's denormalized counts as fallback
    const profileFollowerCount = (profile.follower_count as number) ?? 0
    const profileFollowingCount = (profile.following_count as number) ?? 0
    const profileFriendCount = (profile.friend_count as number) ?? 0

    // Backend returns content_type keys: "post", "reel", "video", "poll", "total"
    // Map to frontend field names
    const result: AggregatedProfile = {
        profile,
        links: links ?? [],
        stats: {
            follower_count: graphCounts?.follower_count ?? profileFollowerCount,
            following_count: graphCounts?.following_count ?? profileFollowingCount,
            friend_count: graphCounts?.friend_count ?? profileFriendCount,
            post: contentCounts?.post ?? 0,
            reel: contentCounts?.reel ?? 0,
            video: contentCounts?.video ?? 0,
            total: contentCounts?.total ?? 0,
        },
        relationship: relationship ?? null,
    }

    const cacheControl = viewerId
        ? "private, no-store"
        : "public, s-maxage=10, stale-while-revalidate=30";

    return NextResponse.json({ data: result }, {
        headers: {
            "Cache-Control": cacheControl,
            "Vary": "X-User-Id, Authorization",
        },
    })
}

/**
 * When the viewer-scoped profile read is refused, decide whether it was the
 * viewer's own block. Returns the minimal payload the blocked-by-you view
 * needs (id, username, display name, relationship.blocked), or null.
 */
async function viewerBlockedProfile(
    profileUrl: string,
    viewerId: string,
): Promise<AggregatedProfile | null> {
    const anon = await fetchJSON<Record<string, unknown>>(profileUrl)
    if (!anon) return null
    const userId = (anon.user_id ?? anon.id) as string | undefined
    if (!userId || userId === viewerId) return null
    const relationship = await fetchRelationship(viewerId, userId)
    if (!relationship?.blocked) return null
    return {
        profile: {
            id: userId,
            user_id: userId,
            username: anon.username,
            display_name: anon.display_name,
        },
        links: [],
        stats: { follower_count: 0, following_count: 0, friend_count: 0, post: 0, reel: 0, video: 0, total: 0 },
        relationship,
    }
}
