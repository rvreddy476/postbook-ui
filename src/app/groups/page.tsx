'use client'

import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import AppShell from '@/components/AppShell'
import CreatePortal from '@/components/CreatePortal'
import {
  useMyGroups,
  useDiscoverGroups,
  useGroupSearch,
  useMySpacesFeed,
  useMyInvites,
  useAcceptInvite,
  useRejectInvite,
  useSparkGroupPostV2,
  useUnsparkGroupPostV2,
  useStashGroupPostV2,
  useUnstashGroupPostV2,
  useRecordGroupPostView,
  useDeleteGroupPostV2,
} from '@/hooks/useGroups'
import { useBatchProfiles } from '@/hooks/useProfile'
import { useAuthUser } from '@/store/auth'
import GroupCard from '@/components/groups/GroupCard'
import GroupPostCard from '@/components/groups/GroupPostCard'
import SpaceView from '@/components/groups/SpaceView'
import type { Group, GroupPostV2 } from '@/types/groups'
import { Search, Plus, Users, Compass, Newspaper, MessageCircle, Mail, Check, X, Megaphone, ChevronRight } from 'lucide-react'
import Link from 'next/link'

type View = 'feed' | 'discover' | 'your-groups' | 'invites'

function lastActive(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Active just now'
  if (mins < 60) return `Last active ${mins} minute${mins === 1 ? '' : 's'} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Last active ${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `Last active ${days} day${days === 1 ? '' : 's'} ago`
  return `Last active ${new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function GroupAvatar({ avatarMediaId, name, size = 'w-10 h-10' }: { avatarMediaId?: string; name: string; size?: string }) {
  if (avatarMediaId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/v1/media/${avatarMediaId}/serve`}
        alt={name}
        className={`${size} rounded-xl object-cover flex-shrink-0 bg-brand-secondary`}
      />
    )
  }
  return (
    <div className={`${size} rounded-xl bg-brand-text/10 flex items-center justify-center flex-shrink-0`}>
      <span className="text-sm font-black text-brand-text/50">{(name || '?').charAt(0).toUpperCase()}</span>
    </div>
  )
}

// useSearchParams needs a Suspense boundary for static prerendering.
export default function GroupsPage() {
  return (
    <Suspense>
      <GroupsPageInner />
    </Suspense>
  )
}

function GroupsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const authUser = useAuthUser()
  const [view, setView] = useState<View>('feed')
  const [searchQuery, setSearchQuery] = useState('')
  const [composeGroup, setComposeGroup] = useState<Group | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  // A space picked from the rail opens in the middle column while the
  // rail stays put; cleared whenever the user switches views.
  // ?space=<id> (e.g. right after creating a space) preselects it.
  const spaceParam = searchParams.get('space')
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(spaceParam)
  useEffect(() => {
    if (spaceParam) setSelectedSpaceId(spaceParam)
  }, [spaceParam])

  const { data: myGroups, isLoading: loadingMy } = useMyGroups()
  const { data: discoverGroups, isLoading: loadingDiscover } = useDiscoverGroups()
  const { data: searchResults } = useGroupSearch(searchQuery)
  const { data: invites } = useMyInvites()
  const {
    data: feedData,
    isLoading: feedLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useMySpacesFeed()

  const acceptInvite = useAcceptInvite()
  const rejectInvite = useRejectInvite()

  // Engagement mutations — same set GroupFeedTab uses, parameterized per group.
  const sparkMut = useSparkGroupPostV2()
  const unsparkMut = useUnsparkGroupPostV2()
  const stashMut = useStashGroupPostV2()
  const unstashMut = useUnstashGroupPostV2()
  const viewMut = useRecordGroupPostView()
  const deleteMut = useDeleteGroupPostV2()
  const refreshFeed = () => qc.invalidateQueries({ queryKey: ['myspace-feed'] })

  const groupsById = useMemo(() => {
    const map = new Map<string, Group>()
    for (const g of myGroups ?? []) map.set(g.id, g)
    return map
  }, [myGroups])

  const feedPosts = useMemo(
    () => feedData?.pages.flatMap((page) => page.data) ?? [],
    [feedData],
  )

  // Enrich feed posts with author name/avatar
  const authorIds = useMemo(() => [...new Set(feedPosts.map((p) => p.author_id))], [feedPosts])
  const { data: profileMap } = useBatchProfiles(authorIds)
  const enrichedPosts = useMemo(
    () =>
      feedPosts.map((post) => {
        const profile = profileMap?.get(post.author_id)
        if (!profile) return post
        return {
          ...post,
          author_name: profile.display_name || profile.username || post.author_name,
          author_avatar_url: profile.avatar_media_id
            ? `/v1/media/${profile.avatar_media_id}/serve`
            : post.author_avatar_url,
        }
      }),
    [feedPosts, profileMap],
  )

  const searching = searchQuery.trim().length >= 2
  const inviteCount = invites?.length ?? 0

  const navItems: { key: View; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'feed', label: 'My Feed', icon: <Newspaper className="w-[18px] h-[18px]" /> },
    { key: 'discover', label: 'Discover', icon: <Compass className="w-[18px] h-[18px]" /> },
    { key: 'your-groups', label: 'My Spaces', icon: <Users className="w-[18px] h-[18px]" /> },
    { key: 'invites', label: 'Invites', icon: <Mail className="w-[18px] h-[18px]" />, badge: inviteCount },
  ]

  const switchView = (v: View) => {
    setView(v)
    setSearchQuery('')
    setSelectedSpaceId(null)
    // Drop a lingering ?space= param so a refresh stays on this view.
    if (spaceParam) router.replace('/groups', { scroll: false })
  }

  const renderFeedPost = (post: GroupPostV2 & { author_name?: string; author_avatar_url?: string }) => {
    const group = groupsById.get(post.group_id)
    const role = group?.viewer_role
    const isAdmin = role === 'owner' || role === 'admin' || role === 'moderator'
    return (
      <div key={post.id} className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-card shadow-sm">
        {/* Space header — the outer card identifies the space, the
            user's post card sits inset below it. */}
        <button
          onClick={() => setSelectedSpaceId(post.group_id)}
          className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-brand-text/5"
        >
          <GroupAvatar avatarMediaId={group?.avatar_media_id} name={group?.name ?? 'Space'} size="w-8 h-8" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-brand-text">{group?.name ?? 'View space'}</p>
            {group && (
              <p className="text-[11px] text-brand-text/40">
                {group.member_count} member{group.member_count === 1 ? '' : 's'}
              </p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-brand-text/30" />
        </button>
        <div className="border-t border-brand-divider bg-brand-secondary/40 p-3">
        <GroupPostCard
          post={post}
          groupId={post.group_id}
          isAdmin={isAdmin}
          isAuthor={authUser?.id === post.author_id}
          onSpark={(gId, postId) => sparkMut.mutate({ groupId: gId, postId }, { onSuccess: refreshFeed })}
          onUnspark={(gId, postId) => unsparkMut.mutate({ groupId: gId, postId }, { onSuccess: refreshFeed })}
          onStash={(gId, postId) => stashMut.mutate({ groupId: gId, postId }, { onSuccess: refreshFeed })}
          onUnstash={(gId, postId) => unstashMut.mutate({ groupId: gId, postId }, { onSuccess: refreshFeed })}
          onView={(gId, postId) => viewMut.mutate({ groupId: gId, postId })}
          onDelete={(postId) => {
            if (confirm('Delete this post?')) {
              deleteMut.mutate({ groupId: post.group_id, postId }, { onSuccess: refreshFeed })
            }
          }}
        />
        </div>
      </div>
    )
  }

  const feedSkeleton = (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-brand-card rounded-xl border border-brand-divider p-4 space-y-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-secondary" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-28 bg-brand-secondary rounded" />
              <div className="h-2.5 w-16 bg-brand-secondary rounded" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-2.5 w-full bg-brand-secondary rounded-full" />
            <div className="h-2.5 w-2/3 bg-brand-secondary rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )

  const emptyState = (title: string, desc: string) => (
    <div className="text-center py-20">
      <div className="w-16 h-16 rounded-2xl bg-brand-text/5 mx-auto mb-4 flex items-center justify-center">
        <MessageCircle className="w-8 h-8 text-brand-text/20" />
      </div>
      <h3 className="text-base font-semibold text-brand-text/60">{title}</h3>
      <p className="text-sm text-brand-text/40 mt-1">{desc}</p>
    </div>
  )

  const renderGroupList = (groups: typeof myGroups, isMine: boolean, loading: boolean, emptyTitle: string, emptyDesc: string) => {
    if (loading) {
      return (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3.5 p-3 bg-brand-card border border-brand-divider rounded-xl animate-pulse">
              <div className="w-12 h-12 rounded-xl bg-brand-text/5 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 bg-brand-text/5 rounded" />
                <div className="h-3 w-24 bg-brand-text/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      )
    }
    if (!groups || groups.length === 0) return emptyState(emptyTitle, emptyDesc)
    return (
      <div className="space-y-2">
        {groups.map((group) => (
          <GroupCard key={group.id} group={group} isMyGroup={isMine} />
        ))}
      </div>
    )
  }

  const renderInvites = () => {
    if (!invites || invites.length === 0) {
      return emptyState('No invites', 'You have no pending group invitations')
    }
    return (
      <div className="space-y-2">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex items-center gap-3.5 rounded-xl border border-brand-divider bg-brand-card p-4"
          >
            <GroupAvatar avatarMediaId={invite.group_avatar_media_id} name={invite.group_name} size="w-12 h-12" />
            <div className="min-w-0 flex-1">
              <Link href={`/groups/${invite.group_id}`} className="block truncate text-sm font-bold text-brand-text hover:underline">
                {invite.group_name}
              </Link>
              <p className="text-xs text-brand-text/40">
                {invite.group_member_count} member{invite.group_member_count === 1 ? '' : 's'} · invited{' '}
                {new Date(invite.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
            <button
              onClick={() => acceptInvite.mutate(invite.id)}
              disabled={acceptInvite.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-brand-text px-4 py-2 text-[10px] font-black uppercase tracking-widest text-brand-bg transition-all hover:opacity-90 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              Accept
            </button>
            <button
              onClick={() => rejectInvite.mutate(invite.id)}
              disabled={rejectInvite.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-brand-text/8 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-brand-text/60 transition-all hover:bg-brand-text/12 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Decline
            </button>
          </div>
        ))}
      </div>
    )
  }

  const renderFeed = () => {
    if (feedLoading || loadingMy) return feedSkeleton
    return (
      <div className="space-y-5">
        {/* Composer — pick one of your groups, then the standard portal */}
        {myGroups && myGroups.length > 0 && (
          <button
            onClick={() => setPickerOpen(true)}
            className="w-full flex items-center gap-3 px-5 py-4 bg-brand-card border border-brand-divider rounded-xl text-sm text-brand-text/60 hover:border-brand-text/20 hover:shadow-sm transition-all group"
          >
            <div className="w-9 h-9 rounded-full bg-brand-text/8 flex items-center justify-center group-hover:bg-brand-text/12 transition-all">
              <Plus className="w-4 h-4 text-brand-text/60 group-hover:text-brand-text transition-colors" />
            </div>
            <span className="group-hover:text-brand-text transition-colors">Write something to your space...</span>
          </button>
        )}

        {!myGroups || myGroups.length === 0 ? (
          emptyState('Your feed is empty', 'Join spaces to see their latest posts here')
        ) : enrichedPosts.length === 0 ? (
          emptyState('No recent activity', 'Posts from your spaces will show up here')
        ) : (
          <>
            {enrichedPosts.map(renderFeedPost)}
            {hasNextPage && (
              <div className="flex justify-center pt-2 pb-4">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="px-6 py-2.5 bg-brand-card rounded-xl font-bold text-xs text-brand-highlight hover:text-brand-text hover:shadow-md transition-all border border-brand-divider disabled:opacity-50"
                >
                  {isFetchingNextPage ? 'Loading...' : 'Load more posts'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  const middleTitle = searching
    ? `Results for "${searchQuery.trim()}"`
    : view === 'feed'
      ? 'Recent activity'
      : view === 'discover'
        ? 'Discover spaces'
        : view === 'invites'
          ? 'Invites'
          : 'My Spaces'

  return (
    <AppShell hideSidebar>
      <div className="flex w-full items-start">
        {/* ── Left rail: search + views + joined spaces — flush left ── */}
        <aside className="sticky top-0 hidden h-[calc(100vh-5rem)] w-[320px] flex-shrink-0 flex-col overflow-y-auto scrollbar-hide border-r border-brand-divider bg-brand-card p-4 md:flex xl:w-[348px]">
          <div className="mb-4 flex items-center justify-between">
            <h1
              className="text-[24px] font-[800] tracking-tight text-brand-text"
              style={{ fontFamily: 'var(--font-outfit, Outfit, sans-serif)' }}
            >
              MySpace
            </h1>
            <Link
              href="/groups/create"
              aria-label="Create new space"
              className="rounded-xl bg-brand-text/8 p-2 text-brand-text/60 transition-colors hover:bg-brand-text/12 hover:text-brand-text"
            >
              <Plus className="h-4 w-4" />
            </Link>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text/30" />
            <input
              type="text"
              placeholder="Search spaces"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-brand-divider bg-brand-secondary py-2.5 pl-10 pr-4 text-sm text-brand-text placeholder:text-brand-text/30 transition-all focus:border-brand-text/20 focus:outline-none focus:ring-2 focus:ring-brand-text/10"
            />
          </div>

          {/* View switcher */}
          <nav className="mb-3 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => switchView(item.key)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                  view === item.key && !searching && !selectedSpaceId
                    ? 'bg-brand-text/8 text-brand-text'
                    : 'text-brand-text/60 hover:bg-brand-text/5 hover:text-brand-text'
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    view === item.key && !searching && !selectedSpaceId ? 'bg-brand-text text-brand-bg' : 'bg-brand-text/8 text-brand-text/60'
                  }`}
                >
                  {item.icon}
                </span>
                {item.label}
                {!!item.badge && (
                  <span className="ml-auto rounded-full bg-brand-highlight/15 px-2 py-0.5 text-[11px] font-black text-brand-highlight">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Create new space */}
          <Link
            href="/groups/create"
            className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-brand-text px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-brand-bg transition-all hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Create new space
          </Link>

          {/* Joined spaces */}
          <div className="border-t border-brand-divider pt-4">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-[13px] font-bold text-brand-text/70">Spaces you&apos;ve joined</p>
              <button
                onClick={() => switchView('your-groups')}
                className="text-xs font-bold text-brand-highlight transition-colors hover:text-brand-text"
              >
                See all
              </button>
            </div>
            {loadingMy ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl p-2 animate-pulse">
                    <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-brand-text/5" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-28 rounded bg-brand-text/5" />
                      <div className="h-2.5 w-20 rounded bg-brand-text/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : myGroups && myGroups.length > 0 ? (
              <div className="space-y-0.5">
                {myGroups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => {
                      setSelectedSpaceId(group.id)
                      setSearchQuery('')
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors ${
                      selectedSpaceId === group.id
                        ? 'bg-emerald-500/10 ring-1 ring-emerald-500/40'
                        : 'hover:bg-brand-text/5'
                    }`}
                  >
                    <GroupAvatar avatarMediaId={group.avatar_media_id} name={group.name} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[13px] font-bold ${selectedSpaceId === group.id ? 'text-brand-text' : 'text-brand-text'}`}>{group.name}</p>
                      <p className="truncate text-[11px] text-brand-text/40">{lastActive(group.updated_at)}</p>
                    </div>
                    {selectedSpaceId === group.id && (
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-1 py-3 text-xs text-brand-text/40">
                You haven&apos;t joined any spaces yet.
              </p>
            )}
          </div>
        </aside>

        {/* ── Middle: selected space / feed / discover / my spaces / invites ── */}
        <main className="min-w-0 flex-1 px-4 pt-5 pb-16 lg:px-6">
          {selectedSpaceId ? (
            <div className="mx-auto max-w-[960px]">
              <SpaceView key={selectedSpaceId} groupId={selectedSpaceId} />
            </div>
          ) : (
          <div className="mx-auto max-w-[680px]">
            <h2 className="mb-4 px-1 text-[17px] font-[800] tracking-tight text-brand-text">{middleTitle}</h2>

            {/* Mobile-only view switcher (left rail hidden below md) */}
            <div className="mb-4 flex items-center gap-2 overflow-x-auto scrollbar-hide md:hidden">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => switchView(item.key)}
                  className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                    view === item.key && !searching && !selectedSpaceId
                      ? 'bg-brand-text text-brand-bg'
                      : 'bg-brand-text/8 text-brand-text/60'
                  }`}
                >
                  {item.label}
                  {!!item.badge && ` (${item.badge})`}
                </button>
              ))}
            </div>

            {searching ? (
              renderGroupList(searchResults, false, false, 'No spaces found', 'Try a different search term')
            ) : view === 'feed' ? (
              renderFeed()
            ) : view === 'discover' ? (
              renderGroupList(
                discoverGroups,
                false,
                loadingDiscover,
                'Nothing to discover',
                'No spaces to discover right now. Check back later!',
              )
            ) : view === 'invites' ? (
              renderInvites()
            ) : (
              renderGroupList(
                myGroups,
                true,
                loadingMy,
                'No spaces yet',
                'Join spaces to connect with people who share your interests',
              )
            )}
          </div>
          )}
        </main>

        {/* ── Right rail: ads / sponsored — hidden while a space is open
               so the space content uses the full width ──────────────── */}
        <aside className={`sticky top-0 h-[calc(100vh-5rem)] w-[320px] flex-shrink-0 flex-col gap-3 overflow-y-auto scrollbar-hide p-4 pr-5 ${selectedSpaceId ? 'hidden' : 'hidden lg:flex'}`}>
          <p className="px-1 text-[11px] font-black uppercase tracking-widest text-brand-text/40">Sponsored</p>
          <div className="rounded-2xl border border-brand-divider bg-brand-card p-4">
            <div className="mb-3 flex h-32 items-center justify-center rounded-xl bg-brand-text/5">
              <Megaphone className="h-8 w-8 text-brand-text/20" />
            </div>
            <p className="text-sm font-bold text-brand-text">Your ad could be here</p>
            <p className="mt-1 text-xs text-brand-text/50">
              Reach people in the spaces they care about. Ad placements are coming soon.
            </p>
          </div>
          <div className="rounded-2xl border border-brand-divider bg-brand-card p-4">
            <p className="text-sm font-bold text-brand-text">Grow your community</p>
            <p className="mt-1 text-xs text-brand-text/50">
              Create a space for your brand, club, or circle and bring your people together.
            </p>
            <Link
              href="/groups/create"
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-text/8 px-3.5 py-2 text-[10px] font-black uppercase tracking-widest text-brand-text/70 transition-colors hover:bg-brand-text/12 hover:text-brand-text"
            >
              <Plus className="h-3.5 w-3.5" />
              Create a space
            </Link>
          </div>
        </aside>
      </div>

      {/* Group picker — choose where the post goes */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setPickerOpen(false)}
          >
            <div className="w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl border border-brand-divider bg-brand-card p-4 shadow-2xl">
              <h3 className="mb-3 text-sm font-black text-brand-text">Post to a space</h3>
              <div className="max-h-[320px] space-y-0.5 overflow-y-auto">
                {(myGroups ?? []).map((group) => (
                  <button
                    key={group.id}
                    onClick={() => {
                      setComposeGroup(group)
                      setPickerOpen(false)
                    }}
                    className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-brand-text/5"
                  >
                    <GroupAvatar avatarMediaId={group.avatar_media_id} name={group.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-brand-text">{group.name}</p>
                      <p className="truncate text-[11px] text-brand-text/40">
                        {group.member_count} member{group.member_count === 1 ? '' : 's'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer portal for the chosen group */}
      <AnimatePresence>
        {composeGroup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setComposeGroup(null)}
          >
            <CreatePortal
              onClose={() => {
                setComposeGroup(null)
                refreshFeed()
              }}
              groupId={composeGroup.id}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  )
}
