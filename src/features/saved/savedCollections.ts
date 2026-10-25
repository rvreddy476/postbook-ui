/*
  Saved collections, as post-service serves them (server commit 546eec063).

  Authority: Architecture/services/post-service/internal/http/
  saved_collections_handler.go (routes and error codes, lines 17-43) and
  service/saved_collections.go (the rules, lines 15-79).

    GET    /v1/saved/collections                 [default, ...the caller's, oldest first]
    POST   /v1/saved/collections                 {name}            -> 201 collection
    PATCH  /v1/saved/collections/:collectionId   {name}            -> collection
    DELETE /v1/saved/collections/:collectionId                     -> {deleted, collection_id, moved_to_default}
    PUT    /v1/saved/:savedId/collection         {collection_id}   -> saved item
    PUT    /v1/posts/:postId/bookmark/collection {collection_id}   -> saved item
    POST   /v1/posts/:postId/bookmark            optional {collection_id}
    GET    /v1/saved?collection_id=default|<uuid>

  An item is in exactly ONE collection. The default one ("All Saved",
  id null) always exists, cannot be renamed or deleted, and its count is the
  items that are in no named collection (store/postgres/saved_collections.go
  :86-87). Deleting a named collection moves its items back to the default.

  Pure: no React, no axios, so the tests load it directly.
*/

export const DEFAULT_COLLECTION_NAME = "All Saved"
/** service/saved_collections.go:37 MaxSavedCollections. */
export const MAX_SAVED_COLLECTIONS = 50
/** service/saved_collections.go:39 MaxCollectionNameLength (characters, after trimming). */
export const MAX_COLLECTION_NAME_LENGTH = 40

export const SAVED_COLLECTIONS_PATH = "/v1/saved/collections"
export const SAVED_ITEMS_PATH = "/v1/saved"

export interface SavedCollectionView {
    /** null is the default collection. */
    id: string | null
    name: string
    count: number
    isDefault: boolean
}

export interface SavedItemView {
    id: string
    targetType: string
    targetId: string
    /** null = the default collection. */
    collectionId: string | null
    collectionName: string
    createdAt: string
}

/** A tab on /saved: the default collection, or a named collection's id. */
export type SavedTab = "default" | string

/* ------------------------------------------------------------------ */
/*  Decoders                                                           */
/* ------------------------------------------------------------------ */

function dataOf(body: unknown): unknown {
    return body && typeof body === "object" && "data" in body ? (body as { data?: unknown }).data : body
}

function str(v: unknown): string | null {
    return typeof v === "string" && v ? v : null
}

function count(v: unknown): number {
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0
}

/** One collection row (service/saved_collections.go:82-90), or null when it is not one. */
export function parseSavedCollection(raw: unknown): SavedCollectionView | null {
    if (!raw || typeof raw !== "object") return null
    const r = raw as Record<string, unknown>
    const name = str(r.name)
    if (!name) return null
    const id = str(r.id)
    const isDefault = r.is_default === true || id === null
    if (isDefault) return { id: null, name: DEFAULT_COLLECTION_NAME, count: count(r.count), isDefault: true }
    return { id, name, count: count(r.count), isDefault: false }
}

/**
 * GET /v1/saved/collections. The default collection always comes first and
 * exactly once — the server sends it first (service/saved_collections.go:134),
 * and a body without it still gets one (count 0) so the All Saved tab is
 * never missing. Rows that are not collections, and repeated ids, are dropped.
 */
export function parseSavedCollections(body: unknown): SavedCollectionView[] {
    const data = dataOf(body)
    const rows = Array.isArray(data) ? data : []
    let def: SavedCollectionView | null = null
    const named: SavedCollectionView[] = []
    const seen = new Set<string>()
    for (const row of rows) {
        const c = parseSavedCollection(row)
        if (!c) continue
        if (c.isDefault) {
            def ??= c
            continue
        }
        if (seen.has(c.id!)) continue
        seen.add(c.id!)
        named.push(c)
    }
    return [def ?? { id: null, name: DEFAULT_COLLECTION_NAME, count: 0, isDefault: true }, ...named]
}

