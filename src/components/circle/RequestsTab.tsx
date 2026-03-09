'use client'

import React, { useState } from 'react'
import { usePendingFriendRequests, useAcceptFriendRequest, useRejectFriendRequest, FriendRequestEntry } from '@/hooks/useConnections'
import CircleUserCard from './CircleUserCard'
import { motion, AnimatePresence } from 'framer-motion'
import { Inbox } from 'lucide-react'

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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-2xl bg-white border border-slate-100 overflow-hidden animate-pulse">
                        <div className="h-20 bg-gradient-to-br from-slate-100 to-slate-50" />
                        <div className="flex flex-col items-center -mt-10 px-4 pb-5">
                            <div className="w-[76px] h-[76px] rounded-full bg-slate-200 ring-4 ring-white" />
                            <div className="mt-3 w-24 h-3.5 rounded bg-slate-200" />
                            <div className="mt-4 flex gap-2">
                                <div className="h-9 w-20 rounded-xl bg-slate-200" />
                                <div className="h-9 w-20 rounded-xl bg-slate-100" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (requests.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center mb-5 shadow-sm">
                    <Inbox className="w-12 h-12 text-emerald-300" />
                </div>
                <p className="text-base font-bold text-slate-500">No pending requests</p>
                <p className="text-sm text-slate-400 mt-1.5">When someone sends you a circle request, it will appear here</p>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                <span className="text-emerald-600 text-sm mr-1">{requests.length}</span> pending request{requests.length !== 1 ? 's' : ''}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                    {requests.map((req) => {
                        const isHandled = handledIds.has(req.user_id)
                        return (
                            <motion.div
                                key={req.user_id}
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
                                    subtitle={req.created_at ? timeAgo(req.created_at) : undefined}
                                    actions={
                                        isHandled ? (
                                            <span className="text-xs font-bold text-emerald-500">Responded</span>
                                        ) : (
                                            <div className="flex items-center gap-2 w-full">
                                                <button
                                                    onClick={() => handleAccept(req.friendship_id, req.user_id)}
                                                    className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-[11px] font-bold text-white hover:opacity-90 transition-all shadow-sm shadow-emerald-500/20"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={() => handleDecline(req.friendship_id, req.user_id)}
                                                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-bold text-slate-500 hover:bg-slate-50 transition-all"
                                                >
                                                    Decline
                                                </button>
                                            </div>
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

export default RequestsTab
