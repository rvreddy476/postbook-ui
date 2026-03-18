"use client"

import { useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useProfilePosts } from "@/hooks/useProfilePosts"
import { motion } from "framer-motion"
import { Film, Play, Sparkles, Plus } from "lucide-react"
import type { PostDetail } from "@/types/profile"

interface FlicksTabProps {
    userId: string
    isOwn: boolean
}

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
    return String(n)
}

function getFlickThumbnail(post: PostDetail): string {
    if (post.video_metadata?.thumbnail_url) return post.video_metadata.thumbnail_url
    if (post.cover_media_id) return `/v1/media/${post.cover_media_id}/serve`
    if (post.media && post.media.length > 0) return `/v1/media/${post.media[0].media_id}/serve`
    return ""
}

function FlickGridItem({ post, index }: { post: PostDetail; index: number }) {
    const router = useRouter()
    const thumbnail = getFlickThumbnail(post)
    const caption = post.text || ""
    const sparkCount = post.counts?.likes ?? 0

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: index * 0.05, ease: "easeOut" }}
            onClick={() => router.push(`/postgram/flick/${post.id}`)}
            className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-slate-900 group cursor-pointer"
        >
            {/* Thumbnail */}
            {thumbnail ? (
                <img
                    src={thumbnail}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900">
                    <Film className="h-10 w-10 text-brand-highlight" />
                </div>
            )}

            {/* Play indicator */}
            <div className="absolute top-3 left-3">
                <Play className="h-4 w-4 text-white/80 fill-white/80 drop-shadow-md" />
            </div>

            {/* Spark count overlay */}
            <div className="absolute bottom-3 left-3 flex items-center gap-1 text-white text-xs font-semibold drop-shadow-lg">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{formatCount(sparkCount)}</span>
            </div>

            {/* Hover caption reveal */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                {caption && (
                    <p className="text-white text-xs leading-relaxed line-clamp-2 font-medium">
                        {caption}
                    </p>
                )}
            </div>
        </motion.div>
    )
}

function FlicksSkeleton() {
    return (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <div
                    key={i}
                    className="aspect-[9/16] rounded-2xl bg-brand-secondary animate-pulse"
                    style={{ animationDelay: `${i * 80}ms` }}
                />
            ))}
        </div>
    )
}

export function FlicksTab({ userId, isOwn }: FlicksTabProps) {
    const router = useRouter()
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
        useProfilePosts(userId, "reel")

    const flicks = useMemo(
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

    if (isLoading) return <FlicksSkeleton />

    if (flicks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-20 w-20 rounded-full bg-brand-secondary flex items-center justify-center mb-5 shadow-sm">
                    <Film className="h-9 w-9 text-brand-text/30" />
                </div>
                <h3 className="text-lg font-semibold text-brand-text font-[var(--font-outfit)]">
                    {isOwn ? "Share your first Flick on Postgram" : "No Flicks yet"}
                </h3>
                <p className="text-sm text-brand-text/60 mt-1.5 max-w-xs">
                    {isOwn
                        ? "Create short, engaging videos and grow your audience."
                        : "When Flicks are posted, they will appear here."}
                </p>
                {isOwn && (
                    <button
                        onClick={() => router.push("/postgram/create")}
                        className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-brand-text hover:bg-brand-text text-white text-sm font-semibold rounded-2xl transition-colors shadow-lg shadow-brand-text/20"
                    >
                        <Plus className="h-4 w-4" />
                        Create Flick
                    </button>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {flicks.map((post, i) => (
                    <FlickGridItem key={post.id} post={post} index={i} />
                ))}
            </div>

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
