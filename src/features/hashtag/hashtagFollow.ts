/*
  Followed hashtags, as post-service serves them (server commit 546eec063).

  Authority: Architecture/services/post-service/internal/http/
  hashtag_follows_handler.go (routes lines 16-27, errors 30-45) and
  service/hashtag_follows.go (rules lines 12-49, the answer 86-94, the list
  row 154-159). Signed-in only.

    POST   /v1/hashtags/:tag/follow      {tag, display_name, following:true}   idempotent
    DELETE /v1/hashtags/:tag/follow      {tag, display_name, following:false}  idempotent
    GET    /v1/hashtags/:tag/follow      {tag, display_name, following}
    GET    /v1/hashtags/followed         [{tag, display_name, followed_at}], meta.next_cursor
    GET    /v1/hashtags/followed/posts   [post detail], meta.next_cursor

  The server normalises the tag exactly as a post's hashtags (a leading #
  dropped, letters / digits / underscore / combining marks, 1-50
  characters, lowercased), so the page sends the tag as typed and shows
  what comes back.

  Pure: no React, no axios.
*/

/** service/hashtag_follows.go:37 MaxFollowedHashtags. */
export const MAX_FOLLOWED_HASHTAGS = 500

export const FOLLOWED_HASHTAGS_PATH = "/v1/hashtags/followed"
export const FOLLOWED_HASHTAG_POSTS_PATH = "/v1/hashtags/followed/posts"

export interface HashtagFollowState {
    tag: string
    displayName: string
    following: boolean
}

export interface FollowedHashtag {
    tag: string
    displayName: string
    followedAt: string
}

function dataOf(body: unknown): unknown {
    return body && typeof body === "object" && "data" in body ? (body as { data?: unknown }).data : body
}

function nonEmpty(v: unknown): string | null {
    return typeof v === "string" && v.trim() ? v : null
}

/** The tag as the route segment takes it: no leading #, encoded. */
export function hashtagSegment(tag: string): string {
    return encodeURIComponent(tag.trim().replace(/^#+/, ""))
}

export function hashtagFollowPath(tag: string): string {
    return `/v1/hashtags/${hashtagSegment(tag)}/follow`
}

/** Follow is POST, unfollow DELETE, on the same path; neither has a body. */
export function hashtagFollowRequest(tag: string, follow: boolean): { method: "post" | "delete"; url: string } {
    return { method: follow ? "post" : "delete", url: hashtagFollowPath(tag) }
}

/** The follow routes' answer (service/hashtag_follows.go:86-90), or null. */
export function parseHashtagFollowState(body: unknown): HashtagFollowState | null {
    const d = dataOf(body)
    if (!d || typeof d !== "object") return null
    const r = d as Record<string, unknown>
    const tag = nonEmpty(r.tag)
    if (!tag || typeof r.following !== "boolean") return null
    return { tag, displayName: nonEmpty(r.display_name) ?? `#${tag}`, following: r.following }
}

export interface FollowedHashtagsPage {
    items: FollowedHashtag[]
    nextCursor: string | null
}

/** GET /v1/hashtags/followed (service/hashtag_follows.go:154-159); malformed and repeated rows dropped. */
export function parseFollowedHashtags(body: unknown): FollowedHashtagsPage {
    const d = dataOf(body)
    const seen = new Set<string>()
    const items: FollowedHashtag[] = []
    for (const row of Array.isArray(d) ? d : []) {
        if (!row || typeof row !== "object") continue
        const r = row as Record<string, unknown>
        const tag = nonEmpty(r.tag)
        if (!tag || seen.has(tag)) continue
        seen.add(tag)
        items.push({
            tag,
            displayName: nonEmpty(r.display_name) ?? `#${tag}`,
            followedAt: typeof r.followed_at === "string" ? r.followed_at : "",
        })
    }
    const meta = body && typeof body === "object" ? (body as { meta?: { next_cursor?: unknown } }).meta : undefined
    return { items, nextCursor: nonEmpty(meta?.next_cursor) }
}

export function followedHashtagsParams(cursor?: string | null, limit = 50): Record<string, string> {
    const params: Record<string, string> = { limit: String(limit) }
    if (cursor) params.cursor = cursor
    return params
}

/** The followed-posts feed: 20 a page (the handler's default; at most 50). */
export function followedHashtagPostsParams(cursor?: string | null): Record<string, string> {
    const params: Record<string, string> = { limit: "20" }
    if (cursor) params.cursor = cursor
    return params
}

/** The list after one tag was unfollowed (or followed again), without a refetch. */
export function withoutFollowedHashtag(pages: readonly FollowedHashtagsPage[], tag: string): FollowedHashtagsPage[] {
    return pages.map((page) => ({ ...page, items: page.items.filter((h) => h.tag !== tag) }))
}

/* ------------------------------------------------------------------ */
/*  Error copy                                                         */
/* ------------------------------------------------------------------ */

const CODE_TEXT: Record<string, string> = {
    INVALID_HASHTAG: "A hashtag is 1 to 50 letters, numbers or underscores.",
    HASHTAG_UNAVAILABLE: "This hashtag can't be followed.",
    HASHTAG_FOLLOW_LIMIT: `You can follow up to ${MAX_FOLLOWED_HASHTAGS} hashtags. Unfollow one to follow another.`,
    STORE_UNAVAILABLE: "Hashtags are unavailable right now. Try again in a moment.",
    UNAUTHORIZED: "Log in to follow hashtags.",
}

export const HASHTAG_OFFLINE_TEXT = "You seem to be offline. Check your connection and try again."

/** A sentence for a refused follow, unfollow or list read. */
export function hashtagFollowErrorText(err: unknown, action: "follow" | "unfollow" | "load"): string {
    const response =
        err && typeof err === "object" && "response" in err
            ? (err as { response?: { status?: number; data?: { error?: { code?: unknown } } } }).response
            : undefined
    const code = response?.data?.error?.code
    if (typeof code === "string" && CODE_TEXT[code]) return CODE_TEXT[code]
    if (response?.status === 401) return CODE_TEXT.UNAUTHORIZED
    if (err && typeof err === "object" && "isAxiosError" in err && !response) return HASHTAG_OFFLINE_TEXT
    if (action === "follow") return "That hashtag couldn't be followed. Try again."
    if (action === "unfollow") return "That hashtag couldn't be unfollowed. Try again."
    return "Your followed hashtags couldn't load. Try again."
}

/** A visitor's Follow: the sign-in page, back to this tag afterwards (both spellings, as features/reels/sounds.ts signInHref). */
export function followSignInHref(tag: string): string {
    const to = encodeURIComponent(`/hashtag/${hashtagSegment(tag)}`)
    return `/login?next=${to}&redirect=${to}`
}
