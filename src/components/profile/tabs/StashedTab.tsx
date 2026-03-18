"use client"

import { useRef, useCallback, useMemo } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { motion } from "framer-motion"
import { Bookmark, Sparkles, MessageCircle, Image } from "lucide-react"
import type { PostDetail } from "@/types/profile"

interface StashedTabProps {
    userId: string
}

interface BookmarksResponse {
    data: PostDetail[]
    meta?: { next_cursor: string }
}

function useStashedPosts() {
    return useInfiniteQuery({
        queryKey: ["stashed-posts"],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: "20" }
            if (pageParam) params.cursor = pageParam as string
            const res = await api.get<BookmarksResponse>("/v1/posts/bookmarks", { params })
            return res.data
        },
        initialPageParam: "" as string,
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
    })
}

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
    return String(n)
}

function formatStashedDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function getPostThumbnail(post: PostDetail): string | null {
    if (post.video_metadata?.thumbnail_url) return post.video_metadata.thumbnail_url
    if (post.cover_media_id) return `/v1/media/${post.cover_media_id}/serve`
    if (post.media && post.media.length > 0) return `/v1/media/${post.media[0].media_id}/serve`
    return null
}

function StashedPostCard({ post, index }: { post: PostDetail; index: number }) {
    const thumbnail = getPostThumbnail(post)
    const sparkCount = post.counts?.likes ?? 0
    const commentCount = post.counts?.comments ?? 0
    const textPreview = post.text?.slice(0, 200) || ""

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.04, ease: "easeOut" }}
            className="rounded-2xl bg-brand-card border border-brand-divider shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 overflow-hidden"
        >
            {/* Stashed label */}
            <div className="px-5 pt-4 pb-2">
                <div className="flex items-center gap-1.5 text-teal-500">
                    <Bookmark className="h-3 w-3 fill-teal-500" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide">
                        Stashed on {formatStashedDate(post.created_at)}
                    </span>
                </div>
            </div>

            <div className="px-5 pb-4 flex gap-4">
                {/* Content */}
                <div className="flex-1 min-w-0 space-y-2.5">
                    {textPreview && (
                        <p className="text-sm text-brand-text leading-relaxed line-clamp-3 font-[var(--font-outfit)]">
                            {textPreview}
                        </p>
                    )}

                    {/* Counts */}
                    <div className="flex items-center gap-4 text-xs text-brand-text/60">
                        <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            {formatCount(sparkCount)} Sparks
                        </span>
                        <span className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            {formatCount(commentCount)}
                        </span>
                    </div>
                </div>

                {/* Thumbnail */}
                {thumbnail && (
                    <div className="flex-shrink-0 h-20 w-20 rounded-xl overflow-hidden bg-brand-secondary">
                        <img
                            src={thumbnail}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                    </div>
                )}
            </div>
        </motion.div>
    )
}

function StashedSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
                <div
                    key={i}
                    className="rounded-2xl bg-brand-card border border-brand-divider p-5 flex gap-4"
                    style={{ animationDelay: `${i * 100}ms` }}
                >
                    <div className="flex-1 space-y-3">
                        <div className="h-3 bg-brand-secondary rounded-lg animate-pulse w-1/3" />
                        <div className="h-4 bg-brand-secondary rounded-lg animate-pulse w-full" />
                        <div className="h-4 bg-brand-secondary rounded-lg animate-pulse w-2/3" />
                        <div className="h-3 bg-brand-secondary rounded-lg animate-pulse w-1/4" />
                    </div>
                    <div className="h-20 w-20 rounded-xl bg-brand-secondary animate-pulse flex-shrink-0" />
                </div>
            ))}
        </div>
    )
}

export function StashedTab({ userId }: StashedTabProps) {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
        useStashedPosts()

    const posts = useMemo(
        () => data?.pages.flatMap((page) => page.data) ?? [],
        [data]
    )

    // Intersection observer for infinite scroll
    const observerRef = useRef<IntersectionObserver | null>(null)
    const sentinelRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (observerRef.current) observerRef.current.disconnect()
            if (!node || !hasNextPage || isFetchingNextPage) return
            observerRef.current = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting) fetchNextPage()
                },
                { rootMargin: "200px" }
            )
            observerRef.current.observe(node)
        },
        [hasNextPage, isFetchingNextPage, fetchNextPage]
    )

    if (isLoading) return <StashedSkeleton />

    if (posts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-20 w-20 rounded-full bg-brand-secondary flex items-center justify-center mb-5 shadow-sm">
                    <Bookmark className="h-9 w-9 text-brand-text/30" />
                </div>
                <h3 className="text-lg font-semibold text-brand-text font-[var(--font-outfit)]">
                    Nothing stashed yet
                </h3>
                <p className="text-sm text-brand-text/60 mt-1.5 max-w-xs">
                    {"Tap \u25C8 on any post to stash it for later."}
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {posts.map((post, i) => (
                <StashedPostCard key={post.id} post={post} index={i} />
            ))}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />

            {isFetchingNextPage && (
                <div className="flex justify-center py-6">
                    <div className="h-6 w-6 border-2 border-brand-text border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </div>
    )
}
