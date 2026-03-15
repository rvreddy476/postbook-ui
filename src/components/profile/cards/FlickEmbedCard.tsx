"use client"

import { motion } from "framer-motion"
import { Play, Film } from "lucide-react"
import Link from "next/link"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, "0")}`
}

// ---------------------------------------------------------------------------
// FlickEmbedCard
// ---------------------------------------------------------------------------

interface FlickEmbedCardProps {
    embedRef: Record<string, unknown>
}

export function FlickEmbedCard({ embedRef }: FlickEmbedCardProps) {
    const sourcePostId = embedRef.source_post_id as string | undefined
    const caption = (embedRef.caption as string) || ""
    const thumbnailUrl = embedRef.thumbnail_url as string | undefined
    const durationSeconds = (embedRef.duration_seconds as number) || 0
    const creatorName = (embedRef.creator_name as string) || ""

    const flickUrl = sourcePostId ? `/postgram/flick/${sourcePostId}` : "#"

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="rounded-xl border border-slate-200 overflow-hidden bg-white inline-block max-w-[220px]"
        >
            {/* Thumbnail area — 9:16 portrait, capped height */}
            <Link href={flickUrl} className="block relative bg-slate-100 group" style={{ aspectRatio: "9/16", maxHeight: 300 }}>
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={caption || "Flick"}
                        loading="lazy"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#D8103F]/50 to-[#D8103F] flex items-center justify-center">
                        <Film className="w-10 h-10 text-white/60" />
                    </div>
                )}

                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center group-hover:bg-black/65 transition-colors duration-200">
                        <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                    </div>
                </div>

                {/* Duration badge */}
                {durationSeconds > 0 && (
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-[11px] font-medium tabular-nums">
                        {formatDuration(durationSeconds)}
                    </span>
                )}
            </Link>

            {/* Info area */}
            <div className="px-3 py-3">
                {caption && (
                    <p className="text-slate-950 text-sm leading-snug line-clamp-2 mb-1">
                        {caption}
                    </p>
                )}

                {creatorName && (
                    <p className="text-xs text-slate-400 mb-2.5">{creatorName}</p>
                )}

                <Link
                    href={flickUrl}
                    className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg bg-[#D8103F] hover:bg-[#b80d35] text-white text-xs font-semibold transition-colors duration-200"
                >
                    <Film className="w-3 h-3" />
                    View Flick
                </Link>
            </div>
        </motion.div>
    )
}
