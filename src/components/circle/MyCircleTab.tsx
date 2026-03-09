'use client'

import React, { useState, useMemo } from 'react'
import { useAuthUser } from '@/store/auth'
import { useFriends, useRemoveFriend } from '@/hooks/useConnections'
import CircleUserCard from './CircleUserCard'
import { useRouter } from 'next/navigation'
import { Search, Users } from 'lucide-react'

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
            <div className="space-y-4">
                <div className="h-11 w-full rounded-xl bg-slate-100/50 animate-pulse" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rounded-2xl bg-white border border-slate-100 overflow-hidden animate-pulse">
                            <div className="h-20 bg-gradient-to-br from-slate-100 to-slate-50" />
                            <div className="flex flex-col items-center -mt-10 px-4 pb-5">
                                <div className="w-[76px] h-[76px] rounded-full bg-slate-200 ring-4 ring-white" />
                                <div className="mt-3 w-24 h-3.5 rounded bg-slate-200" />
                                <div className="mt-1 w-16 h-2.5 rounded bg-slate-100" />
                                <div className="mt-4 w-full flex justify-center gap-2">
                                    <div className="h-9 w-20 rounded-xl bg-slate-100" />
                                    <div className="h-9 w-20 rounded-xl bg-slate-100" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (friends.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-50 to-fuchsia-50 flex items-center justify-center mb-5 shadow-sm">
                    <Users className="w-12 h-12 text-violet-300" />
                </div>
                <p className="text-base font-bold text-slate-500">Your circle is empty</p>
                <p className="text-sm text-slate-400 mt-1.5 max-w-xs">Discover new people and send connection requests to build your circle!</p>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    <span className="text-violet-600 text-sm mr-1">{friends.length}</span> in your circle
                </p>
            </div>

            {friends.length > 5 && (
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                    <input
                        type="text"
                        placeholder="Search your circle..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 transition-all"
                    />
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                                    <span className="text-xs font-bold text-emerald-500">Removed</span>
                                ) : confirmRemove === friend.user_id ? (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleRemove(username, friend.user_id)}
                                            className="rounded-xl bg-gradient-to-r from-red-500 to-rose-500 px-4 py-2 text-[11px] font-bold text-white hover:opacity-90 transition-all shadow-sm shadow-red-500/20"
                                        >
                                            Confirm
                                        </button>
                                        <button
                                            onClick={() => setConfirmRemove(null)}
                                            className="rounded-xl bg-slate-100 px-4 py-2 text-[11px] font-bold text-slate-500 hover:bg-slate-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 w-full">
                                        <button
                                            onClick={() => router.push(`/u/${username}`)}
                                            className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 text-[11px] font-bold text-white hover:opacity-90 transition-all shadow-sm shadow-violet-500/20"
                                        >
                                            View Profile
                                        </button>
                                        <button
                                            onClick={() => setConfirmRemove(friend.user_id)}
                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-bold text-slate-400 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-all"
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
                    <div className="col-span-full py-12 text-center">
                        <p className="text-sm text-slate-400">
                            No friends matching &ldquo;{search}&rdquo;
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default MyCircleTab
