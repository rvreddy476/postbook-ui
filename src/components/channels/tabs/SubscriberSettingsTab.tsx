'use client'

import React from 'react'
import { Bell, BellOff, LogOut, Loader2, Shield } from 'lucide-react'
import type { BroadcastChannel } from '@/types/channels'

/**
 * Settings a SUBSCRIBER has over a channel — which is only ever about their
 * own relationship to it, never the channel itself.
 *
 * There are two distinct tabs called Settings and they must not be confused:
 * SettingsTab edits the channel (name, description, who may comment) and
 * belongs to whoever runs it; this one edits the viewer's membership. Showing
 * the owner's version to a subscriber would offer controls every write of
 * which the server refuses — a screen of buttons that all fail.
 *
 * Muting and leaving are kept apart deliberately. "Stop notifying me" and "I
 * am no longer part of this" are different intentions, and a product that
 * only offers the second makes the quiet option cost the membership.
 */
export default function SubscriberSettingsTab({
    channel,
    onSetMuted,
    onLeave,
    isSaving = false,
    isLeaving = false,
}: {
    channel: BroadcastChannel
    onSetMuted: (muted: boolean) => void
    onLeave: () => void
    isSaving?: boolean
    isLeaving?: boolean
}) {
    // Go sends false for an unset bool rather than omitting it, so an absent
    // field and an explicit false both mean "not muted" — which is the right
    // default either way: a channel you subscribed to should reach you.
    const muted = channel.viewer_muted === true

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-card">
                <header className="border-b border-brand-divider px-4 py-3">
                    <h3 className="flex items-center gap-2 text-[14px] font-semibold text-brand-text">
                        <Bell className="h-4 w-4 text-brand-text/45" strokeWidth={1.9} />
                        Notifications
                    </h3>
                </header>

                <div className="divide-y divide-brand-divider">
                    <Choice
                        icon={Bell}
                        title="All posts"
                        detail="Tell me when this channel posts"
                        selected={!muted}
                        disabled={isSaving}
                        onSelect={() => onSetMuted(false)}
                    />
                    <Choice
                        icon={BellOff}
                        title="Muted"
                        detail="Still subscribed, but no notifications"
                        selected={muted}
                        disabled={isSaving}
                        onSelect={() => onSetMuted(true)}
                    />
                </div>
            </section>

            <section className="rounded-2xl border border-brand-divider bg-brand-card p-4">
                <h3 className="flex items-center gap-2 text-[14px] font-semibold text-brand-text">
                    <Shield className="h-4 w-4 text-brand-text/45" strokeWidth={1.9} />
                    This channel
                </h3>
                <dl className="mt-3 space-y-2 text-[13px]">
                    <div className="flex items-center justify-between gap-3">
                        <dt className="text-brand-text/55">Who can post</dt>
                        <dd className="font-medium text-brand-text">Admins only</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <dt className="text-brand-text/55">Comments</dt>
                        <dd className="font-medium capitalize text-brand-text">
                            {channel.comment_mode === 'subscribers_only'
                                ? 'Subscribers only'
                                : channel.comment_mode || 'enabled'}
                        </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <dt className="text-brand-text/55">Forwarding</dt>
                        <dd className="font-medium text-brand-text">
                            {channel.forward_allowed ? 'Allowed' : 'Off'}
                        </dd>
                    </div>
                </dl>
                {/* Stated, not editable. These are the channel's rules and a
                    subscriber lives under them; showing them as switches would
                    offer control that does not exist. */}
                <p className="mt-3 text-[11px] text-brand-text/40">
                    Set by whoever runs this channel.
                </p>
            </section>

            <section className="rounded-2xl border border-brand-divider bg-brand-card p-4">
                <button
                    type="button"
                    onClick={onLeave}
                    disabled={isLeaving}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger/30 px-4 py-2.5 text-[13px] font-semibold text-danger transition-colors hover:bg-danger/10 disabled:opacity-40"
                >
                    {isLeaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                    ) : (
                        <LogOut className="h-4 w-4" strokeWidth={1.9} />
                    )}
                    Leave channel
                </button>
                <p className="mt-2 text-center text-[11px] text-brand-text/40">
                    You can subscribe again at any time.
                </p>
            </section>
        </div>
    )
}

function Choice({
    icon: Icon,
    title,
    detail,
    selected,
    disabled,
    onSelect,
}: {
    icon: typeof Bell
    title: string
    detail: string
    selected: boolean
    disabled?: boolean
    onSelect: () => void
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            disabled={disabled}
            aria-pressed={selected}
            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-50 ${
                selected ? 'bg-primary-tint' : 'hover:bg-brand-secondary'
            }`}
        >
            <Icon
                className={`h-[18px] w-[18px] shrink-0 ${selected ? 'text-primary-ink' : 'text-brand-text/40'}`}
                strokeWidth={1.9}
            />
            <span className="min-w-0 flex-1">
                <span className={`block text-[13px] font-medium ${selected ? 'text-primary-ink' : 'text-brand-text'}`}>
                    {title}
                </span>
                <span className="block text-[11px] text-brand-text/45">{detail}</span>
            </span>
            <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    selected ? 'border-primary-ink' : 'border-brand-divider'
                }`}
            >
                {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary-ink" />}
            </span>
        </button>
    )
}
