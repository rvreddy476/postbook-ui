'use client'

import React, { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import CreatePortal from '@/components/CreatePortal'
import {
  useGroupFeedV2,
  useGroupPostSearch,
  useSparkGroupPostV2,
  useUnsparkGroupPostV2,
  useStashGroupPostV2,
  useUnstashGroupPostV2,
  useRecordGroupPostView,
  useDeleteGroupPostV2,
  useEchoGroupPostV2,
  useUnechoGroupPostV2,
} from '@/hooks/useGroups'
import { useBatchProfiles } from '@/hooks/useProfile'
import { useAuthUser } from '@/store/auth'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, MessageCircle } from 'lucide-react'
import GroupPostCard from '@/components/groups/GroupPostCard'
import {
  engageGroupPost,
  groupPostSearchKey,
  MIN_GROUP_SEARCH_LENGTH,
} from '@/components/groups/patchGroupFeed'

interface GroupFeedTabProps {
  groupId: string
  isMember: boolean
  viewerRole?: string
  /** Hide the inline compose box — for surfaces where a New Post
   *  button in the header already covers it. */
  hideComposer?: boolean
  /**
   * When set and long enough, the tab shows search results instead of the
   * feed — same cards, same handlers, same page shape. Rendering results
   * through a second component would be a second place for engagement,
   * deletion and comments to drift out of step with the feed.
   */
  searchQuery?: string
}

