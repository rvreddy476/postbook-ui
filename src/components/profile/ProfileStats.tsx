"use client"

import type { GraphCounts, ContentCounts, AppPlatform } from "@/types/profile"
import { motion } from "framer-motion"

interface ProfileStatsProps {
    graphCounts: GraphCounts
    contentCounts: ContentCounts
    platform: AppPlatform
}

interface StatItem {
    label: string
    value: number
}

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toString()
}

export function ProfileStats({ graphCounts, contentCounts, platform }: ProfileStatsProps) {
    const stats: StatItem[] = []

    if (platform === "postboek") {
        stats.push(
            { label: "Posts", value: contentCounts.total },
            { label: "Followers", value: graphCounts.follower_count },
            { label: "Following", value: graphCounts.following_count },
            { label: "Circle", value: graphCounts.friend_count },
        )
    } else if (platform === "posttube") {
        stats.push(
            { label: "Transmissions", value: contentCounts.video },
            { label: "Briefs", value: contentCounts.short },
            { label: "Subscribers", value: graphCounts.follower_count },
        )
    } else {
        // postgram
        stats.push(
            { label: "Snapshots", value: contentCounts.post + contentCounts.photo },
            { label: "Followers", value: graphCounts.follower_count },
            { label: "Following", value: graphCounts.following_count },
        )
    }

    return (
        <div className="flex flex-wrap justify-center md:justify-start gap-4 py-8">
            {stats.map((stat, index) => (
                <motion.button
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex-1 min-w-[140px] group cursor-pointer relative"
                >
                    <div className="absolute inset-0 bg-white/40 rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] active:scale-95 transition-all duration-300 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] group-hover:-translate-y-1 group-hover:bg-white" />

                    <div className="relative p-5 flex flex-col items-center gap-1">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover:text-violet-600 transition-colors">
                            {stat.label}
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-slate-950 tracking-tighter italic">
                                {formatCount(stat.value)}
                            </span>
                        </div>

                        {/* Status Ring */}
                        <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full bg-slate-200 group-hover:bg-violet-400 transition-colors shadow-sm" />
                    </div>
                </motion.button>
            ))}
        </div>
    )
}
