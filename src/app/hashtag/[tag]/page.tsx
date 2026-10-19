'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { PostDetail } from '@/types/profile'
import AppShell from '@/components/AppShell'
import { ArrowLeft, ArrowUp, Clock, Clapperboard, Hash, Loader2, RefreshCw, TrendingUp, Video } from 'lucide-react'
import { useHashtagLiveStream } from '@/hooks/useHashtagLiveStream'
import { ShareSheet } from '@/features/reels/components/ShareSheet'
import { HashtagGrid, HashtagGridSkeleton } from '@/features/hashtag/HashtagGrid'
import {
    hashtagCountLabel,
    hashtagShareUrl,
    hashtagTile,
    hashtagTotal,
    type HashtagPageMeta,
    type HashtagTab,
} from '@/features/hashtag/hashtagPage'
import { ShareIcon } from "@/components/icons/ShareIcon";
import '@/features/reels/components/reels-screen.css'

type SortMode = 'recent' | 'top'

const CONTENT_TABS: { id: HashtagTab; label: string; icon: React.ReactNode; contentTypes: string[] }[] = [
    { id: 'all',    label: 'All',    icon: <Hash className="w-3.5 h-3.5" />,        contentTypes: [] },
    { id: 'posts',  label: 'Posts',  icon: <Hash className="w-3.5 h-3.5" />,        contentTypes: ['post', 'poll'] },
    { id: 'reels',  label: 'Reels',  icon: <Clapperboard className="w-3.5 h-3.5" />, contentTypes: ['flick'] },
    { id: 'videos', label: 'Videos', icon: <Video className="w-3.5 h-3.5" />,        contentTypes: ['long_video'] },
]

interface HashtagPostsResponse {
    data: PostDetail[]
    /** `total` arrives with post-service 2-B2; the page tolerates its absence. */
    meta?: HashtagPageMeta
}

/** The route segment as text; a malformed escape is kept as typed rather than throwing. */
function safeDecode(segment: string): string {
    try {
        return decodeURIComponent(segment)
    } catch {
        return segment
    }
}

function useHashtagPosts(tag: string, sort: SortMode, contentTypes: string[]) {
    return useInfiniteQuery({
        queryKey: ['hashtag-posts', tag, sort, contentTypes],
        queryFn: async ({ pageParam }) => {
            const params = new URLSearchParams({ limit: '20', sort })
            if (pageParam) params.set('cursor', pageParam as string)
            for (const ct of contentTypes) params.append('content_type', ct)
            const res = await api.get<HashtagPostsResponse>(`/v1/hashtags/${encodeURIComponent(tag)}/posts?${params.toString()}`)
            return res.data
        },
        initialPageParam: '' as string,
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
        enabled: !!tag,
    })
}