/** One saved item (store/postgres/saved.go:17-27), or null. */
export function parseSavedItem(raw: unknown): SavedItemView | null {
    if (!raw || typeof raw !== "object") return null
    const r = raw as Record<string, unknown>
    const id = str(r.id)
    const targetId = str(r.target_id)
    if (!id || !targetId) return null
    return {
        id,
        targetType: str(r.target_type) ?? "post",
        targetId,
        collectionId: str(r.collection_id),
        collectionName: typeof r.collection_name === "string" ? r.collection_name : "",
        createdAt: typeof r.created_at === "string" ? r.created_at : "",
    }
}

export interface SavedItemsPage {
    items: SavedItemView[]
    nextCursor: string | null
}

/** GET /v1/saved: { data: SavedItem[], meta?: { next_cursor } } (handler.go:2503-2543). */
export function parseSavedItemsPage(body: unknown): SavedItemsPage {
    const data = dataOf(body)
    const items = (Array.isArray(data) ? data : []).map(parseSavedItem).filter((i): i is SavedItemView => i !== null)
    const meta = body && typeof body === "object" ? (body as { meta?: { next_cursor?: unknown } }).meta : undefined
    return { items, nextCursor: str(meta?.next_cursor) }
}

/** DELETE /v1/saved/collections/:id -> how many items went back to All Saved. */
export function parseDeletedCollection(body: unknown): { collectionId: string | null; movedToDefault: number } {
    const d = dataOf(body)
    const r = d && typeof d === "object" ? (d as Record<string, unknown>) : {}
    return { collectionId: str(r.collection_id), movedToDefault: count(r.moved_to_default) }
}

/* ------------------------------------------------------------------ */
/*  Requests                                                           */
/* ------------------------------------------------------------------ */

export interface ApiRequest {
    method: "get" | "post" | "put" | "patch" | "delete"
    url: string
    body?: Record<string, unknown>
    params?: Record<string, string>
}

/** The collection_id value a body or a query carries: "default" or the id. */
export function collectionRef(collectionId: string | null): string {
    return collectionId ?? "default"
}

/** The ?collection_id= a tab reads; the default tab reads "default", never an absent filter. */
export function savedItemsParams(tab: SavedTab, cursor?: string | null): Record<string, string> {
    const params: Record<string, string> = { limit: "20", collection_id: tab === "default" ? "default" : tab }
    if (cursor) params.cursor = cursor
    return params
}

export function createCollectionRequest(name: string): ApiRequest {
    return { method: "post", url: SAVED_COLLECTIONS_PATH, body: { name } }
}

export function renameCollectionRequest(collectionId: string, name: string): ApiRequest {
    return { method: "patch", url: `${SAVED_COLLECTIONS_PATH}/${encodeURIComponent(collectionId)}`, body: { name } }
}

export function deleteCollectionRequest(collectionId: string): ApiRequest {
    return { method: "delete", url: `${SAVED_COLLECTIONS_PATH}/${encodeURIComponent(collectionId)}` }
}

/** Move one saved item: PUT /v1/saved/:savedId/collection (the key must be there; handler.go requiredCollectionBody). */
export function moveSavedItemRequest(savedId: string, toCollectionId: string | null): ApiRequest {
    return {
        method: "put",
        url: `${SAVED_ITEMS_PATH}/${encodeURIComponent(savedId)}/collection`,
        body: { collection_id: collectionRef(toCollectionId) },
    }
}

/**
 * Save a post into a collection from a post card.
 *
 * - A named collection: POST /v1/posts/:id/bookmark {collection_id}. It
 *   saves the post, or moves it there if it was already saved (the upsert
 *   updates collection_id; store/postgres/saved_collections.go:340-343).
 * - All Saved, not yet saved: the plain POST with no body.
 * - All Saved, already saved: a plain POST would keep it where it is
 *   (handler.go AddBookmark: "no body is the plain save, which keeps an
 *   already-saved post where it is"), so this is the move,
 *   PUT /v1/posts/:id/bookmark/collection {collection_id: "default"}.
 */
