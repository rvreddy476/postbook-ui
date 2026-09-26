'use client'

import React, { useState } from 'react'
import {
    Check,
    ChevronDown,
    ChevronUp,
    Clock,
    Globe,
    Lock,
    Share2,
    Shield,
    UserPlus,
    Users,
} from 'lucide-react'
import type { Group } from '@/types/groups'
import { useJoinGroup } from '@/hooks/useGroups'
import GroupJoinedMenu from './GroupJoinedMenu'

/**
 * A group's masthead: its cover, and the three facts that identify it.
 *
 * Deliberately only three — **name, member count, group type**. The reference
 * also showed a row of member avatars, a handle and the description; all are
 * out. A group's description belongs on the About tab where it is the thing
 * being read, not as a caption repeating the name, and a handle is a URL
 * detail rather than an identity.
 *
 * The shape is copied from the channel panel's masthead rather than shared
 * with it. They look alike and are not alike: a channel branches on
 * publish/subscribe, a group on seven roles with five different action
 * clusters; the fields differ (cover_media_id vs banner_media_id,
 * member_count vs subscriber_count); and the channel one lives in a flex
 * column inside the messenger while this is a full page with a right rail.
 * Unifying them takes ten props and three render props to save 120 lines.
 */

interface GroupCoverHeaderProps {
    group: Group
    /** Collapse the cover and give the whole column to the content. */
    collapsed: boolean
    onToggleCollapsed: (next: boolean) => void
    onInvite: () => void
    onShare: () => void
}

export default function GroupCoverHeader({
    group,
    collapsed,
    onToggleCollapsed,
    onInvite,
    onShare,
}: GroupCoverHeaderProps) {
    const joinGroup = useJoinGroup()
    const [joinError, setJoinError] = useState<string | null>(null)

    const viewerRole = group.viewer_role ?? 'outsider'
    const isAdmin = viewerRole === 'owner' || viewerRole === 'admin'
    const isMember = isAdmin || viewerRole === 'moderator' || viewerRole === 'member'

    const privacy = group.privacy_level ?? group.visibility ?? 'public'
    const PrivacyIcon = privacy === 'public' ? Globe : privacy === 'restricted' ? Shield : Lock
    const coverSrc = group.cover_media_id ? `/v1/media/${group.cover_media_id}/serve` : null
    const avatarSrc = group.avatar_media_id ? `/v1/media/${group.avatar_media_id}/serve` : null

    /*
      Mirror the server's who_can_invite rule rather than always offering the
      button. A member of an admins-only group would otherwise be shown a
      modal whose every Invite click returns 403.
    */
    const canInvite =
        isMember &&
        (group.who_can_invite === 'all_members' ||
            group.who_can_invite === undefined ||
            (group.who_can_invite === 'admins_mods' && (isAdmin || viewerRole === 'moderator')) ||
            (group.who_can_invite === 'admins_only' && isAdmin))

    const join = () => {
        setJoinError(null)
        joinGroup.mutate(group.id, {
            onError: (err: unknown) => {
                const body = (err as { response?: { data?: { error?: { message?: string } } } })
                    ?.response?.data?.error
                setJoinError(body?.message || 'Could not join. Please try again.')
            },
        })
    }

    if (collapsed) {
        return (
            <header className="shrink-0 border-b border-brand-divider bg-brand-bg">
                <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-5 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-secondary text-brand-text/60">
                        {avatarSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                        ) : (
                            <Users className="h-4 w-4" strokeWidth={1.9} />
                        )}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-brand-text">
                        {group.name}
                    </p>
                    <button
                        onClick={() => onToggleCollapsed(false)}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-brand-text/55 transition-colors hover:bg-brand-secondary hover:text-brand-text"
                    >
                        <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.4} />
                        Show cover
                    </button>
                </div>
            </header>
        )
    }

    return (
        <header className="shrink-0 bg-brand-bg">
            <div className="relative">
                <div className="relative h-40 w-full overflow-hidden sm:h-52">
                    {coverSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverSrc} alt="" className="h-full w-full object-cover" />
                    ) : (
                        /*
                          The product's gradient, never a grey void and never
                          one of the old per-letter pastel gradients — those
                          were six hardcoded light-mode Tailwind values that
                          compiled fine and were unreadable in dark.
                        */
                        <div className="bg-primary-grad h-full w-full" />
                    )}
                    {/* Heavier on the left, where the text sits, so white type
                        holds over any photograph rather than a lucky one. */}
                    <div className="absolute inset-0 bg-linear-to-r from-black/65 via-black/35 to-black/10" />
                </div>

                <button
                    onClick={() => onToggleCollapsed(true)}
                    aria-label="Hide cover"
                    className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur-xs transition-colors hover:bg-black/55"
                >
                    <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.4} />
                    Hide cover
                </button>

                <div className="absolute inset-x-0 bottom-0">
                    <div className="mx-auto flex max-w-5xl items-end gap-4 px-5 pb-4 sm:px-6">
                        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-brand-card bg-brand-secondary text-brand-text/60 shadow-lg sm:h-24 sm:w-24">
                            {avatarSrc ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                            ) : (
                                <Users className="h-8 w-8" strokeWidth={1.75} />
                            )}
                        </span>

                        <div className="min-w-0 flex-1 pb-1">
                            <h1 className="truncate text-[22px] font-bold -tracking-[0.02em] text-white drop-shadow-sm sm:text-[26px]">
                                {group.name}
                            </h1>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold capitalize text-white backdrop-blur-xs">
                                    <PrivacyIcon className="h-3 w-3" strokeWidth={2.2} />
                                    {privacy} group
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-xs">
                                    <Users className="h-3 w-3" strokeWidth={2.2} />
                                    {formatCount(group.member_count)}{' '}
                                    {group.member_count === 1 ? 'member' : 'members'}
                                </span>
                                {/* A content warning, not decoration. */}
                                {group.is_mature && (
                                    <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-xs">
                                        18+
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="group-cover__actions-wide hidden shrink-0 items-center gap-2 pb-1 sm:flex">
                            <GroupActions
                                group={group}
                                isMember={isMember}
                                canInvite={canInvite}
                                joining={joinGroup.isPending}
                                privacy={privacy}
                                onInvite={onInvite}
                                onShare={onShare}
                                onJoin={join}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Below sm the actions cannot sit over the cover without wrapping
                into the badges, so they move under it. */}
            <div className="group-cover__actions-narrow mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-5 pt-3 sm:hidden">
                <GroupActions
                    group={group}
                    isMember={isMember}
                    canInvite={canInvite}
                    joining={joinGroup.isPending}
                    privacy={privacy}
                    onInvite={onInvite}
                    onShare={onShare}
                    onJoin={join}
                />
            </div>

            {joinError && (
                <p role="alert" className="mx-auto max-w-5xl px-5 pt-2 text-[12px] font-medium text-danger">
                    {joinError}
                </p>
            )}
        </header>
    )
}

