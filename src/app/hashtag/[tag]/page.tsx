'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { useInfiniteQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { PostDetail } from '@/types/profile'
import PostCard from '@/components/PostCard'
import { Hash, Loader2, TrendingUp } from 'lucide-react'

interface HashtagPostsResponse {
    data: PostDetail[]
    meta?: { next_cursor: string }
}

function useHashtagPosts(tag: string) {
    return useInfiniteQuery({
        queryKey: ['hashtag-posts', tag],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: '20' }
            if (pageParam) {
                params.cursor = pageParam as string
            }
            const res = await api.get<HashtagPostsResponse>(`/v1/hashtags/${tag}/posts`, { params })
            return res.data
        },
        initialPageParam: '' as string,
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
        enabled: !!tag,
    })
}

export default function HashtagPage() {
    const params = useParams()
    const tag = params.tag as string

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        error,
    } = useHashtagPosts(tag)

    const allPosts = data?.pages.flatMap((page) => page.data) ?? []
    const totalCount = allPosts.length

    return (
        <div className="min-h-screen bg-brand-bg">
            {/* Page Header */}
            <div className="sticky top-0 z-10 bg-brand-card/80 backdrop-blur-xl border-b border-brand-divider shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-text/50 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-brand-text/20 flex-shrink-0">
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
                                        ? `${totalCount}${hasNextPage ? '+' : ''} post${totalCount !== 1 ? 's' : ''}`
                                        : 'No posts yet'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <main className="max-w-2xl mx-auto px-4 py-6">
                {/* Loading State */}
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-text/50 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-brand-text/20 animate-pulse">
                            <Hash className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <p className="text-sm font-bold text-brand-text">Loading #{tag}</p>
                            <p className="text-xs text-brand-text/40">Fetching tagged posts...</p>
                        </div>
                        <Loader2 className="w-5 h-5 text-brand-text/50 animate-spin" />
                    </div>
                )}

                {/* Error State */}
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

                {/* Empty State */}
                {!isLoading && !isError && allPosts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-text/5 to-fuchsia-50 border border-brand-text/10 flex items-center justify-center">
                            <Hash className="w-9 h-9 text-brand-text/30" />
                        </div>
                        <div className="text-center max-w-xs">
                            <p className="text-base font-bold text-brand-text">No posts yet</p>
                            <p className="text-sm text-brand-text/40 mt-1.5 leading-relaxed">
                                Be the first to post with{' '}
                                <span className="font-semibold text-brand-text/50">#{tag}</span> and
                                start the conversation.
                            </p>
                        </div>
                    </div>
                )}

                {/* Posts List */}
                {allPosts.length > 0 && (
                    <div className="space-y-4">
                        {allPosts.map((post) => (
                            <PostCard key={post.id} post={post} />
                        ))}
                    </div>
                )}

                {/* Load More */}
                {!isLoading && !isError && allPosts.length > 0 && (
                    <div className="mt-8 flex justify-center">
                        {hasNextPage ? (
                            <button
                                onClick={() => fetchNextPage()}
                                disabled={isFetchingNextPage}
                                className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-brand-card border border-brand-divider text-sm font-bold text-brand-text shadow-sm hover:shadow-md hover:border-brand-text/20 hover:text-brand-text active:scale-95 disabled:opacity-60 disabled:pointer-events-none transition-all duration-200"
                            >
                                {isFetchingNextPage ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin text-brand-text/50" />
                                        <span>Loading more...</span>
                                    </>
                                ) : (
                                    <>
                                        <Hash className="w-4 h-4 text-brand-text/50" />
                                        <span>Load more posts</span>
                                    </>
                                )}
                            </button>
                        ) : (
                            <div className="flex flex-col items-center gap-2 py-4">
                                <div className="h-px w-32 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                                <p className="text-xs font-semibold text-brand-text/40 uppercase tracking-widest">
                                    All caught up
                                </p>
                                <div className="h-px w-32 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}
