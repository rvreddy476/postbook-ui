'use client'

import React, { useState } from 'react'
import { usePendingFriendRequests, useAcceptFriendRequest, useRejectFriendRequest, FriendRequestEntry } from '@/hooks/useConnections'
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

const RequestsTab: React.FC = () => {
    const { data, isLoading } = usePendingFriendRequests()
    const acceptRequest = useAcceptFriendRequest()
    const rejectRequest = useRejectFriendRequest()
    const [handledIds, setHandledIds] = useState<Set<string>>(new Set())

    const requests = data?.items ?? []

    const handleAccept = (friendshipId: string, userId: string) => {
        setHandledIds(prev => new Set(prev).add(userId))
        acceptRequest.mutate(friendshipId)
    }

    const handleDecline = (friendshipId: string, userId: string) => {
        setHandledIds(prev => new Set(prev).add(userId))
        rejectRequest.mutate(friendshipId)
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
                        <div className="flex gap-2">
                            <div className="h-8 w-16 rounded-xl bg-slate-200" />
                            <div className="h-8 w-16 rounded-xl bg-slate-100" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (requests.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <svg className="h-16 w-16 text-slate-200 mb-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <p className="text-sm font-bold text-slate-400">No pending requests</p>
                <p className="text-xs text-slate-300 mt-1">When someone sends you a circle request, it will appear here</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {requests.length} pending request{requests.length !== 1 ? 's' : ''}
            </p>
            <AnimatePresence>
                {requests.map((req) => {
                    const isHandled = handledIds.has(req.user_id)
                    return (
                        <motion.div
                            key={req.user_id}
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
                                subtitle={req.created_at ? timeAgo(req.created_at) : undefined}
                                actions={
                                    isHandled ? (
                                        <span className="text-xs font-bold text-slate-400">Responded</span>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleAccept(req.friendship_id, req.user_id)}
                                                className="rounded-xl orchid-gradient px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition-all"
                                            >
                                                Accept
                                            </button>
                                            <button
                                                onClick={() => handleDecline(req.friendship_id, req.user_id)}
                                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all"
                                            >
                                                Decline
                                            </button>
                                        </>
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

export default RequestsTab
