'use client'

import React, { useMemo } from 'react'
import {
    BarChart3,
    CalendarDays,
    Eye,
    FileText,
    Globe,
    Heart,
    Languages,
    Link2,
    MapPin,
    Shield,
    Tag,
    Users,
} from 'lucide-react'
import type { BroadcastChannel, ChannelUpdate, ChannelMember } from '@/types/channels'
import { useBatchProfiles } from '@/hooks/useProfile'
import Avatar from '@/components/ui/Avatar'
import { formatCount, monthBuckets, overviewStats, recentPosts } from './overviewStats'

/**
 * The channel's Overview.
 *
 * Every number here is derived from data the client already holds — the
 * channel record, its updates and its member list. Nothing is invented: where
 * the product cannot know something, this says so rather than showing a
 * plausible figure.
 *
 * Two panels from the reference are deliberately absent, and the reason is the
 * same for both — there is no source behind them:
 *
 *   - "vs last month" deltas on the stat cards. channel-service keeps current
 *     totals, not a history, so a percentage change would be a number with
 *     nothing under it. Counts are shown without one.
 *   - Reported Content. The report queue is /internal/channel-reports, behind
 *     the internal service key and meant for platform moderators, so a
 *     channel's own admin has no route to it. A card here would be empty at
 *     best and misleading at worst.
 *
 * The member-growth chart is drawn from POSTING activity, which the channel
 * does have, and is labelled as that rather than as membership over time.
 */

