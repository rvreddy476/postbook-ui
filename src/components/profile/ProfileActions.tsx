"use client"

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import Link from "next/link"
import {
    Flag,
    Link2,
    MoreHorizontal,
    Pencil,
    Settings,
    Share2,
    Shield,
    ShieldOff,
    UserCheck,
    UserPlus,
    Clock,
    Volume2,
    VolumeX,
} from "lucide-react"
import {
    FOLLOW_BUTTON_LABELS,
    profileMenuRows,
    type FollowButtonState,
    type ProfileMenuRowKey,
} from "./profileParity"

/*
  The profile's action row (parity 3-W1).

  Owner:   Edit profile · Share · Settings. No ⋮, so never a Report on
           your own profile.
  Visitor: Follow · Message · Share · ⋮ (Copy link, Mute, Block/Unblock,
           Report). Message is the existing request-only MessageButton,
           passed in untouched as `messageSlot`; the circle (connection)
           control is passed in as `connectionSlot`.

  The menu is a WAI-ARIA menu button: Enter/Space/ArrowDown opens it on the
  first item, arrows and Home/End move, Escape closes it and returns focus
  to the button, Tab or a click outside closes it.
*/

interface ProfileActionsProps {
    isOwn: boolean
    signedIn: boolean
    username: string
    followState: FollowButtonState
    followBusy?: boolean
    blocked: boolean
    isMuted?: boolean
    onFollow: () => void
    onUnfollow: () => void
    onEditProfile: () => void
    onShare: () => void
    onCopyLink: () => void
    onBlock?: () => void
    onUnblock?: () => void
    onMute?: () => void
    onUnmute?: () => void
    onReport?: () => void
    settingsHref?: string
    signInHref?: string
    messageSlot?: ReactNode
    connectionSlot?: ReactNode
    /** Start with the menu open (static renders in tests). */
    defaultMenuOpen?: boolean
}

const BTN =
    "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold tracking-wider transition-all shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-outline disabled:opacity-60"
const BTN_PRIMARY = `${BTN} bg-primary-ink text-primary-foreground hover:bg-primary-hover`
const BTN_QUIET = `${BTN} border border-brand-divider bg-brand-card text-brand-text hover:bg-brand-secondary`
const BTN_ICON =
    "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-divider bg-brand-card text-brand-text shadow-xs transition-all hover:bg-brand-secondary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-outline"

const ROW_ICONS: Record<ProfileMenuRowKey, ReactNode> = {
    copy_link: <Link2 className="h-4 w-4" aria-hidden />,
    mute: <VolumeX className="h-4 w-4" aria-hidden />,
    unmute: <Volume2 className="h-4 w-4" aria-hidden />,
    block: <Shield className="h-4 w-4" aria-hidden />,
    unblock: <ShieldOff className="h-4 w-4" aria-hidden />,
    report: <Flag className="h-4 w-4" aria-hidden />,
}