function GroupActions({
    group,
    isMember,
    canInvite,
    joining,
    privacy,
    onInvite,
    onShare,
    onJoin,
}: {
    group: Group
    isMember: boolean
    canInvite: boolean
    joining: boolean
    privacy: string
    onInvite: () => void
    onShare: () => void
    onJoin: () => void
}) {
    if (isMember) {
        return (
            <>
                {canInvite && (
                    <button
                        onClick={onInvite}
                        className="bg-primary-grad flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-white shadow-md transition-all hover:shadow-lg active:scale-[0.98]"
                    >
                        <UserPlus className="h-3.5 w-3.5" strokeWidth={2} />
                        Add members
                    </button>
                )}
                <button
                    onClick={onShare}
                    className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur-xs transition-colors hover:bg-white/25 sm:bg-white/15"
                >
                    <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
                    Share
                </button>
                <GroupJoinedMenu group={group} />
            </>
        )
    }

    // The viewer's way in depends on how the group is joined. A group that
    // takes requests says so; an invite-only one says that rather than
    // offering a button that always fails.
    if (group.join_mode === 'request') {
        return (
            <button
                onClick={onJoin}
                disabled={joining}
                className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur-xs transition-colors hover:bg-white/25 disabled:opacity-50"
            >
                <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                {joining ? 'Requesting…' : 'Request to join'}
            </button>
        )
    }
    if (group.join_mode === 'invite_only' || privacy === 'private') {
        return (
            <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-[13px] font-semibold text-white/70 backdrop-blur-xs">
                <Lock className="h-3.5 w-3.5" strokeWidth={2} />
                Invite only
            </span>
        )
    }
    if (group.viewer_role === 'pending') {
        return (
            <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-[13px] font-semibold text-white/70 backdrop-blur-xs">
                <Check className="h-3.5 w-3.5" strokeWidth={2} />
                Requested
            </span>
        )
    }
    return (
        <button
            onClick={onJoin}
            disabled={joining}
            className="bg-primary-grad flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50"
        >
            <Users className="h-3.5 w-3.5" strokeWidth={2} />
            {joining ? 'Joining…' : 'Join group'}
        </button>
    )
}

function formatCount(n: number): string {
    if (!Number.isFinite(n)) return '0'
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(Math.trunc(n))
}
