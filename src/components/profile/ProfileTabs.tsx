"use client"

import { useRef, useEffect, useState } from "react"
import type { ProfileTab } from "@/types/profile"
import { motion } from "framer-motion"
import {
    Images,
    User,
    Video,
    Film,
    Bookmark,
    Users,
    Briefcase,
    HelpCircle,
    ShoppingBag,
    CalendarCheck,
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

type TabDef = {
    key: ProfileTab
    label: string
    icon: typeof Images
    /** Tailwind classes for the active icon background + text colour. */
    activeColor: string
    /** Tailwind class for the inactive icon tint. */
    inactiveColor: string
    selfOnly?: boolean
    requiresContent?: boolean
}

const tabDefinitions: TabDef[] = [
    {
        key: "posts",
        label: "Media",
        icon: Images,
        activeColor: "bg-violet-100 text-violet-600",
        inactiveColor: "text-violet-400",
    },
    {
        key: "about",
        label: "About",
        icon: User,
        activeColor: "bg-cyan-100 text-cyan-600",
        inactiveColor: "text-cyan-400",
    },
    {
        key: "connections",
        label: "Circle",
        icon: Users,
        activeColor: "bg-pink-100 text-pink-600",
        inactiveColor: "text-pink-400",
    },
    {
        key: "qa",
        label: "Q&A",
        icon: HelpCircle,
        activeColor: "bg-amber-100 text-amber-600",
        inactiveColor: "text-amber-400",
    },
    {
        key: "videos",
        label: "Videos",
        icon: Video,
        activeColor: "bg-red-100 text-red-600",
        inactiveColor: "text-red-400",
        requiresContent: true,
    },
    {
        key: "flicks",
        label: "Reels",
        icon: Film,
        activeColor: "bg-orange-100 text-orange-600",
        inactiveColor: "text-orange-400",
        requiresContent: true,
    },
    {
        key: "orders",
        label: "Orders",
        icon: ShoppingBag,
        activeColor: "bg-emerald-100 text-emerald-600",
        inactiveColor: "text-emerald-400",
        selfOnly: true,
    },
    {
        key: "bookings",
        label: "Bookings",
        icon: CalendarCheck,
        activeColor: "bg-blue-100 text-blue-600",
        inactiveColor: "text-blue-400",
        selfOnly: true,
    },
    {
        key: "stashed",
        label: "Stash",
        icon: Bookmark,
        activeColor: "bg-rose-100 text-rose-600",
        inactiveColor: "text-rose-400",
        selfOnly: true,
    },
    {
        key: "portfolio",
        label: "Portfolio",
        icon: Briefcase,
        activeColor: "bg-indigo-100 text-indigo-600",
        inactiveColor: "text-indigo-400",
    },
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
        <div className={`py-1 border-b border-brand-divider/60 ${isSticky ? "" : ""}`}>
            <div className="relative">
                {canScrollLeft && (
                    <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-brand-card to-transparent z-10 pointer-events-none" />
                )}
                {canScrollRight && (
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-brand-card to-transparent z-10 pointer-events-none" />
                )}

                <div
                    ref={scrollRef}
                    className="flex overflow-x-auto scrollbar-hide gap-1"
                >
                    {visibleTabs.map((tab) => {
                        const isActive = activeTab === tab.key
                        const Icon = tab.icon
                        return (
                            <button
                                key={tab.key}
                                onClick={() => onTabChange(tab.key)}
                                className={`relative flex items-center gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] whitespace-nowrap transition-all duration-200 group ${
                                    isActive
                                        ? "text-brand-text"
                                        : "text-zinc-400 hover:text-zinc-700"
                                }`}
                            >
                                <span
                                    className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-300 ${
                                        isActive
                                            ? `${tab.activeColor} shadow-sm scale-110`
                                            : `bg-transparent ${tab.inactiveColor} group-hover:bg-zinc-100`
                                    }`}
                                >
                                    <Icon className="w-4 h-4" strokeWidth={2.25} />
                                </span>
                                <span>{tab.label}</span>

                                {isActive && (
                                    <motion.div
                                        layoutId="profile-tab-indicator"
                                        className="absolute bottom-0 left-3 right-3 h-[2.5px] bg-gradient-to-r from-brand-text to-brand-text/60 rounded-full"
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
