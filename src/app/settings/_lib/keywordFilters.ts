/**
 * Settings › Filter keywords: words and hashtags that hide posts from the
 * caller's feeds. Not the DM filter (`dm_filtered_keywords`, on Inbox &
 * messaging): this list lives in trust-safety and feed-service applies it.
 *
 * Authority: trust-safety-service internal/http/keyword_filters_handler.go
 * (the gateway sends the exact prefix `/v1/users/me/keyword-filters` there).
 *
 *   GET /v1/users/me/keyword-filters → { data: { keywords: string[] } }
 *   PUT /v1/users/me/keyword-filters   { keywords: string[] }
 *       → { data: { keywords } }, the stored (normalised) list. The PUT
 *       REPLACES the whole list; [] clears it.
 *   400 TOO_MANY_KEYWORDS  more than 50 entries (counted BEFORE dedupe)
 *   400 INVALID_KEYWORD    an entry empty after trimming, over 40 characters,
 *                          or with a control character
 *
 * The server's normalisation (service/keyword_filters.go NormalizeKeywords):
 * trim, drop ONE leading '#', trim again, lower-case, collapse inner
 * whitespace; duplicates collapse to the first. feed-service matches both
 * "tag" and "#tag", so a hashtag is stored without its '#'.
 *
 * Pure: no client imports, so the tests load it directly.
 */

export const KEYWORD_FILTERS_PATH = "/v1/users/me/keyword-filters"
export const MAX_FEED_KEYWORDS = 50
export const MAX_FEED_KEYWORD_LENGTH = 40

/**
 * The stored list from a GET or PUT body. Null when the body is not the
 * `{ data: { keywords } }` document, so the page shows an error instead of
 * an empty list it would then save over the real one.
 */
export function parseKeywordFilters(body: unknown): string[] | null {
    const data =
        body && typeof body === "object" && !Array.isArray(body) && "data" in body
            ? (body as { data?: unknown }).data
            : null
    if (!data || typeof data !== "object" || Array.isArray(data)) return null
    const list = (data as { keywords?: unknown }).keywords
    // GetUserKeywordFilters never answers nil, but a null list is still "none".
    if (list === null) return []
    if (!Array.isArray(list)) return null
    return list.filter((k): k is string => typeof k === "string")
}

/** The entry before inner whitespace collapses: what the server measures and checks. */
function trimmedFeedKeyword(raw: string): string {
    let k = raw.trim()
    if (k.startsWith("#")) k = k.slice(1)
    return k.trim().toLowerCase()
}

/** One entry as the server stores it. */
export function normaliseFeedKeyword(raw: string): string {
    return trimmedFeedKeyword(raw).split(/\s+/u).filter(Boolean).join(" ")
}

export type FeedKeywordProblem = "EMPTY" | "TOO_LONG" | "INVALID" | "DUPLICATE" | "TOO_MANY"

// Go's unicode.IsControl is the Cc category.
const CONTROL = /\p{Cc}/u

export type AddFeedKeywordResult =
    | { ok: true; list: string[]; word: string }
    | { ok: false; problem: FeedKeywordProblem }

/** Add one entry the way the server would store it, or say why it would be refused. */
export function addFeedKeyword(list: readonly string[], raw: string): AddFeedKeywordResult {
    // The server's order: empty, then length, then control characters, all
    // on the trimmed entry BEFORE inner whitespace collapses ("a<tab>b" is
    // refused, and inner runs of spaces count towards the 40).
    const trimmed = trimmedFeedKeyword(raw)
    if (!trimmed) return { ok: false, problem: "EMPTY" }
    if (Array.from(trimmed).length > MAX_FEED_KEYWORD_LENGTH) return { ok: false, problem: "TOO_LONG" }
    if (CONTROL.test(trimmed)) return { ok: false, problem: "INVALID" }
    const word = normaliseFeedKeyword(raw)
    if (list.includes(word)) return { ok: false, problem: "DUPLICATE" }
    if (list.length >= MAX_FEED_KEYWORDS) return { ok: false, problem: "TOO_MANY" }
    return { ok: true, list: [...list, word], word }
}

export function removeFeedKeyword(list: readonly string[], word: string): string[] {
    return list.filter((w) => w !== word)
}

export function sameKeywordList(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * The request a Save sends: the WHOLE list (the PUT replaces it). Null when
 * the list equals what the server has, so nothing is sent.
 */
export function keywordFiltersRequest(
    saved: readonly string[],
    next: readonly string[],
): { method: "put"; url: string; body: { keywords: string[] } } | null {
    if (sameKeywordList(saved, next)) return null
    return { method: "put", url: KEYWORD_FILTERS_PATH, body: { keywords: [...next] } }
}

const PROBLEM_TEXT: Record<FeedKeywordProblem, string> = {
    EMPTY: "Type a word, phrase or hashtag first.",
    TOO_LONG: `Each word or phrase can have up to ${MAX_FEED_KEYWORD_LENGTH} characters.`,
    INVALID: "That word has characters that can't be used.",
    DUPLICATE: "That word is already on your list.",
    TOO_MANY: `You can filter up to ${MAX_FEED_KEYWORDS} words. Remove one to add another.`,
}

export function feedKeywordProblemText(problem: FeedKeywordProblem): string {
    return PROBLEM_TEXT[problem]
}

interface ErrorLike {
    response?: { status?: number; data?: unknown }
}

/** Plain words for a failed PUT. */
export function keywordFiltersSaveError(err: unknown): string {
    const body = (err as ErrorLike | null)?.response?.data as { error?: { code?: unknown } } | undefined
    const code = body?.error?.code
    if (code === "TOO_MANY_KEYWORDS") return PROBLEM_TEXT.TOO_MANY
    if (code === "INVALID_KEYWORD") return "One of your words can't be used. Remove it and try again."
    return "Could not save your filter words. Please try again."
}

export function feedKeywordCountText(list: readonly string[]): string {
    return `${list.length}/${MAX_FEED_KEYWORDS}`
}
