'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import GroupsWorkspace from '@/components/groups/GroupsWorkspace'
import GroupPostDialog from '@/components/groups/GroupPostDialog'
import {
  useMyGroups,
  useDiscoverGroups,
  useGroupSearch,
  useMySpacesFeed,
  useMyInvites,
  useAcceptInvite,
  useRejectInvite,
  useStashGroupPostV2,
  useUnstashGroupPostV2,
  useRecordGroupPostView,
  useDeleteGroupPostV2,
} from '@/hooks/useGroups'
import { useBatchProfiles } from '@/hooks/useProfile'
import { useAuthUser } from '@/store/auth'
import GroupDiscovery from '@/components/groups/GroupDiscovery'
import { Sparkles, HeartHandshake } from 'lucide-react'
import GroupCard from '@/components/groups/GroupCard'
import GroupPostCard from '@/components/groups/GroupPostCard'
import { publicPostAuthorIds } from '@/components/groups/anonymousIdentity'
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
        className={`${size} rounded-xl object-cover shrink-0 bg-brand-secondary`}
      />
    )
  }
  return (
    <div className={`${size} rounded-xl bg-brand-text/10 flex items-center justify-center shrink-0`}>
      <span className="text-sm font-black text-brand-text/50">{(name || '?').charAt(0).toUpperCase()}</span>
    </div>
  )
}

