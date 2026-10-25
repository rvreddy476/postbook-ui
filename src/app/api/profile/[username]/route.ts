import { NextRequest, NextResponse } from "next/server"
import { API_GATEWAY_URL } from "@/app/api/auth/_lib/session"
import { relationshipFromGraph } from "@/lib/graphApi"
import type { Relationship } from "@/types/profile"

/*
  The profile page's aggregate read: profile, links, counts and the viewer's
  relationship in one round trip.

  Every call goes through the API GATEWAY with the caller's own
  `Authorization: Bearer` header and nothing else that names a user. The
  gateway verifies the token, derives the viewer from it, stamps the
  internal service key graph-service requires, and strips any identity
  header a client sent. This route used to call graph/profile/post-service
  directly with a viewer id copied from a client `X-User-Id` header: graph
  refused the keyless call (so the relationship came back null and the page
  showed "Follow" to someone already following), and anyone could claim to
  be another viewer and read that viewer's block and follow flags.
*/

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

/** The caller's bearer header, or null. Only this crosses to the gateway. */
function bearerOf(request: Request): string | null {
    const auth = request.headers.get("authorization")
    return auth && /^Bearer\s+\S+/i.test(auth) ? auth : null
}

async function fetchJSON<T>(path: string, auth: string | null): Promise<T | null> {
    return (await fetchWithStatus<T>(path, auth)).data
}

async function fetchWithStatus<T>(
    path: string,
    auth: string | null,
): Promise<{ data: T | null; status: number }> {
    const headers: Record<string, string> = { Accept: "application/json" }
    if (auth) headers["Authorization"] = auth
    try {
        const res = await fetch(`${API_GATEWAY_URL}${path}`, {
            headers,
            cache: "no-store",
        })
        if (!res.ok) return { data: null, status: res.status }
        const body = await res.json()
        return { data: body?.data ?? body, status: res.status }
    } catch {
        return { data: null, status: 0 }
    }
}

/**
 * The signed-in viewer's relationship to `userId`, from graph-service via
 * the gateway. No `user_id` is sent: the actor is the token's user, and
 * graph refuses an explicit id naming anyone else (400 VIEWER_BOUND).
 */
async function fetchRelationship(auth: string, userId: string) {
    const raw = await fetchJSON<Record<string, unknown>>(
        `/v1/graph/relationship?other_id=${encodeURIComponent(userId)}`,
        auth,
    )
    return relationshipFromGraph(raw)
}

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "Vary": "Authorization" }

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    const { username } = await params
    // Never a client X-User-Id: the gateway derives the viewer from this.
    const auth = bearerOf(request)

    // Step 1: Resolve username or user ID → profile. The viewer's token goes
    // with it, so profile-service's block gate (either direction → 404,
    // indistinguishable from a missing account) applies here as on the API.
    const profilePath = UUID_RE.test(username)
        ? `/v1/profiles/${encodeURIComponent(username)}`
        : `/v1/profiles/by-username/${encodeURIComponent(username)}`
    const { data: profile, status: profileStatus } = await fetchWithStatus<Record<string, unknown>>(
        profilePath,
        auth,
    )
    if (!profile) {
        // One exception to the gate's silence: the viewer blocked THIS
        // account. They already know, and the page must offer Unblock. A
        // block the other way stays a plain not-found.
        if (profileStatus === 404 && auth) {
            const blockedByViewer = await viewerBlockedProfile(profilePath, auth)
            if (blockedByViewer) {
                return NextResponse.json({ data: blockedByViewer }, { headers: PRIVATE_HEADERS })
            }
        }
        return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userId = (profile.user_id ?? profile.id) as string
    // Normalize: backend sends user_id, frontend expects id
    if (profile.user_id && !profile.id) {
        profile.id = profile.user_id
    }
    const id = encodeURIComponent(userId)

    // Step 2: Fan out all remaining calls in parallel
    const [links, graphCounts, contentCounts, relationship] = await Promise.all([
        fetchJSON<Record<string, unknown>[]>(`/v1/profiles/${id}/links`, auth),
        // Use profile's denormalized counts as primary source; fall back to graph service
        fetchJSON<{ follower_count: number; following_count: number; friend_count: number }>(
            `/v1/graph/counts/${id}`,
            auth,
        ),
        fetchJSON<Record<string, number>>(`/v1/posts/by-author/${id}/counts`, auth),
        // On your own profile graph answers all-false; the page decides
        // ownership from the session and ignores it there.
        auth ? fetchRelationship(auth, userId) : Promise.resolve(null),
    ])

    // Use profile's denormalized counts as fallback
    const profileFollowerCount = (profile.follower_count as number) ?? 0
    const profileFollowingCount = (profile.following_count as number) ?? 0
    const profileFriendCount = (profile.friend_count as number) ?? 0

    // Backend returns content_type keys: "post", "reel", "video", "poll", "total"
    // Map to frontend field names
    const result: AggregatedProfile = {
        profile,
        links: Array.isArray(links) ? links : [],
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

    return NextResponse.json({ data: result }, {
        headers: auth
            ? PRIVATE_HEADERS
            : { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30", "Vary": "Authorization" },
    })
}

/**
 * When the viewer-scoped profile read is refused, decide whether it was the
 * viewer's own block. Returns the minimal payload the blocked-by-you view
 * needs (id, username, display name, relationship.blocked), or null.
 */
async function viewerBlockedProfile(
    profilePath: string,
    auth: string,
): Promise<AggregatedProfile | null> {
    // Read signed out: does the account exist for a stranger?
    const anon = await fetchJSON<Record<string, unknown>>(profilePath, null)
    if (!anon) return null
    const userId = (anon.user_id ?? anon.id) as string | undefined
    if (!userId) return null
    const relationship = await fetchRelationship(auth, userId)
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
