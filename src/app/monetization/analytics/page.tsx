"use client"

import React, { useState, useMemo } from "react"
import Link from "next/link"
import { useCreatorOverview, useContentList, useCreatorTrend } from "@/hooks/useCreatorAnalytics"
import AnalyticsOverview from "@/components/monetization/AnalyticsOverview"
import ContentAnalyticsTable from "@/components/monetization/ContentAnalyticsTable"

const PERIODS = [
    { value: "7d", label: "7 Days" },
    { value: "30d", label: "30 Days" },
    { value: "90d", label: "90 Days" },
] as const

export default function AnalyticsPage() {
    const [period, setPeriod] = useState<string>("7d")
    const [sort, setSort] = useState<string>("views_display")

    const { data: overview, isLoading: overviewLoading, isError: overviewError } = useCreatorOverview(period)
    const { data: trend, isLoading: trendLoading } = useCreatorTrend(period)
    const {
        data: contentPages,
        isLoading: contentLoading,
        isError: contentError,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
    } = useContentList(sort)

    const contentItems = useMemo(
        () => contentPages?.pages.flatMap((page) => page.data) ?? [],
        [contentPages],
    )

    const isError = overviewError || contentError

    return (
        <div className="min-h-screen bg-[#FAF5F0]">
            <div className="max-w-4xl mx-auto px-4 pt-10 pb-16">
                {/* Page heading */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-[0.8rem] bg-gradient-to-br from-[#D4A574] to-[#7B5B3A] flex items-center justify-center shadow-lg shadow-[#D4A574]/20">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-[#3C2415]">Content Analytics</h1>
                    </div>
                    <p className="text-[11px] font-bold text-[#7B5B3A] uppercase tracking-widest ml-[52px]">
                        Understand your audience & content performance
                    </p>
                </div>

                {/* Navigation tabs */}
                <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1">
                    <Link
                        href="/monetization"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 bg-[#FAF5F0] text-[#7B5B3A] border-transparent border hover:bg-brand-card hover:text-[#3C2415] hover:border-[#F0E6DC] transition-all duration-200"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Dashboard
                    </Link>
                    <Link
                        href="/monetization/analytics"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 bg-brand-card text-[#3C2415] border-[#D4A574] border shadow-sm shadow-[#D4A574]/10"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Analytics
                    </Link>
                    <Link
                        href="/monetization/tiers"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 bg-[#FAF5F0] text-[#7B5B3A] border-transparent border hover:bg-brand-card hover:text-[#3C2415] hover:border-[#F0E6DC] transition-all duration-200"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Tiers
                    </Link>
                    <Link
                        href="/monetization/payouts"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 bg-[#FAF5F0] text-[#7B5B3A] border-transparent border hover:bg-brand-card hover:text-[#3C2415] hover:border-[#F0E6DC] transition-all duration-200"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Payouts
                    </Link>
                </div>

                {/* Divider */}
                <div className="h-px bg-[#F0E6DC] mb-6" />

                {/* Period selector */}
                <div className="flex items-center gap-2 mb-6">
                    <div className="flex items-center gap-2 mr-3">
                        <div className="w-6 h-6 rounded-md bg-[#FAF5F0] border border-[#F0E6DC] flex items-center justify-center">
                            <svg className="w-3 h-3 text-[#D4A574]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#7B5B3A]">Period</span>
                    </div>
                    {PERIODS.map((p) => (
                        <button
                            key={p.value}
                            onClick={() => setPeriod(p.value)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${
                                period === p.value
                                    ? "bg-brand-card text-[#3C2415] border border-[#D4A574] shadow-sm shadow-[#D4A574]/10"
                                    : "text-[#7B5B3A] border border-transparent hover:bg-brand-card hover:border-[#F0E6DC] hover:text-[#3C2415]"
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Error state */}
                {isError ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className="text-[11px] font-black uppercase tracking-widest text-[#3C2415]">Something went wrong</p>
                            <p className="text-[10px] font-bold text-[#7B5B3A] mt-0.5">Failed to load analytics data. Please try again later.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Overview cards */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-[#FAF5F0] border border-[#F0E6DC] flex items-center justify-center">
                                    <svg className="w-4 h-4 text-[#D4A574]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-xs font-black text-[#3C2415]">Performance Overview</h3>
                                    <p className="text-[9px] font-bold text-[#7B5B3A] uppercase tracking-widest">Key metrics at a glance</p>
                                </div>
                            </div>
                            <AnalyticsOverview
                                overview={overview}
                                trend={trend}
                                isLoading={overviewLoading || trendLoading}
                            />
                        </div>

                        {/* Content table */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-[#FAF5F0] border border-[#F0E6DC] flex items-center justify-center">
                                    <svg className="w-4 h-4 text-[#D4A574]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-xs font-black text-[#3C2415]">Content Performance</h3>
                                    <p className="text-[9px] font-bold text-[#7B5B3A] uppercase tracking-widest">Click a row to see detailed analytics</p>
                                </div>
                            </div>
                            <ContentAnalyticsTable
                                items={contentItems}
                                isLoading={contentLoading}
                                sort={sort}
                                onSortChange={setSort}
                                hasNextPage={hasNextPage}
                                isFetchingNextPage={isFetchingNextPage}
                                onLoadMore={() => fetchNextPage()}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