export function saveToCollectionRequest(postId: string, toCollectionId: string | null, alreadySaved: boolean): ApiRequest {
    const base = `/v1/posts/${encodeURIComponent(postId)}/bookmark`
    if (toCollectionId) return { method: "post", url: base, body: { collection_id: toCollectionId } }
    if (alreadySaved) return { method: "put", url: `${base}/collection`, body: { collection_id: "default" } }
    return { method: "post", url: base }
}

/* ------------------------------------------------------------------ */
/*  Collection rules (mirroring NormalizeCollectionName)               */
/* ------------------------------------------------------------------ */

export type CollectionNameProblem = "empty" | "too_long" | "invalid" | "reserved" | "taken" | "limit"

const RESERVED = new Set(["all saved", "default"])
// Control characters other than whitespace (Go: unicode.IsControl && !unicode.IsSpace).
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000E-\u001F\u007F-\u0084\u0086-\u009F]/

/** Trim and fold inner whitespace runs to one space, as the server stores the name. */
export function normalizeCollectionName(raw: string): string {
    return raw.split(/\s+/).filter(Boolean).join(" ")
}

/**
 * Why a name would be refused, before it is sent: the server's own rules
 * (service/saved_collections.go:60-79) plus the two the store enforces —
 * unique per user case-insensitively, at most 50. `renamingId` is the
 * collection being renamed (its own name is not "taken", and the limit does
 * not apply to a rename).
 */
export function collectionNameProblem(
    raw: string,
    collections: readonly SavedCollectionView[],
    renamingId?: string,
): { ok: true; name: string } | { ok: false; problem: CollectionNameProblem } {
    if (CONTROL.test(raw)) return { ok: false, problem: "invalid" }
    const name = normalizeCollectionName(raw)
    const length = Array.from(name).length
    if (length === 0) return { ok: false, problem: "empty" }
    if (length > MAX_COLLECTION_NAME_LENGTH) return { ok: false, problem: "too_long" }
    const lower = name.toLowerCase()
    if (RESERVED.has(lower)) return { ok: false, problem: "reserved" }
    const named = collections.filter((c) => !c.isDefault)
    if (named.some((c) => c.id !== renamingId && c.name.toLowerCase() === lower)) return { ok: false, problem: "taken" }
    if (!renamingId && named.length >= MAX_SAVED_COLLECTIONS) return { ok: false, problem: "limit" }
    return { ok: true, name }
}

/** Whether another collection may be created. */
export function canCreateCollection(collections: readonly SavedCollectionView[]): boolean {
    return collections.filter((c) => !c.isDefault).length < MAX_SAVED_COLLECTIONS
}

export const COLLECTION_NAME_PROBLEM_TEXT: Record<CollectionNameProblem, string> = {
    empty: "Give the collection a name.",
    too_long: `A collection name can be at most ${MAX_COLLECTION_NAME_LENGTH} characters.`,
    invalid: "That name has characters a collection name can't use.",
    reserved: `“${DEFAULT_COLLECTION_NAME}” is where everything you save starts, so pick another name.`,
    taken: "You already have a collection with that name.",
    limit: `You can have up to ${MAX_SAVED_COLLECTIONS} collections. Delete one to make another.`,
}

/* ------------------------------------------------------------------ */
/*  Error copy                                                         */
/* ------------------------------------------------------------------ */

export type SavedAction = "load" | "create" | "rename" | "delete" | "move" | "save" | "unsave"

/** The refusal codes of writeSavedCollectionError (saved_collections_handler.go:63-85). */
const CODE_TEXT: Record<string, string> = {
    INVALID_COLLECTION_NAME: `A collection name needs 1 to ${MAX_COLLECTION_NAME_LENGTH} characters and can't be “${DEFAULT_COLLECTION_NAME}”.`,
    COLLECTION_NAME_TAKEN: COLLECTION_NAME_PROBLEM_TEXT.taken,
    COLLECTION_LIMIT_REACHED: COLLECTION_NAME_PROBLEM_TEXT.limit,
    COLLECTION_NOT_FOUND: "That collection no longer exists. It may have been deleted on another device.",
    INVALID_COLLECTION_ID: "That collection no longer exists. It may have been deleted on another device.",
    NOT_SAVED: "This post isn't in your saved items any more.",
    STORE_UNAVAILABLE: "Saved items are unavailable right now. Try again in a moment.",
    UNAUTHORIZED: "Log in again to manage your saved items.",
}

