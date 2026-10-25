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
    Heart,
    Clapperboard,
    Lock,
    Repeat2,
} from "lucide-react"

/**
 * The tabs a profile can show. Orders and Bookings are gone (they were
 * "Coming soon" placeholders; orders live in the shop); Reposts is new.
 */
export type ProfileTabKey = ProfileTab | "reposts"

interface ProfileTabsProps {
    activeTab: ProfileTabKey
    onTabChange: (tab: ProfileTabKey) => void
    isOwn: boolean
    /** @deprecated Videos and Reels tabs always show; kept for callers. */
    hasVideos?: boolean
    /** @deprecated Videos and Reels tabs always show; kept for callers. */
    hasFlicks?: boolean
    hasMedia: boolean
    /** Videos that credit this person (accepted); the "Appears in" tab shows only then. */
    hasAppearances?: boolean
    /** The person offers a membership level; the "Members" tab shows only then. */
    hasMembers?: boolean
    isSticky?: boolean
}

type TabDef = {
    key: ProfileTabKey
    label: string
    icon: typeof Images
    selfOnly?: boolean
    requiresContent?: boolean
}

const tabDefinitions: TabDef[] = [
    { key: "posts", label: "Media", icon: Images },
    { key: "about", label: "About", icon: User },
    // Followers / Following (and Blocked on your own); no Connections list: Connect is gone (24 Oct 2026).
    { key: "connections", label: "People", icon: Users },
    { key: "qa", label: "Q&A", icon: HelpCircle },
    { key: "videos", label: "Videos", icon: Video, requiresContent: true },
    { key: "flicks", label: "Reels", icon: Film, requiresContent: true },
    // Members-only posts, shorts and videos (paid memberships); locked for non-members.
    { key: "members", label: "Members", icon: Lock, requiresContent: true },
    // Others' long videos that credit this person, once accepted (video credits).
    { key: "appears", label: "Appears in", icon: Clapperboard, requiresContent: true },
    // Posts this person reposted (post-service GET /v1/creators/:id/reposts).
    { key: "reposts", label: "Reposts", icon: Repeat2 },
    { key: "stashed", label: "Saved", icon: Bookmark, selfOnly: true },
    // The viewer's liked reels; post-service serves likes to their owner only.
    { key: "liked", label: "Liked", icon: Heart, selfOnly: true },
    { key: "portfolio", label: "Portfolio", icon: Briefcase },
]

// Q&A is parked until after launch: the tab (and ProfileQASection) stay in
// the code, hidden from every profile until this flips.
const QA_TAB_ENABLED = false

/*
  Reposts read GET /v1/creators/:creatorId/reposts (REPOSTS_PATH in
  tabs/reposts.ts), which post-service serves with the viewer's rules since
  febe0e20b. The old /v1/users/:userId/reposts never reached post-service
  through the gateway. Keep this switch to hide the tab again if needed.
*/
export const REPOSTS_TAB_ENABLED = true

/**
 * The tabs a viewer sees. Videos and Reels are always there (an empty grid
 * says so, with a sort control once there is content) rather than appearing
 * only when the content count is non-zero; Saved and Liked belong to the
 * owner only.
 */
export function visibleProfileTabKeys({
    isOwn,
    hasMedia = false,
    hasAppearances = false,
    hasMembers = false,
    repostsEnabled = REPOSTS_TAB_ENABLED,
}: {
    isOwn: boolean
    hasMedia?: boolean
    hasAppearances?: boolean
    hasMembers?: boolean
    repostsEnabled?: boolean
}): ProfileTabKey[] {
    return tabDefinitions
        .filter((tab) => {
            if (tab.selfOnly && !isOwn) return false
            if (tab.key === "media" && !hasMedia) return false
            if (tab.key === "appears" && !hasAppearances) return false
            if (tab.key === "members" && !hasMembers) return false
            if (tab.key === "qa" && !QA_TAB_ENABLED) return false
            if (tab.key === "reposts" && !repostsEnabled) return false
            return true
        })
        .map((tab) => tab.key)
}

export function ProfileTabs({
    activeTab,
    onTabChange,
    isOwn,
    hasMedia,
    hasAppearances = false,
    hasMembers = false,
}: ProfileTabsProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(false)

    const visibleKeys = new Set(visibleProfileTabKeys({ isOwn, hasMedia, hasAppearances, hasMembers }))
    const visibleTabs = tabDefinitions.filter((tab) => visibleKeys.has(tab.key))

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        const check = () => {
            setCanScrollLeft(el.scrollLeft > 2)
            setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
        }
        check()
        el.addEventListener("scroll", check, { passive: true })
        window.addEventListener("resize", check)
        return () => {
            el.removeEventListener("scroll", check)
            window.removeEventListener("resize", check)
        }
    }, [visibleTabs.length])

    // The row scrolls sideways inside its own box on a narrow screen;
    // min-w-0 keeps it from widening the page instead.
    return (
        <div className="min-w-0 py-1 border-b border-brand-divider/60">
            <div className="relative min-w-0">
                {canScrollLeft && (
                    <div className="absolute left-0 top-0 bottom-0 w-8 bg-linear-to-r from-brand-card to-transparent z-10 pointer-events-none" />
                )}
                {canScrollRight && (
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-linear-to-l from-brand-card to-transparent z-10 pointer-events-none" />
                )}

                <div
                    ref={scrollRef}
                    role="tablist"
                    aria-label="Profile sections"
                    className="flex min-w-0 max-w-full overflow-x-auto overscroll-x-contain scrollbar-hide gap-1"
                >
                    {visibleTabs.map((tab) => {
                        const isActive = activeTab === tab.key
                        const Icon = tab.icon
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                data-tab={tab.key}
                                onClick={() => onTabChange(tab.key)}
                                className={`relative flex items-center gap-2 px-4 py-3 text-xs font-bold tracking-[0.14em] whitespace-nowrap transition-all duration-200 group ${
                                    isActive
                                        ? "text-brand-text"
                                        : "text-muted-foreground hover:text-brand-text"
                                }`}
                            >
                                {/* One accent for every tab, from the theme: the
                                    active icon sits on the brand tint. */}
                                <span
                                    className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-300 ${
                                        isActive
                                            ? "bg-primary-tint text-primary-ink shadow-xs scale-110"
                                            : "bg-transparent text-muted-foreground group-hover:bg-brand-secondary"
                                    }`}
                                >
                                    <Icon className="w-4 h-4" strokeWidth={2.25} />
                                </span>
                                <span>{tab.label}</span>

                                {isActive && (
                                    <motion.div
                                        layoutId="profile-tab-indicator"
                                        className="absolute bottom-0 left-3 right-3 h-[2.5px] bg-linear-to-r from-brand-text to-brand-text/60 rounded-full"
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
