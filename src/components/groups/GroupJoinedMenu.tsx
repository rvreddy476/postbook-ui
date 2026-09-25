'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, ChevronDown, Link2, LogOut, Settings2 } from 'lucide-react'
import type { Group } from '@/types/groups'
import { useLeaveGroup } from '@/hooks/useGroups'

/**
 * The Joined ▾ menu.
 *
 * Two items the reference has are deliberately NOT here, because neither has
 * anything behind it in group-service:
 *
 *   - **Per-group mute / "manage notifications"**. There is no mute route, no
 *     notification-preference route and no column to hold one. What exists is
 *     account-wide (`push_group_posts`, `inapp_group_posts` in
 *     notification-service), so the item links there and is worded as what it
 *     is. A per-group control would be a switch that flips and does nothing.
 *
 *   - **Follow / unfollow**. For a group this is the same act as join/leave,
 *     which Exit group already covers. Two controls for one state, one of them
 *     inert, is worse than one.
 *
 * Group settings is here because dropping the old Manage tab would otherwise
 * orphan a working 475-line settings page.
 */
export default function GroupJoinedMenu({ group }: { group: Group }) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [leaving, setLeaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const ref = useRef<HTMLDivElement>(null)
    const leaveGroup = useLeaveGroup()

    useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    const viewerRole = group.viewer_role ?? 'member'
    const isAdmin = viewerRole === 'owner' || viewerRole === 'admin'

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(
                `${window.location.origin}/groups/${group.handle || group.id}`,
            )
        } catch {
            // Clipboard is blocked in some contexts; the Share dialog offers
            // the same link as selectable text, so this is not worth an alert.
        }
        setOpen(false)
    }

    const leave = () => {
        // A confirm, because leaving a private or invite-only group may not be
        // undoable by the person doing it.
        if (!window.confirm(`Leave ${group.name}?`)) return
        setLeaving(true)
        setError(null)
        leaveGroup.mutate(group.id, {
            onSuccess: () => router.push('/groups'),
            onError: (err: unknown) => {
                const body = (err as { response?: { data?: { error?: { message?: string } } } })
                    ?.response?.data?.error
                setError(body?.message || 'Could not leave the group.')
                setLeaving(false)
            },
        })
    }

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-haspopup="menu"
                className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur-xs transition-colors hover:bg-white/25"
            >
                <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
                Joined
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.4} />
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 top-full z-30 mt-2 w-60 overflow-hidden rounded-xl border border-brand-divider bg-brand-card shadow-xl"
                >
                    <button
                        role="menuitem"
                        onClick={() => {
                            router.push('/settings/notifications')
                            setOpen(false)
                        }}
                        className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-brand-secondary"
                    >
                        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-brand-text/45" strokeWidth={1.9} />
                        <span className="min-w-0">
                            <span className="block text-[13px] font-medium text-brand-text">
                                Notification settings
                            </span>
                            {/* Said plainly: these apply to every group, not
                                this one. Wording it as if it scoped here would
                                be the lie the control itself avoids. */}
                            <span className="block text-[11px] text-brand-text/45">
                                For all groups
                            </span>
                        </span>
                    </button>

                    <button
                        role="menuitem"
                        onClick={copyLink}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-brand-text transition-colors hover:bg-brand-secondary"
                    >
                        <Link2 className="h-4 w-4 shrink-0 text-brand-text/45" strokeWidth={1.9} />
                        Copy link
                    </button>

                    {isAdmin && (
                        <button
                            role="menuitem"
                            onClick={() => {
                                router.push(`/groups/${group.id}/settings`)
                                setOpen(false)
                            }}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-brand-text transition-colors hover:bg-brand-secondary"
                        >
                            <Settings2 className="h-4 w-4 shrink-0 text-brand-text/45" strokeWidth={1.9} />
                            Group settings
                        </button>
                    )}

                    <div className="border-t border-brand-divider">
                        <button
                            role="menuitem"
                            onClick={leave}
                            disabled={leaving}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
                        >
                            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.9} />
                            {leaving ? 'Leaving…' : 'Exit group'}
                        </button>
                    </div>

                    {error && (
                        <p role="alert" className="px-3.5 pb-2.5 text-[11px] text-danger">
                            {error}
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}
