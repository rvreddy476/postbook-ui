"use client"

import React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Hash, Sparkles, TrendingUp, Loader2, AlertCircle } from "lucide-react"
import { useTrending, useSuggested, TrendingHashtag } from "@/hooks/useSearch"
import type { PostDetail } from "@/types/profile"
import PostCard from "@/components/PostCard"

// ─── Trending hashtag pill ────────────────────────────────────────────────────

interface HashtagPillProps {
    item: TrendingHashtag
    rank: number
}

function HashtagPill({ item, rank }: HashtagPillProps) {
    const router = useRouter()

    const rankColors: Record<number, string> = {
        1: "from-amber-400 to-orange-500",
        2: "from-slate-400 to-slate-500",
        3: "from-amber-600 to-amber-700",
    }
    const gradientClass = rankColors[rank] ?? "from-[#D8103F]/50 to-fuchsia-500"

    return (
        <button
            onClick={() => router.push(`/hashtag/${item.tag}`)}
            className="group flex items-center gap-3 p-4 bg-brand-card rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#D8103F]/10 transition-all duration-200 text-left w-full"
        >
            {/* Rank badge */}
            <div
                className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-200`}
            >
                <span className="text-white text-xs font-black">#{rank}</span>
            </div>

            {/* Tag info */}
            <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-gray-900 group-hover:text-[#b80d35] transition-colors truncate">
                    #{item.tag}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                    <p className="text-xs text-gray-400 font-medium">
                        {item.post_count.toLocaleString()} post{item.post_count !== 1 ? "s" : ""}
                        {item.growth_rate !== undefined && item.growth_rate > 0 && (
                            <span className="ml-1.5 text-emerald-500 font-semibold">
                                +{item.growth_rate.toFixed(0)}%
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* Arrow */}
            <div className="flex-shrink-0 text-gray-300 group-hover:text-[#D8103F]/50 group-hover:translate-x-0.5 transition-all duration-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            </div>
        </button>
    )
}

// ─── Trending hashtag card grid (for larger display) ─────────────────────────

interface HashtagCardProps {
    item: TrendingHashtag
}

function HashtagCard({ item }: HashtagCardProps) {
    const router = useRouter()

    return (
        <button
            onClick={() => router.push(`/hashtag/${item.tag}`)}
            className="group flex flex-col items-center justify-center gap-2 p-5 bg-brand-card rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#D8103F]/10 hover:bg-[#D8103F]/30 transition-all duration-200 aspect-square"
        >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D8103F]/50 to-fuchsia-500 flex items-center justify-center shadow-md shadow-[#D8103F]/20 group-hover:scale-105 transition-transform duration-200">
                <Hash className="w-6 h-6 text-white" />
            </div>
            <p className="text-sm font-bold text-gray-900 group-hover:text-[#b80d35] transition-colors truncate max-w-full px-1">
                {item.tag}
            </p>
            <p className="text-xs text-gray-400 font-medium">
                {item.post_count >= 1000
                    ? `${(item.post_count / 1000).toFixed(1)}K`
                    : item.post_count} posts
            </p>
        </button>
    )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
    icon,
    title,
    subtitle,
    action,
}: {
    icon: React.ReactNode
    title: string
    subtitle?: string
    action?: React.ReactNode
}) {
    return (
        <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D8103F]/50 to-fuchsia-500 flex items-center justify-center shadow-md shadow-[#D8103F]/20">
                    {icon}
                </div>
                <div>
                    <h2 className="text-base font-black text-gray-900">{title}</h2>
                    {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
                </div>
            </div>
            {action && <div>{action}</div>}
        </div>
    )
}

// ─── Error card ───────────────────────────────────────────────────────────────

function ErrorCard({ message }: { message: string }) {
    return (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-600 font-medium">{message}</p>
        </div>
    )
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function TrendingSkeletons() {
    return (
        <div className="space-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-brand-card rounded-2xl border border-gray-100">
                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                        <div className="h-4 bg-gray-100 rounded-lg w-1/3" />
                        <div className="h-3 bg-gray-100 rounded-lg w-1/4" />
                    </div>
                </div>
            ))}
        </div>
    )
}

function SuggestedSkeletons() {
    return (
        <div className="space-y-4 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-brand-card rounded-xl border border-gray-100 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-gray-100" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-4 bg-gray-100 rounded-lg w-1/4" />
                            <div className="h-3 bg-gray-100 rounded-lg w-1/6" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="h-3 bg-gray-100 rounded-lg w-full" />
                        <div className="h-3 bg-gray-100 rounded-lg w-3/4" />
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── Main discover page ───────────────────────────────────────────────────────

export default function DiscoverPage() {
    const { data: trendingData, isLoading: trendingLoading, isError: trendingError } = useTrending()
    const { data: suggestedData, isLoading: suggestedLoading, isError: suggestedError } = useSuggested()

    const hashtags = trendingData?.hashtags ?? []
    const suggestedPosts = suggestedData?.posts ?? []

    // Split hashtags: top 3 as list with rank, rest as grid pills
    const topHashtags = hashtags.slice(0, 5)
    const moreHashtags = hashtags.slice(5)

    return (
        <div className="min-h-screen bg-brand-bg">
            {/* Page header */}
            <div className="sticky top-0 z-10 bg-brand-card/90 backdrop-blur-xl border-b border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D8103F]/50 to-fuchsia-500 flex items-center justify-center shadow-md shadow-[#D8103F]/20">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-900 tracking-tight">Discover</h1>
                        <p className="text-xs text-gray-400 font-medium">Trending topics and suggested content</p>
                    </div>
                    <Link
                        href="/search"
                        className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm font-bold text-gray-600 hover:bg-[#D8103F]/5 hover:border-[#D8103F]/20 hover:text-[#b80d35] transition-all"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="11" cy="11" r="8" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                        </svg>
                        Search
                    </Link>
                </div>
            </div>

            {/* Main content */}
            <main className="max-w-2xl mx-auto px-4 py-6 space-y-10">

                {/* ── Trending Hashtags ── */}
                <section>
                    <SectionHeader
                        icon={<TrendingUp className="w-5 h-5 text-white" />}
                        title="Trending Now"
                        subtitle="What people are talking about"
                    />

                    {trendingLoading && <TrendingSkeletons />}

                    {trendingError && (
                        <ErrorCard message="Could not load trending topics. Please try again later." />
                    )}

                    {!trendingLoading && !trendingError && hashtags.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D8103F]/5 to-fuchsia-50 border border-[#D8103F]/10 flex items-center justify-center">
                                <Hash className="w-7 h-7 text-[#D8103F]/30" />
                            </div>
                            <p className="text-sm font-semibold text-gray-500">No trending topics right now</p>
                        </div>
                    )}

                    {!trendingLoading && topHashtags.length > 0 && (
                        <div className="space-y-3">
                            {topHashtags.map((item, index) => (
                                <HashtagPill key={item.tag} item={item} rank={index + 1} />
                            ))}
                        </div>
                    )}

                    {/* Additional hashtags in pill grid */}
                    {!trendingLoading && moreHashtags.length > 0 && (
                        <div className="mt-4 grid grid-cols-3 gap-3">
                            {moreHashtags.map((item) => (
                                <HashtagCard key={item.tag} item={item} />
                            ))}
                        </div>
                    )}

                    {/* View all hashtags link */}
                    {!trendingLoading && hashtags.length > 0 && (
                        <div className="mt-4 text-center">
                            <Link
                                href="/search?type=all"
                                className="inline-flex items-center gap-2 text-sm font-bold text-[#D8103F] hover:text-[#8a0a28] transition-colors"
                            >
                                <Hash className="w-4 h-4" />
                                Explore all hashtags
                            </Link>
                        </div>
                    )}
                </section>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

                {/* ── Suggested Posts ── */}
                <section>
                    <SectionHeader
                        icon={<Sparkles className="w-5 h-5 text-white" />}
                        title="Suggested for You"
                        subtitle="Posts you might enjoy"
                    />

                    {suggestedLoading && <SuggestedSkeletons />}

                    {suggestedError && (
                        <ErrorCard message="Could not load suggested posts. Please try again later." />
                    )}

                    {!suggestedLoading && !suggestedError && suggestedPosts.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D8103F]/5 to-fuchsia-50 border border-[#D8103F]/10 flex items-center justify-center">
                                <Sparkles className="w-7 h-7 text-[#D8103F]/30" />
                            </div>
                            <p className="text-sm font-semibold text-gray-500">No suggestions yet — explore more to get started</p>
                        </div>
                    )}

                    {!suggestedLoading && suggestedPosts.length > 0 && (
                        <div className="space-y-4">
                            {suggestedPosts.map((post: PostDetail) => (
                                <PostCard key={post.id} post={post} />
                            ))}
                        </div>
                    )}

                    {suggestedLoading && (
                        <div className="flex justify-center py-4">
                            <Loader2 className="w-6 h-6 text-[#D8103F]/50 animate-spin" />
                        </div>
                    )}
                </section>
            </main>
        </div>
    )
}
