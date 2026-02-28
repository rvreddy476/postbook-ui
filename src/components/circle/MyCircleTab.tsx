'use client'

import React, { useState, useMemo } from 'react'
import { useAuthUser } from '@/store/auth'
import { useFriends, useRemoveFriend } from '@/hooks/useConnections'
import CircleUserCard from './CircleUserCard'
import { useRouter } from 'next/navigation'

function formatDate(dateStr?: string): string {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const MyCircleTab: React.FC = () => {
    const authUser = useAuthUser()
    const { data, isLoading } = useFriends(authUser?.id, 50)
    const removeFriend = useRemoveFriend()
    const router = useRouter()
    const [search, setSearch] = useState('')
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
    const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())

    const friends = data?.items ?? []

    const filtered = useMemo(() => {
        if (!search.trim()) return friends
        const q = search.toLowerCase()
        return friends.filter(
            (f) =>
                f.display_name.toLowerCase().includes(q) ||
                (f.username && f.username.toLowerCase().includes(q))
        )
    }, [friends, search])

    const handleRemove = (username: string, userId: string) => {
        setRemovedIds(prev => new Set(prev).add(userId))
        setConfirmRemove(null)
        removeFriend.mutate(username)
    }

    if (isLoading) {
        return (
            <div className="space-y-3">
                <div className="h-10 w-full rounded-xl bg-slate-100 animate-pulse" />
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm border border-slate-50 animate-pulse">
                        <div className="h-12 w-12 rounded-full bg-slate-200" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3 w-24 rounded bg-slate-200" />
                            <div className="h-2 w-16 rounded bg-slate-100" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (friends.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <svg className="h-16 w-16 text-slate-200 mb-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
                <p className="text-sm font-bold text-slate-400">Your circle is empty</p>
                <p className="text-xs text-slate-300 mt-1">Add friends to get started!</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {friends.length} in your circle
                </p>
            </div>

            {friends.length > 5 && (
                <div className="relative">
                    <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search your circle..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 transition-all"
                    />
                </div>
            )}

            <div className="space-y-3">
                {filtered.map((friend) => {
                    const isRemoved = removedIds.has(friend.user_id)
                    const username = friend.username ?? friend.user_id
                    return (
                        <CircleUserCard
                            key={friend.user_id}
                            userId={friend.user_id}
                            displayName={friend.display_name}
                            username={friend.username}
                            avatarMediaId={friend.avatar_media_id}
                            subtitle={friend.friend_since ? `Friends since ${formatDate(friend.friend_since)}` : undefined}
                            actions={
                                isRemoved ? (
                                    <span className="text-xs font-bold text-slate-400">Removed</span>
                                ) : confirmRemove === friend.user_id ? (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleRemove(username, friend.user_id)}
                                            className="rounded-lg bg-red-500 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-red-600 transition-colors"
                                        >
                                            Confirm
                                        </button>
                                        <button
                                            onClick={() => setConfirmRemove(null)}
                                            className="rounded-lg bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => router.push(`/u/${username}`)}
                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
                                        >
                                            View
                                        </button>
                                        <button
                                            onClick={() => setConfirmRemove(friend.user_id)}
                                            className="rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-50 transition-all"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )
                            }
                        />
                    )
                })}
                {filtered.length === 0 && search && (
                    <p className="py-8 text-center text-sm text-slate-400">
                        No friends matching &ldquo;{search}&rdquo;
                    </p>
                )}
            </div>
        </div>
    )
}

export default MyCircleTab
