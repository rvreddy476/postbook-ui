'use client'

import React from 'react'
import Link from 'next/link'

interface CircleUserCardProps {
    userId: string
    displayName: string
    username?: string
    avatarMediaId?: string
    subtitle?: string
    actions: React.ReactNode
}

function getAvatarUrl(userId: string, avatarMediaId?: string) {
    return avatarMediaId
        ? `/v1/media/${avatarMediaId}/serve`
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
}

const CircleUserCard: React.FC<CircleUserCardProps> = ({
    userId,
    displayName,
    username,
    avatarMediaId,
    subtitle,
    actions,
}) => {
    const profileHref = username ? `/u/${username}` : `/u/${userId}`

    return (
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm border border-slate-50 transition-all hover:shadow-md">
            <Link href={profileHref} className="shrink-0">
                <img
                    src={getAvatarUrl(userId, avatarMediaId)}
                    alt={displayName}
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-slate-100"
                />
            </Link>
            <div className="min-w-0 flex-1">
                <Link href={profileHref} className="block">
                    <p className="truncate text-sm font-bold text-slate-800 hover:text-violet-600 transition-colors">
                        {displayName}
                    </p>
                    {username && (
                        <p className="truncate text-xs text-slate-400">@{username}</p>
                    )}
                </Link>
                {subtitle && (
                    <p className="mt-0.5 text-[10px] text-slate-400">{subtitle}</p>
                )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {actions}
            </div>
        </div>
    )
}

export default CircleUserCard
