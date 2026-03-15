"use client"

import React, { useState } from "react"
import type { ContentSummary } from "@/types/analytics"
import ContentDetailPanel from "./ContentDetailPanel"

interface ContentAnalyticsTableProps {
    items: ContentSummary[]
    isLoading: boolean
    sort: string
    onSortChange: (sort: string) => void
    hasNextPage?: boolean
    isFetchingNextPage?: boolean
    onLoadMore?: () => void
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
    if (id.length <= 8) return id
    return `${id.slice(0, 4)}...${id.slice(-4)}`
}

function cqsColor(score: number): string {
    if (score >= 0.7) return "bg-emerald-50 text-emerald-600 border-emerald-100"
    if (score >= 0.4) return "bg-amber-50 text-amber-600 border-amber-100"
    return "bg-red-50 text-red-500 border-red-100"
}

function cqsDotColor(score: number): string {
    if (score >= 0.7) return "bg-emerald-400"
    if (score >= 0.4) return "bg-amber-400"
    return "bg-red-400"
}

const SORT_OPTIONS = [
    { value: "views_display", label: "Views" },
    { value: "cqs", label: "CQS" },
    { value: "watch_time", label: "Watch Time" },
] as const

function RowSkeleton() {
    return (
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-3 px-4 py-3 animate-pulse">
            <div className="flex items-center gap-2">
                <div className="h-3 bg-[#F0E6DC] rounded-full w-20" />
                <div className="h-4 bg-[#F0E6DC] rounded-lg w-12" />
            </div>
            <div className="h-3 bg-[#F0E6DC] rounded-full w-12" />
            <div className="h-3 bg-[#F0E6DC] rounded-full w-14" />
            <div className="h-3 bg-[#F0E6DC] rounded-full w-10" />
            <div className="h-3 bg-[#F0E6DC] rounded-full w-12" />
            <div className="h-3 bg-[#F0E6DC] rounded-full w-10" />
            <div className="h-3 bg-[#F0E6DC] rounded-full w-10" />
        </div>
    )
}

