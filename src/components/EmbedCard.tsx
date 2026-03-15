"use client"

import Link from "next/link"
import { Play, Film, ExternalLink, Eye, Heart } from "lucide-react"
import type { PostDetail } from "@/types/profile"

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

    return (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow">
            {/* Thumbnail area */}
            <Link href={watchUrl} className="block relative aspect-video bg-slate-100 group">
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={embedRef?.title || post.text || "Video"}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#D8103F]/10 to-purple-200">
                        {isFlick ? (
                            <Film className="h-10 w-10 text-[#D8103F]/30" />
                        ) : (
                            <Play className="h-10 w-10 text-[#D8103F]/30" />
                        )}
                    </div>
                )}

                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
                        <Play className="h-5 w-5 text-[#D8103F] ml-0.5" />
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
                            className="text-sm font-semibold text-slate-900 line-clamp-2 hover:text-[#D8103F] transition-colors"
                        >
                            {embedRef?.title || post.text || "Untitled"}
                        </Link>
                        {embedRef?.channel_name && (
                            <p className="text-xs text-slate-500 mt-0.5">{embedRef.channel_name}</p>
                        )}
                    </div>
                    <Link
                        href={watchUrl}
                        className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 hover:bg-[#D8103F]/10 transition-colors"
                        title="Open in PostTube"
                    >
                        <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                    </Link>
                </div>

                {/* Stats */}
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
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
        </div>
    )
}