const FALLBACK_TEXT: Record<SavedAction, string> = {
    load: "Your saved items couldn't load. Try again.",
    create: "That collection couldn't be created. Try again.",
    rename: "That collection couldn't be renamed. Try again.",
    delete: "That collection couldn't be deleted. Try again.",
    move: "That post couldn't be moved. Try again.",
    save: "That post couldn't be saved. Try again.",
    unsave: "That post couldn't be removed from Saved. Try again.",
}

export const OFFLINE_TEXT = "You seem to be offline. Check your connection and try again."

/** The `error.code` of an axios-style error, if any. */
export function errorCode(err: unknown): string | undefined {
    const response =
        err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { error?: { code?: unknown } } } }).response
            : undefined
    const code = response?.data?.error?.code
    return typeof code === "string" ? code : undefined
}

function isOffline(err: unknown): boolean {
    return !!err && typeof err === "object" && "isAxiosError" in err && !(err as { response?: unknown }).response
}

/** A sentence for a failed saved-items request. */
export function savedErrorText(err: unknown, action: SavedAction): string {
    const code = errorCode(err)
    if (code && CODE_TEXT[code]) return CODE_TEXT[code]
    if (isOffline(err)) return OFFLINE_TEXT
    return FALLBACK_TEXT[action]
}

/* ------------------------------------------------------------------ */
/*  Move and filter                                                    */
/* ------------------------------------------------------------------ */

/** Whether an item is listed on a tab (every item is in exactly one collection). */
export function itemBelongsToTab(item: Pick<SavedItemView, "collectionId">, tab: SavedTab): boolean {
    return tab === "default" ? item.collectionId === null : item.collectionId === tab
}

/** The tab a collection is shown on. */
export function tabOf(collectionId: string | null): SavedTab {
    return collectionId ?? "default"
}

/**
 * The listed pages after an item moved: the item gets its new collection,
 * and leaves the list when the tab no longer holds it.
 */
export function applyMoveToPages(
    pages: readonly SavedItemsPage[],
    savedId: string,
    toCollectionId: string | null,
    tab: SavedTab,
): SavedItemsPage[] {
    return pages.map((page) => ({
        ...page,
        items: page.items
            .map((item) => (item.id === savedId ? { ...item, collectionId: toCollectionId } : item))
            .filter((item) => item.id !== savedId || itemBelongsToTab(item, tab)),
    }))
}

/** The tab counts after an item moved from one collection to another (no change for a same-collection move). */
export function applyMoveToCounts(
    collections: readonly SavedCollectionView[],
    fromCollectionId: string | null,
    toCollectionId: string | null,
): SavedCollectionView[] {
    if (fromCollectionId === toCollectionId) return [...collections]
    return collections.map((c) => {
        if (c.id === fromCollectionId) return { ...c, count: Math.max(0, c.count - 1) }
        if (c.id === toCollectionId) return { ...c, count: c.count + 1 }
        return c
    })
}

/** After deleting a collection: it goes, and its items are counted in All Saved. */
export function applyDeleteToCounts(
    collections: readonly SavedCollectionView[],
    deletedId: string,
    movedToDefault: number,
): SavedCollectionView[] {
    return collections
        .filter((c) => c.id !== deletedId)
        .map((c) => (c.isDefault ? { ...c, count: c.count + movedToDefault } : c))
}

/** The tab to show: the chosen one while it still exists, else All Saved. */
export function resolveTab(tab: SavedTab, collections: readonly SavedCollectionView[] | undefined): SavedTab {
    if (tab === "default" || !collections) return tab
    return collections.some((c) => c.id === tab) ? tab : "default"
}
