"use client"

import React from "react"
import { useContentAnalytics, useContentTrend } from "@/hooks/useCreatorAnalytics"

interface ContentDetailPanelProps {
    contentId: string
    onClose: () => void
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

function truncateId(id: string): string {
    if (id.length <= 12) return id
    return `${id.slice(0, 6)}...${id.slice(-6)}`
}

function cqsDotColor(score: number): string {
    if (score >= 0.7) return "bg-emerald-400"
    if (score >= 0.4) return "bg-amber-400"
    return "bg-red-400"
}

function cqsLabel(score: number): string {
    if (score >= 0.7) return "Excellent"
    if (score >= 0.4) return "Average"
    return "Needs improvement"
}

function formatHour(hour: string): string {
    // hour is ISO string or "HH:00" format - extract just the hour part for display
    if (hour.length <= 5) return hour
    try {
        const d = new Date(hour)
        return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    } catch {
        return hour.slice(11, 16)
    }
}

const ContentDetailPanel: React.FC<ContentDetailPanelProps> = ({ contentId, onClose }) => {
    const { data: detail, isLoading: detailLoading } = useContentAnalytics(contentId, "7d")
    const { data: trend, isLoading: trendLoading } = useContentTrend(contentId)

    const isLoading = detailLoading || trendLoading
    const metrics = detail?.metrics
    const hourlyTrend = trend ?? detail?.trend ?? []

    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl border border-[#D4A574] p-6 shadow-md shadow-[#D4A574]/10 animate-pulse">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="h-4 bg-[#F0E6DC] rounded-full w-32" />
                        <div className="h-5 bg-[#F0E6DC] rounded-lg w-14" />
                    </div>
                    <div className="w-8 h-8 bg-[#F0E6DC] rounded-lg" />
                </div>
                <div className="h-40 bg-[#F0E6DC] rounded-xl mb-6" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                            <div className="h-2.5 bg-[#F0E6DC] rounded-full w-16" />
                            <div className="h-5 bg-[#F0E6DC] rounded-full w-20" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (!metrics) {
        return (
            <div className="bg-white rounded-2xl border border-[#F0E6DC] p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#7B5B3A]">Content Details</p>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-[#FAF5F0] border border-[#F0E6DC] flex items-center justify-center hover:border-[#D4A574] transition-colors"
                    >
                        <svg className="w-4 h-4 text-[#7B5B3A]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <p className="text-[10px] font-bold text-[#D4A574]">Unable to load content details.</p>
            </div>
        )
    }

    // Compute chart bar heights
    const maxViews = Math.max(...hourlyTrend.map((h) => h.views), 1)
    const chartHeight = 120

    return (
        <div className="bg-white rounded-2xl border border-[#D4A574] p-6 shadow-md shadow-[#D4A574]/10">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-black text-[#3C2415]">
                        {truncateId(metrics.content_id)}
                    </span>
                    <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest border ${
                            metrics.content_type === "reel"
                                ? "bg-purple-50 text-purple-600 border-purple-100"
                                : "bg-blue-50 text-blue-600 border-blue-100"
                        }`}
                    >
                        {metrics.content_type === "reel" ? "Reel" : "Long Video"}
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-lg bg-[#FAF5F0] border border-[#F0E6DC] flex items-center justify-center hover:border-[#D4A574] transition-colors"
                >
                    <svg className="w-4 h-4 text-[#7B5B3A]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Hourly trend chart */}
            {hourlyTrend.length > 0 && (
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-md bg-[#FAF5F0] border border-[#F0E6DC] flex items-center justify-center">
                            <svg className="w-3 h-3 text-[#D4A574]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4" />
                            </svg>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#7B5B3A]">Hourly Trend</span>
                    </div>
                    <div className="bg-[#FAF5F0] rounded-xl border border-[#F0E6DC] p-4">
                        <div className="flex items-end gap-1 overflow-x-auto" style={{ height: chartHeight }}>
                            {hourlyTrend.map((point, idx) => {
                                const barHeight = Math.max((point.views / maxViews) * (chartHeight - 20), 2)
                                return (
                                    <div
                                        key={idx}
                                        className="flex flex-col items-center gap-1 flex-shrink-0"
                                        style={{ minWidth: hourlyTrend.length > 24 ? 16 : 28 }}
                                    >
                                        <div className="relative group">
                                            {/* Tooltip */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                                                <div className="bg-[#3C2415] text-white text-[8px] font-bold rounded-lg px-2 py-1 whitespace-nowrap shadow-lg">
                                                    <div>{formatNumber(point.views)} views</div>
                                                    <div>{formatNumber(point.plays)} plays</div>
                                                    <div>{formatWatchTime(point.watch_time_ms)}</div>
                                                </div>
                                            </div>
                                            <div
                                                className="w-full rounded-t-md bg-gradient-to-t from-[#D4A574] to-[#D4A574]/60 hover:from-[#7B5B3A] hover:to-[#D4A574] transition-all duration-200 cursor-pointer"
                                                style={{
                                                    height: barHeight,
                                                    minWidth: hourlyTrend.length > 24 ? 8 : 16,
                                                }}
                                            />
                                        </div>
                                        {/* Only show labels for every Nth bar to avoid crowding */}
                                        {(idx % Math.max(Math.floor(hourlyTrend.length / 12), 1) === 0) && (
                                            <span className="text-[6px] font-bold text-[#D4A574] whitespace-nowrap">
                                                {formatHour(point.hour)}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Key metrics grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-[#FAF5F0] rounded-xl border border-[#F0E6DC] p-3">
                    <p className="text-[8px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1">Views</p>
                    <p className="text-lg font-black text-[#3C2415]">{formatNumber(metrics.views_display)}</p>
                    <p className="text-[8px] font-bold text-[#D4A574]">{formatNumber(metrics.unique_viewers)} unique</p>
                </div>

                <div className="bg-[#FAF5F0] rounded-xl border border-[#F0E6DC] p-3">
                    <p className="text-[8px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1">Watch Time</p>
                    <p className="text-lg font-black text-[#3C2415]">{formatWatchTime(metrics.watch_time_total_ms)}</p>
                    <p className="text-[8px] font-bold text-[#D4A574]">avg {formatWatchTime(metrics.avg_watch_time_ms)}</p>
                </div>

                <div className="bg-[#FAF5F0] rounded-xl border border-[#F0E6DC] p-3">
                    <p className="text-[8px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1">Completion</p>
                    <p className="text-lg font-black text-[#3C2415]">{(metrics.completion_rate * 100).toFixed(1)}%</p>
                    <p className="text-[8px] font-bold text-[#D4A574]">avg {metrics.avg_percent_viewed.toFixed(1)}% viewed</p>
                </div>

                <div className="bg-[#FAF5F0] rounded-xl border border-[#F0E6DC] p-3">
                    <p className="text-[8px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1">Content Quality</p>
                    <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${cqsDotColor(metrics.content_quality_score)}`} />
                        <p className="text-lg font-black text-[#3C2415]">
                            {(metrics.content_quality_score * 100).toFixed(0)}%
                        </p>
                    </div>
                    <p className="text-[8px] font-bold text-[#D4A574]">{cqsLabel(metrics.content_quality_score)}</p>
                </div>
            </div>

            {/* Engagement stats */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-4">
                {[
                    { label: "Impressions", value: formatNumber(metrics.impressions) },
                    { label: "Plays", value: formatNumber(metrics.plays) },
                    { label: "Likes", value: formatNumber(metrics.likes) },
                    { label: "Comments", value: formatNumber(metrics.comments) },
                    { label: "Shares", value: formatNumber(metrics.shares) },
                    { label: "Saves", value: formatNumber(metrics.saves) },
                ].map((stat) => (
                    <div key={stat.label} className="text-center">
                        <p className="text-[7px] font-black uppercase tracking-widest text-[#D4A574] mb-0.5">{stat.label}</p>
                        <p className="text-sm font-black text-[#3C2415]">{stat.value}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default ContentDetailPanel
