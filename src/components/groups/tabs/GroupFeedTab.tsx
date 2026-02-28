'use client'

import React, { useState, useMemo } from 'react'
import CreatePortal from '@/components/CreatePortal'
import { useGroupFeed, useGroupMembers } from '@/hooks/useGroups'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import type { GroupPost, GroupMember } from '@/types/groups'

interface GroupFeedTabProps {
  groupId: string
  isMember: boolean
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function GroupPostCard({ post, memberMap }: { post: GroupPost; memberMap: Map<string, GroupMember> }) {
  const member = memberMap.get(post.author_id)
  const name = member?.display_name || member?.username || `User ${post.author_id.slice(0, 6)}`
  const avatarSrc = member?.avatar_media_id
    ? `/v1/media/${member.avatar_media_id}/serve`
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author_id.slice(0, 8)}`

  return (
    <Link href={`/post/${post.post_id}`}>
      <div className="bg-white rounded-xl border border-slate-100 p-4 hover:border-violet-200 hover:shadow-sm transition-all">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
            <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-700 truncate">{name}</p>
            <p className="text-[10px] text-slate-400">{timeAgo(post.created_at)}</p>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function GroupFeedTab({ groupId, isMember }: GroupFeedTabProps) {
  const [showCreate, setShowCreate] = useState(false)
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useGroupFeed(groupId)
  const { data: members } = useGroupMembers(groupId)

  const memberMap = useMemo(() => {
    const map = new Map<string, GroupMember>()
    members?.forEach((m) => map.set(m.user_id, m))
    return map
  }, [members])

  const posts = data?.pages.flatMap((page) => page.data) ?? []

  return (
    <div className="space-y-4 max-w-[640px] mx-auto">
      {/* Create Post Button */}
      {isMember && (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-400 hover:border-violet-300 hover:text-violet-500 transition-all"
        >
          <Plus className="w-4 h-4" />
          Write something to the group...
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
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">No posts yet. Be the first to share something!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <GroupPostCard key={post.post_id} post={post} memberMap={memberMap} />
          ))}
        </div>
      )}

      {/* Load More */}
      {hasNextPage && (
        <div className="flex justify-center pt-4 pb-8">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-8 py-3 bg-white rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-500 hover:text-violet-600 hover:shadow-lg transition-all border border-slate-100 disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  )
}
