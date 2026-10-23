"use client"

import { useMemo } from "react"
import { useAppearanceRows } from "@/features/posttube/credits/useCredits"
import type { PostDetail } from "@/types/profile"
import { ProfileTabError } from "../states/ProfileTabError"
import { VideoCard, VideosSkeleton } from "./VideosTab"

/**
 * Appears in: other creators' long videos that credit this person and
 * that they accepted (GET /v1/creators/:creatorId/appearances, newest
 * first; the creator id is the person's user id), in the same grid as
 * Videos. The rows are channel-video rows and carry no credits. The
 * profile only shows the tab when the first page has rows, so there is no
 * empty state to draw.
 */
export function AppearsInTab({ userId }: { userId: string }) {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } = useAppearanceRows(userId)
    // The appearances rows are post rows, the same shape the Videos grid reads.
    const videos = useMemo(() => (data?.pages.flatMap((page) => page.items) ?? []) as unknown as PostDetail[], [data])

    if (isLoading) return <VideosSkeleton />
    if (isError && videos.length === 0) return <ProfileTabError subject="videos" onRetry={() => void refetch()} />

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {videos.map((post, i) => (
                    <VideoCard key={post.id} post={post} index={i} />
                ))}
            </div>
            {hasNextPage ? (
                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={() => void fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="rounded-xl border border-brand-divider bg-brand-card px-4 py-2 text-xs font-bold text-brand-text hover:bg-brand-secondary disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-outline"
                    >
                        {isFetchingNextPage ? "Loading…" : "Load more"}
                    </button>
                </div>
            ) : null}
        </div>
    )
}
