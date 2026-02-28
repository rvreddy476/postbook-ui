'use client'

import React, { useState } from 'react'
import { useAuthUser } from '@/store/auth'
import { useFriendSuggestions, useSendFriendRequest } from '@/hooks/useConnections'
import CircleUserCard from './CircleUserCard'

const SuggestionsTab: React.FC = () => {
    const authUser = useAuthUser()
    const { data: suggestions, isLoading } = useFriendSuggestions(authUser?.id, 20)
    const sendRequest = useSendFriendRequest()
    const [sentIds, setSentIds] = useState<Set<string>>(new Set())

    const handleSend = (username: string, userId: string) => {
        setSentIds(prev => new Set(prev).add(userId))
        sendRequest.mutate(username)
    }

    if (isLoading) {
        return (
            <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm border border-slate-50 animate-pulse">
                        <div className="h-12 w-12 rounded-full bg-slate-200" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3 w-24 rounded bg-slate-200" />
                            <div className="h-2 w-16 rounded bg-slate-100" />
                        </div>
                        <div className="h-8 w-24 rounded-xl bg-slate-200" />
                    </div>
                ))}
            </div>
        )
    }

    if (!suggestions || suggestions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <svg className="h-16 w-16 text-slate-200 mb-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
                <p className="text-sm font-bold text-slate-400">No suggestions right now</p>
                <p className="text-xs text-slate-300 mt-1">Check back later for new people to connect with</p>
            </div>
        )
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {suggestions.map((user) => {
                const isSent = sentIds.has(user.user_id)
                return (
                    <CircleUserCard
                        key={user.user_id}
                        userId={user.user_id}
                        displayName={user.display_name}
                        username={user.username}
                        avatarMediaId={user.avatar_media_id}
                        actions={
                            <button
                                onClick={() => user.username && handleSend(user.username, user.user_id)}
                                disabled={isSent || !user.username}
                                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                                    isSent
                                        ? 'bg-emerald-50 text-emerald-600 cursor-default'
                                        : !user.username
                                        ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                        : 'orchid-gradient text-white hover:opacity-90'
                                }`}
                            >
                                {isSent ? 'Request Sent' : 'Add to Circle'}
                            </button>
                        }
                    />
                )
            })}
        </div>
    )
}

export default SuggestionsTab
