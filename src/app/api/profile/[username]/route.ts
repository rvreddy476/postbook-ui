import { NextRequest, NextResponse } from "next/server"

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
        short: number
        video: number
        photo: number
        total: number
    }
    relationship: Record<string, unknown> | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function fetchJSON<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
    try {
        const res = await fetch(url, {
            headers: { "Content-Type": "application/json", ...headers },
            next: { revalidate: 0 },
        })
        if (!res.ok) return null
        const body = await res.json()
        return body.data ?? body
    } catch {
        return null
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    const { username } = await params
    const viewerId = request.headers.get("X-User-Id")

    // Step 1: Resolve username or user ID → profile
    const isUUID = UUID_RE.test(username)
    const profile = await fetchJSON<Record<string, unknown>>(
        isUUID
            ? `${PROFILE_SERVICE_URL}/v1/profiles/${encodeURIComponent(username)}`
            : `${PROFILE_SERVICE_URL}/v1/profiles/by-username/${encodeURIComponent(username)}`
    )
    if (!profile) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userId = (profile.user_id ?? profile.id) as string
    // Normalize: backend sends user_id, frontend expects id
    if (profile.user_id && !profile.id) {
        profile.id = profile.user_id
    }

    // Step 2: Fan out all remaining calls in parallel
    const fwdHeaders: Record<string, string> = {}
    if (viewerId) fwdHeaders["X-User-Id"] = viewerId

    const [links, graphCounts, contentCounts, relationship] = await Promise.all([
        fetchJSON<Record<string, unknown>[]>(
            `${PROFILE_SERVICE_URL}/v1/profiles/${userId}/links`
        ),
        // Use profile's denormalized counts as primary source; fall back to graph service
        fetchJSON<{ follower_count: number; following_count: number; friend_count: number }>(
            `${GRAPH_SERVICE_URL}/v1/graph/counts/${userId}`
        ),
        fetchJSON<{ post: number; short: number; video: number; photo: number; total: number }>(
            `${POST_SERVICE_URL}/v1/posts/by-author/${userId}/counts`
        ),
        // Relationship: use profile-service's new relationship endpoint
        viewerId && viewerId !== userId
            ? fetchJSON<Record<string, unknown>>(
                  `${PROFILE_SERVICE_URL}/v1/profiles/${userId}/relationship`,
                  fwdHeaders
              )
            : Promise.resolve(null),
    ])

    // Use profile's denormalized counts as fallback
    const profileFollowerCount = (profile.follower_count as number) ?? 0
    const profileFollowingCount = (profile.following_count as number) ?? 0
    const profileFriendCount = (profile.friend_count as number) ?? 0

    const result: AggregatedProfile = {
        profile,
        links: links ?? [],
        stats: {
            follower_count: graphCounts?.follower_count ?? profileFollowerCount,
            following_count: graphCounts?.following_count ?? profileFollowingCount,
            friend_count: graphCounts?.friend_count ?? profileFriendCount,
            post: contentCounts?.post ?? 0,
            short: contentCounts?.short ?? 0,
            video: contentCounts?.video ?? 0,
            photo: contentCounts?.photo ?? 0,
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
