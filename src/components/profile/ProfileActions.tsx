"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import type { Relationship } from "@/types/profile"
import {
    UserCheck,
    UserPlus,
    MessageSquare,
    Settings,
    Share2,
    Clock,
    Users,
    MoreHorizontal,
    Shield,
    ShieldOff,
    UserMinus,
    Lock,
    VolumeX,
    Volume2,
    Link2,
    Flag,
    SlidersHorizontal,
    EyeOff,
    MinusCircle,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface ProfileActionsProps {
    isOwn: boolean
    relationship: Relationship | null
    username?: string
    displayName?: string
    isMuted?: boolean
    onFollow: () => void
    onUnfollow: () => void
    onSendCircleRequest: () => void
    onAcceptCircleRequest: () => void
    onDeclineCircleRequest: () => void
    onCancelCircleRequest: () => void
    onRemoveFromCircle: () => void
    onEditProfile: () => void
    onMessage?: () => void
    onBlock?: () => void
    onUnblock?: () => void
    onMute?: () => void
    onUnmute?: () => void
}

interface MenuItem {
    label: string
    icon: React.ReactNode
    onClick: () => void
    destructive?: boolean
    divider?: boolean
}

export function ProfileActions({
    isOwn,
    relationship,
    username,
    displayName,
    isMuted = false,
    onFollow,
    onUnfollow,
    onSendCircleRequest,
    onAcceptCircleRequest,
    onDeclineCircleRequest,
    onCancelCircleRequest,
    onRemoveFromCircle,
    onEditProfile,
    onMessage,
    onBlock,
    onUnblock,
    onMute,
    onUnmute,
}: ProfileActionsProps) {
    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    const handleClickOutside = useCallback(
        (e: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(e.target as Node)
            ) {
                setMenuOpen(false)
            }
        },
        []
    )

    useEffect(() => {
        if (menuOpen) {
            document.addEventListener("mousedown", handleClickOutside)
        }
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [menuOpen, handleClickOutside])

    const handleCopyLink = useCallback(() => {
        const url = `${window.location.origin}/u/${username}`
        navigator.clipboard.writeText(url).catch(() => {})
        setMenuOpen(false)
    }, [username])

    // Self view
    if (isOwn) {
        return (
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onEditProfile}
                    className="rounded-xl border-slate-200 hover:border-[#D8103F]/20 hover:bg-[#D8103F]/5 text-sm font-semibold"
                >
                    <Settings className="mr-2 h-4 w-4" />
                    Edit Profile
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyLink}
                    className="rounded-xl"
                >
                    <Share2 className="h-4 w-4" />
                </Button>
            </div>
        )
    }

    const isFollowing = relationship?.following ?? false
    const inCircle = relationship?.in_circle ?? false
    const circleRequestSent = relationship?.circle_request_sent ?? false
    const circleRequestReceived = relationship?.circle_request_received ?? false
    const isBlocked = relationship?.blocked ?? false
    const canDM = relationship?.can_dm ?? false

    // Blocked state
    if (isBlocked) {
        return (
            <Button
                variant="outline"
                size="sm"
                onClick={onUnblock}
                className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
            >
                <ShieldOff className="mr-2 h-4 w-4" />
                Unblock
            </Button>
        )
    }

    // Build overflow menu
    const menuItems: MenuItem[] = []

    if (isFollowing) {
        menuItems.push({
            label: `Unfollow @${username}`,
            icon: <UserMinus className="h-4 w-4" />,
            onClick: () => { setMenuOpen(false); onUnfollow() },
        })
    }

    if (!inCircle && !circleRequestSent) {
        menuItems.push({
            label: "Add to Circle",
            icon: <Users className="h-4 w-4" />,
            onClick: () => { setMenuOpen(false); onSendCircleRequest() },
        })
    }

    if (inCircle) {
        menuItems.push({
            label: "Remove from Circle",
            icon: <Users className="h-4 w-4" />,
            onClick: () => { setMenuOpen(false); onRemoveFromCircle() },
            destructive: true,
        })
    }

    // Divider before Tune
    menuItems.push({ label: "divider", icon: null, onClick: () => {}, divider: true })

    // Tune section
    menuItems.push({
        label: `Not interested in this creator`,
        icon: <EyeOff className="h-4 w-4" />,
        onClick: () => setMenuOpen(false),
    })
    menuItems.push({
        label: `Show less from ${displayName || username}`,
        icon: <MinusCircle className="h-4 w-4" />,
        onClick: () => setMenuOpen(false),
    })

    if (isMuted) {
        menuItems.push({
            label: `Unmute @${username}`,
            icon: <Volume2 className="h-4 w-4" />,
            onClick: () => { setMenuOpen(false); onUnmute?.() },
        })
    } else {
        menuItems.push({
            label: `Mute @${username}`,
            icon: <VolumeX className="h-4 w-4" />,
            onClick: () => { setMenuOpen(false); onMute?.() },
        })
    }

    // Divider before destructive actions
    menuItems.push({ label: "divider", icon: null, onClick: () => {}, divider: true })

    menuItems.push({
        label: `Block @${username}`,
        icon: <Shield className="h-4 w-4" />,
        onClick: () => { setMenuOpen(false); onBlock?.() },
        destructive: true,
    })
    menuItems.push({
        label: "Report",
        icon: <Flag className="h-4 w-4" />,
        onClick: () => setMenuOpen(false),
        destructive: true,
    })
    menuItems.push({
        label: "Copy profile link",
        icon: <Link2 className="h-4 w-4" />,
        onClick: handleCopyLink,
    })

    return (
        <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
                {/* Follow */}
                <Button
                    onClick={isFollowing ? onUnfollow : onFollow}
                    variant={isFollowing ? "outline" : "default"}
                    size="sm"
                    className={`rounded-xl text-sm font-semibold ${
                        isFollowing
                            ? "border-[#D8103F]/30 text-[#D8103F] hover:bg-[#D8103F]/5"
                            : "bg-[#D8103F] hover:bg-[#b80d35] text-white"
                    }`}
                >
                    {isFollowing ? (
                        <>
                            <UserCheck className="mr-1.5 h-4 w-4" />
                            Following
                        </>
                    ) : (
                        <>
                            <UserPlus className="mr-1.5 h-4 w-4" />
                            Follow
                        </>
                    )}
                </Button>

                {/* Circle (Friend) */}
                {inCircle ? (
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-sm font-semibold"
                        onClick={() => setMenuOpen(true)}
                    >
                        <Users className="mr-1.5 h-4 w-4" />
                        Friends
                    </Button>
                ) : circleRequestSent ? (
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-amber-200 text-amber-600 hover:bg-amber-50 text-sm font-semibold"
                        onClick={onCancelCircleRequest}
                    >
                        <Clock className="mr-1.5 h-4 w-4" />
                        Requested
                    </Button>
                ) : circleRequestReceived ? (
                    <div className="flex gap-1">
                        <Button
                            size="sm"
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                            onClick={onAcceptCircleRequest}
                        >
                            Accept
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl border-slate-200 text-sm font-semibold"
                            onClick={onDeclineCircleRequest}
                        >
                            Decline
                        </Button>
                    </div>
                ) : (
                    <Button
                        onClick={onSendCircleRequest}
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-slate-200 text-slate-700 hover:border-[#D8103F]/20 hover:bg-[#D8103F]/5 text-sm font-semibold"
                    >
                        <UserPlus className="mr-1.5 h-4 w-4" />
                        Add Friend
                    </Button>
                )}

                {/* Message */}
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!canDM}
                    onClick={canDM ? onMessage : undefined}
                    className={`rounded-xl text-sm font-semibold ${
                        canDM
                            ? "border-slate-200 text-slate-700 hover:border-[#D8103F]/20 hover:bg-[#D8103F]/5"
                            : "opacity-40 cursor-not-allowed"
                    }`}
                    title={canDM ? "Send message" : "Add to Circle first"}
                >
                    {!canDM && <Lock className="mr-1 h-3 w-3" />}
                    <MessageSquare className="h-4 w-4" />
                </Button>

                {/* More */}
                <div className="relative">
                    <Button
                        ref={buttonRef}
                        variant="ghost"
                        size="sm"
                        onClick={() => setMenuOpen((p) => !p)}
                        className="rounded-xl"
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>

                    <AnimatePresence>
                        {menuOpen && (
                            <motion.div
                                ref={menuRef}
                                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                transition={{ duration: 0.12 }}
                                className="absolute right-0 top-full mt-1 z-50 w-64 rounded-xl bg-white border border-slate-100 shadow-lg py-1 overflow-hidden"
                            >
                                {/* Tune header */}
                                <div className="px-4 py-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    <SlidersHorizontal className="w-3 h-3" />
                                    More Actions
                                </div>
                                {menuItems.map((item, i) => {
                                    if (item.divider) {
                                        return <div key={i} className="my-1 border-t border-slate-100" />
                                    }
                                    return (
                                        <button
                                            key={i}
                                            onClick={item.onClick}
                                            className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
                                                item.destructive
                                                    ? "text-red-600 hover:bg-red-50"
                                                    : "text-slate-700 hover:bg-slate-50"
                                            }`}
                                        >
                                            {item.icon}
                                            {item.label}
                                        </button>
                                    )
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {!canDM && (
                <p className="text-xs text-slate-400">
                    Add {displayName || username} to your Circle to unlock messaging
                </p>
            )}
        </div>
    )
}
