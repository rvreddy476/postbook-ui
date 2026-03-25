"use client"

import React, { useState } from "react"
import Link from "next/link"
import { Play, Film, ExternalLink, Eye, Heart, MessageCircle, Repeat2, Bookmark } from "lucide-react"
import type { PostDetail } from "@/types/profile"
import { useToggleLike } from "@/hooks/usePostReaction"
import { useToggleBookmark } from "@/hooks/usePostActions"
import { useUserProfile } from "@/hooks/useEditProfile"
import ShareDialog from "@/components/ShareDialog"

interface EmbedCardProps {
    post: PostDetail
}

function fmtCount(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
}

/**
 * Renders a cross-posted video or flick embed in the Postbook feed.
 * Content types: video_embed, flick_embed
 * The embed_ref JSONB on the post contains the source video metadata.
 */
export default function EmbedCard({ post }: EmbedCardProps) {
    const embedRef = post.embed_ref as {
        source_module?: string
        source_post_id?: string
        title?: string
        thumbnail_url?: string
        duration_seconds?: number
        channel_name?: string
        view_count?: number
    } | null

    const liked = !!post.viewer_reaction
    const likesCount = post.counts?.likes ?? 0
    const commentsCount = post.counts?.comments ?? 0
    const sharesCount = post.counts?.shares ?? 0

    const [bookmarked, setBookmarked] = useState(!!post.is_bookmarked)
    const [showShareDialog, setShowShareDialog] = useState(false)

    const likeMutation = useToggleLike()
    const bookmarkMutation = useToggleBookmark()
    const { data: reposterProfile } = useUserProfile(post.is_repost ? post.reposted_by : undefined)

    const isFlick = post.content_type === "flick_embed"
    const sourceModule = embedRef?.source_module ?? (isFlick ? "postgram" : "posttube")
    const watchUrl = `/posttube/watch/${embedRef?.source_post_id ?? post.id}`
    const thumbnailUrl = embedRef?.thumbnail_url ?? post.cover_media_id

    const durationStr = (() => {
        const sec = embedRef?.duration_seconds
        if (!sec || sec <= 0) return ""
        const h = Math.floor(sec / 3600)
        const m = Math.floor((sec % 3600) / 60)
        const s = Math.round(sec % 60)
        if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        return `${m}:${String(s).padStart(2, "0")}`
    })()

    const toggleLike = () => likeMutation.mutate(post.id)

    const handleBookmark = () => {
        const was = bookmarked
        setBookmarked(!was)
        bookmarkMutation.mutate(post.id, { onError: () => setBookmarked(was) })
    }

    return (
        <div className="rounded-xl border border-brand-divider bg-brand-card overflow-hidden hover:shadow-md transition-shadow">
            {/* Repost indicator */}
            {post.is_repost && (
                <div className="px-4 pt-2.5 flex items-center gap-1.5" style={{ color: '#EC1A59' }}>
                    <Repeat2 className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold">
                        {reposterProfile?.display_name || 'Someone'} reposted
                    </span>
                </div>
            )}
            {/* Thumbnail area */}
            <Link href={watchUrl} className="block relative aspect-video bg-brand-secondary group">
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={embedRef?.title || post.text || "Video"}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-text/10 to-purple-200">
                        {isFlick ? (
                            <Film className="h-10 w-10 text-brand-text/30" />
                        ) : (
                            <Play className="h-10 w-10 text-brand-text/30" />
                        )}
                    </div>
                )}

                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-card/90 shadow-lg">
                        <Play className="h-5 w-5 text-brand-text ml-0.5" />
                    </div>
                </div>

                {/* Duration badge */}
                {durationStr && (
                    <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {durationStr}
                    </span>
                )}

                {/* Source module badge */}
                <span className="absolute top-2 left-2 rounded-lg bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-white flex items-center gap-1">
                    {isFlick ? <Film className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    {sourceModule === "posttube" ? "PostTube" : sourceModule === "postgram" ? "Postgram" : sourceModule}
                </span>
            </Link>

            {/* Info bar */}
            <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <Link
                            href={watchUrl}
                            className="text-sm font-semibold text-brand-text line-clamp-2 hover:text-brand-text transition-colors"
                        >
                            {embedRef?.title || post.text || "Untitled"}
                        </Link>
                        {embedRef?.channel_name && (
                            <p className="text-xs text-brand-highlight mt-0.5">{embedRef.channel_name}</p>
                        )}
                    </div>
                    <Link
                        href={watchUrl}
                        className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-brand-secondary hover:bg-brand-text/10 transition-colors"
                        title="Open in PostTube"
                    >
                        <ExternalLink className="h-3.5 w-3.5 text-brand-highlight" />
                    </Link>
                </div>

                {/* Stats */}
                <div className="mt-2 flex items-center gap-3 text-xs text-brand-text/60">
                    {embedRef?.view_count != null && (
                        <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" /> {fmtCount(embedRef.view_count)}
                        </span>
                    )}
                    {post.counts && (
                        <span className="flex items-center gap-1">
                            <Heart className="h-3 w-3" /> {fmtCount(post.counts.likes)}
                        </span>
                    )}
                    {isFlick && (
                        <span className="ml-auto rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                            Flick
                        </span>
                    )}
                </div>
            </div>

            {/* Action Bar */}
            <div className="px-4 py-2 flex items-center justify-between border-t border-brand-divider">
                {/* Spark */}
                <button onClick={toggleLike} aria-label="Spark"
                    className={`flex items-center gap-1.5 transition-all ${liked ? 'text-brand-text scale-110' : 'text-brand-text/40 hover:text-brand-text'}`}>
                    <svg viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={liked ? 0 : 2} className="w-[18px] h-[18px]">
                        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
                    </svg>
                    {likesCount > 0 && <span className="text-[11px] font-mono">{likesCount}</span>}
                </button>

                {/* Comment */}
                <Link href={`/post/${post.id}`} aria-label="Comment"
                    className="flex items-center gap-1.5 text-brand-text/40 hover:text-brand-text transition-all">
                    <MessageCircle className="w-[18px] h-[18px]" />
                    {commentsCount > 0 && <span className="text-[11px] font-mono">{commentsCount}</span>}
                </Link>

                {/* Echo / Repost */}
                <button onClick={() => setShowShareDialog(true)} aria-label="Echo"
                    className="flex items-center gap-1.5 text-brand-text/40 hover:text-brand-text transition-all">
                    <Repeat2 className="w-[18px] h-[18px]" />
                    {sharesCount > 0 && <span className="text-[11px] font-mono">{sharesCount}</span>}
                </button>

                {/* Stash / Bookmark */}
                <button onClick={handleBookmark} aria-label="Stash"
                    className={`transition-all ${bookmarked ? 'text-brand-text scale-110' : 'text-brand-text/40 hover:text-brand-text'}`}>
                    <Bookmark className={`w-[18px] h-[18px] ${bookmarked ? 'fill-current' : ''}`} />
                </button>
            </div>

            {/* Share Dialog */}
            <ShareDialog postId={post.id} isOpen={showShareDialog} onClose={() => setShowShareDialog(false)} />
        </div>
    )
}