function formatDate(iso?: string): string {
    if (!iso) return '—'
    const d = new Date(iso)
    return Number.isNaN(d.getTime())
        ? '—'
        : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatCard({
    icon: Icon,
    label,
    value,
    tint,
    hint,
}: {
    icon: typeof Users
    label: string
    value: string
    tint: string
    hint?: string
}) {
    return (
        <div className="rounded-2xl border border-brand-divider bg-brand-card p-4">
            <div className="flex items-start gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tint}`}>
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </span>
                <div className="min-w-0">
                    <p className="text-[12px] font-medium text-brand-text/55">{label}</p>
                    <p className="mt-0.5 text-[24px] font-bold leading-none -tracking-[0.02em] text-brand-text">
                        {value}
                    </p>
                    {hint && <p className="mt-1 text-[11px] text-brand-text/40">{hint}</p>}
                </div>
            </div>
        </div>
    )
}

function Panel({
    title,
    icon: Icon,
    action,
    children,
}: {
    title: string
    icon: typeof Users
    action?: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <section className="rounded-2xl border border-brand-divider bg-brand-card">
            <header className="flex items-center justify-between gap-3 border-b border-brand-divider px-4 py-3">
                <h3 className="flex items-center gap-2 text-[14px] font-semibold text-brand-text">
                    <Icon className="h-4 w-4 text-brand-text/45" strokeWidth={1.9} />
                    {title}
                </h3>
                {action}
            </header>
            <div className="p-4">{children}</div>
        </section>
    )
}

export default function OverviewTab({
    channel,
    updates = [],
    admins = [],
    onViewPosts,
    onViewMembers,
}: {
    channel: BroadcastChannel
    updates?: ChannelUpdate[]
    /** From GET /admins, which already returns the owner first. */
    admins?: ChannelMember[]
    onViewPosts?: () => void
    onViewMembers?: () => void
}) {
    const activity = useMemo(() => monthBuckets(updates), [updates])
    const peak = Math.max(1, ...activity.map((m) => m.count))
    const stats = useMemo(() => overviewStats(updates), [updates])

    /*
      Names, not UUIDs. The member row carries only a user id — channel-service
      has no profile to join against — so the panel would otherwise list eight
      hex characters per person, which tells an owner nothing about who they
      have given the keys to. The batch profile call is the same one the feed
      and comments use.

      Not gated on the profiles arriving: the roles are the useful part and
      they are already loaded, so a slow profile call must not hide the panel.
    */
    /*
      The owner, guaranteed.

      channel-service used to write the owner's membership row outside the
      channel's transaction and log a failure instead of returning it, so a
      channel can exist whose /admins list is empty. That is fixed at the
      source, but channels already in that state keep their empty list — and a
      "who runs this" panel that omits the owner is worse than no panel.

      broadcast_channels.owner_id is the authority either way: it is what
      viewer_role is resolved from. So when the list has no owner, the channel
      record supplies one.
    */
    const runners = useMemo(() => {
        if (admins.some((m) => m.role === 'owner')) return admins
        return [
            {
                channel_id: channel.id,
                user_id: channel.owner_id,
                role: 'owner',
                notify_on: 'all',
                subscribed_at: channel.created_at,
            } satisfies ChannelMember,
            ...admins,
        ]
    }, [admins, channel.id, channel.owner_id, channel.created_at])

    const adminIds = useMemo(() => runners.map((m) => m.user_id), [runners])
    const { data: profiles } = useBatchProfiles(adminIds)

    const recent = useMemo(() => recentPosts(updates), [updates])

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                    icon={Users}
                    label="Members"
                    value={formatCount(channel.subscriber_count || 0)}
                    tint="bg-tile-place/10 text-tile-place"
                />
                <StatCard
                    icon={FileText}
                    label="Posts this month"
                    value={formatCount(stats.thisMonth)}
                    tint="bg-tile-photo/10 text-tile-photo"
                    hint={`${formatCount(stats.total)} in total`}
                />
                <StatCard
                    icon={Heart}
                    label="Engagement"
                    value={stats.engagementRate === null ? '—' : `${stats.engagementRate.toFixed(1)}%`}
                    tint="bg-tile-poll/10 text-tile-poll"
                    hint={stats.engagementRate === null ? 'no views yet' : 'reactions and replies per view'}
                />
                <StatCard
                    icon={Eye}
                    label="Total views"
                    value={formatCount(stats.views)}
                    tint="bg-tile-tag/10 text-tile-tag"
                />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <Panel title="Posting activity" icon={BarChart3}>
                    {updates.length === 0 ? (
                        <p className="py-6 text-center text-[13px] text-brand-text/45">
                            Nothing published yet.
                        </p>
                    ) : (
                        <>
                            {/*
                              Posting activity, not member growth. The reference
                              charts members over six months; channel-service
                              keeps a current total and no history, so that line
                              cannot be drawn. This is the same shape from data
                              that exists, and it is labelled as what it is.
                            */}
                            <div className="flex h-32 items-stretch gap-2">
                                {activity.map((m) => (
                                    <div key={m.key} className="flex flex-1 flex-col items-center gap-2">
                                        <div className="flex w-full flex-1 items-end">
                                            <div
                                                className="w-full rounded-t-md bg-primary-grad transition-all"
                                                style={{ height: `${Math.max(4, (m.count / peak) * 100)}%` }}
                                                title={`${m.count} post${m.count === 1 ? '' : 's'}`}
                                            />
                                        </div>
                                        <span className="text-[10px] text-brand-text/45">{m.label}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-3 text-[11px] text-brand-text/40">
                                Posts published per month over the last six months.
                            </p>
                        </>
                    )}
                </Panel>

                <Panel title="About this channel" icon={Globe}>
                    <dl className="space-y-2.5 text-[13px]">
                        <Row icon={CalendarDays} label="Created" value={formatDate(channel.created_at)} />
                        <Row
                            icon={Shield}
                            label="Visibility"
                            value={<span className="capitalize">{channel.channel_type || 'private'}</span>}
                        />
                        {channel.language && (
                            <Row icon={Languages} label="Language" value={channel.language} />
                        )}
                        {channel.category && (
                            <Row icon={Tag} label="Category" value={<span className="capitalize">{channel.category}</span>} />
                        )}
                        {/* The handle, not a link. It used to point at
                            /channels/<id>, which no longer exists on the web —
                            and even when it did, this Overview is rendered
                            inside that very channel, so it was a link to the
                            page you were already on. */}
                        <Row
                            icon={Link2}
                            label="Link"
                            value={<span className="truncate">@{channel.handle}</span>}
                        />
                    </dl>
                </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <Panel
                    title="Recent posts"
                    icon={FileText}
                    action={
                        onViewPosts && updates.length > 0 ? (
                            <button
                                onClick={onViewPosts}
                                className="text-[12px] font-medium text-primary-ink hover:underline"
                            >
                                View all
                            </button>
                        ) : undefined
                    }
                >
                    {recent.length === 0 ? (
                        <p className="py-6 text-center text-[13px] text-brand-text/45">
                            No posts yet. Your first one will show here.
                        </p>
                    ) : (
                        <ul className="divide-y divide-brand-divider">
                            {recent.map((u) => (
                                <li key={u.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[13px] font-medium text-brand-text">
                                            {u.title || u.body || 'Untitled'}
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-brand-text/45">
                                            {formatDate(u.published_at || u.created_at)}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3 text-[11px] text-brand-text/45">
                                        <span className="flex items-center gap-1">
                                            <Eye className="h-3 w-3" /> {formatCount(u.view_count || 0)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Heart className="h-3 w-3" /> {formatCount(u.reaction_count || 0)}
                                        </span>
                                    </div>
                                    <span
                                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                            u.status === 'published'
                                                ? 'bg-success/10 text-success'
                                                : 'bg-warning/10 text-warning'
                                        }`}
                                    >
                                        {u.status === 'published' ? 'Published' : u.status || 'Draft'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>

                <Panel
                    title="Who runs this"
                    icon={Shield}
                    action={
                        onViewMembers ? (
                            <button
                                onClick={onViewMembers}
                                className="text-[12px] font-medium text-primary-ink hover:underline"
                            >
                                All members
                            </button>
                        ) : undefined
                    }
                >
                    {runners.length === 0 ? (
                        <p className="py-6 text-center text-[13px] text-brand-text/45">
                            Just you, for now.
                        </p>
                    ) : (
                        <ul className="space-y-2.5">
                            {runners.slice(0, 6).map((m) => {
                                const p = profiles?.get(m.user_id)
                                // A loaded profile with an empty name is a real
                                // case, so fall through on empty rather than on
                                // absent — ?? would print nothing.
                                const name = p?.display_name || p?.username || 'Member'
                                return (
                                    <li key={m.user_id} className="flex items-center gap-2.5">
                                        <Avatar
                                            src={p?.avatar_media_id ? `/v1/media/${p.avatar_media_id}/serve` : null}
                                            name={name}
                                            className="h-8 w-8"
                                        />
                                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-brand-text">
                                            {name}
                                        </span>
                                        <span className="shrink-0 rounded-full bg-primary-tint px-2 py-0.5 text-[10px] font-semibold capitalize text-primary-ink">
                                            {m.role}
                                        </span>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </Panel>
            </div>
        </div>
    )
}

function Row({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof Users
    label: string
    value: React.ReactNode
}) {
    return (
        <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 shrink-0 text-brand-text/35" strokeWidth={1.9} />
            <dt className="shrink-0 text-brand-text/50">{label}</dt>
            <dd className="ml-auto min-w-0 truncate text-right font-medium text-brand-text">{value}</dd>
        </div>
    )
}