const ContentAnalyticsTable: React.FC<ContentAnalyticsTableProps> = ({
    items,
    isLoading,
    sort,
    onSortChange,
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
}) => {
    const [selectedContentId, setSelectedContentId] = useState<string | null>(null)

    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl border border-[#F0E6DC] overflow-hidden shadow-sm">
                {/* Sort controls */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[#F0E6DC] bg-[#FAF5F0]">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mr-2">Sort by</span>
                    {SORT_OPTIONS.map((opt) => (
                        <div key={opt.value} className="h-6 bg-[#F0E6DC] rounded-lg w-16 animate-pulse" />
                    ))}
                </div>
                <div className="divide-y divide-[#F0E6DC]">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <RowSkeleton key={i} />
                    ))}
                </div>
            </div>
        )
    }

    if (items.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-[#F0E6DC] p-10 shadow-sm">
                <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#FAF5F0] border border-[#F0E6DC] flex items-center justify-center">
                        <svg className="w-5 h-5 text-[#D4A574]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#7B5B3A]">No content data yet</p>
                    <p className="text-[9px] font-bold text-[#D4A574]">Publish your first video to see content analytics.</p>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="bg-white rounded-2xl border border-[#F0E6DC] overflow-hidden shadow-sm">
                {/* Sort controls */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[#F0E6DC] bg-[#FAF5F0]">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mr-2">Sort by</span>
                    {SORT_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => onSortChange(opt.value)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-200 ${
                                sort === opt.value
                                    ? "bg-white text-[#3C2415] border border-[#D4A574] shadow-sm shadow-[#D4A574]/10"
                                    : "text-[#7B5B3A] border border-transparent hover:bg-white hover:border-[#F0E6DC] hover:text-[#3C2415]"
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {/* Table header - desktop */}
                <div className="hidden lg:grid grid-cols-[minmax(120px,1fr)_80px_80px_80px_80px_80px_64px_64px] gap-3 px-4 py-2.5 bg-[#FAF5F0]/50 border-b border-[#F0E6DC]">
                    <span className="text-[8px] font-black uppercase tracking-widest text-[#7B5B3A]">Content</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-[#7B5B3A] text-right">Views</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-[#7B5B3A] text-right">Watch Time</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-[#7B5B3A] text-right">Avg % Viewed</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-[#7B5B3A] text-right">CQS</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-[#7B5B3A] text-right">Likes</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-[#7B5B3A] text-right">Shares</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-[#7B5B3A]" />
                </div>

                {/* Content rows */}
                <div className="divide-y divide-[#F0E6DC]">
                    {items.map((item) => (
                        <div
                            key={item.content_id}
                            className={`grid grid-cols-1 lg:grid-cols-[minmax(120px,1fr)_80px_80px_80px_80px_80px_64px_64px] gap-2 lg:gap-3 px-4 py-3 hover:bg-[#FAF5F0]/50 transition-colors duration-200 cursor-pointer ${
                                selectedContentId === item.content_id ? "bg-[#FAF5F0]" : ""
                            }`}
                            onClick={() =>
                                setSelectedContentId(
                                    selectedContentId === item.content_id ? null : item.content_id,
                                )
                            }
                        >
                            {/* Content ID + Type */}
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-[10px] font-bold text-[#3C2415] truncate">
                                    {truncateId(item.content_id)}
                                </span>
                                <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest border flex-shrink-0 ${
                                        item.content_type === "reel"
                                            ? "bg-purple-50 text-purple-600 border-purple-100"
                                            : "bg-blue-50 text-blue-600 border-blue-100"
                                    }`}
                                >
                                    {item.content_type === "reel" ? "Flick" : "Video"}
                                </span>
                            </div>

                            {/* Views */}
                            <div className="flex items-center justify-between lg:justify-end">
                                <span className="text-[8px] font-black uppercase tracking-widest text-[#7B5B3A] lg:hidden">Views</span>
                                <span className="text-[11px] font-black text-[#3C2415]">{formatNumber(item.views_display)}</span>
                            </div>

                            {/* Watch Time */}
                            <div className="flex items-center justify-between lg:justify-end">
                                <span className="text-[8px] font-black uppercase tracking-widest text-[#7B5B3A] lg:hidden">Watch Time</span>
                                <span className="text-[11px] font-bold text-[#7B5B3A]">{formatWatchTime(item.watch_time_total_ms)}</span>
                            </div>

                            {/* Avg % Viewed */}
                            <div className="flex items-center justify-between lg:justify-end">
                                <span className="text-[8px] font-black uppercase tracking-widest text-[#7B5B3A] lg:hidden">Avg % Viewed</span>
                                <span className="text-[11px] font-bold text-[#7B5B3A]">{item.avg_percent_viewed.toFixed(1)}%</span>
                            </div>

                            {/* CQS */}
                            <div className="flex items-center justify-between lg:justify-end">
                                <span className="text-[8px] font-black uppercase tracking-widest text-[#7B5B3A] lg:hidden">CQS</span>
                                <div className="flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${cqsDotColor(item.content_quality_score)}`} />
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black border ${cqsColor(item.content_quality_score)}`}>
                                        {(item.content_quality_score * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </div>

                            {/* Likes */}
                            <div className="flex items-center justify-between lg:justify-end">
                                <span className="text-[8px] font-black uppercase tracking-widest text-[#7B5B3A] lg:hidden">Likes</span>
                                <span className="text-[11px] font-bold text-[#7B5B3A]">{formatNumber(item.likes)}</span>
                            </div>

                            {/* Shares */}
                            <div className="flex items-center justify-between lg:justify-end">
                                <span className="text-[8px] font-black uppercase tracking-widest text-[#7B5B3A] lg:hidden">Shares</span>
                                <span className="text-[11px] font-bold text-[#7B5B3A]">{formatNumber(item.shares)}</span>
                            </div>

                            {/* Expand indicator */}
                            <div className="hidden lg:flex items-center justify-center">
                                <svg
                                    className={`w-3.5 h-3.5 text-[#D4A574] transition-transform duration-200 ${
                                        selectedContentId === item.content_id ? "rotate-180" : ""
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Load more */}
                {hasNextPage && onLoadMore && (
                    <div className="border-t border-[#F0E6DC] p-4 flex justify-center">
                        <button
                            onClick={onLoadMore}
                            disabled={isFetchingNextPage}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#FAF5F0] border border-[#F0E6DC] text-[#7B5B3A] hover:border-[#D4A574] hover:text-[#3C2415] hover:bg-white active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isFetchingNextPage ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-[#D4A574] border-t-transparent rounded-full animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                <>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                    Load more
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Detail panel - expandable section below the table */}
            {selectedContentId && (
                <div className="mt-4">
                    <ContentDetailPanel
                        contentId={selectedContentId}
                        onClose={() => setSelectedContentId(null)}
                    />
                </div>
            )}
        </>
    )
}

export default ContentAnalyticsTable
