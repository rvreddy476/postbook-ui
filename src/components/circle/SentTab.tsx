'use client'

import React, { useState } from 'react'
import { useSentFriendRequests, useCancelFriendRequest } from '@/hooks/useConnections'
import CircleUserCard from './CircleUserCard'
import { motion, AnimatePresence } from 'framer-motion'

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
            <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm border border-slate-50 animate-pulse">
                        <div className="h-12 w-12 rounded-full bg-slate-200" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3 w-24 rounded bg-slate-200" />
                            <div className="h-2 w-16 rounded bg-slate-100" />
                        </div>
                        <div className="h-8 w-16 rounded-xl bg-slate-200" />
                    </div>
                ))}
            </div>
        )
    }

    if (requests.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <svg className="h-16 w-16 text-slate-200 mb-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                <p className="text-sm font-bold text-slate-400">No pending sent requests</p>
                <p className="text-xs text-slate-300 mt-1">Requests you send will appear here until they are accepted</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {requests.length} sent request{requests.length !== 1 ? 's' : ''}
            </p>
            <AnimatePresence>
                {requests.map((req) => {
                    const isCancelled = cancelledIds.has(req.friendship_id)
                    return (
                        <motion.div
                            key={req.friendship_id}
                            layout
                            initial={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
                            transition={{ duration: 0.3 }}
                        >
                            <CircleUserCard
                                userId={req.user_id}
                                displayName={req.display_name}
                                username={req.username}
                                avatarMediaId={req.avatar_media_id}
                                subtitle={req.created_at ? `Sent ${timeAgo(req.created_at)}` : undefined}
                                actions={
                                    isCancelled ? (
                                        <span className="text-xs font-bold text-slate-400">Cancelled</span>
                                    ) : (
                                        <button
                                            onClick={() => handleCancel(req.friendship_id)}
                                            className="rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 transition-all"
                                        >
                                            Cancel
                                        </button>
                                    )
                                }
                            />
                        </motion.div>
                    )
                })}
            </AnimatePresence>
        </div>
    )
}

export default SentTab
