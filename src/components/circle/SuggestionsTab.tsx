'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, RefreshCw } from 'lucide-react'
import { useAuthUser } from '@/store/auth'
import { useFriendSuggestions, useSendFriendRequest, useHideSuggestion } from '@/hooks/useConnections'
import CircleUserCard from './CircleUserCard'

const SuggestionsTab: React.FC = () => {
    const authUser = useAuthUser()
    const { data: suggestions, isLoading, refetch, isFetching } = useFriendSuggestions(authUser?.id, 20)
    const sendRequest = useSendFriendRequest()
    const hideSuggestion = useHideSuggestion()
    const [sentIds, setSentIds] = useState<Set<string>>(new Set())
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

    const handleSend = (usernameOrId: string, userId: string) => {
        setSentIds(prev => new Set(prev).add(userId))
        sendRequest.mutate(usernameOrId)
    }

    const handleDismiss = (userId: string) => {
        setDismissedIds(prev => new Set(prev).add(userId))
        hideSuggestion.mutate({ candidateUserId: userId })
    }

    const visibleSuggestions = suggestions?.filter(u => !dismissedIds.has(u.user_id)) ?? []

    if (isLoading) {
        return (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-2xl bg-white border border-slate-100 overflow-hidden animate-pulse">
                        <div className="h-20 bg-gradient-to-br from-slate-100 to-slate-50" />
                        <div className="flex flex-col items-center -mt-10 px-4 pb-5">
                            <div className="w-[76px] h-[76px] rounded-full bg-slate-200 ring-4 ring-white" />
                            <div className="mt-3 w-24 h-3.5 rounded bg-slate-200" />
                            <div className="mt-1 w-16 h-2.5 rounded bg-slate-100" />
                            <div className="mt-4 w-28 h-9 rounded-xl bg-slate-100" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (!suggestions || visibleSuggestions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center mb-5 shadow-sm">
                    <Sparkles className="w-12 h-12 text-amber-300" />
                </div>
                <p className="text-base font-bold text-slate-500">No suggestions right now</p>
                <p className="text-sm text-slate-400 mt-1.5">Check back later for new people to connect with</p>
                {dismissedIds.size > 0 && (
                    <button
                        onClick={() => setDismissedIds(new Set())}
                        className="mt-5 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-[#D8103F] bg-[#D8103F]/5 hover:bg-[#D8103F]/10 transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Show dismissed suggestions
                    </button>
                )}
            </div>
        )
    }

    return (
        <div>
            {/* Header with count and refresh */}
            <div className="flex items-center justify-between mb-5">
                <p className="text-xs text-slate-400">
                    <span className="font-bold text-amber-600 text-sm mr-1">{visibleSuggestions.length}</span> people you may know
                </p>
                <button
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold text-[#D8103F] bg-[#D8103F]/5 hover:bg-[#D8103F]/10 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                    {visibleSuggestions.map((user, index) => {
                        const isSent = sentIds.has(user.user_id)
                        return (
                            <motion.div
                                key={user.user_id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0, transition: { delay: index * 0.05 } }}
                                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                            >
                                <CircleUserCard
                                    userId={user.user_id}
                                    displayName={user.display_name}
                                    username={user.username}
                                    avatarMediaId={user.avatar_media_id}
                                    subtitle={user.explain_text}
                                    mutualCount={user.mutual_friend_count}
                                    reasonCodes={user.reason_codes}
                                    onDismiss={() => handleDismiss(user.user_id)}
                                    actions={
                                        <button
                                            onClick={() => handleSend(user.username || user.user_id, user.user_id)}
                                            disabled={isSent}
                                            className={`w-full rounded-xl px-5 py-2.5 text-[11px] font-bold transition-all ${
                                                isSent
                                                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-600 cursor-default border border-emerald-100'
                                                    : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 active:scale-[0.97] shadow-md shadow-amber-500/20'
                                            }`}
                                        >
                                            {isSent ? 'Request Sent' : 'Add to Circle'}
                                        </button>
                                    }
                                />
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </motion.div>
        </div>
    )
}

export default SuggestionsTab
