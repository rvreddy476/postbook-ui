"use client"

import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query"
import { Repeat2 } from "lucide-react"

import PostCard from "@/components/PostCard"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import type { PostDetail } from "@/types/profile"
import { EmptyTabState } from "../states/EmptyTabState"
import { ProfileTabError } from "../states/ProfileTabError"
import {
    parseRepostsPage,
    repostOriginalIds,
    repostRows,
    repostsParams,
    repostsPath,
    type UserRepost,
} from "./reposts"

interface RepostRowsPage {
    rows: { repost: UserRepost; post: PostDetail }[]
    nextCursor: string | null
}

/** POST /v1/posts/batch → { data: { [id]: PostDetail } }, gated for the viewer. */
async function fetchOriginals(ids: string[]): Promise<Map<string, PostDetail>> {
    const map = new Map<string, PostDetail>()
    if (ids.length === 0) return map
    const res = await api.post<{ data?: Record<string, PostDetail | null> | null }>("/v1/posts/batch", { ids: ids.slice(0, 100) })
    for (const row of Object.values(res.data?.data ?? {})) {
        if (row && typeof row.id === "string") map.set(row.id, row)
    }
    return map
}

/** The posts this person reposted, newest first; a quote repost shows their words above the post. */
export function RepostsTab({ userId, isOwn }: { userId: string; isOwn: boolean }) {
    const query = useInfiniteQuery<RepostRowsPage, Error, InfiniteData<RepostRowsPage>, readonly unknown[], string | null>({
        queryKey: ["profile-reposts", userId],
        initialPageParam: null,
        queryFn: async ({ pageParam }) => {
            const res = await api.get(repostsPath(userId), { params: repostsParams(pageParam) })
            const page = parseRepostsPage(res.data)
            const originals = await fetchOriginals(repostOriginalIds(page.items))
            return { rows: repostRows(page.items, originals), nextCursor: page.nextCursor }
        },
        getNextPageParam: (last) => last.nextCursor,
    })

    if (query.isPending) {
        return (
            <div className="max-w-[680px] space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-32 bg-brand-secondary/50 rounded-2xl animate-pulse" />
                ))}
            </div>
        )
    }
    if (query.isError) return <ProfileTabError subject="reposts" onRetry={() => void query.refetch()} />

    const rows = query.data.pages.flatMap((p) => p.rows)
    if (rows.length === 0) {
        return (
            <EmptyTabState
                icon={<Repeat2 />}
                title="No reposts yet"
                description={isOwn ? "Posts you repost show here." : "Posts they repost show here."}
            />
        )
    }

    return (
        <div className="max-w-[680px] space-y-4">
            {rows.map(({ repost, post }) => (
                <div key={repost.repostId} className="space-y-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-highlight">
                        <Repeat2 className="h-3.5 w-3.5" aria-hidden />
                        {repost.kind === "quote" ? "Quoted" : "Reposted"}
                    </p>
                    {repost.quoteText ? <p className="text-sm text-brand-text whitespace-pre-line">{repost.quoteText}</p> : null}
                    <PostCard post={post} />
                </div>
            ))}
            {query.hasNextPage && (
                <div className="text-center pt-4">
                    <Button variant="outline" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage} className="rounded-xl">
                        {query.isFetchingNextPage ? "Loading..." : "Load more"}
                    </Button>
                </div>
            )}
        </div>
    )
}
