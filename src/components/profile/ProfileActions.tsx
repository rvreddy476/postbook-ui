"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import type { Relationship } from "@/types/profile"
import { UserCheck, UserPlus, MessageSquare, Settings, Share2, Clock, Users, MoreHorizontal, Shield, ShieldOff, UserMinus, Lock } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface ProfileActionsProps {
    isOwn: boolean
    relationship: Relationship | null
    username?: string
    displayName?: string
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
}

export function ProfileActions({
    isOwn,
    relationship,
    username,
    displayName,
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
}: ProfileActionsProps) {
    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    const handleClickOutside = useCallback((e: MouseEvent) => {
        if (
            menuRef.current &&
            !menuRef.current.contains(e.target as Node) &&
            buttonRef.current &&
            !buttonRef.current.contains(e.target as Node)
        ) {
            setMenuOpen(false)
        }
    }, [])

    useEffect(() => {
        if (menuOpen) {
            document.addEventListener("mousedown", handleClickOutside)
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [menuOpen, handleClickOutside])

    if (isOwn) {
        return (
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onEditProfile}>
                    <Settings className="mr-2 h-4 w-4" />
                    Edit Profile
                </Button>
                <Button variant="ghost" size="sm">
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

    // When user is blocked, show only Unblock button
    if (isBlocked) {
        return (
            <div className="flex gap-2">
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={onUnblock}
                >
                    <ShieldOff className="mr-2 h-4 w-4" />
                    Unblock
                </Button>
            </div>
        )
    }

    // Build more menu items based on relationship state
    const menuItems: { label: string; icon: React.ReactNode; onClick: () => void; destructive?: boolean }[] = []

    if (isFollowing) {
        menuItems.push({
            label: `Unfollow @${username}`,
            icon: <UserMinus className="h-4 w-4" />,
            onClick: () => { setMenuOpen(false); onUnfollow() },
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
    menuItems.push({
        label: `Block @${username}`,
        icon: <Shield className="h-4 w-4" />,
        onClick: () => { setMenuOpen(false); onBlock?.() },
        destructive: true,
    })

    return (
        <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
                {/* Follow Button (always visible, independent of circle) */}
                <Button
                    onClick={isFollowing ? onUnfollow : onFollow}
                    variant={isFollowing ? "outline" : "default"}
                    size="sm"
                    className={isFollowing
                        ? "border-violet-300 text-violet-700 hover:bg-violet-50"
                        : "bg-violet-600 hover:bg-violet-700 text-white"
                    }
                >
                    {isFollowing ? (
                        <>
                            <UserCheck className="mr-2 h-4 w-4" />
                            Following
                        </>
                    ) : (
                        <>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Follow
                        </>
                    )}
                </Button>

                {/* Circle Button (independent of follow) */}
                {inCircle ? (
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => setMenuOpen(true)}
                    >
                        <Users className="mr-2 h-4 w-4" />
                        In Circle ✓
                    </Button>
                ) : circleRequestSent ? (
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-amber-300 text-amber-700 hover:bg-amber-50"
                        onClick={onCancelCircleRequest}
                    >
                        <Clock className="mr-2 h-4 w-4" />
                        Pending...
                    </Button>
                ) : circleRequestReceived ? (
                    <div className="flex gap-1">
                        <Button
                            variant="default"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={onAcceptCircleRequest}
                        >
                            Accept
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-slate-300 text-slate-600"
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
                        className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                    >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add Friend
                    </Button>
                )}

                {/* Chat Button (gated by circle membership) */}
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!canDM}
                    onClick={canDM ? onMessage : undefined}
                    className={canDM
                        ? "border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                        : "opacity-40 cursor-not-allowed"
                    }
                    title={canDM ? "Send message" : "Add to circle first"}
                >
                    {!canDM && <Lock className="mr-1 h-3 w-3" />}
                    <MessageSquare className="h-4 w-4" />
                </Button>

                {/* More Actions Dropdown */}
                <div className="relative">
                    <Button
                        ref={buttonRef}
                        variant="ghost"
                        size="sm"
                        onClick={() => setMenuOpen((prev) => !prev)}
                        aria-label="More actions"
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
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl bg-white border border-violet-100 shadow-lg py-1 overflow-hidden"
                            >
                                {menuItems.map((item, i) => (
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
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Helper text when chat is disabled */}
            {!canDM && (
                <p className="text-xs text-slate-400">
                    🔒 Add {displayName || username} to your Circle to unlock messaging
                </p>
            )}
        </div>
    )
}
