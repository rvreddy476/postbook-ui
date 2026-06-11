'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import RightPanel from '@/components/RightPanel'
import {
  useMyGroups,
  useDiscoverGroups,
  useGroupSearch,
  useMySpacesFeed,
  useSparkGroupPostV2,
  useUnsparkGroupPostV2,
  useStashGroupPostV2,
  useUnstashGroupPostV2,
  useRecordGroupPostView,
  useDeleteGroupPostV2,
  type MySpaceFeedPost,
} from '@/hooks/useGroups'
import { useBatchProfiles } from '@/hooks/useProfile'
import { useAuthUser } from '@/store/auth'
import GroupCard from '@/components/groups/GroupCard'
import GroupPostCard from '@/components/groups/GroupPostCard'
import { Search, Plus, Users, Compass, Newspaper, MessageCircle } from 'lucide-react'
import Link from 'next/link'

type View = 'feed' | 'discover' | 'your-groups'

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

export default function GroupsPage() {
  const router = useRouter()
  const authUser = useAuthUser()
  const [view, setView] = useState<View>('feed')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: myGroups, isLoading: loadingMy } = useMyGroups()
  const { data: discoverGroups, isLoading: loadingDiscover } = useDiscoverGroups()
  const { data: searchResults } = useGroupSearch(searchQuery)
  const { posts: feedPosts, isLoading: feedLoading } = useMySpacesFeed(myGroups)

  // Engagement mutations — same set GroupFeedTab uses, parameterized per group.
  const sparkMut = useSparkGroupPostV2()
  const unsparkMut = useUnsparkGroupPostV2()
  const stashMut = useStashGroupPostV2()
  const unstashMut = useUnstashGroupPostV2()
  const viewMut = useRecordGroupPostView()
  const deleteMut = useDeleteGroupPostV2()

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

  const navItems: { key: View; label: string; icon: React.ReactNode }[] = [
    { key: 'feed', label: 'Your feed', icon: <Newspaper className="w-[18px] h-[18px]" /> },
    { key: 'discover', label: 'Discover', icon: <Compass className="w-[18px] h-[18px]" /> },
    { key: 'your-groups', label: 'Your groups', icon: <Users className="w-[18px] h-[18px]" /> },
  ]

  const renderFeedPost = (post: MySpaceFeedPost) => {
    const role = post.group.viewer_role
    const isAdmin = role === 'owner' || role === 'admin' || role === 'moderator'
    return (
      <div key={`${post.group.id}-${post.id}`}>
        {/* Group attribution strip — which space this post came from */}
        <Link
          href={`/groups/${post.group.id}`}
          className="flex items-center gap-2 px-1 pb-1.5 group/attr w-fit"
        >
          <GroupAvatar avatarMediaId={post.group.avatar_media_id} name={post.group.name} size="w-5 h-5" />
          <span className="text-xs font-bold text-brand-text/60 group-hover/attr:text-brand-text transition-colors">
            {post.group.name}
          </span>
        </Link>
        <GroupPostCard
          post={post}
          groupId={post.group.id}
          isAdmin={isAdmin}
          isAuthor={authUser?.id === post.author_id}
          onSpark={(gId, postId) => sparkMut.mutate({ groupId: gId, postId })}
          onUnspark={(gId, postId) => unsparkMut.mutate({ groupId: gId, postId })}
          onStash={(gId, postId) => stashMut.mutate({ groupId: gId, postId })}
          onUnstash={(gId, postId) => unstashMut.mutate({ groupId: gId, postId })}
          onView={(gId, postId) => viewMut.mutate({ groupId: gId, postId })}
          onDelete={(postId) => {
            if (confirm('Delete this post?')) deleteMut.mutate({ groupId: post.group.id, postId })
          }}
        />
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

  const middleTitle = searching
    ? `Results for "${searchQuery.trim()}"`
    : view === 'feed'
      ? 'Recent activity'
      : view === 'discover'
        ? 'Discover groups'
        : 'Your groups'

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-[1380px] items-start gap-5 px-3 pt-5 pb-16 lg:px-5">
        {/* ── Left rail: search + views + joined groups ──────────────── */}
        <aside className="sticky top-0 hidden max-h-[calc(100vh-6rem)] w-[300px] flex-shrink-0 flex-col overflow-y-auto scrollbar-hide rounded-2xl border border-brand-divider bg-brand-card p-4 md:flex xl:w-[330px]">
          <div className="mb-4 flex items-center justify-between">
            <h1
              className="text-[24px] font-[800] tracking-tight text-brand-text"
              style={{ fontFamily: 'var(--font-outfit, Outfit, sans-serif)' }}
            >
              MySpace
            </h1>
            <Link
              href="/groups/create"
              aria-label="Create new group"
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
              placeholder="Search groups"
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
                onClick={() => {
                  setView(item.key)
                  setSearchQuery('')
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                  view === item.key && !searching
                    ? 'bg-brand-text/8 text-brand-text'
                    : 'text-brand-text/60 hover:bg-brand-text/5 hover:text-brand-text'
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    view === item.key && !searching ? 'bg-brand-text text-brand-bg' : 'bg-brand-text/8 text-brand-text/60'
                  }`}
                >
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* Create new group */}
          <Link
            href="/groups/create"
            className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-brand-text px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-brand-bg transition-all hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Create new group
          </Link>

          {/* Joined groups */}
          <div className="border-t border-brand-divider pt-4">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-[13px] font-bold text-brand-text/70">Groups you&apos;ve joined</p>
              <button
                onClick={() => {
                  setView('your-groups')
                  setSearchQuery('')
                }}
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
                  <Link
                    key={group.id}
                    href={`/groups/${group.id}`}
                    className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-brand-text/5"
                  >
                    <GroupAvatar avatarMediaId={group.avatar_media_id} name={group.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-brand-text">{group.name}</p>
                      <p className="truncate text-[11px] text-brand-text/40">{lastActive(group.updated_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="px-1 py-3 text-xs text-brand-text/40">
                You haven&apos;t joined any groups yet.
              </p>
            )}
          </div>
        </aside>

        {/* ── Middle: feed / discover / your groups / search ─────────── */}
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[680px]">
            <h2 className="mb-4 px-1 text-[17px] font-[800] tracking-tight text-brand-text">{middleTitle}</h2>

            {/* Mobile-only view switcher (left rail hidden below md) */}
            <div className="mb-4 flex items-center gap-2 md:hidden">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setView(item.key)
                    setSearchQuery('')
                  }}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                    view === item.key && !searching
                      ? 'bg-brand-text text-brand-bg'
                      : 'bg-brand-text/8 text-brand-text/60'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {searching ? (
              renderGroupList(searchResults, false, false, 'No groups found', 'Try a different search term')
            ) : view === 'feed' ? (
              feedLoading || loadingMy ? (
                feedSkeleton
              ) : !myGroups || myGroups.length === 0 ? (
                emptyState('Your feed is empty', 'Join groups to see their latest posts here')
              ) : enrichedPosts.length === 0 ? (
                emptyState('No recent activity', 'Posts from your groups will show up here')
              ) : (
                <div className="space-y-5">{enrichedPosts.map(renderFeedPost)}</div>
              )
            ) : view === 'discover' ? (
              renderGroupList(
                discoverGroups,
                false,
                loadingDiscover,
                'Nothing to discover',
                'No groups to discover right now. Check back later!',
              )
            ) : (
              renderGroupList(
                myGroups,
                true,
                loadingMy,
                'No groups yet',
                'Join groups to connect with people who share your interests',
              )
            )}
          </div>
        </main>

        {/* ── Right rail: the usual suggestions / promotions panel ───── */}
        <aside className="sticky top-0 hidden max-h-[calc(100vh-6rem)] w-[340px] flex-shrink-0 flex-col overflow-y-auto scrollbar-hide lg:flex">
          <RightPanel onContactClick={() => router.push('/messenger')} />
        </aside>
      </div>
    </AppShell>
  )
}
