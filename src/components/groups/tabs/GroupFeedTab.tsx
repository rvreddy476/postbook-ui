'use client'

import React, { useState, useMemo } from 'react'
import CreatePortal from '@/components/CreatePortal'
import { useGroupFeed, useGroupMembers } from '@/hooks/useGroups'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Plus, Heart, MessageCircle, Repeat2, Bookmark, Pin,
  Crown, ShieldCheck, Wrench, MoreHorizontal, Image as ImageIcon
} from 'lucide-react'
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
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d`
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function RoleBadge({ role }: { role: string }) {
  if (role === 'owner' || role === 'admin') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 rounded-md">
        <Crown className="w-2.5 h-2.5" />{role === 'owner' ? 'Owner' : 'Admin'}
      </span>
    )
  }
  if (role === 'moderator') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 rounded-md">
        <Wrench className="w-2.5 h-2.5" />Mod
      </span>
    )
  }
  return null
}

function GroupPostCard({ post, memberMap }: { post: GroupPost; memberMap: Map<string, GroupMember> }) {
  const member = memberMap.get(post.author_id)
  const name = member?.display_name || member?.username || `User ${post.author_id.slice(0, 8)}`
  const username = member?.username ? `@${member.username}` : null
  const avatarSrc = member?.avatar_media_id
    ? `/v1/media/${member.avatar_media_id}/serve`
    : null
  const role = member?.role || 'member'

  return (
    <Link href={`/post/${post.post_id}`} className="block">
      <motion.article
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-card rounded-xl border border-brand-divider hover:border-brand-divider hover:shadow-sm transition-all"
      >
        {/* Author Row */}
        <div className="flex items-center gap-3 p-4 pb-0">
          <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden flex-shrink-0 ring-2 ring-white shadow-sm">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-sm font-bold text-white">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-bold text-slate-800 truncate">{name}</span>
              <RoleBadge role={role} />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-brand-text/60">
              {username && <span className="font-medium">{username}</span>}
              {username && <span>·</span>}
              <span>{timeAgo(post.created_at)}</span>
            </div>
          </div>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
            className="p-1.5 text-slate-300 hover:text-brand-highlight rounded-lg hover:bg-brand-secondary transition-all"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Content placeholder — in a real implementation this would show post body/media */}
        <div className="px-4 py-3">
          <div className="h-2.5 w-full bg-brand-secondary rounded-full mb-2" />
          <div className="h-2.5 w-3/4 bg-brand-secondary rounded-full" />
        </div>

        {/* Engagement Rail */}
        <div className="flex items-center border-t border-slate-50 px-2">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-brand-text/60 hover:text-rose-500 hover:bg-rose-50/50 rounded-lg transition-all"
          >
            <Heart className="w-4 h-4" />
            <span className="hidden sm:inline">Spark</span>
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-brand-text/60 hover:text-blue-500 hover:bg-blue-50/50 rounded-lg transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Comment</span>
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-brand-text/60 hover:text-emerald-500 hover:bg-emerald-50/50 rounded-lg transition-all"
          >
            <Repeat2 className="w-4 h-4" />
            <span className="hidden sm:inline">Echo</span>
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-brand-text/60 hover:text-amber-500 hover:bg-amber-50/50 rounded-lg transition-all"
          >
            <Bookmark className="w-4 h-4" />
            <span className="hidden sm:inline">Stash</span>
          </button>
        </div>
      </motion.article>
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
    <div className="space-y-4">
      {/* Compose Box */}
      {isMember && (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center gap-3 px-5 py-4 bg-brand-card border border-brand-divider rounded-xl text-sm text-brand-text/60 hover:border-[#D8103F]/20 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center group-hover:from-[#D8103F]/10 group-hover:to-[#D8103F]/5 transition-all">
            <Plus className="w-4 h-4 text-brand-text/60 group-hover:text-[#D8103F] transition-colors" />
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
                <div className="w-10 h-10 rounded-full bg-slate-100" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-28 bg-slate-100 rounded" />
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
            <MessageCircle className="w-7 h-7 text-slate-200" />
          </div>
          <p className="text-sm font-semibold text-brand-text/60">No posts yet</p>
          <p className="text-xs text-slate-300 mt-1">Be the first to share something with the group!</p>
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
        <div className="flex justify-center pt-2 pb-4">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-6 py-2.5 bg-brand-card rounded-xl font-bold text-xs text-brand-highlight hover:text-[#D8103F] hover:shadow-md transition-all border border-brand-divider disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading...' : 'Load more posts'}
          </button>
        </div>
      )}
    </div>
  )
}
