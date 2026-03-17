'use client'

import React, { useState } from 'react'
import { useSentFriendRequests, useCancelFriendRequest } from '@/hooks/useConnections'
import CircleUserCard from './CircleUserCard'
import { motion, AnimatePresence } from 'framer-motion'
import { Send } from 'lucide-react'

function timeAgo(dateStr: string): string {
    const now = Date.now()
    const then = new Date(dateStr).getTime()
    const diff = Math.max(0, now - then)
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    return `${Math.floor(days / 30)}mo ago`
}

const SentTab: React.FC = () => {
    const { data, isLoading } = useSentFriendRequests()
    const cancelRequest = useCancelFriendRequest()
    const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set())

    const requests = data?.items ?? []

    const handleCancel = (friendshipId: string) => {
        setCancelledIds(prev => new Set(prev).add(friendshipId))
        cancelRequest.mutate(friendshipId)
    }

    if (isLoading) {
        return (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-2xl bg-brand-card border border-brand-divider overflow-hidden animate-pulse">
                        <div className="h-20 bg-gradient-to-br from-slate-100 to-slate-50" />
                        <div className="flex flex-col items-center -mt-10 px-4 pb-5">
                            <div className="w-[76px] h-[76px] rounded-full bg-slate-200 ring-4 ring-white" />
                            <div className="mt-3 w-24 h-3.5 rounded bg-slate-200" />
                            <div className="mt-4 h-9 w-20 rounded-xl bg-slate-100" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (requests.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center mb-5 shadow-sm">
                    <Send className="w-12 h-12 text-blue-300" />
                </div>
                <p className="text-base font-bold text-brand-highlight">No pending sent requests</p>
                <p className="text-sm text-brand-text/60 mt-1.5">Requests you send will appear here until they are accepted</p>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-text/60">
                <span className="text-blue-600 text-sm mr-1">{requests.length}</span> sent request{requests.length !== 1 ? 's' : ''}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                    {requests.map((req) => {
                        const isCancelled = cancelledIds.has(req.friendship_id)
                        return (
                            <motion.div
                                key={req.friendship_id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                            >
                                <CircleUserCard
                                    userId={req.user_id}
                                    displayName={req.display_name}
                                    username={req.username}
                                    avatarMediaId={req.avatar_media_id}
                                    subtitle={req.created_at ? `Sent ${timeAgo(req.created_at)}` : undefined}
                                    actions={
                                        isCancelled ? (
                                            <span className="text-xs font-bold text-brand-text/60">Cancelled</span>
                                        ) : (
                                            <button
                                                onClick={() => handleCancel(req.friendship_id)}
                                                className="w-full rounded-xl border border-red-200 bg-brand-card px-4 py-2.5 text-[11px] font-bold text-red-500 hover:bg-red-50 hover:border-red-300 transition-all"
                                            >
                                                Cancel Request
                                            </button>
                                        )
                                    }
                                />
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </div>
        </div>
    )
}

export default SentTab
