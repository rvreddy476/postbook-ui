'use client'

import React from 'react'
import { Star, MessageCircle, Repeat2, Bookmark, MoreHorizontal, Pin, Megaphone } from 'lucide-react'
import type { GroupPostV2 } from '@/hooks/useGroupPosts'

interface GroupPostCardProps {
  post: GroupPostV2
  channelName?: string
  onSpark?: () => void
  onComment?: () => void
  onEcho?: () => void
  onStash?: () => void
  isAdmin?: boolean
  onPin?: () => void
  onDelete?: () => void
  onApprove?: () => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function getInitialColor(name: string): string {
  const colors = ['bg-amber-200', 'bg-blue-200', 'bg-emerald-200', 'bg-purple-200', 'bg-rose-200', 'bg-indigo-200']
  return colors[name.charCodeAt(0) % colors.length]
}

export default function GroupPostCard({ post, channelName, onSpark, onComment, onEcho, onStash, isAdmin, onPin, onDelete, onApprove }: GroupPostCardProps) {
  const authorInitial = (post.author_name ?? post.author_id)?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="bg-white rounded-2xl border border-brand-divider p-4 transition-all hover:shadow-sm">
      {/* Badges */}
      <div className="flex items-center gap-2 mb-3">
        {post.is_pinned && (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-brand-text/50 bg-brand-text/5 px-2 py-0.5 rounded-full">
            <Pin className="w-2.5 h-2.5" /> Pinned
          </span>
        )}
        {post.is_announcement && (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            <Megaphone className="w-2.5 h-2.5" /> Announcement
          </span>
        )}
        {channelName && (
          <span className="text-[9px] font-semibold text-brand-text/40 bg-brand-bg px-2 py-0.5 rounded-full">
            💬 {channelName}
          </span>
        )}
      </div>

      {/* Author row */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-9 h-9 rounded-full ${getInitialColor(post.author_id)} flex items-center justify-center text-sm font-bold text-white shrink-0`}>
          {post.author_avatar_url ? (
            <img src={post.author_avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
          ) : authorInitial}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-brand-text">{post.author_name ?? post.author_id}</span>
          <span className="text-[10px] text-brand-text/35 ml-2">{timeAgo(post.created_at)}</span>
        </div>
        {isAdmin && (
          <button className="w-7 h-7 rounded-lg flex items-center justify-center text-brand-text/30 hover:bg-brand-bg hover:text-brand-text transition-all">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Title */}
      {post.title && (
        <h3 className="text-[15px] font-bold text-brand-text mb-1.5">{post.title}</h3>
      )}

      {/* Body */}
      {post.body && (
        <p className="text-sm text-brand-text/70 leading-relaxed whitespace-pre-wrap">{post.body}</p>
      )}

      {/* Pending approval banner */}
      {post.status === 'pending_approval' && isAdmin && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-700">Pending approval</span>
          <div className="flex gap-2">
            <button onClick={onApprove} className="text-xs font-bold text-green-600 hover:underline">Approve</button>
            <button onClick={onDelete} className="text-xs font-bold text-red-500 hover:underline">Reject</button>
          </div>
        </div>
      )}

      {/* Engagement rail */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-brand-divider">
        <button onClick={onSpark} className="flex items-center gap-1.5 text-xs text-brand-text/40 hover:text-brand-text transition-colors">
          <Star className="w-3.5 h-3.5" />
          <span className="font-semibold">{post.spark_count > 0 ? formatCount(post.spark_count) : 'Spark'}</span>
        </button>
        <button onClick={onComment} className="flex items-center gap-1.5 text-xs text-brand-text/40 hover:text-brand-text transition-colors">
          <MessageCircle className="w-3.5 h-3.5" />
          <span className="font-semibold">{post.comment_count > 0 ? formatCount(post.comment_count) : 'Comment'}</span>
        </button>
        <button onClick={onEcho} className="flex items-center gap-1.5 text-xs text-brand-text/40 hover:text-brand-text transition-colors">
          <Repeat2 className="w-3.5 h-3.5" />
          <span className="font-semibold">Echo</span>
        </button>
        <button onClick={onStash} className="flex items-center gap-1.5 text-xs text-brand-text/40 hover:text-brand-text transition-colors ml-auto">
          <Bookmark className="w-3.5 h-3.5" />
          <span className="font-semibold">Stash</span>
        </button>
      </div>
    </div>
  )
}
