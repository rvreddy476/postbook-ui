'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Share2, X } from 'lucide-react'
import type { Group } from '@/types/groups'

/**
 * Share a group.
 *
 * This shares a URL, not an invite link, and the copy has to say so.
 * group-service has no link-based join at all: `POST /:groupId/invite` takes
 * a user id (or a batch of them) and there is no code, no token and no
 * accept-by-link route. Labelling this "Invite link" would promise that
 * anyone holding it can get in, which for a private or invite-only group is
 * simply untrue — they would follow it and be told they cannot join.
 *
 * So: it is a link to the group, the dialog explains what that does for this
 * group's privacy setting, and getting someone IN is what the Invite button
 * beside it is for.
 */
export default function GroupShareDialog({
    group,
    onClose,
}: {
    group: Group
    onClose: () => void
}) {
    const [copied, setCopied] = useState(false)

    const url =
        typeof window === 'undefined'
            ? ''
            : `${window.location.origin}/groups/${group.handle || group.id}`

    const privacy = group.privacy_level ?? group.visibility ?? 'public'
    const isOpen = privacy === 'public'

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // Blocked clipboard: the input below is selectable, so there is
            // still a way to get the link.
        }
    }

    const share = async () => {
        if (typeof navigator === 'undefined' || !navigator.share) return
        try {
            await navigator.share({ title: group.name, url })
        } catch {
            // The user dismissed the sheet. Not an error.
        }
    }

    const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

    return createPortal(
        <div
            className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
            role="dialog"
            aria-modal="true"
            aria-label={`Share ${group.name}`}
        >
            <div className="animate-in fade-in zoom-in-95 w-full max-w-md overflow-hidden rounded-2xl bg-brand-card shadow-2xl duration-200">
                <div className="flex items-center gap-3 border-b border-brand-divider px-5 py-4">
                    <span className="bg-primary-grad flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white">
                        <Share2 className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="truncate text-[17px] font-semibold -tracking-[0.018em] text-brand-text">
                            Share {group.name}
                        </h2>
                        <p className="text-[12px] text-brand-text/60">A link to the group</p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand-text/50 transition-colors hover:bg-brand-secondary hover:text-brand-text"
                    >
                        <X className="h-[18px] w-[18px]" />
                    </button>
                </div>

                <div className="space-y-3 px-5 py-5">
                    <div className="flex items-center gap-2">
                        <input
                            readOnly
                            value={url}
                            onFocus={(e) => e.currentTarget.select()}
                            className="min-w-0 flex-1 rounded-xl border border-brand-divider bg-brand-secondary px-3.5 py-2.5 text-[13px] text-brand-text outline-hidden"
                        />
                        <button
                            onClick={copy}
                            className="bg-primary-grad flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:shadow-md"
                        >
                            {copied ? (
                                <Check className="h-4 w-4" strokeWidth={2.4} />
                            ) : (
                                <Copy className="h-4 w-4" strokeWidth={2} />
                            )}
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                    </div>

                    {/* What the link actually does, which depends on the
                        group's privacy — not a generic reassurance. */}
                    <p className="text-[12px] leading-relaxed text-brand-text/55">
                        {isOpen
                            ? 'Anyone with this link can find the group and see its posts.'
                            : 'Anyone with this link can find the group, but they will still need an invite to join it or see its posts. Use Invite to add someone.'}
                    </p>

                    {canNativeShare && (
                        <button
                            onClick={share}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-divider px-4 py-2.5 text-[13px] font-semibold text-brand-text transition-colors hover:bg-brand-secondary"
                        >
                            <Share2 className="h-4 w-4" strokeWidth={1.9} />
                            Share via…
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    )
}
