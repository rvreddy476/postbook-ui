"use client"

import { useState } from "react"
import { useProfilePosts } from "@/hooks/useProfilePosts"
import { ContentFilterBar } from "../ContentFilterBar"
import { Button } from "@/components/ui/button"
import PostCard from "@/components/PostCard"
import type { ContentType, AppPlatform } from "@/types/profile"
import { Gem } from "lucide-react"

interface CreationsTabProps {
    userId: string
    platform: AppPlatform
}

const defaultFilters: Record<AppPlatform, ContentType> = {
    postboek: "all",
    posttube: "video",
    postgram: "reel",
}

export function CreationsTab({ userId, platform }: CreationsTabProps) {
    const [filter, setFilter] = useState<ContentType>(defaultFilters[platform])
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
        useProfilePosts(userId, filter)

    const posts = data?.pages.flatMap((page) => page.data) ?? []

    if (isLoading) {
        return (
            <div className="max-w-[680px] space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-32 bg-slate-100/50 rounded-2xl animate-pulse" />
                ))}
            </div>
        )
    }

    return (
        <div className="max-w-[680px] space-y-4">
            <ContentFilterBar activeFilter={filter} onFilterChange={setFilter} />

            {posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                        <Gem className="h-6 w-6 text-slate-300" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">No posts yet</h3>
                    <p className="text-sm text-slate-400 mt-1 max-w-xs">
                        Share your first moment with the world.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {posts.map((post) => (
                        <PostCard key={post.id} post={post} />
                    ))}
                </div>
            )}

            {hasNextPage && (
                <div className="text-center pt-4">
                    <Button
                        variant="outline"
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="rounded-xl"
                    >
                        {isFetchingNextPage ? "Loading..." : "Load more"}
                    </Button>
                </div>
            )}
        </div>
    )
}