export function ProfileActions({
    isOwn,
    signedIn,
    username,
    followState,
    followBusy = false,
    blocked,
    isMuted = false,
    onFollow,
    onUnfollow,
    onEditProfile,
    onShare,
    onCopyLink,
    onBlock,
    onUnblock,
    onMute,
    onUnmute,
    onReport,
    settingsHref = "/settings",
    signInHref = "/login",
    messageSlot,
    connectionSlot,
    defaultMenuOpen = false,
}: ProfileActionsProps) {
    const [menuOpen, setMenuOpen] = useState(defaultMenuOpen)
    const menuRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const rows = profileMenuRows({ isOwn, signedIn, blocked, isMuted })

    const items = () =>
        Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])

    const closeMenu = useCallback((refocus: boolean) => {
        setMenuOpen(false)
        if (refocus) buttonRef.current?.focus()
    }, [])

    useEffect(() => {
        if (!menuOpen) return
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node
            if (menuRef.current?.contains(t) || buttonRef.current?.contains(t)) return
            setMenuOpen(false)
        }
        document.addEventListener("mousedown", onDown)
        return () => document.removeEventListener("mousedown", onDown)
    }, [menuOpen])

    // Opening moves focus to the first item.
    useEffect(() => {
        if (menuOpen) items()[0]?.focus()
    }, [menuOpen])

    const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault()
            setMenuOpen(true)
        }
    }

    const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
        const list = items()
        const at = list.indexOf(document.activeElement as HTMLButtonElement)
        if (e.key === "Escape") {
            e.preventDefault()
            closeMenu(true)
        } else if (e.key === "ArrowDown") {
            e.preventDefault()
            list[(at + 1) % list.length]?.focus()
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            list[(at - 1 + list.length) % list.length]?.focus()
        } else if (e.key === "Home") {
            e.preventDefault()
            list[0]?.focus()
        } else if (e.key === "End") {
            e.preventDefault()
            list[list.length - 1]?.focus()
        } else if (e.key === "Tab") {
            closeMenu(false)
        }
    }

    const handlers: Record<ProfileMenuRowKey, (() => void) | undefined> = {
        copy_link: onCopyLink,
        mute: onMute,
        unmute: onUnmute,
        block: onBlock,
        unblock: onUnblock,
        report: onReport,
    }

    const shareButton = (
        <button type="button" onClick={onShare} className={BTN_QUIET} aria-label="Share profile">
            <Share2 className="h-4 w-4" aria-hidden />
            <span>Share</span>
        </button>
    )

    if (isOwn) {
        return (
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end" data-testid="profile-actions-owner">
                <button type="button" onClick={onEditProfile} className={BTN_PRIMARY}>
                    <Pencil className="h-4 w-4" aria-hidden />
                    Edit profile
                </button>
                {shareButton}
                <Link href={settingsHref} className={BTN_ICON} aria-label="Settings" title="Settings">
                    <Settings className="h-4 w-4" aria-hidden />
                </Link>
            </div>
        )
    }

    const followLabel = FOLLOW_BUTTON_LABELS[followState]
    let followButton: ReactNode = null
    if (!blocked) {
        if (!signedIn) {
            followButton = (
                <Link href={signInHref} className={BTN_PRIMARY}>
                    <UserPlus className="h-4 w-4" aria-hidden />
                    Follow
                </Link>
            )
        } else if (followState === "following") {
            followButton = (
                <button
                    type="button"
                    onClick={onUnfollow}
                    disabled={followBusy}
                    aria-pressed="true"
                    aria-label={`Following @${username}. Unfollow`}
                    className={BTN_QUIET}
                >
                    <UserCheck className="h-4 w-4" aria-hidden />
                    {followLabel}
                </button>
            )
        } else if (followState === "requested") {
            followButton = (
                <button type="button" disabled aria-disabled="true" title="Follow request sent" className={BTN_QUIET}>
                    <Clock className="h-4 w-4" aria-hidden />
                    {followLabel}
                </button>
            )
        } else {
            followButton = (
                <button type="button" onClick={onFollow} disabled={followBusy} aria-pressed="false" className={BTN_PRIMARY}>
                    <UserPlus className="h-4 w-4" aria-hidden />
                    {followLabel}
                </button>
            )
        }
    }

    return (
        <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end" data-testid="profile-actions-visitor">
            {followButton}
            {!blocked ? connectionSlot : null}
            {!blocked ? messageSlot : null}
            {shareButton}
            <div className="relative">
                <button
                    ref={buttonRef}
                    type="button"
                    aria-label="More actions"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-controls="profile-actions-menu"
                    onClick={() => setMenuOpen((v) => !v)}
                    onKeyDown={onTriggerKey}
                    className={BTN_ICON}
                >
                    <MoreHorizontal className="h-4 w-4" aria-hidden />
                </button>
                {menuOpen ? (
                    <div
                        ref={menuRef}
                        id="profile-actions-menu"
                        role="menu"
                        aria-label={`Actions for @${username}`}
                        onKeyDown={onMenuKey}
                        className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-brand-divider bg-brand-card py-1 shadow-lg"
                    >
                        {rows.map((row) => (
                            <button
                                key={row.key}
                                type="button"
                                role="menuitem"
                                tabIndex={-1}
                                data-row={row.key}
                                onClick={() => {
                                    closeMenu(false)
                                    handlers[row.key]?.()
                                }}
                                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors focus-visible:outline-hidden focus-visible:bg-brand-secondary ${
                                    row.destructive ? "text-danger hover:bg-brand-secondary" : "text-brand-text hover:bg-brand-secondary"
                                }`}
                            >
                                {ROW_ICONS[row.key]}
                                {row.label}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    )
}
