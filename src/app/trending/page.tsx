'use client'

import React from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { formatPostCount, useLiveTrendingHashtags, useTrendingHashtags } from '@/hooks/useHashtags'
import { Flame, Hash, Loader2, TrendingUp } from 'lucide-react'

const RANK_GRADIENTS = [
    'from-yellow-400 to-orange-500',
    'from-slate-300 to-slate-400',
    'from-amber-600 to-amber-700',
]

export default function TrendingPage() {
    const { data: tags = [], isLoading, isError } = useTrendingHashtags(30)
    useLiveTrendingHashtags(30)

    return (
        <AppShell>
            <div className="min-h-screen bg-brand-bg">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-brand-card/80 backdrop-blur-xl border-b border-brand-divider shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                    <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shadow-lg shadow-orange-500/20 flex-shrink-0">
                            <Flame className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-brand-text tracking-tight">Trending Now</h1>
                            <p className="text-xs font-semibold text-brand-text/40 mt-0.5">Top hashtags in the last 24 hours</p>
                        </div>
                    </div>
                </div>

                <main className="max-w-2xl mx-auto px-4 py-6">
                    {/* Loading */}
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center animate-pulse">
                                <Flame className="w-6 h-6 text-white" />
                            </div>
                            <Loader2 className="w-5 h-5 text-brand-text/50 animate-spin" />
                            <p className="text-xs font-semibold text-brand-text/40">Loading trending hashtags...</p>
                        </div>
                    )}

                    {/* Error */}
                    {isError && (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                                <span className="text-2xl">!</span>
                            </div>
                            <p className="text-sm font-bold text-brand-text">Could not load trending hashtags</p>
                        </div>
                    )}

                    {/* Empty */}
                    {!isLoading && !isError && tags.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-text/5 to-orange-50 border border-brand-text/10 flex items-center justify-center">
                                <TrendingUp className="w-9 h-9 text-brand-text/30" />
                            </div>
                            <div className="text-center max-w-xs">
                                <p className="text-base font-bold text-brand-text">Nothing trending yet</p>
                                <p className="text-sm text-brand-text/40 mt-1.5">
                                    Start posting with hashtags to see them here.
                                </p>
                            </div>
                            <Link
                                href="/create/post"
                                className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-400 to-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-shadow"
                            >
                                Create a post
                            </Link>
                        </div>
                    )}

                    {/* Trending list */}
                    {tags.length > 0 && (
                        <div className="space-y-2">
                            {tags.map((tag, index) => {
                                const rawName = (tag.display_name || tag.normalized_name || '').replace(/^#/, '')
                                const rank = index + 1
                                const rankGradient = rank <= 3 ? RANK_GRADIENTS[rank - 1] : null

                                return (
                                    <Link
                                        key={tag.normalized_name}
                                        href={`/hashtag/${tag.normalized_name}`}
                                        className="group flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-brand-card border border-brand-divider hover:border-violet-200 hover:shadow-md transition-all duration-200"
                                    >
                                        {/* Rank badge */}
                                        <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                                            rankGradient
                                                ? `bg-gradient-to-br ${rankGradient} text-white shadow-sm`
                                                : 'bg-brand-divider text-brand-text/50'
                                        }`}>
                                            {rank}
                                        </div>

                                        {/* Tag info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-brand-text truncate group-hover:text-violet-600 transition-colors">
                                                #{rawName}
                                            </p>
                                            <p className="text-xs text-brand-text/40 mt-0.5 font-semibold">
                                                {formatPostCount(tag.post_count)} posts
                                            </p>
                                        </div>

                                        {/* Trending icon */}
                                        <div className="flex-shrink-0 flex items-center gap-1.5">
                                            {tag.is_trending && (
                                                <Flame className="w-3.5 h-3.5 text-orange-400" />
                                            )}
                                            <Hash className="w-4 h-4 text-brand-text/20 group-hover:text-violet-400 transition-colors" />
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    )}

                    {/* Subtle footer when loaded */}
                    {tags.length > 0 && (
                        <div className="mt-8 flex flex-col items-center gap-2 py-4">
                            <div className="h-px w-32 bg-gradient-to-r from-transparent via-brand-divider to-transparent" />
                            <p className="text-xs font-semibold text-brand-text/30 uppercase tracking-widest">
                                Updates live
                            </p>
                            <div className="h-px w-32 bg-gradient-to-r from-transparent via-brand-divider to-transparent" />
                        </div>
                    )}
                </main>
            </div>
        </AppShell>
    )
}
