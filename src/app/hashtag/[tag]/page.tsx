'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { PostDetail } from '@/types/profile'
import PostCard from '@/components/PostCard'
import AppShell from '@/components/AppShell'
import { ArrowLeft, ArrowUp, Clock, Clapperboard, Hash, Loader2, TrendingUp, Video } from 'lucide-react'
import { useHashtagLiveStream } from '@/hooks/useHashtagLiveStream'

type SortMode = 'recent' | 'top'
type ContentTab = 'all' | 'posts' | 'reels' | 'videos'

const CONTENT_TABS: { id: ContentTab; label: string; icon: React.ReactNode; contentTypes: string[] }[] = [
    { id: 'all',    label: 'All',    icon: <Hash className="w-3.5 h-3.5" />,        contentTypes: [] },
    { id: 'posts',  label: 'Posts',  icon: <Hash className="w-3.5 h-3.5" />,        contentTypes: ['post', 'poll'] },
    { id: 'reels',  label: 'Reels',  icon: <Clapperboard className="w-3.5 h-3.5" />, contentTypes: ['flick'] },
    { id: 'videos', label: 'Videos', icon: <Video className="w-3.5 h-3.5" />,        contentTypes: ['long_video'] },
]

interface HashtagPostsResponse {
    data: PostDetail[]
    meta?: { next_cursor: string }
}

function useHashtagPosts(tag: string, sort: SortMode, contentTypes: string[]) {
    return useInfiniteQuery({
        queryKey: ['hashtag-posts', tag, sort, contentTypes],
        queryFn: async ({ pageParam }) => {
            const params = new URLSearchParams({ limit: '20', sort })
            if (pageParam) params.set('cursor', pageParam as string)
            for (const ct of contentTypes) params.append('content_type', ct)
            const res = await api.get<HashtagPostsResponse>(`/v1/hashtags/${tag}/posts?${params.toString()}`)
            return res.data
        },
        initialPageParam: '' as string,
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
        enabled: !!tag,
    })
}

