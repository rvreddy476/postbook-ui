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
            className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#F0E6DC] shadow-sm hover:border-[#D4A574] hover:shadow-md transition-all group"
        >
            {/* Avatar */}
            <div className="h-12 w-12 rounded-lg bg-[#F0E6DC] overflow-hidden flex-shrink-0">
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={channel.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-bold text-[#7B5B3A]">
                        {channel.name.charAt(0).toUpperCase()}
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-[#3C2415] truncate">
                        {channel.name}
                    </h3>
                    {channel.is_verified && (
                        <BadgeCheck className="w-3.5 h-3.5 text-[#D4A574] flex-shrink-0" />
                    )}
                </div>
                <p className="text-xs text-[#7B5B3A] truncate">@{channel.handle}</p>
            </div>

            {/* Subscriber count */}
            <div className="flex items-center gap-1 text-xs text-[#7B5B3A] flex-shrink-0">
                <Users className="w-3 h-3" />
                <span>{channel.subscriber_count.toLocaleString()}</span>
            </div>
        </Link>
    )
}