export default function GroupsPage() {
  const qc = useQueryClient()
  const authUser = useAuthUser()
  const [view, setView] = useState<View>('discover')
  useEffect(()=>{ if(new URLSearchParams(window.location.search).get('view')==='feed') setView('feed') },[])
  const [searchQuery, setSearchQuery] = useState('')
  const [composeGroup, setComposeGroup] = useState<Group | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const { data: myGroups, isLoading: loadingMy } = useMyGroups()
  const discovery = useDiscoverGroups()
  const { data: discoverGroups, isLoading: loadingDiscover } = discovery
  const search = useGroupSearch(searchQuery.trim())
  const { data: searchResults } = search
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
  const authorIds = useMemo(() => publicPostAuthorIds(feedPosts), [feedPosts])
  const { data: profileMap } = useBatchProfiles(authorIds)
  const enrichedPosts = useMemo(
    () =>
      feedPosts.map((post) => {
        if (post.is_anonymous) return post
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
    { key: 'your-groups', label: 'My Groups', icon: <Users className="w-[18px] h-[18px]" /> },
    { key: 'invites', label: 'Invites', icon: <Mail className="w-[18px] h-[18px]" />, badge: inviteCount },
  ]

  const switchView = (v: View) => {
    setView(v)
    setSearchQuery('')
  }

  const renderFeedPost = (post: GroupPostV2 & { author_name?: string; author_avatar_url?: string }) => {
    const group = groupsById.get(post.group_id)
    const role = group?.viewer_role
    const isAdmin = role === 'owner' || role === 'admin' || role === 'moderator'
    return (
      <div key={post.id} className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-card shadow-xs">
        {/* Group header — the outer card identifies the group, the
            user's post card sits inset below it. */}
        <Link
          href={`/groups/${post.group_id}`}
          className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-brand-text/5"
        >
          <GroupAvatar avatarMediaId={group?.avatar_media_id} name={group?.name ?? 'Group'} size="w-8 h-8" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-brand-text">{group?.name ?? 'View group'}</p>
            {group && (
              <p className="text-[11px] text-brand-text/40">
                {group.member_count} member{group.member_count === 1 ? '' : 's'}
              </p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-brand-text/30" />
        </Link>
        <div className="border-t border-brand-divider bg-brand-secondary/40 p-3">
        <GroupPostCard
          post={post}
          groupId={post.group_id}
          isAdmin={isAdmin}
          viewerRole={role}
          isAuthor={authUser?.id === post.author_id}
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
              <div className="h-3.5 w-28 bg-brand-secondary rounded-sm" />
              <div className="h-2.5 w-16 bg-brand-secondary rounded-sm" />
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
              <div className="w-12 h-12 rounded-xl bg-brand-text/5 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 bg-brand-text/5 rounded-sm" />
                <div className="h-3 w-24 bg-brand-text/5 rounded-sm" />
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
              className="flex items-center gap-1.5 rounded-xl bg-primary-ink px-4 py-2 text-[10px] font-black tracking-widest text-white transition-all hover:bg-primary-hover disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              Accept
            </button>
            <button
              onClick={() => rejectInvite.mutate(invite.id)}
              disabled={rejectInvite.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-brand-text/8 px-4 py-2 text-[10px] font-black tracking-widest text-brand-text/60 transition-all hover:bg-brand-text/12 disabled:opacity-50"
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
            className="w-full flex items-center gap-3 px-5 py-4 bg-brand-card border border-brand-divider rounded-xl text-sm text-brand-text/60 hover:border-brand-text/20 hover:shadow-xs transition-all group"
          >
            <div className="w-9 h-9 rounded-full bg-brand-text/8 flex items-center justify-center group-hover:bg-brand-text/12 transition-all">
              <Plus className="w-4 h-4 text-brand-text/60 group-hover:text-brand-text transition-colors" />
            </div>
            <span className="group-hover:text-brand-text transition-colors">Write something to your group...</span>
          </button>
        )}

        {!myGroups || myGroups.length === 0 ? (
          emptyState('Your feed is empty', 'Join groups to see their latest posts here')
        ) : enrichedPosts.length === 0 ? (
          emptyState('No recent activity', 'Posts from your groups will show up here')
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
        ? 'Discover groups'
        : view === 'invites'
          ? 'Invites'
          : 'My Groups'

  return (
    <GroupsWorkspace discovery onFeedClick={() => switchView('feed')}>
      <main className="groups-directory">
        <header className="groups-directory__hero">
          <div>
            <p className="groups-directory__eyebrow">PEOPLE · IDEAS · TOGETHER</p>
            <h1>{view==='feed'&&!searching?'Your group feed':view==='your-groups'&&!searching?'Your communities':view==='invites'&&!searching?'Your invitations':'Discover groups'}</h1>
            <p className="groups-directory__description">Find your community, share your passions, and connect with people on VChat.</p>
            <label className="groups-directory__search"><Search size={20}/><input aria-label="Search all groups" type="search" placeholder="Search groups by name, topic, or interest…" value={searchQuery} onChange={event=>setSearchQuery(event.target.value)}/></label>
          </div>
          <div className="groups-directory__art" aria-hidden="true"><Users size={36}/><strong>Better conversations.<br/>Brighter communities.</strong><span><Sparkles size={21}/></span><span><HeartHandshake size={22}/></span></div>
        </header>
        <nav className="groups-directory__tabs" aria-label="Groups views">{navItems.map(item=><button key={item.key} aria-pressed={view===item.key&&!searching} onClick={()=>switchView(item.key)}>{item.label}{!!item.badge&&` (${item.badge})`}</button>)}</nav>
        {searching||view==='discover'?<GroupDiscovery groups={(searching?searchResults:discoverGroups)??[]} myGroups={myGroups??[]} loading={searching?search.isLoading:loadingDiscover} error={searching?search.isError:discovery.isError} onRetry={()=>{if(searching) void search.refetch();else void discovery.refetch()}} searching={searching}/>
        :<div className={view==='feed'?'groups-directory__feed':''}>{view==='feed'?renderFeed():view==='invites'?renderInvites():renderGroupList(myGroups,true,loadingMy,'No groups yet','Join groups to connect with people who share your interests')}</div>}
      </main>

      {/* Group picker — choose where the post goes */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs"
            onClick={(e) => e.target === e.currentTarget && setPickerOpen(false)}
          >
            <div className="w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl border border-brand-divider bg-brand-card p-4 shadow-2xl">
              <h3 className="mb-3 text-sm font-black text-brand-text">Post to a group</h3>
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
        {composeGroup && (
            <GroupPostDialog
              onClose={() => {
                setComposeGroup(null)
                refreshFeed()
              }}
              groupId={composeGroup.id}
            />
        )}
    </GroupsWorkspace>
  )
}
