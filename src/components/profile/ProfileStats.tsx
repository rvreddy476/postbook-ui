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
        { key: "posts", label: "Posts", value: contentCounts.total, icon: Newspaper, color: "text-[#D8103F]", bgColor: "bg-[#D8103F]/5 group-hover:bg-[#D8103F]/10" },
        { key: "friends", label: "Friends", value: graphCounts.friend_count, icon: Users, color: "text-teal-600", bgColor: "bg-teal-50 group-hover:bg-teal-100" },
        { key: "followers", label: "Followers", value: graphCounts.follower_count, icon: Heart, color: "text-rose-500", bgColor: "bg-rose-50 group-hover:bg-rose-100" },
        { key: "following", label: "Following", value: graphCounts.following_count, icon: UserPlus, color: "text-amber-600", bgColor: "bg-amber-50 group-hover:bg-amber-100" },
    ]

    return (
        <div className="flex items-center gap-3 py-3">
            {stats.map((stat, i) => {
                const Icon = stat.icon
                return (
                    <motion.button
                        key={stat.key}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        onClick={() => onStatClick?.(stat.key)}
                        className="group flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-200"
                    >
                        <div className={`p-1.5 rounded-xl ${stat.bgColor} transition-colors duration-200`}>
                            <Icon className={`w-4 h-4 ${stat.color}`} />
                        </div>
                        <div className="flex flex-col items-start leading-tight">
                            <span className="text-base font-bold text-slate-900">
                                {formatCount(stat.value)}
                            </span>
                            <span className="text-[11px] font-medium text-slate-400 tracking-wide">
                                {stat.label}
                            </span>
                        </div>
                    </motion.button>
                )
            })}
        </div>
    )
}
