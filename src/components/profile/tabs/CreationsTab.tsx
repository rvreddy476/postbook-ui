"use client"

import { useState, useEffect } from "react"
import { useProfilePosts } from "@/hooks/useProfilePosts"
import { ContentFilterBar } from "../ContentFilterBar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { ContentType, AppPlatform, PostDetail } from "@/types/profile"
import { Pin } from "lucide-react"

interface CreationsTabProps {
    userId: string
    platform: AppPlatform
}

const defaultFilters: Record<AppPlatform, ContentType> = {
    postboek: "all",
    posttube: "video",
    postgram: "photo",
}

function PostItem({ post }: { post: PostDetail }) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                            {post.is_pinned && (
                                <span className="flex items-center gap-1 text-xs text-primary font-medium">
                                    <Pin className="h-3 w-3" />
                                    Pinned
                                </span>
                            )}
                            <span className="text-xs text-muted-foreground capitalize">
                                {post.content_type}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {new Date(post.created_at).toLocaleDateString()}
                            </span>
                        </div>
                        <p className="text-sm">{post.text}</p>
                        {post.media && post.media.length > 0 && (
                            <div className="flex gap-2 mt-2">
                                {post.media.map((m) => (
                                    <div
                                        key={m.media_id}
                                        className="h-20 w-20 rounded-lg bg-muted overflow-hidden"
                                    >
                                        <img
                                            src={`/v1/media/${m.media_id}/serve`}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                        {post.counts && (
                            <div className="flex gap-4 text-xs text-muted-foreground pt-1">
                                <span>{post.counts.likes} likes</span>
                                <span>{post.counts.comments} comments</span>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export function CreationsTab({ userId, platform }: CreationsTabProps) {
    const [filter, setFilter] = useState<ContentType>(defaultFilters[platform])
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
        useProfilePosts(userId, filter)

    const posts = data?.pages.flatMap((page) => page.data) ?? []

    if (isLoading && !isError) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <ContentFilterBar activeFilter={filter} onFilterChange={setFilter} />

            {posts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    No content to show
                </div>
            ) : (
                <div className="space-y-3">
                    {posts.map((post) => (
                        <PostItem key={post.id} post={post} />
                    ))}
                </div>
            )}

            {hasNextPage && (
                <div className="text-center pt-4">
                    <Button
                        variant="outline"
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                    >
                        {isFetchingNextPage ? "Loading..." : "Load more"}
                    </Button>
                </div>
            )}
        </div>
    )
}