export default function GroupFeedTab({
  groupId,
  isMember,
  viewerRole,
  hideComposer = false,
  searchQuery = '',
}: GroupFeedTabProps) {
  const [showCreate, setShowCreate] = useState(false)
  const qc = useQueryClient()
  const authUser = useAuthUser()

  /*
    Both queries are declared unconditionally — hooks must be — but the
    search one only fetches once the query is long enough, and the results
    replace the feed rather than sitting beside it.
  */
  const trimmedQuery = searchQuery.trim()
  const searching = trimmedQuery.length >= MIN_GROUP_SEARCH_LENGTH
  const feedQuery = useGroupFeedV2(groupId)
  const searchResults = useGroupPostSearch(groupId, trimmedQuery)
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = searching
    ? searchResults
    : feedQuery

  const isAdmin = viewerRole === 'owner' || viewerRole === 'admin' || viewerRole === 'moderator'

  // Engagement mutations
  const sparkMut = useSparkGroupPostV2()
  const unsparkMut = useUnsparkGroupPostV2()
  const stashMut = useStashGroupPostV2()
  const unstashMut = useUnstashGroupPostV2()
  const viewMut = useRecordGroupPostView()
  const deleteMut = useDeleteGroupPostV2()
  const echoMut = useEchoGroupPostV2()
  const unechoMut = useUnechoGroupPostV2()

  const rawPosts = data?.pages.flatMap((page) => page.data) ?? []

  // Batch-fetch author profiles
  const authorIds = useMemo(() => [...new Set(rawPosts.map(p => p.author_id))], [rawPosts])
  const { data: profileMap } = useBatchProfiles(authorIds)

  // Enrich posts with author name/avatar
  const posts = useMemo(() => rawPosts.map(post => {
    const profile = profileMap?.get(post.author_id)
    if (!profile) return post
    return {
      ...post,
      author_name: profile.display_name || profile.username || post.author_name,
      author_avatar_url: profile.avatar_media_id
        ? `/v1/media/${profile.avatar_media_id}/serve`
        : post.author_avatar_url,
    }
  }), [rawPosts, profileMap])

  // Split pinned vs regular
  const pinnedPosts = useMemo(() => posts.filter(p => p.is_pinned), [posts])
  const regularPosts = useMemo(() => posts.filter(p => !p.is_pinned), [posts])

  /*
    Engagement callbacks. Every one of them patches the cached feed page —
    count and viewer flag together — before firing the request, and rolls that
    patch back on failure. The card holds no reaction state of its own, so the
    cache is the single source the filled heart and the number both read.
  */
  const engage = (
    gId: string,
    postId: string,
    kind: 'spark' | 'echo' | 'stash',
    engaged: boolean,
    mutation: Parameters<typeof engageGroupPost>[0]['mutation'],
    echoType?: string,
  ) =>
    engageGroupPost({
      qc,
      groupId: gId,
      postId,
      kind,
      engaged,
      mutation,
      echoType,
      /*
        While searching, the same post is cached twice. Patch both or the
        heart fills in one list and not the other.
      */
      extraKeys: searching ? [groupPostSearchKey(gId, trimmedQuery)] : [],
    })

  const handleSpark = (gId: string, postId: string) => engage(gId, postId, 'spark', true, sparkMut)
  const handleUnspark = (gId: string, postId: string) => engage(gId, postId, 'spark', false, unsparkMut)
  const handleStash = (gId: string, postId: string) => engage(gId, postId, 'stash', true, stashMut)
  const handleUnstash = (gId: string, postId: string) => engage(gId, postId, 'stash', false, unstashMut)
  const handleRepost = (gId: string, postId: string, echoType: string) =>
    engage(gId, postId, 'echo', true, echoMut, echoType)
  const handleUnrepost = (gId: string, postId: string) => engage(gId, postId, 'echo', false, unechoMut)

  const handleView = (gId: string, postId: string) => viewMut.mutate({ groupId: gId, postId })
  const handleDelete = (postId: string) => {
    if (confirm('Delete this post?')) {
      deleteMut.mutate({ groupId, postId })
    }
  }

  const renderPost = (post: typeof posts[0]) => (
    <GroupPostCard
      key={post.id}
      post={post}
      groupId={groupId}
      isAdmin={isAdmin}
      isAuthor={authUser?.id === post.author_id}
      onSpark={handleSpark}
      onUnspark={handleUnspark}
      onStash={handleStash}
      onUnstash={handleUnstash}
      onView={handleView}
      onDelete={handleDelete}
      onRepost={handleRepost}
      onUnrepost={handleUnrepost}
    />
  )

  return (
    <div className="space-y-4">
      {/* Compose Box */}
      {isMember && !hideComposer && !searching && (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center gap-3 px-5 py-4 bg-brand-card border border-brand-divider rounded-xl text-sm text-brand-text/60 hover:border-brand-text/20 hover:shadow-xs transition-all group"
        >
          <div className="w-9 h-9 rounded-full bg-linear-to-br from-brand-secondary to-brand-secondary flex items-center justify-center group-hover:from-brand-text/10 group-hover:to-brand-text/5 transition-all">
            <Plus className="w-4 h-4 text-brand-text/60 group-hover:text-brand-text transition-colors" />
          </div>
          <span className="group-hover:text-brand-highlight transition-colors">Write something to your group...</span>
        </button>
      )}

      {/* Create Post Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs"
            onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}
          >
            <CreatePortal onClose={() => setShowCreate(false)} groupId={groupId} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Posts */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
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
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 rounded-2xl bg-brand-secondary mx-auto mb-4 flex items-center justify-center">
            <MessageCircle className="w-7 h-7 text-brand-text/20" />
          </div>
          {/*
            An empty feed means two different things, and saying the wrong one
            is worse than saying nothing.

            For a member it is what it looks like: nobody has posted. For
            everyone else the feed is empty because the server did not send
            them the posts — a private group may be busy — so claiming "no
            posts yet" states as fact something the server never said, and
            "be the first to share" invites an action a non-member has no
            composer for.
          */}
          {searching ? (
            <>
              <p className="text-sm font-semibold text-brand-text/60">No posts match that</p>
              <p className="text-xs text-brand-text/30 mt-1">
                Nothing in this group mentions &ldquo;{trimmedQuery}&rdquo;.
              </p>
            </>
          ) : isMember ? (
            <>
              <p className="text-sm font-semibold text-brand-text/60">No posts yet</p>
              <p className="text-xs text-brand-text/30 mt-1">Be the first to share something with the group!</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-brand-text/60">Posts are for members</p>
              <p className="text-xs text-brand-text/30 mt-1">Join this group to see what people are sharing.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/*
            Results keep the server's order, which is by relevance. Floating
            pinned posts to the top of a search would put a pinned post above
            a better match for no reason the reader can see.
          */}
          {searching ? (
            posts.map(renderPost)
          ) : (
            <>
              {pinnedPosts.map(renderPost)}
              {regularPosts.map(renderPost)}
            </>
          )}
        </div>
      )}

      {/* Load More */}
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
    </div>
  )
}
