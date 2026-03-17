"use client"

import { useRef, useCallback, useMemo } from "react"
import { useProfilePosts } from "@/hooks/useProfilePosts"
import { motion } from "framer-motion"
import { Image, Play, Sparkles } from "lucide-react"
import type { PostDetail } from "@/types/profile"

interface MediaTabProps {
    userId: string
}

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
    return String(n)
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, "0")}`
}

function getMediaThumbnail(post: PostDetail): string {
    if (post.video_metadata?.thumbnail_url) return post.video_metadata.thumbnail_url
    if (post.cover_media_id) return `/v1/media/${post.cover_media_id}/serve`
    if (post.media && post.media.length > 0) return `/v1/media/${post.media[0].media_id}/serve`
    return ""
}

function isVideoPost(post: PostDetail): boolean {
    if (post.content_type === "reel" || post.content_type === "video") return true
    if (post.media?.some((m) => m.kind === "video")) return true
    return false
}

function MediaGridItem({ post, index }: { post: PostDetail; index: number }) {
    const thumbnail = getMediaThumbnail(post)
    const isVideo = isVideoPost(post)
    const sparkCount = post.counts?.likes ?? 0
    const duration = post.video_metadata?.duration_seconds

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: index * 0.04, ease: "easeOut" }}
            className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 group cursor-pointer"
        >
            {thumbnail ? (
                <img
                    src={thumbnail}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-100">
                    <Image className="h-8 w-8 text-slate-300" />
                </div>
            )}

            {/* Video indicators */}
            {isVideo && (
                <>
                    <div className="absolute top-3 left-3 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-lg">
                        <Play className="h-3 w-3 fill-white" />
                        {duration ? formatDuration(duration) : "Video"}
                    </div>
                </>
            )}

            {/* Type badge */}
            {!isVideo && post.media && post.media.length > 1 && (
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-lg">
                    +{post.media.length - 1}
                </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="flex items-center gap-1.5 text-white font-semibold text-sm">
                    <Sparkles className="h-4 w-4" />
                    <span>{formatCount(sparkCount)}</span>
                </div>
            </div>
        </motion.div>
    )
}

function MediaSkeleton() {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
                <div
                    key={i}
                    className="aspect-square rounded-2xl bg-slate-100 animate-pulse"
                    style={{ animationDelay: `${i * 80}ms` }}
                />
            ))}
        </div>
    )
}

export function MediaTab({ userId }: MediaTabProps) {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
        useProfilePosts(userId, "all")

    const allPosts = useMemo(
        () => data?.pages.flatMap((page) => page.data) ?? [],
        [data]
    )

    const mediaPosts = useMemo(
        () => allPosts.filter((post) => post.media && post.media.length > 0),
        [allPosts]
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

    if (isLoading) return <MediaSkeleton />

    if (mediaPosts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-20 w-20 rounded-full bg-brand-secondary flex items-center justify-center mb-5 shadow-sm">
                    <Image className="h-9 w-9 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-brand-text font-[var(--font-outfit)]">
                    No photos or videos yet
                </h3>
                <p className="text-sm text-brand-text/60 mt-1.5 max-w-xs">
                    When photos and videos are shared, they will appear here.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {mediaPosts.map((post, i) => (
                    <MediaGridItem key={post.id} post={post} index={i} />
                ))}
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />

            {isFetchingNextPage && (
                <div className="flex justify-center py-6">
                    <div className="h-6 w-6 border-2 border-[#D8103F] border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </div>
    )
}
