"use client"

import Link from "next/link"
import type { Channel } from "@/types/profile"
import { BadgeCheck, Users } from "lucide-react"

interface ChannelCardProps {
    channel: Channel
}

export function ChannelCard({ channel }: ChannelCardProps) {
    const avatarUrl = channel.avatar_media_id
        ? `/v1/media/${channel.avatar_media_id}/serve`
        : null

    return (
        <Link
            href={`/posttube/channel/${channel.handle}`}
            className="flex items-center gap-3 p-5 bg-brand-card rounded-2xl border border-brand-divider border-l-[3px] border-l-violet-500 shadow-sm hover:shadow-md transition-all group"
        >
            {/* Avatar */}
            <div className="h-12 w-12 rounded-xl bg-brand-secondary overflow-hidden flex-shrink-0">
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={channel.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-bold text-brand-text/60">
                        {channel.name.charAt(0).toUpperCase()}
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-brand-text truncate">
                        {channel.name}
                    </h3>
                    {channel.is_verified && (
                        <BadgeCheck className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                    )}
                </div>
                <p className="text-xs text-brand-text/60 truncate">@{channel.handle}</p>
            </div>

            {/* Subscriber count */}
            <div className="flex items-center gap-1 text-xs font-medium text-brand-text/60 flex-shrink-0">
                <Users className="w-3 h-3 text-violet-500" />
                <span>{channel.subscriber_count.toLocaleString()}</span>
            </div>
        </Link>
    )
}
