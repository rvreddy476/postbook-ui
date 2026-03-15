'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { X, Users, Info } from 'lucide-react'

interface CircleUserCardProps {
    userId: string
    displayName: string
    username?: string
    avatarMediaId?: string
    subtitle?: string
    mutualCount?: number
    reasonCodes?: string[]
    actions: React.ReactNode
    onDismiss?: () => void
}

function getAvatarUrl(userId: string, avatarMediaId?: string) {
    return avatarMediaId
        ? `/v1/media/${avatarMediaId}/serve`
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
}

// Deterministic gradient from userId — more vibrant
function getGradient(userId: string): { bg: string; ring: string } {
    const hash = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    const gradients = [
        { bg: 'from-[#D8103F]/50 via-fuchsia-500 to-pink-400', ring: 'ring-[#D8103F]/20' },
        { bg: 'from-blue-500 via-indigo-500 to-purple-500', ring: 'ring-blue-200' },
        { bg: 'from-rose-500 via-orange-400 to-amber-400', ring: 'ring-rose-200' },
        { bg: 'from-emerald-500 via-teal-400 to-cyan-400', ring: 'ring-emerald-200' },
        { bg: 'from-fuchsia-500 via-pink-500 to-rose-400', ring: 'ring-fuchsia-200' },
        { bg: 'from-amber-500 via-orange-500 to-red-400', ring: 'ring-amber-200' },
    ]
    return gradients[hash % gradients.length]
}

const REASON_LABELS: Record<string, string> = {
    MUTUAL_FRIENDS: 'Mutual friends',
    SAME_CITY: 'Same city',
    SAME_SCHOOL: 'Same school',
    SAME_COMPANY: 'Same company',
    SAME_PROFESSION: 'Same profession',
    MUTUAL_FOLLOW: 'You follow each other',
    COMMON_GROUPS: 'Common groups',
    TRIADIC_CLOSURE: 'Close network connection',
    CONTACT_MATCH: 'In your contacts',
    CLUSTER_COMPLETION: 'Part of your circle',
    FRIENDS_FOLLOW: 'Friends follow them',
    TRENDING_REGION: 'Trending in your area',
    NEW_CREATOR: 'New to atpost',
    POPULAR: 'Popular on atpost',
}

const CircleUserCard: React.FC<CircleUserCardProps> = ({
    userId,
    displayName,
    username,
    avatarMediaId,
    subtitle,
    mutualCount,
    reasonCodes,
    actions,
    onDismiss,
}) => {
    const [showWhy, setShowWhy] = React.useState(false)
    const profileHref = username ? `/u/${username}` : `/u/${userId}`
    const gradient = getGradient(userId)

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="relative group rounded-2xl bg-white shadow-sm border border-slate-100/80 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-0.5"
        >
            {/* Dismiss button */}
            {onDismiss && (
                <button
                    onClick={onDismiss}
                    className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white/80 opacity-0 group-hover:opacity-100 transition-all hover:bg-black/40 hover:scale-110"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}

            {/* Gradient cover band */}
            <div className={`h-20 bg-gradient-to-br ${gradient.bg} relative overflow-hidden`}>
                {/* Decorative circles */}
                <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full" />
                <div className="absolute -bottom-6 -left-3 w-12 h-12 bg-white/10 rounded-full" />
                <div className="absolute top-2 left-1/2 w-8 h-8 bg-white/5 rounded-full" />
            </div>

            {/* Avatar + info */}
            <div className="flex flex-col items-center -mt-10 px-4 pb-5">
                <Link href={profileHref} className="block">
                    <div className={`w-[76px] h-[76px] rounded-full overflow-hidden ring-4 ring-white shadow-lg transition-transform duration-300 group-hover:scale-105`}>
                        <img
                            src={getAvatarUrl(userId, avatarMediaId)}
                            alt={displayName}
                            className="w-full h-full object-cover"
                        />
                    </div>
                </Link>

                <Link href={profileHref} className="block mt-3 text-center">
                    <p className="text-sm font-bold text-slate-800 truncate max-w-[160px] hover:text-[#D8103F] transition-colors">
                        {displayName}
                    </p>
                    {username && (
                        <p className="text-[11px] text-slate-400 truncate max-w-[140px]">@{username}</p>
                    )}
                </Link>

                {subtitle && (
                    <div className="relative flex items-center gap-1 mt-1.5">
                        <p className="text-[10px] text-slate-400 text-center line-clamp-1">{subtitle}</p>
                        {reasonCodes && reasonCodes.length > 0 && (
                            <button
                                onClick={() => setShowWhy(!showWhy)}
                                className="flex-shrink-0 text-slate-300 hover:text-[#D8103F]/50 transition-colors"
                                title="Why this suggestion?"
                            >
                                <Info className="w-3 h-3" />
                            </button>
                        )}
                        {showWhy && reasonCodes && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-2.5 min-w-[160px]">
                                <p className="text-[10px] font-bold text-slate-500 mb-1.5">Why this suggestion?</p>
                                <ul className="space-y-0.5">
                                    {reasonCodes.map(code => (
                                        <li key={code} className="text-[10px] text-slate-400">
                                            {REASON_LABELS[code] || code}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Mutual friends indicator */}
                {mutualCount !== undefined && mutualCount > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-slate-50">
                        <Users className="w-3 h-3 text-[#D8103F]/50" />
                        <span className="text-[10px] text-slate-500 font-semibold">
                            {mutualCount} mutual{mutualCount > 1 ? 's' : ''}
                        </span>
                    </div>
                )}

                {/* Action buttons */}
                <div className="mt-4 w-full flex justify-center">
                    {actions}
                </div>
            </div>
        </motion.div>
    )
}

export default CircleUserCard
