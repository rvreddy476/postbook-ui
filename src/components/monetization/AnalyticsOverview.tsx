"use client"

import React from "react"
import type { CreatorOverview, DailyDataPoint } from "@/types/analytics"

interface AnalyticsOverviewProps {
    overview: CreatorOverview | undefined
    trend: DailyDataPoint[] | undefined
    isLoading: boolean
}

function formatWatchTime(ms: number): string {
    const totalMinutes = Math.floor(ms / 60_000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
}

function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toLocaleString()
}

function Sparkline({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
    if (!data || data.length === 0) return null
    const max = Math.max(...data, 1)
    const width = 120
    const step = width / Math.max(data.length - 1, 1)

    const points = data.map((v, i) => {
        const x = i * step
        const y = height - (v / max) * (height - 4)
        return `${x},${y}`
    }).join(" ")

    const areaPoints = `0,${height} ${points} ${(data.length - 1) * step},${height}`

    return (
        <svg width={width} height={height} className="flex-shrink-0">
            <defs>
                <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <polygon points={areaPoints} fill={`url(#spark-${color})`} />
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

function StatCardSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-[#F0E6DC] p-5 shadow-sm animate-pulse">
            <div className="h-2.5 bg-[#F0E6DC] rounded-full w-20 mb-3" />
            <div className="h-6 bg-[#F0E6DC] rounded-full w-24 mb-2" />
            <div className="h-10 bg-[#F0E6DC] rounded-lg w-full" />
        </div>
    )
}

const AnalyticsOverview: React.FC<AnalyticsOverviewProps> = ({ overview, trend, isLoading }) => {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <StatCardSkeleton key={i} />
                ))}
            </div>
        )
    }

    if (!overview) {
        return (
            <div className="bg-white rounded-2xl border border-[#F0E6DC] p-10 shadow-sm">
                <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#FAF5F0] border border-[#F0E6DC] flex items-center justify-center">
                        <svg className="w-5 h-5 text-[#D4A574]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#7B5B3A]">No analytics data yet</p>
                    <p className="text-[9px] font-bold text-[#D4A574]">Start posting content to see your analytics here.</p>
                </div>
            </div>
        )
    }

    const viewsTrend = trend?.map((d) => d.views) ?? []
    const watchTimeTrend = trend?.map((d) => d.watch_time_ms) ?? []
    const cqsTrend = trend?.map((d) => d.cqs) ?? []

    const stats = [
        {
            label: "Total Views",
            value: formatNumber(overview.total_views),
            sparkData: viewsTrend,
            sparkColor: "#D4A574",
            icon: (
                <svg className="w-4 h-4 text-[#D4A574]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
            ),
        },
        {
            label: "Watch Time",
            value: formatWatchTime(overview.total_watch_time_ms),
            sparkData: watchTimeTrend,
            sparkColor: "#7B5B3A",
            icon: (
                <svg className="w-4 h-4 text-[#7B5B3A]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
        {
            label: "Average CQS",
            value: `${(overview.avg_cqs * 100).toFixed(1)}%`,
            sparkData: cqsTrend,
            sparkColor: overview.avg_cqs >= 0.7 ? "#16a34a" : overview.avg_cqs >= 0.4 ? "#ca8a04" : "#dc2626",
            icon: (
                <svg className="w-4 h-4 text-[#3C2415]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
            ),
        },
        {
            label: "Likes",
            value: formatNumber(overview.total_likes),
            sparkData: [],
            sparkColor: "#D4A574",
            icon: (
                <svg className="w-4 h-4 text-[#D4A574]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
            ),
        },
        {
            label: "Shares",
            value: formatNumber(overview.total_shares),
            sparkData: [],
            sparkColor: "#7B5B3A",
            icon: (
                <svg className="w-4 h-4 text-[#7B5B3A]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
            ),
        },
    ]

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.map((stat) => (
                <div
                    key={stat.label}
                    className="bg-white rounded-2xl border border-[#F0E6DC] p-5 shadow-sm hover:shadow-md hover:border-[#D4A574] transition-all duration-300"
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-[#FAF5F0] border border-[#F0E6DC] flex items-center justify-center">
                                {stat.icon}
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#7B5B3A]">
                                {stat.label}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-end justify-between gap-3">
                        <p className="text-2xl font-black text-[#3C2415] tracking-tight">{stat.value}</p>
                        {stat.sparkData.length > 1 && (
                            <Sparkline data={stat.sparkData} color={stat.sparkColor} />
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}

export default AnalyticsOverview
