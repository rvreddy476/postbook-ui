/**
 * The profile's Pinned row, read the way post-service exposes pins.
 *
 * Posts are pinned with PUT /v1/posts/:id/pin { pinned } (author only; at
 * most 3 per author, service/post.go TogglePin), which sets posts.is_pinned.
 * There is no "list my pins" route: GET /v1/posts/by-author/:id in its
 * default "latest" order sorts `is_pinned DESC, created_at DESC`
 * (store/postgres/author_sort.go), so the pinned posts are exactly the
 * leading rows with is_pinned true. One page of MAX_PINNED_POSTS rows holds
 * them all.
 *
 * (The old row read /v1/users/:id/pins on user-service, a separate table
 * nothing in the app writes, so it was always empty.)
 *
 * Pure: no client imports, so the tests load it directly.
 */

export const MAX_PINNED_POSTS = 3

export function pinnedPostsRequest(userId: string): { url: string; params: Record<string, string> } {
    // No sort and no type: the server's default order is the one that leads with pins.
    return { url: `/v1/posts/by-author/${encodeURIComponent(userId)}`, params: { limit: String(MAX_PINNED_POSTS) } }
}

/** The pinned rows of a by-author page body (`{ data: PostDetail[] }`), in order. */
export function pinnedPosts<P extends { id: string; is_pinned?: boolean | null }>(body: unknown): P[] {
    const data = body && typeof body === "object" && "data" in body ? (body as { data?: unknown }).data : null
    if (!Array.isArray(data)) return []
    const out: P[] = []
    for (const row of data) {
        if (!row || typeof row !== "object") continue
        const p = row as P
        // Pinned rows lead; the first unpinned row ends them.
        if (p.is_pinned !== true) break
        if (typeof p.id === "string" && p.id) out.push(p)
        if (out.length === MAX_PINNED_POSTS) break
    }
    return out
}

export function unpinRequest(postId: string): { method: "put"; url: string; body: { pinned: false } } {
    return { method: "put", url: `/v1/posts/${encodeURIComponent(postId)}/pin`, body: { pinned: false } }
}

const REEL_TYPES = new Set(["reel", "flick", "short", "shorts"])
const VIDEO_TYPES = new Set(["video", "long_video"])

/** The chip's words: the title or caption, else what kind of post it is. */
export function pinnedLabel(p: { title?: string | null; text?: string | null; content_type?: string | null }): string {
    const text = (p.title || p.text || "").trim()
    if (text) return text.length > 60 ? `${text.slice(0, 59)}…` : text
    const t = (p.content_type || "").toLowerCase()
    if (REEL_TYPES.has(t)) return "Reel"
    if (VIDEO_TYPES.has(t)) return "Video"
    return "Post"
}

export function pinnedHref(postId: string): string {
    return `/post/${encodeURIComponent(postId)}`
}
