'use client'

import React, { useState } from 'react'
import { Send } from 'lucide-react'
import { useCommunityPosts, useCreateCommunityPost } from '@/hooks/useCommunityPosts'
import { ROLE_BADGE_CONFIG } from '@/lib/communityRoles'

interface Props {
  postId: string
  communityId: string
  spaceId: string
  viewerRole?: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const avatarColors = [
  'from-amber-200 to-orange-300', 'from-blue-200 to-cyan-300',
  'from-emerald-200 to-teal-300', 'from-purple-200 to-pink-300',
]

function pickColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

export default function CommunityPostCommentSection({ postId, communityId, spaceId }: Props) {
  const [text, setText] = useState('')
  const { data: allPosts } = useCommunityPosts(communityId, spaceId)
  const createReply = useCreateCommunityPost(communityId, spaceId)

  // Filter replies to this post
  const replies = (allPosts ?? []).filter(p => p.parent_post_id === postId)

  const handleSubmit = () => {
    if (!text.trim()) return
    createReply.mutate(
      { body: text.trim(), parent_post_id: postId },
      { onSuccess: () => setText('') }
    )
  }

  return (
    <div className="space-y-3">
      {replies.length === 0 && (
        <p className="text-xs text-brand-text/30 text-center py-2">No replies yet</p>
      )}

      {replies.map(reply => {
        const name = (reply as any).author_name ?? 'Member'
        const avatar = (reply as any).author_avatar_url as string | undefined
        const role = (reply as any).author_role as string | undefined
        const badge = role ? ROLE_BADGE_CONFIG[role] : undefined
        const gradient = pickColor(reply.author_id)

        return (
          <div key={reply.id} className="flex gap-2">
            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
              {avatar ? (
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center text-[10px] font-bold text-white`}>
                  {name[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="bg-brand-bg rounded-xl px-3 py-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-bold text-brand-text">{name}</span>
                  {badge && (
                    <span className={`px-1 py-0.5 text-[8px] font-bold rounded-full uppercase ${badge.color}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-brand-text/70 leading-relaxed whitespace-pre-wrap">{reply.body}</p>
              </div>
              <span className="text-[10px] text-brand-text/30 ml-3">{timeAgo(reply.created_at)}</span>
            </div>
          </div>
        )
      })}

      {/* Reply input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Write a reply..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
          className="flex-1 bg-brand-bg border border-brand-divider rounded-xl px-3 py-2 text-xs text-brand-text placeholder:text-brand-text/30 outline-none focus:ring-1 focus:ring-brand-text/20"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || createReply.isPending}
          className="w-8 h-8 rounded-lg bg-brand-text text-brand-bg flex items-center justify-center hover:bg-brand-text/90 transition-colors disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
