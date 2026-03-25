'use client'

import React, { useState, useMemo } from 'react'
import CreatePortal from '@/components/CreatePortal'
import {
  useGroupFeedV2,
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

interface GroupFeedTabProps {
  groupId: string
  isMember: boolean
  viewerRole?: string
}

export default function GroupFeedTab({ groupId, isMember, viewerRole }: GroupFeedTabProps) {
  const [showCreate, setShowCreate] = useState(false)
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useGroupFeedV2(groupId)
  const authUser = useAuthUser()

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

  // Engagement callbacks
  const handleSpark = (gId: string, postId: string) => sparkMut.mutate({ groupId: gId, postId })
  const handleUnspark = (gId: string, postId: string) => unsparkMut.mutate({ groupId: gId, postId })
  const handleStash = (gId: string, postId: string) => stashMut.mutate({ groupId: gId, postId })
  const handleUnstash = (gId: string, postId: string) => unstashMut.mutate({ groupId: gId, postId })
  const handleView = (gId: string, postId: string) => viewMut.mutate({ groupId: gId, postId })
  const handleDelete = (postId: string) => {
    if (confirm('Delete this post?')) {
      deleteMut.mutate({ groupId, postId })
    }
  }
  const handleRepost = (gId: string, postId: string, echoType: string) => echoMut.mutate({ groupId: gId, postId, echoType })
  const handleUnrepost = (gId: string, postId: string) => unechoMut.mutate({ groupId: gId, postId })

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
    />
  )

  return (
    <div className="space-y-4">
      {/* Compose Box */}
      {isMember && (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center gap-3 px-5 py-4 bg-brand-card border border-brand-divider rounded-xl text-sm text-brand-text/60 hover:border-brand-text/20 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-secondary to-brand-secondary flex items-center justify-center group-hover:from-brand-text/10 group-hover:to-brand-text/5 transition-all">
            <Plus className="w-4 h-4 text-brand-text/60 group-hover:text-brand-text transition-colors" />
          </div>
          <span className="group-hover:text-brand-highlight transition-colors">Write something to the group...</span>
        </button>
      )}

      {/* Create Post Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
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
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 rounded-2xl bg-brand-secondary mx-auto mb-4 flex items-center justify-center">
            <MessageCircle className="w-7 h-7 text-brand-text/20" />
          </div>
          <p className="text-sm font-semibold text-brand-text/60">No posts yet</p>
          <p className="text-xs text-brand-text/30 mt-1">Be the first to share something with the group!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pinnedPosts.map(renderPost)}
          {regularPosts.map(renderPost)}
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
