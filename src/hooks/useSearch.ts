"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import type { PostDetail, UserProfile } from "@/types/profile"
import type {
    AutocompleteItem,
    EntityBucket,
    EntityHitMap,
    EntityType,
    MultiEntitySearchData,
} from "@/types/search"

export type SearchType = "all" | "profiles" | "posts"

export interface ProfileResult {
    id: string
    username: string
    display_name: string
    bio: string
    avatar_media_id?: string
    is_verified: boolean
    follower_count: number
}

export interface SearchResults {
    profiles: ProfileResult[]
    posts: PostDetail[]
}

export function useUniversalSearch(
    query: string,
    type: SearchType = "all",
    enabled: boolean = true
) {
    return useQuery({
        queryKey: ["search", query, type],
        queryFn: async () => {
            const res = await api.get<{ data: SearchResults }>("/v1/search", {
                params: { q: query, type, limit: 20 },
            })
            return res.data.data
        },
        enabled: enabled && query.length >= 2,
    })
}

export function useSearchHashtags(query: string) {
    return useQuery({
        queryKey: ["search-hashtags", query],
        queryFn: async () => {
            const res = await api.get<{ data: string[] }>("/v1/search/hashtags", {
                params: { q: query, limit: 10 },
            })
            return res.data.data as string[]
        },
        enabled: query.length >= 2,
    })
}

export interface TrendingHashtag {
    hashtag: string
    score: number
}

export interface TrendingResponse {
    trending: TrendingHashtag[]
}

export function useTrending() {
    return useQuery({
        queryKey: ["trending"],
        queryFn: async () => {
            const res = await api.get<{ data: TrendingResponse }>("/v1/discover/trending")
            return res.data.data
        },
        staleTime: 60000,
    })
}

export interface SuggestedResponse {
    posts: PostDetail[]
}

export function useSuggested() {
    return useQuery({
        queryKey: ["suggested"],
        queryFn: async () => {
            const res = await api.get<{ data: SuggestedResponse }>("/v1/discover/suggested")
            return res.data.data
        },
    })
}

// ─── Autocomplete ────────────────────────────────────────────────────────────
//
// The backend's /v1/search/autocomplete is now multi-entity by default
// (users + hashtags + communities). To keep older call sites that only
// want users working, the hook accepts an optional `kinds` argument and
// returns a discriminated `AutocompleteItem[]`. Existing callers reading
// `user_id` / `username` / `display_name` still work — those fields are
// present on `kind === "user"` entries.

/** @deprecated Use AutocompleteItem from `@/types/search` instead. Kept
 * as a back-compat alias so callers that imported `AutocompleteUser`
 * keep building during the rollout. */
export interface AutocompleteUser {
    user_id: string
    username: string
    display_name: string
}

export type AutocompleteKinds = "all" | "users"

export function useAutocomplete(
    query: string,
    kinds: AutocompleteKinds = "all",
) {
    return useQuery<AutocompleteItem[]>({
        queryKey: ["search", "autocomplete", query, kinds],
        queryFn: async () => {
            const params: Record<string, string | number> = { q: query, limit: 8 }
            if (kinds === "users") params.kinds = "users"
            const res = await api.get("/v1/search/autocomplete", { params })
            // The handler nests results under either `.data.results` (new
            // shape) or `.data` (older builds). Be defensive so a
            // staggered backend rollout doesn't break the dropdown.
            const payload = res.data?.data ?? res.data ?? {}
            const items: AutocompleteItem[] =
                payload.results ?? payload.items ?? payload ?? []
            // Legacy users-only response was a flat array of
            // `{user_id, username, display_name}`. Normalize to the
            // discriminated shape so the UI can branch on `kind`.
            return items.map((it: any) => {
                if (it.kind) return it as AutocompleteItem
                return { kind: "user", ...it } as AutocompleteItem
            })
        },
        enabled: query.length >= 1,
        staleTime: 10_000,
    })
}

// ─── Multi-entity ranked search ──────────────────────────────────────────────
//
// One per-entity cursor map is held in component state. Each "Show more"
// click feeds the corresponding `cursor.<type>` query param back into
// `/v1/search`. We merge the new bucket into the existing items so the
// list grows. Independent per-type pagination — fetching more posts
// doesn't reset users.
//
// A useInfiniteQuery per type would have worked too, but six parallel
// infinite queries to the same endpoint duplicate the query_id and
// double the analytics writes. A single cursor-map keeps `query_id`
// stable across pagination of the same query.

export interface UseMultiEntitySearchOptions {
    /** Search query string. Requests are gated to `length >= 2` after trimming. */
    q: string
    /** Entities to query. Defaults to all six. */
    types?: EntityType[]
    /** Page size per entity. Defaults to 20. */
    limit?: number
    /** Disable the initial fetch (e.g. while typing). */
    enabled?: boolean
}

