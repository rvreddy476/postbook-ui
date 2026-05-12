"use client"

import { ContentCounts } from "@/types/profile"
import { Film, Clapperboard, Sparkles } from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"

interface CreatorCardProps {
    username: string
    contentCounts: ContentCounts
}

export default function CreatorCard({ username, contentCounts }: CreatorCardProps) {
    const hasCreatorContent = contentCounts.video > 0 || contentCounts.reel > 0

    if (!hasCreatorContent) return null

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.15 }}
            className="bg-brand-card rounded-2xl shadow-sm border border-brand-divider overflow-hidden"
        >
            {/* Teal gradient header */}
            <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-5 py-3">
                <div className="flex items-center gap-2">
                    <Film className="h-4 w-4 text-white" />
                    <span className="text-sm font-bold text-white">Creator on atpost</span>
                </div>
            </div>

            <div className="p-5 space-y-3">
                {contentCounts.video > 0 && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-sm text-brand-highlight">
                            <Film className="h-4 w-4 text-brand-text/60" />
                            <span>Posttube Videos</span>
                        </div>
                        <span className="text-sm font-semibold text-brand-text">
                            {contentCounts.video.toLocaleString()}
                        </span>
                    </div>
                )}

                {contentCounts.reel > 0 && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-sm text-brand-highlight">
                            <Clapperboard className="h-4 w-4 text-brand-text/60" />
                            <span>Reels</span>
                        </div>
                        <span className="text-sm font-semibold text-brand-text">
                            {contentCounts.reel.toLocaleString()}
                        </span>
                    </div>
                )}

                {contentCounts.total > 0 && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-sm text-brand-highlight">
                            <Sparkles className="h-4 w-4 text-brand-text/60" />
                            <span>Total Sparks</span>
                        </div>
                        <span className="text-sm font-semibold text-brand-text">
                            {contentCounts.total.toLocaleString()}
                        </span>
                    </div>
                )}

                <Link
                    href={`/posttube/channel/${username}`}
                    className="block mt-1 w-full text-center text-sm font-semibold text-brand-text hover:text-brand-text transition-colors"
                >
                    View Channel
                </Link>
            </div>
        </motion.div>
    )
}
