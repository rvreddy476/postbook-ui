"use client"

import type { GraphCounts, ContentCounts } from "@/types/profile"
import { motion } from "framer-motion"
import { Newspaper, Users, Heart, UserPlus } from "lucide-react"

interface ProfileStatsProps {
    graphCounts: GraphCounts
    contentCounts: ContentCounts
    onStatClick?: (stat: string) => void
}

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toString()
}

interface StatItem {
    key: string
    label: string
    value: number
    icon: typeof Newspaper
    color: string
    bgColor: string
}

export function ProfileStats({ graphCounts, contentCounts, onStatClick }: ProfileStatsProps) {
    const stats: StatItem[] = [
        { key: "posts", label: "Posts", value: contentCounts.total, icon: Newspaper, color: "text-sky-500", bgColor: "" },
        { key: "followers", label: "Followers", value: graphCounts.follower_count, icon: Heart, color: "text-rose-500", bgColor: "" },
        { key: "following", label: "Following", value: graphCounts.following_count, icon: UserPlus, color: "text-amber-500", bgColor: "" },
        { key: "friends", label: "Friends", value: graphCounts.friend_count, icon: Users, color: "text-emerald-500", bgColor: "" },
    ]

    return (
        <div className="rounded-2xl border border-brand-divider bg-brand-card shadow-sm p-5">
            <div className="grid grid-cols-4 gap-2">
                {stats.map((stat, i) => {
                    const Icon = stat.icon
                    return (
                        <motion.button
                            key={stat.key}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06 }}
                            onClick={() => onStatClick?.(stat.key)}
                            className="group flex flex-col items-center text-center gap-1 rounded-xl py-2 hover:bg-brand-secondary transition-colors duration-200"
                        >
                            <Icon className={`w-4 h-4 ${stat.color}`} />
                            <span className="text-lg font-black text-brand-text tracking-tight leading-none">
                                {formatCount(stat.value)}
                            </span>
                            <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-brand-text/50">
                                {stat.label}
                            </span>
                        </motion.button>
                    )
                })}
            </div>
        </div>
    )
}