export default function HashtagPage() {
    const params = useParams()
    const router = useRouter()
    const tag = params.tag as string
    const queryClient = useQueryClient()
    const [sort, setSort] = useState<SortMode>('recent')
    const [contentTab, setContentTab] = useState<ContentTab>('all')

    const activeTab = CONTENT_TABS.find((t) => t.id === contentTab)!

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        error,
    } = useHashtagPosts(tag, sort, activeTab.contentTypes)

    const allPosts = data?.pages.flatMap((page) => page.data) ?? []
    const totalCount = allPosts.length

    const { newPostCount, acknowledge } = useHashtagLiveStream(tag)
    const handleRefresh = () => {
        acknowledge()
        queryClient.invalidateQueries({ queryKey: ['hashtag-posts', tag] })
    }

    const handleSortChange = (next: SortMode) => {
        if (next === sort) return
        setSort(next)
        queryClient.removeQueries({ queryKey: ['hashtag-posts', tag] })
    }

    const handleTabChange = (next: ContentTab) => {
        if (next === contentTab) return
        setContentTab(next)
        queryClient.removeQueries({ queryKey: ['hashtag-posts', tag] })
    }

    return (
        <AppShell>
            <div className="min-h-screen bg-brand-bg">
                {/* Page Header */}
                <div className="sticky top-0 z-10 bg-brand-card/80 backdrop-blur-xl border-b border-brand-divider shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                    <div className="max-w-2xl mx-auto px-4 pt-4 pb-0">
                        {/* Title row */}
                        <div className="flex items-center gap-3 pb-3">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-brand-text/60 hover:text-brand-text hover:bg-brand-divider transition-colors"
                                aria-label="Go back"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20 flex-shrink-0">
                                <Hash className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-xl font-black text-brand-text tracking-tight truncate">
                                    #{tag}
                                </h1>
                                {!isLoading && (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <TrendingUp className="w-3 h-3 text-brand-text/50" />
                                        <span className="text-xs font-semibold text-brand-text/40">
                                            {totalCount > 0
                                                ? `${totalCount}${hasNextPage ? '+' : ''} post${totalCount !== 1 ? 's' : ''} loaded`
                                                : 'No posts yet'}
                                        </span>
                                    </div>
                                )}
                            </div>
                            {/* Sort toggle */}
                            <div className="flex-shrink-0 flex items-center gap-1 rounded-xl bg-brand-divider/60 p-1">
                                <button
                                    type="button"
                                    onClick={() => handleSortChange('recent')}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                                        sort === 'recent'
                                            ? 'bg-brand-card text-brand-text shadow-sm'
                                            : 'text-brand-text/40 hover:text-brand-text/70'
                                    }`}
                                >
                                    <Clock className="w-3 h-3" />
                                    Recent
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSortChange('top')}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                                        sort === 'top'
                                            ? 'bg-brand-card text-brand-text shadow-sm'
                                            : 'text-brand-text/40 hover:text-brand-text/70'
                                    }`}
                                >
                                    <TrendingUp className="w-3 h-3" />
                                    Top
                                </button>
                            </div>
                        </div>

                        {/* Content-type tabs */}
                        <div className="flex items-center gap-0 border-t border-brand-divider/50">
                            {CONTENT_TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => handleTabChange(tab.id)}
                                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                                        contentTab === tab.id
                                            ? 'border-violet-500 text-violet-600'
                                            : 'border-transparent text-brand-text/40 hover:text-brand-text/70'
                                    }`}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <main className="max-w-2xl mx-auto px-4 py-6">
                    {/* Loading */}
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20 animate-pulse">
                                <Hash className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <p className="text-sm font-bold text-brand-text">Loading #{tag}</p>
                                <p className="text-xs text-brand-text/40">Fetching tagged content...</p>
                            </div>
                            <Loader2 className="w-5 h-5 text-brand-text/50 animate-spin" />
                        </div>
                    )}

                    {/* Error */}
                    {isError && (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                                <span className="text-2xl">!</span>
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-brand-text">Something went wrong</p>
                                <p className="text-xs text-brand-text/40 mt-1">
                                    {(error as Error)?.message ?? 'Could not load posts for this hashtag.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Empty */}
                    {!isLoading && !isError && allPosts.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-text/5 to-fuchsia-50 border border-brand-text/10 flex items-center justify-center">
                                <Hash className="w-9 h-9 text-brand-text/30" />
                            </div>
                            <div className="text-center max-w-xs">
                                <p className="text-base font-bold text-brand-text">
                                    No {contentTab === 'all' ? 'posts' : contentTab} yet
                                </p>
                                <p className="text-sm text-brand-text/40 mt-1.5 leading-relaxed">
                                    {contentTab === 'all' ? (
                                        <>Be the first to use <span className="font-semibold text-brand-text/60">#{tag}</span> and start the conversation.</>
                                    ) : (
                                        <>No {contentTab} with <span className="font-semibold text-brand-text/60">#{tag}</span> yet.</>
                                    )}
                                </p>
                            </div>
                            {contentTab !== 'videos' && (
                                <a
                                    href="/create/post"
                                    className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-shadow"
                                >
                                    Create first {contentTab === 'reels' ? 'reel' : 'post'}
                                </a>
                            )}
                        </div>
                    )}

                    {/* Live pill */}
                    {newPostCount > 0 && (
                        <button
                            type="button"
                            onClick={handleRefresh}
                            className="mx-auto mb-4 flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition-transform hover:scale-105 active:scale-95"
                        >
                            <ArrowUp className="h-4 w-4" />
                            {newPostCount === 1 ? '1 new post' : `${newPostCount} new posts`}
                        </button>
                    )}

                    {/* Posts */}
                    {allPosts.length > 0 && (
                        <div className="space-y-4">
                            {allPosts.map((post) => (
                                <PostCard key={post.id} post={post} />
                            ))}
                        </div>
                    )}

                    {/* Load more / end */}
                    {!isLoading && !isError && allPosts.length > 0 && (
                        <div className="mt-8 flex justify-center">
                            {hasNextPage ? (
                                <button
                                    onClick={() => fetchNextPage()}
                                    disabled={isFetchingNextPage}
                                    className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-brand-card border border-brand-divider text-sm font-bold text-brand-text shadow-sm hover:shadow-md hover:border-brand-text/20 active:scale-95 disabled:opacity-60 disabled:pointer-events-none transition-all duration-200"
                                >
                                    {isFetchingNextPage ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin text-brand-text/50" />
                                            <span>Loading more...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Hash className="w-4 h-4 text-brand-text/50" />
                                            <span>Load more</span>
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="flex flex-col items-center gap-2 py-4">
                                    <div className="h-px w-32 bg-gradient-to-r from-transparent via-brand-divider to-transparent" />
                                    <p className="text-xs font-semibold text-brand-text/40 uppercase tracking-widest">
                                        All caught up
                                    </p>
                                    <div className="h-px w-32 bg-gradient-to-r from-transparent via-brand-divider to-transparent" />
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </AppShell>
    )
}
