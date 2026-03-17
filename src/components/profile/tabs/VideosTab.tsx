"use client"

import { useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useProfilePosts } from "@/hooks/useProfilePosts"
import { motion } from "framer-motion"
import { Video, Play, Sparkles, Clock, Upload } from "lucide-react"
import type { PostDetail } from "@/types/profile"

interface VideosTabProps {
    userId: string
    isOwn: boolean
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

function formatRelativeDate(dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
    return `${Math.floor(diffDays / 365)}y ago`
}

function getVideoThumbnail(post: PostDetail): string {
    if (post.video_metadata?.thumbnail_url) return post.video_metadata.thumbnail_url
    if (post.cover_media_id) return `/v1/media/${post.cover_media_id}/serve`
    if (post.media && post.media.length > 0) return `/v1/media/${post.media[0].media_id}/serve`
    return ""
}

function VideoCard({ post, index }: { post: PostDetail; index: number }) {
    const router = useRouter()
    const thumbnail = getVideoThumbnail(post)
    const title = post.title || (post.text ? post.text.slice(0, 80) : "Untitled video")
    const duration = post.video_metadata?.duration_seconds
    const sparkCount = post.counts?.likes ?? 0

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.06, ease: "easeOut" }}
            onClick={() => router.push(`/posttube/watch/${post.id}`)}
            className="group cursor-pointer rounded-2xl overflow-hidden bg-brand-card border border-brand-divider shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-400"
        >
            {/* Thumbnail */}
            <div className="relative aspect-video bg-slate-100 overflow-hidden">
                {thumbnail ? (
                    <img
                        src={thumbnail}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-100">
                        <Video className="h-10 w-10 text-slate-300" />
                    </div>
                )}

                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="h-14 w-14 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center shadow-xl">
                        <Play className="h-6 w-6 text-white fill-white ml-0.5" />
                    </div>
                </div>

                {/* Duration badge */}
                {duration !== undefined && duration > 0 && (
                    <div className="absolute bottom-2.5 right-2.5 bg-black/75 backdrop-blur-sm text-white text-xs font-semibold px-2 py-0.5 rounded-lg">
                        {formatDuration(duration)}
                    </div>
                )}
            </div>

            {/* Details */}
            <div className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-brand-text font-[var(--font-outfit)] line-clamp-2 leading-snug">
                    {title}
                </h3>
                <div className="flex items-center gap-3 text-xs text-brand-text/60">
                    <span className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        {formatCount(sparkCount)} Sparks
                    </span>
                    <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeDate(post.created_at)}
                    </span>
                </div>
            </div>
        </motion.div>
    )
}

function VideosSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <div
                    key={i}
                    className="rounded-2xl overflow-hidden bg-brand-card border border-brand-divider"
                    style={{ animationDelay: `${i * 100}ms` }}
                >
                    <div className="aspect-video bg-slate-100 animate-pulse" />
                    <div className="p-4 space-y-3">
                        <div className="h-4 bg-slate-100 rounded-lg animate-pulse w-3/4" />
                        <div className="h-3 bg-slate-100 rounded-lg animate-pulse w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    )
}

export function VideosTab({ userId, isOwn }: VideosTabProps) {
    const router = useRouter()
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
        useProfilePosts(userId, "video")

    const videos = useMemo(
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

    if (isLoading) return <VideosSkeleton />

    if (videos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-20 w-20 rounded-full bg-brand-secondary flex items-center justify-center mb-5 shadow-sm">
                    <Video className="h-9 w-9 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-brand-text font-[var(--font-outfit)]">
                    {isOwn ? "Start creating on Posttube" : "No videos yet"}
                </h3>
                <p className="text-sm text-brand-text/60 mt-1.5 max-w-xs">
                    {isOwn
                        ? "Upload your first video and share it with the world."
                        : "When videos are published, they will show up here."}
                </p>
                {isOwn && (
                    <button
                        onClick={() => router.push("/posttube/upload")}
                        className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-[#D8103F] hover:bg-[#b80d35] text-white text-sm font-semibold rounded-2xl transition-colors shadow-lg shadow-[#D8103F]/20"
                    >
                        <Upload className="h-4 w-4" />
                        Upload Video
                    </button>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {videos.map((post, i) => (
                    <VideoCard key={post.id} post={post} index={i} />
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