/*
  /hashtag/<tag> (audit T-34): the tag's title, its count (the server's
  total when it sends one, else what is loaded), Share, and the posts as a
  poster grid — the same tiles as the sound and liked-reels pages.

  Not here yet, on purpose:
  - Report: trust-safety does not accept entity_type "hashtag" yet
    (validEntityTypes), so a Report item would only fail. Add it with that.
  - Signed-out visitors: the page sits in AppShell, which sends a visitor
    with no session to /login, so /hashtag/ stays off the middleware's
    public list until the page renders without one.
*/
export default function HashtagPage() {
    const params = useParams()
    const router = useRouter()
    const tag = safeDecode(String(params.tag ?? '')).replace(/^#/, '')
    const queryClient = useQueryClient()
    const [sort, setSort] = useState<SortMode>('recent')
    const [contentTab, setContentTab] = useState<HashtagTab>('all')
    const [shareOpen, setShareOpen] = useState(false)

    const activeTab = CONTENT_TABS.find((t) => t.id === contentTab)!

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        refetch,
    } = useHashtagPosts(tag, sort, activeTab.contentTypes)

    const allPosts = data?.pages.flatMap((page) => page.data ?? []) ?? []
    const tiles = allPosts.map(hashtagTile)
    const total = hashtagTotal(data?.pages[0]?.meta)
    const countLabel = hashtagCountLabel(total, allPosts.length, Boolean(hasNextPage), contentTab)

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

    const handleTabChange = (next: HashtagTab) => {
        if (next === contentTab) return
        setContentTab(next)
        queryClient.removeQueries({ queryKey: ['hashtag-posts', tag] })
    }

    const shareUrl = hashtagShareUrl(tag, typeof window === 'undefined' ? '' : window.location.origin)

    return (
        <AppShell>
            <div className="min-h-screen bg-brand-bg">
                {/* Page Header */}
                <div className="sticky top-0 z-10 bg-brand-card/80 backdrop-blur-xl border-b border-brand-divider">
                    <div className="max-w-5xl mx-auto px-4 pt-4 pb-0">
                        {/* Title row */}
                        <div className="flex items-center gap-3 pb-3">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-brand-text/60 hover:text-brand-text hover:bg-brand-divider transition-colors"
                                aria-label="Go back"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="w-12 h-12 rounded-2xl bg-primary-tint text-primary-ink flex items-center justify-center shrink-0" aria-hidden>
                                <Hash className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-xl font-black text-brand-text tracking-tight truncate">
                                    #{tag}
                                </h1>
                                {!isLoading && !isError && (
                                    <p className="mt-0.5 text-xs font-semibold text-brand-text/60" data-hashtag-count>
                                        {countLabel}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setShareOpen(true)}
                                className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-brand-divider text-xs font-bold text-brand-text hover:bg-brand-secondary transition-colors"
                                aria-haspopup="dialog"
                            >
                                <ShareIcon className="w-4 h-4" aria-hidden />
                                Share
                            </button>
                            {/* Sort toggle */}
                            <div className="shrink-0 flex items-center gap-1 rounded-xl bg-brand-divider/60 p-1" role="group" aria-label="Sort">
                                <button
                                    type="button"
                                    onClick={() => handleSortChange('recent')}
                                    aria-pressed={sort === 'recent'}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                                        sort === 'recent'
                                            ? 'bg-brand-card text-brand-text shadow-xs'
                                            : 'text-brand-text/60 hover:text-brand-text'
                                    }`}
                                >
                                    <Clock className="w-3 h-3" />
                                    Recent
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSortChange('top')}
                                    aria-pressed={sort === 'top'}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                                        sort === 'top'
                                            ? 'bg-brand-card text-brand-text shadow-xs'
                                            : 'text-brand-text/60 hover:text-brand-text'
                                    }`}
                                >
                                    <TrendingUp className="w-3 h-3" />
                                    Top
                                </button>
                            </div>
                        </div>

                        {/* Content-type tabs */}
                        <div className="flex items-center gap-0 border-t border-brand-divider/50 overflow-x-auto" role="tablist" aria-label="Content type">
                            {CONTENT_TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={contentTab === tab.id}
                                    onClick={() => handleTabChange(tab.id)}
                                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                                        contentTab === tab.id
                                            ? 'border-primary-ink text-primary-ink'
                                            : 'border-transparent text-brand-text/60 hover:text-brand-text'
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
                <main className="max-w-5xl mx-auto px-4 py-6">
                    {/* Live pill */}
                    {newPostCount > 0 && (
                        <button
                            type="button"
                            onClick={handleRefresh}
                            className="mx-auto mb-4 flex items-center gap-2 rounded-full bg-primary-ink px-4 py-2 text-sm font-bold text-white transition-transform hover:scale-105 active:scale-95"
                        >
                            <ArrowUp className="h-4 w-4" />
                            {newPostCount === 1 ? '1 new post' : `${newPostCount} new posts`}
                        </button>
                    )}

                    {isLoading ? (
                        <HashtagGridSkeleton />
                    ) : isError ? (
                        <div className="liked-reels__empty" role="alert">
                            <h2>Couldn&apos;t load #{tag}</h2>
                            <p>Check your connection and try again.</p>
                            <button type="button" onClick={() => void refetch()} className="liked-reels__cta">
                                <RefreshCw size={15} /> Retry
                            </button>
                        </div>
                    ) : tiles.length === 0 ? (
                        <div className="liked-reels__empty">
                            <Hash size={28} className="opacity-60" aria-hidden />
                            <h2>No {contentTab === 'all' ? 'posts' : contentTab} with #{tag} yet</h2>
                            <p>Be the first to use it.</p>
                            {contentTab !== 'videos' && (
                                <a href={contentTab === 'reels' ? '/reels/create' : '/create/post'} className="liked-reels__cta">
                                    Create {contentTab === 'reels' ? 'a reel' : 'a post'}
                                </a>
                            )}
                        </div>
                    ) : (
                        <>
                            <HashtagGrid tiles={tiles} />
                            <div className="mt-8 flex justify-center">
                                {hasNextPage ? (
                                    <button
                                        type="button"
                                        onClick={() => fetchNextPage()}
                                        disabled={isFetchingNextPage}
                                        className="liked-reels__link"
                                    >
                                        {isFetchingNextPage ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                                                Loading…
                                            </>
                                        ) : (
                                            'Show more'
                                        )}
                                    </button>
                                ) : (
                                    <p className="text-xs font-semibold text-brand-text/60">All caught up</p>
                                )}
                            </div>
                        </>
                    )}
                </main>
            </div>
            <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} url={shareUrl} title={`#${tag} on VChat`} heading={`Share #${tag}`} />
        </AppShell>
    )
}
