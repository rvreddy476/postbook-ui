import type { Relationship } from "@/types/profile"

/**
 * The social graph's wire contract, in one place.
 *
 * graph-service owns follows and blocks. profile-service used to serve
 * `/v1/profiles/:u/follow`, `/block`, `/me/blocks`, `/:id/followers`,
 * `/:id/following` and `/:id/relationship` from shadow tables that disagreed
 * with the canonical graph; it now answers every one of them with 410
 * ROUTE_RETIRED (profile-service retired_graph_routes.go). Every web call
 * that still used them failed: follow, unfollow, block, unblock, the blocked
 * list and the follower lists did nothing.
 *
 * The routes below are graph-service's own (graph-service/internal/http
 * handler.go), the same ones Android uses (core/profile ProfileApi.kt).
 * Every mutation takes the TARGET'S USER ID as `{ user_id }` — never a
 * username — and reads the viewer from the gateway's X-User-Id.
 *
 * Pure: no client imports, so the server-side profile route can use it too.
 * Resolving a username to an id lives with the hooks (useConnections
 * resolveUserId).
 */
export const GRAPH_ROUTES = {
    follow: "/v1/graph/follow",
    // Unfollow is a POST to its own path; DELETE /v1/graph/follow is not a route.
    unfollow: "/v1/graph/unfollow",
    // Block is POST, unblock is DELETE on the same path with the same body.
    block: "/v1/graph/block",
    relationship: "/v1/graph/relationship",
    relationshipsBatch: "/v1/graph/relationships/batch",
    blockedAndMuted: "/v1/graph/blocked-and-muted",
    followers: (userId: string) => `/v1/graph/followers/${encodeURIComponent(userId)}`,
    following: (userId: string) => `/v1/graph/following/${encodeURIComponent(userId)}`,
} as const

/** graph-service caps a relationships batch at 100 targets (store.MaxRelationshipBatch). */
export const GRAPH_BATCH_MAX = 100

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The one body shape every graph follow/block mutation reads. */
export function graphUserIdBody(userId: string): { user_id: string } {
    return { user_id: userId }
}

/**
 * The ids out of a follower/following response. graph-service answers a bare
 * array on the offset path and `{ items, next_cursor }` on the cursor path —
 * and a bare `[]` on either path when the owner has blocked the caller.
 */
export function idsFromGraphList(data: unknown): { ids: string[]; nextCursor: string } {
    if (Array.isArray(data)) return { ids: data.map(String), nextCursor: "" }
    if (data && typeof data === "object") {
        const d = data as { items?: unknown; next_cursor?: unknown }
        const ids = Array.isArray(d.items) ? d.items.map(String) : []
        return { ids, nextCursor: typeof d.next_cursor === "string" ? d.next_cursor : "" }
    }
    return { ids: [], nextCursor: "" }
}

/**
 * GET /v1/graph/relationship?user_id=<viewer>&other_id=<target> → the UI's
 * Relationship.
 *
 * THE BLOCK FLAGS ARE CROSSED ON THIS ROUTE. Its `blocked` means the TARGET
 * blocked the viewer and `blocked_by` means the VIEWER blocked the target
 * (graph-service store GetRelationshipFull; service.Relationship comments).
 * The UI's Relationship uses the opposite reading — `blocked` is "you blocked
 * them" (BlockedProfileView "blocked_by_viewer"), `blocked_by` is "they
 * blocked you" — so they are swapped here, and only here.
 *
 * The BATCH route (POST /v1/graph/relationships/batch) reads `blocked` as
 * "the viewer blocked the target", which already matches the UI; do not run
 * batch rows through this function.
 *
 * graph-service now also sends the unambiguous `viewer_blocked_target` and
 * `target_blocked_viewer` (parity 1-B2). When a response carries them
 * they win; an older graph-service without them falls back to the crossed
 * legacy pair above.
 */
export function relationshipFromGraph(raw: Record<string, unknown> | null | undefined): Relationship | null {
    if (!raw || typeof raw !== "object") return null
    const isConnection = !!raw.is_connection
    const status = (raw.connection_status as Relationship["connection_status"]) ?? "none"
    const { viewerBlockedTarget, targetBlockedViewer } = blockFlagsFromGraph(raw)
    return {
        following: !!raw.follows,
        followed_by: !!raw.followed_by,
        is_connection: isConnection,
        connection_status: isConnection ? "accepted" : status,
        follow_request_status: (raw.follow_request_status as Relationship["follow_request_status"]) ?? "none",
        blocked: viewerBlockedTarget,
        blocked_by: targetBlockedViewer,
        is_muted: !!raw.is_muted,
        // graph-service has no can_dm; message-service enforces who may
        // message whom when the conversation is created. Blocking either way
        // is the only case the UI can rule out up front.
        can_dm: !viewerBlockedTarget && !targetBlockedViewer,
        can_see_online: false,
        can_add_to_group: isConnection,
    }
}

/**
 * Both block directions from a GET /v1/graph/relationship body: the explicit
 * fields when present (a boolean, even false, is authoritative), otherwise
 * the crossed legacy fields (`blocked_by` = viewer blocked target, `blocked`
 * = target blocked viewer on this route).
 */
export function blockFlagsFromGraph(raw: Record<string, unknown>): {
    viewerBlockedTarget: boolean
    targetBlockedViewer: boolean
} {
    const viewerBlockedTarget =
        typeof raw.viewer_blocked_target === "boolean" ? raw.viewer_blocked_target : !!raw.blocked_by
    const targetBlockedViewer =
        typeof raw.target_blocked_viewer === "boolean" ? raw.target_blocked_viewer : !!raw.blocked
    return { viewerBlockedTarget, targetBlockedViewer }
}

/**
 * The accounts the viewer has blocked, from the batch rows of the people in
 * `/v1/graph/blocked-and-muted`. That route mixes in both block directions
 * and the viewer's mutes; only `blocked === true` on a batch row (viewer →
 * target) is a block the viewer can undo.
 */
export function blockedByViewer(batch: Record<string, unknown> | null | undefined): string[] {
    const rows = ((batch as { relationships?: Record<string, unknown> } | null)?.relationships ?? batch) as
        | Record<string, { blocked?: unknown } | null>
        | null
        | undefined
    if (!rows || typeof rows !== "object") return []
    return Object.entries(rows)
        .filter(([, rel]) => !!rel && typeof rel === "object" && rel.blocked === true)
        .map(([id]) => id)
}
