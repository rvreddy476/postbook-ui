"use client"

import Link from "next/link"
import type { BusinessPage } from "@/types/profile"
import { BadgeCheck, Star, MapPin } from "lucide-react"

interface BusinessPageCardProps {
    page: BusinessPage
}

export function BusinessPageCard({ page }: BusinessPageCardProps) {
    const avatarUrl = page.avatar_media_id
        ? `/v1/media/${page.avatar_media_id}/serve`
        : null

    return (
        <Link
            href={`/page/${page.handle}`}
            className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#F0E6DC] shadow-sm hover:border-[#D4A574] hover:shadow-md transition-all group"
        >
            {/* Avatar */}
            <div className="h-12 w-12 rounded-lg bg-[#F0E6DC] overflow-hidden flex-shrink-0">
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={page.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-bold text-[#7B5B3A]">
                        {page.name.charAt(0).toUpperCase()}
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-[#3C2415] truncate">
                        {page.name}
                    </h3>
                    {page.is_verified && (
                        <BadgeCheck className="w-3.5 h-3.5 text-[#D4A574] flex-shrink-0" />
                    )}
                </div>
                {page.category && (
                    <p className="text-xs text-[#7B5B3A] truncate">{page.category}</p>
                )}
                {page.city && (
                    <div className="flex items-center gap-1 text-[10px] text-[#7B5B3A]/60 mt-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        <span>{[page.city, page.state].filter(Boolean).join(", ")}</span>
                    </div>
                )}
            </div>

            {/* Rating */}
            <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-[#D4A574] text-[#D4A574]" />
                    <span className="text-sm font-bold text-[#3C2415]">
                        {page.average_rating.toFixed(1)}
                    </span>
                </div>
                <span className="text-[10px] text-[#7B5B3A]">
                    {page.review_count} {page.review_count === 1 ? "review" : "reviews"}
                </span>
            </div>
        </Link>
    )
}
