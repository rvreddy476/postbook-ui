/**
 * The Reposts tab's reader. Pure: no client imports, so the tests load it.
 *
 * post-service (internal/http/handler.go ListUserReposts, service/post.go):
 *
 *   GET /v1/users/:userId/reposts?limit=&cursor=
 *     → { data: { items: UserRepostItem[], next_cursor? } }
 *     UserRepostItem = { repost_id, type: "plain" | "quote", quote_text?,
 *                        original_post_id, created_at }
 *     Active reposts only, newest first; limit 1..50 (default 20).
 *
 * A repost row names the original post by id only, so the tab hydrates the
 * page with ONE POST /v1/posts/batch sent as the viewer: post-service gates
 * visibility there, and an original it does not return (deleted, private,
 * blocked) is left out of the tab.
 *
 * NOTE: the gateway does not reach this route yet (see REPOSTS_TAB_ENABLED
 * in ProfileTabs.tsx).
 */

export const REPOSTS_PAGE_SIZE = 20

export function repostsPath(userId: string): string {
    return `/v1/users/${encodeURIComponent(userId)}/reposts`
}

export interface UserRepost {
    repostId: string
    kind: "plain" | "quote"
    /** The reposter's own words on a quote repost; empty on a plain one. */
    quoteText: string
    originalPostId: string
    createdAt: string
}

export interface RepostsPage {
    items: UserRepost[]
    nextCursor: string | null
}

function str(v: unknown): string {
    return typeof v === "string" ? v : ""
}

/**
 * One page. The list sits inside `data` (`{ items, next_cursor }`), not in
 * `meta`. A body that is not that document throws, so the tab shows an
 * error instead of "no reposts".
 */
export function parseRepostsPage(body: unknown): RepostsPage {
    const data =
        body && typeof body === "object" && !Array.isArray(body) && "data" in body
            ? (body as { data?: unknown }).data
            : null
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("The reposts response had no data.")
    }
    const { items, next_cursor } = data as { items?: unknown; next_cursor?: unknown }
    if (items !== undefined && items !== null && !Array.isArray(items)) {
        throw new Error("The reposts response had no list.")
    }
    const out: UserRepost[] = []
    const seen = new Set<string>()
    for (const raw of (items as unknown[] | null | undefined) ?? []) {
        if (!raw || typeof raw !== "object") continue
        const r = raw as Record<string, unknown>
        const repostId = str(r.repost_id)
        const originalPostId = str(r.original_post_id)
        if (!repostId || !originalPostId || seen.has(repostId)) continue
        seen.add(repostId)
        out.push({
            repostId,
            kind: r.type === "quote" ? "quote" : "plain",
            quoteText: r.type === "quote" ? str(r.quote_text).trim() : "",
            originalPostId,
            createdAt: str(r.created_at),
        })
    }
    return { items: out, nextCursor: typeof next_cursor === "string" && next_cursor !== "" ? next_cursor : null }
}

export function repostsParams(cursor?: string | null): Record<string, string> {
    const params: Record<string, string> = { limit: String(REPOSTS_PAGE_SIZE) }
    if (cursor) params.cursor = cursor
    return params
}

/** The distinct original post ids of a page, in order, for one /v1/posts/batch. */
export function repostOriginalIds(items: readonly UserRepost[]): string[] {
    const out: string[] = []
    for (const r of items) if (!out.includes(r.originalPostId)) out.push(r.originalPostId)
    return out
}

/**
 * The rows the tab draws: each repost with its original, in repost order.
 * A repost whose original the viewer may not see is dropped.
 */
export function repostRows<P>(items: readonly UserRepost[], originals: ReadonlyMap<string, P>): { repost: UserRepost; post: P }[] {
    const rows: { repost: UserRepost; post: P }[] = []
    for (const repost of items) {
        const post = originals.get(repost.originalPostId)
        if (post) rows.push({ repost, post })
    }
    return rows
}