export interface UseMultiEntitySearchResult {
    data: MultiEntitySearchData | undefined
    isLoading: boolean
    isFetching: boolean
    error: unknown
    /** Stable analytics handle for the current query/types combo. */
    queryId: string | undefined
    /** Trigger "Show more" for a single entity. No-op when bucket has no cursor. */
    fetchMore: (type: EntityType) => Promise<void>
    /** Per-type fetching flag — drives the "Loading more…" spinner. */
    fetchingMore: Partial<Record<EntityType, boolean>>
}

async function fetchMultiEntity(
    query: string,
    types: EntityType[],
    limit: number,
    cursors: Partial<Record<EntityType, string | null>>,
): Promise<MultiEntitySearchData> {
    const params: Record<string, string | number> = {
        q: query,
        types: types.join(","),
        limit,
    }
    for (const t of types) {
        const c = cursors[t]
        if (c) params[`cursor.${t}`] = c
    }
    const res = await api.get<{ data: MultiEntitySearchData }>("/v1/search", { params })
    return res.data.data
}

export function useMultiEntitySearch(
    opts: UseMultiEntitySearchOptions,
): UseMultiEntitySearchResult {
    const { q, types, limit = 20, enabled = true } = opts
    const typeList = useMemo<EntityType[]>(
        () =>
            types && types.length > 0
                ? types
                : ["posts", "users", "hashtags", "products", "communities", "channels"],
        [types],
    )
    const typesKey = typeList.join(",")

    // Manual aggregated state — first-page data lives in the react-query
    // cache, the merged "all loaded so far" view is in local state.
    const [merged, setMerged] = useState<MultiEntitySearchData | undefined>(undefined)
    const [fetchingMore, setFetchingMore] = useState<Partial<Record<EntityType, boolean>>>({})

    const trimmed = q.trim()
    const initialQuery = useQuery({
        queryKey: ["search", "multi", trimmed, typesKey, limit],
        queryFn: async () => fetchMultiEntity(trimmed, typeList, limit, {}),
        enabled: enabled && trimmed.length >= 2,
    })

    // Reset merged state whenever query/types/limit changes — the new
    // first page becomes the new baseline for "Show more" merging.
    useEffect(() => {
        if (initialQuery.data) {
            setMerged(initialQuery.data)
            setFetchingMore({})
        } else if (!initialQuery.isFetching) {
            setMerged(undefined)
        }
    }, [initialQuery.data, initialQuery.isFetching, trimmed, typesKey, limit])

    const fetchMore = useCallback(
        async (type: EntityType) => {
            const current = merged?.results?.[type] as
                | EntityBucket<EntityHitMap[typeof type]>
                | undefined
            const cursor = current?.next_cursor
            if (!cursor) return
            setFetchingMore((m) => ({ ...m, [type]: true }))
            try {
                // Request just this type so we don't waste a round-trip
                // on buckets the user isn't paginating.
                const page = await fetchMultiEntity(trimmed, [type], limit, { [type]: cursor })
                const nextBucket = page.results?.[type] as
                    | EntityBucket<EntityHitMap[typeof type]>
                    | undefined
                if (!nextBucket) return
                setMerged((prev) => {
                    if (!prev) return prev
                    const prevBucket = prev.results?.[type] as
                        | EntityBucket<EntityHitMap[typeof type]>
                        | undefined
                    const mergedBucket: EntityBucket<EntityHitMap[typeof type]> = {
                        items: [...(prevBucket?.items ?? []), ...nextBucket.items],
                        next_cursor: nextBucket.next_cursor ?? null,
                    }
                    return {
                        ...prev,
                        results: {
                            ...prev.results,
                            [type]: mergedBucket,
                        },
                    }
                })
            } finally {
                setFetchingMore((m) => ({ ...m, [type]: false }))
            }
        },
        [merged, trimmed, limit],
    )

    return {
        data: merged,
        isLoading: initialQuery.isLoading,
        isFetching: initialQuery.isFetching,
        error: initialQuery.error,
        queryId: merged?.query_id,
        fetchMore,
        fetchingMore,
    }
}

// ─── Click-tracking ──────────────────────────────────────────────────────────
//
// Fire-and-forget POST to /v1/search/click. The backend always returns
// 204; we swallow errors so a flaky network never blocks navigation.

export interface RecordClickInput {
    query_id: string
    entity_type: EntityType
    entity_id: string
    position: number
}

export function useRecordSearchClick() {
    return useMutation({
        mutationFn: async (input: RecordClickInput) => {
            try {
                await api.post("/v1/search/click", input)
            } catch {
                // Best-effort. Click analytics aren't load-bearing.
            }
        },
    })
}

// `UserProfile` is unused inside this module but the original file
// imported it via type-only re-exports. Re-export so callers that
// did `import { UserProfile } from "@/hooks/useSearch"` keep building.
export type { UserProfile }
