/**
 * Settings › Recently deleted: the caller's soft-deleted posts.
 *
 * Authority: post-service (internal/http/delete_post.go).
 *
 *   GET  /v1/posts/me/deleted?limit=&cursor=
 *        → { data: PostDetail[], meta?: { next_cursor } }
 *        Newest deletion first. Every row carries deleted_at and purge_at
 *        (deleted_at + the purge window; the purge worker hard-deletes the
 *        post, and its media, at purge_at). Rows are NOT media-hydrated.
 *
 *   POST /v1/posts/:postId/restore   (author only, empty body)
 *        200 the restored post
 *        409 NOT_DELETED             live already, or not the caller's
 *        410 RESTORE_WINDOW_EXPIRED  purge_at has passed
 *
 * Pure: no hooks, no client imports, so the tests load it directly.
 */

export const DELETED_POSTS_PATH = "/v1/posts/me/deleted"
export const DELETED_POSTS_PAGE_SIZE = 20

export function restorePostPath(postId: string): string {
    return `/v1/posts/${encodeURIComponent(postId)}/restore`
}

export type DeletedPostKind = "reel" | "video" | "post"

export interface DeletedPost {
    id: string
    /** What the row shows: the title, else the caption, else nothing. */
    text: string
    kind: DeletedPostKind
    deletedAt: string
    /** When the post is removed for good. Null only when the server omitted it. */
    purgeAt: string | null
}

export interface DeletedPostsPage {
    items: DeletedPost[]
    nextCursor: string | null
}

const REEL_TYPES = new Set(["reel", "flick", "short", "shorts"])
const VIDEO_TYPES = new Set(["video", "long_video"])

export function deletedPostKind(contentType: unknown): DeletedPostKind {
    const t = typeof contentType === "string" ? contentType.toLowerCase() : ""
    if (REEL_TYPES.has(t)) return "reel"
    if (VIDEO_TYPES.has(t)) return "video"
    return "post"
}

const KIND_LABEL: Record<DeletedPostKind, string> = { reel: "Reel", video: "Video", post: "Post" }

export function deletedPostKindLabel(kind: DeletedPostKind): string {
    return KIND_LABEL[kind]
}

function str(v: unknown): string {
    return typeof v === "string" ? v : ""
}

function decodeRow(raw: unknown): DeletedPost | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
    const r = raw as Record<string, unknown>
    const id = str(r.id)
    const deletedAt = str(r.deleted_at)
    // A row without its id or its deletion time is not a Recently deleted
    // row (it cannot be restored or dated); leave it out.
    if (!id || !deletedAt) return null
    const title = str(r.title).trim()
    const caption = str(r.text).trim()
    const purgeAt = str(r.purge_at)
    return {
        id,
        text: title || caption,
        kind: deletedPostKind(r.content_type),
        deletedAt,
        purgeAt: purgeAt || null,
    }
}

/**
 * One page of GET /v1/posts/me/deleted. A body that is not the
 * `{ data: [...] }` envelope throws, so the page shows an error rather than
 * claiming "nothing deleted".
 */
export function parseDeletedPostsPage(body: unknown): DeletedPostsPage {
    if (!body || typeof body !== "object" || Array.isArray(body) || !("data" in body)) {
        throw new Error("The Recently deleted response had no data.")
    }
    const { data, meta } = body as { data?: unknown; meta?: unknown }
    // post-service sends [] for an empty list; null is read the same way.
    if (data !== null && !Array.isArray(data)) throw new Error("The Recently deleted response had no list.")
    const items: DeletedPost[] = []
    const seen = new Set<string>()
    for (const raw of data ?? []) {
        const row = decodeRow(raw)
        if (!row || seen.has(row.id)) continue
        seen.add(row.id)
        items.push(row)
    }
    const next = meta && typeof meta === "object" ? (meta as { next_cursor?: unknown }).next_cursor : undefined
    return { items, nextCursor: typeof next === "string" && next !== "" ? next : null }
}

/** Query params for one page; the first page sends no cursor. */
export function deletedPostsParams(cursor?: string | null): Record<string, string> {
    const params: Record<string, string> = { limit: String(DELETED_POSTS_PAGE_SIZE) }
    if (cursor) params.cursor = cursor
    return params
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Whole days left before permanent removal, rounded DOWN so the page never
 * promises more time than there is. Null when purge_at is missing or
 * unreadable; 0 when it has passed or is under a day away.
 */
export function daysLeft(purgeAt: string | null, now: number = Date.now()): number | null {
    if (!purgeAt) return null
    const at = Date.parse(purgeAt)
    if (Number.isNaN(at)) return null
    return Math.max(0, Math.floor((at - now) / DAY_MS))
}

/** The words beside a row: how long it can still be restored. */
export function daysLeftText(purgeAt: string | null, now: number = Date.now()): string {
    const at = purgeAt ? Date.parse(purgeAt) : NaN
    if (Number.isNaN(at)) return "Can be restored for now"
    if (at <= now) return "Being removed permanently"
    const days = daysLeft(purgeAt, now) ?? 0
    if (days === 0) return "Less than a day left"
    return days === 1 ? "1 day left" : `${days} days left`
}

/* ------------------------------------------------------------------ */
/*  Restore                                                            */
/* ------------------------------------------------------------------ */

export type RestoreOutcome = "restored" | "already_restored" | "expired" | "failed"

interface ErrorLike {
    response?: { status?: number; data?: unknown }
}

/** What a failed POST /restore means, from its status and envelope code. */
export function restoreFailure(err: unknown): Exclude<RestoreOutcome, "restored"> {
    const res = (err as ErrorLike | null)?.response
    const status = res?.status
    const body = res?.data as { error?: { code?: unknown } } | undefined
    const code = typeof body?.error?.code === "string" ? body.error.code : undefined
    if (status === 410 || code === "RESTORE_WINDOW_EXPIRED") return "expired"
    if (status === 409 || code === "NOT_DELETED") return "already_restored"
    return "failed"
}

/**
 * The restore itself: POST /v1/posts/:id/restore with an empty body, read
 * into an outcome. `post` is the HTTP client's post (injected so the flow
 * is testable); it never throws past here.
 */
export async function runRestore(
    post: (url: string, body: Record<string, never>) => Promise<unknown>,
    postId: string,
): Promise<RestoreOutcome> {
    try {
        await post(restorePostPath(postId), {})
        return "restored"
    } catch (err) {
        return restoreFailure(err)
    }
}

/**
 * Whether the row leaves the list after the outcome. A restored post is
 * live again, a 409 means it already is (or was never ours), and a 410
 * means it can no longer come back: none of them belongs on the list. A
 * plain failure keeps the row so the person can try again.
 */
export function restoreRemovesRow(outcome: RestoreOutcome): boolean {
    return outcome !== "failed"
}

const RESTORE_TEXT: Record<RestoreOutcome, string> = {
    restored: "Restored. It's back on your profile.",
    already_restored: "That post isn't in Recently deleted any more.",
    expired: "Too late to restore that post. It has been removed permanently.",
    failed: "Could not restore that post. Please try again.",
}

export function restoreText(outcome: RestoreOutcome): string {
    return RESTORE_TEXT[outcome]
}

/** The pages with one row removed (after a restore), keeping each page's cursor. */
export function withoutDeletedPost<P extends { items: DeletedPost[] }>(pages: readonly P[], postId: string): P[] {
    return pages.map((p) => ({ ...p, items: p.items.filter((i) => i.id !== postId) }))
}
