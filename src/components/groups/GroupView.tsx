'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useGroupByHandle, useGroupDetails } from '@/hooks/useGroups'
import type { GroupTab } from '@/types/groups'
import GroupCoverHeader from './GroupCoverHeader'
import GroupShareDialog from './GroupShareDialog'
import GroupInviteModal from './GroupInviteModal'
import RecentMediaCard from './RecentMediaCard'
import GroupFeedTab from './tabs/GroupFeedTab'
import GroupAboutTab from './tabs/GroupAboutTab'
import GroupMembersTab from './tabs/GroupMembersTab'
import GroupMediaTab from './tabs/GroupMediaTab'
import GroupEventsTab from './tabs/GroupEventsTab'
import CreatePortal from '@/components/CreatePortal'

/**
 * A group, as a page.
 *
 * `/groups/[groupId]` used to be a 22-line redirect into `/groups?space=…`,
 * which put a group inside the directory's middle column. A group is a place
 * of its own, so it gets a route of its own and the directory goes back to
 * being a directory.
 *
 * The tab lives in `?tab=`, not in nested routes. Five page files plus a
 * layout to hold the group query, for a tab set whose membership varies with
 * the viewer's role, replaces one search-param read with a directory of
 * files — and `?tab=` is shareable and bookmarkable for free.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const TABS: { id: GroupTab; label: string }[] = [
    { id: 'about', label: 'About' },
    { id: 'discussion', label: 'Discussion' },
    { id: 'members', label: 'Members' },
    { id: 'events', label: 'Events' },
    { id: 'media', label: 'Media' },
]

const TAB_IDS = TABS.map((t) => t.id)

function isTab(v: string | null): v is GroupTab {
    return !!v && (TAB_IDS as string[]).includes(v)
}

export default function GroupView({ groupIdOrHandle }: { groupIdOrHandle: string }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    // The route segment may be a uuid or a handle; deep links carry either.
    const isUUID = UUID_REGEX.test(groupIdOrHandle)
    const byId = useGroupDetails(isUUID ? groupIdOrHandle : undefined)
    const byHandle = useGroupByHandle(!isUUID ? groupIdOrHandle : undefined)
    const group = byId.data ?? byHandle.data
    const isLoading = isUUID ? byId.isLoading : byHandle.isLoading

    const urlTab = searchParams.get('tab')
    const [tab, setTabLocal] = useState<GroupTab>(isTab(urlTab) ? urlTab : 'discussion')
    const [collapsed, setCollapsed] = useState(false)
    const [showComposer, setShowComposer] = useState(false)
    const [showInvite, setShowInvite] = useState(false)
    const [showShare, setShowShare] = useState(false)

    // Follow the URL when it changes underneath us (back button, a pasted
    // link), without making every tab click a navigation.
    useEffect(() => {
        const next = isTab(urlTab) ? urlTab : 'discussion'
        setTabLocal((cur) => (cur === next ? cur : next))
    }, [urlTab])

    const setTab = useCallback((next: GroupTab) => {
        setTabLocal(next)
        const url = new URL(window.location.href)
        if (next === 'discussion') url.searchParams.delete('tab')
        else url.searchParams.set('tab', next)
        window.history.replaceState({}, '', url.toString())
    }, [])

    const viewerRole = group?.viewer_role ?? 'outsider'
    const isAdmin = viewerRole === 'owner' || viewerRole === 'admin'
    const isMember = isAdmin || viewerRole === 'moderator' || viewerRole === 'member'

    /*
      Mirror who_can_post so nobody is handed a composer whose Post button
      returns 403. The server decides; this only avoids offering.
    */
    const canPost = useMemo(() => {
        if (!isMember || !group) return false
        switch (group.who_can_post) {
            case 'admins_only':
                return isAdmin
            case 'admins_mods':
                return isAdmin || viewerRole === 'moderator'
            default:
                return true
        }
    }, [group, isMember, isAdmin, viewerRole])

    if (isLoading) {
        return (
            <div className="mx-auto max-w-5xl space-y-4 p-5">
                <div className="h-52 animate-pulse rounded-2xl bg-brand-secondary" />
                <div className="h-7 w-56 animate-pulse rounded-lg bg-brand-secondary" />
                <div className="h-4 w-40 animate-pulse rounded-sm bg-brand-secondary" />
            </div>
        )
    }

    if (!group) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 px-5 text-center">
                <p className="text-[15px] font-semibold text-brand-text">Group unavailable</p>
                <p className="max-w-sm text-[13px] text-brand-text/60">
                    It may have been removed, or you may not have access to it.
                </p>
                <button
                    onClick={() => router.push('/groups')}
                    className="mt-2 rounded-full bg-brand-secondary px-4 py-2 text-[13px] font-semibold text-brand-text"
                >
                    Back to groups
                </button>
            </div>
        )
    }

    return (
        <div className="relative min-h-screen bg-brand-secondary">
            <GroupCoverHeader
                group={group}
                collapsed={collapsed}
                onToggleCollapsed={setCollapsed}
                onInvite={() => setShowInvite(true)}
                onShare={() => setShowShare(true)}
            />

            {/* Underlined, not pilled: a row of tinted pills directly beneath
                a photograph competes with it for the eye. */}
            <div
                role="tablist"
                aria-label="Group sections"
                className="scrollbar-none sticky top-0 z-20 overflow-x-auto border-b border-brand-divider bg-brand-bg"
            >
                <div className="mx-auto flex max-w-5xl items-center gap-1 px-5">
                    {TABS.map((t) => {
                        const active = tab === t.id
                        return (
                            <button
                                key={t.id}
                                role="tab"
                                aria-selected={active}
                                onClick={() => setTab(t.id)}
                                className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-[14px] transition-colors ${
                                    active
                                        ? 'border-primary-ink font-semibold text-primary-ink'
                                        : 'border-transparent font-medium text-brand-text/50 hover:text-brand-text'
                                }`}
                            >
                                {t.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            <main className="mx-auto max-w-5xl px-5 py-5">
                {tab === 'discussion' ? (
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
                        <div className="min-w-0">
                            <GroupFeedTab
                                groupId={group.id}
                                isMember={isMember}
                                viewerRole={viewerRole}
                                hideComposer
                            />
                        </div>
                        <aside className="hidden lg:block">
                            <RecentMediaCard groupId={group.id} onSeeAll={() => setTab('media')} />
                        </aside>
                    </div>
                ) : tab === 'about' ? (
                    <div className="mx-auto max-w-2xl">
                        <GroupAboutTab group={group} />
                    </div>
                ) : tab === 'members' ? (
                    <div className="mx-auto max-w-3xl">
                        <GroupMembersTab groupId={group.id} currentUserRole={viewerRole} />
                    </div>
                ) : tab === 'events' ? (
                    <div className="mx-auto max-w-3xl">
                        <GroupEventsTab groupId={group.id} viewerRole={viewerRole} />
                    </div>
                ) : (
                    <div className="mx-auto max-w-3xl">
                        <GroupMediaTab groupId={group.id} />
                    </div>
                )}
            </main>

            {/*
              A button, not a bar. One action — write a post — does not need a
              full-width text field under every post pretending to be one.
              Only on Discussion, and only for someone the group lets post;
              the Events tab has its own create button, and one floating
              action per screen is the rule.
            */}
            {canPost && tab === 'discussion' && (
                <button
                    type="button"
                    onClick={() => setShowComposer(true)}
                    aria-label="Write a post"
                    title="Write a post"
                    className="bg-primary-grad fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-all hover:shadow-xl active:scale-95"
                >
                    <Plus className="h-6 w-6" strokeWidth={2.4} />
                </button>
            )}

            {showComposer && (
                <CreatePortal groupId={group.id} onClose={() => setShowComposer(false)} />
            )}
            {showInvite && (
                <GroupInviteModal groupId={group.id} onClose={() => setShowInvite(false)} />
            )}
            {showShare && <GroupShareDialog group={group} onClose={() => setShowShare(false)} />}
        </div>
    )
}
