"use client"

import { motion } from "framer-motion"
import { Play, Video } from "lucide-react"
import Link from "next/link"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    if (hrs > 0) {
        return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    }
    return `${mins}:${String(secs).padStart(2, "0")}`
}

// ---------------------------------------------------------------------------
// VideoEmbedCard
// ---------------------------------------------------------------------------

interface VideoEmbedCardProps {
    embedRef: Record<string, unknown>
}

export function VideoEmbedCard({ embedRef }: VideoEmbedCardProps) {
    const sourcePostId = embedRef.source_post_id as string | undefined
    const title = (embedRef.title as string) || "Untitled Video"
    const thumbnailUrl = embedRef.thumbnail_url as string | undefined
    const durationSeconds = (embedRef.duration_seconds as number) || 0
    const creatorName = (embedRef.creator_name as string) || ""

    const watchUrl = sourcePostId ? `/posttube/watch/${sourcePostId}` : "#"

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="rounded-xl border border-brand-divider overflow-hidden bg-brand-card"
        >
            {/* Thumbnail area — 16:9 */}
            <Link href={watchUrl} className="block relative aspect-video bg-brand-secondary group">
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
                        <Video className="w-12 h-12 text-white/60" />
                    </div>
                )}

                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center group-hover:bg-black/65 transition-colors duration-200">
                        <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                    </div>
                </div>

                {/* Duration badge */}
                {durationSeconds > 0 && (
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-xs font-medium tabular-nums">
                        {formatDuration(durationSeconds)}
                    </span>
                )}
            </Link>

            {/* Info area */}
            <div className="px-4 py-3">
                <p className="text-brand-text text-sm font-semibold leading-snug line-clamp-1">
                    {title}
                </p>

                <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                        {creatorName && (
                            <span className="text-xs text-brand-highlight">{creatorName}</span>
                        )}
                        {creatorName && durationSeconds > 0 && (
                            <span className="text-brand-text/30 text-xs">·</span>
                        )}
                        {durationSeconds > 0 && (
                            <span className="text-xs text-brand-text/60">
                                {formatDuration(durationSeconds)}
                            </span>
                        )}
                    </div>

                    <Link
                        href={watchUrl}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold transition-colors duration-200"
                    >
                        <Play className="w-3 h-3" fill="white" />
                        Watch on Posttube
                    </Link>
                </div>
            </div>
        </motion.div>
    )
}
