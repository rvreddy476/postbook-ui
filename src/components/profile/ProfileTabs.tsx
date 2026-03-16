"use client"

import { useRef, useEffect, useState } from "react"
import type { ProfileTab } from "@/types/profile"
import { motion } from "framer-motion"
import {
    FileText,
    User,
    Video,
    Film,
    Bookmark,
    CircleDot,
    Briefcase,
} from "lucide-react"

interface ProfileTabsProps {
    activeTab: ProfileTab
    onTabChange: (tab: ProfileTab) => void
    isOwn: boolean
    hasVideos: boolean
    hasFlicks: boolean
    hasMedia: boolean
    isSticky?: boolean
}

const tabDefinitions: {
    key: ProfileTab
    label: string
    icon: typeof FileText
    selfOnly?: boolean
    requiresContent?: boolean
}[] = [
    { key: "about", label: "About", icon: User },
    { key: "connections", label: "My Circle", icon: CircleDot },
    { key: "posts", label: "Posts", icon: FileText },
    { key: "videos", label: "Videos", icon: Video, requiresContent: true },
    { key: "flicks", label: "Flicks", icon: Film, requiresContent: true },
    { key: "stashed", label: "Stash", icon: Bookmark, selfOnly: true },
    { key: "portfolio", label: "Portfolio", icon: Briefcase },
]

export function ProfileTabs({
    activeTab,
    onTabChange,
    isOwn,
    hasVideos,
    hasFlicks,
    hasMedia,
    isSticky = false,
}: ProfileTabsProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(false)

    const visibleTabs = tabDefinitions.filter((tab) => {
        if (tab.selfOnly && !isOwn) return false
        if (tab.key === "videos" && !hasVideos) return false
        if (tab.key === "flicks" && !hasFlicks) return false
        if (tab.key === "media" && !hasMedia) return false
        return true
    })

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        const check = () => {
            setCanScrollLeft(el.scrollLeft > 2)
            setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
        }
        check()
        el.addEventListener("scroll", check, { passive: true })
        return () => el.removeEventListener("scroll", check)
    }, [visibleTabs.length])

    return (
        <div className="py-1 border-b border-[#DED9D1]/60">
            <div className="relative">
                {canScrollLeft && (
                    <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
                )}
                {canScrollRight && (
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
                )}

                <div
                    ref={scrollRef}
                    className="flex overflow-x-auto scrollbar-hide gap-0.5"
                >
                    {visibleTabs.map((tab) => {
                        const isActive = activeTab === tab.key
                        const Icon = tab.icon
                        return (
                            <button
                                key={tab.key}
                                onClick={() => onTabChange(tab.key)}
                                className={`relative flex items-center gap-2 px-5 py-3.5 text-xs font-bold uppercase tracking-[0.15em] whitespace-nowrap transition-colors duration-200 ${
                                    isActive
                                        ? "text-[#D8103F]"
                                        : "text-zinc-400 hover:text-zinc-600"
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{tab.label}</span>

                                {isActive && (
                                    <motion.div
                                        layoutId="profile-tab-indicator"
                                        className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#D8103F] rounded-full"
                                        transition={{
                                            type: "spring",
                                            bounce: 0.2,
                                            duration: 0.5,
                                        }}
                                    />
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
