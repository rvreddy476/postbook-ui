'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles } from 'lucide-react'
import { useInterstitialSuggestions, useSendFriendRequest } from '@/hooks/useConnections'
import CircleUserCard from './CircleUserCard'

interface InterstitialSuggestionsProps {
    triggerType: 'friend_accept' | 'follow'
    triggerUserId: string
    triggerDisplayName?: string
    onClose: () => void
}

const InterstitialSuggestions: React.FC<InterstitialSuggestionsProps> = ({
    triggerType,
    triggerUserId,
    triggerDisplayName,
    onClose,
}) => {
    const { data: suggestions, isLoading } = useInterstitialSuggestions(triggerType, triggerUserId, 5)
    const sendRequest = useSendFriendRequest()
    const [sentIds, setSentIds] = useState<Set<string>>(new Set())

    const handleSend = (usernameOrId: string, userId: string) => {
        setSentIds(prev => new Set(prev).add(userId))
        sendRequest.mutate(usernameOrId)
    }

    if (isLoading) return null
    if (!suggestions || suggestions.length === 0) return null

    const headerText = triggerType === 'friend_accept'
        ? `You and ${triggerDisplayName || 'your new friend'} have mutual connections`
        : `People followed by ${triggerDisplayName || 'this user'}'s network`

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-gradient-to-br from-amber-50/50 to-orange-50/50 rounded-2xl border border-amber-100/50 p-5"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <p className="text-xs font-bold text-slate-600">{headerText}</p>
                </div>
                <button
                    onClick={onClose}
                    className="w-6 h-6 rounded-full bg-slate-200/50 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                    {suggestions.map((user, index) => {
                        const isSent = sentIds.has(user.user_id)
                        return (
                            <motion.div
                                key={user.user_id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0, transition: { delay: index * 0.05 } }}
                                exit={{ opacity: 0, scale: 0.9 }}
                            >
                                <CircleUserCard
                                    userId={user.user_id}
                                    displayName={user.display_name}
                                    username={user.username}
                                    avatarMediaId={user.avatar_media_id}
                                    subtitle={user.explain_text}
                                    mutualCount={user.mutual_friend_count}
                                    reasonCodes={user.reason_codes}
                                    actions={
                                        <button
                                            onClick={() => handleSend(user.username || user.user_id, user.user_id)}
                                            disabled={isSent}
                                            className={`w-full rounded-xl px-4 py-2 text-[11px] font-bold transition-all ${
                                                isSent
                                                    ? 'bg-emerald-50 text-emerald-600 cursor-default border border-emerald-100'
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
            </div>
        </motion.div>
    )
}

export default InterstitialSuggestions
