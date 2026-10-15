/**
 * Profile grid order (parity T-21).
 *
 * post-service GET /v1/posts/by-author/:id takes ?sort=latest|popular|oldest
 * (absent is latest; anything else is 400 INVALID_SORT). Its cursor is
 * opaque and TIED TO THE SORT that issued it — replaying a "latest" cursor
 * under "popular" is 400 INVALID_CURSOR — so the sort is part of the query
 * key: changing it starts a fresh infinite query whose first page has no
 * cursor. Pinned posts lead only under "latest" (server-side).
 *
 * Pure: no client imports, so tests can load it directly.
 */
export const PROFILE_POST_SORTS = ["latest", "popular", "oldest"] as const

export type ProfilePostSort = (typeof PROFILE_POST_SORTS)[number]

export const PROFILE_POST_SORT_LABELS: Record<ProfilePostSort, string> = {
    latest: "Latest",
    popular: "Popular",
    oldest: "Oldest",
}

export function isProfilePostSort(value: unknown): value is ProfilePostSort {
    return typeof value === "string" && (PROFILE_POST_SORTS as readonly string[]).includes(value)
}

/** The React Query key for one author's grid: a new sort is a new query, so paging restarts. */
export function profilePostsQueryKey(
    userId: string | undefined,
    contentType: string,
    sort?: ProfilePostSort,
) {
    return sort
        ? (["profile-posts", userId, contentType, sort] as const)
        : (["profile-posts", userId, contentType] as const)
}

/**
 * Query params for one page. `cursor` is only ever the next_cursor the SAME
 * sort returned; the first page sends none. With no sort the request is the
 * pre-T-21 one (server default, latest).
 */
export function profilePostsParams({
    contentType,
    sort,
    cursor,
    limit = 20,
}: {
    contentType: string
    sort?: ProfilePostSort
    cursor?: string
    limit?: number
}): Record<string, string> {
    const params: Record<string, string> = { limit: String(limit) }
    if (contentType && contentType !== "all") params.type = contentType
    if (sort) params.sort = sort
    if (cursor) params.cursor = cursor
    return params
}

/** The next page's cursor from a response's meta, or undefined at the end. */
export function nextProfilePostsCursor(page: { meta?: { next_cursor?: string } } | undefined): string | undefined {
    return page?.meta?.next_cursor || undefined
}

/**
 * The infinite-query options useProfilePosts runs, with the HTTP GET
 * injected so tests can drive the same paging with a fake transport.
 */
export function profilePostsInfiniteOptions<T extends { meta?: { next_cursor?: string } }>(
    userId: string | undefined,
    contentType: string,
    sort: ProfilePostSort | undefined,
    get: (path: string, params: Record<string, string>) => Promise<T>,
) {
    return {
        queryKey: profilePostsQueryKey(userId, contentType, sort),
        queryFn: ({ pageParam }: { pageParam: string }) =>
            get(`/v1/posts/by-author/${userId}`, profilePostsParams({ contentType, sort, cursor: pageParam })),
        initialPageParam: "",
        getNextPageParam: (lastPage: T) => nextProfilePostsCursor(lastPage),
        enabled: !!userId,
    }
}
