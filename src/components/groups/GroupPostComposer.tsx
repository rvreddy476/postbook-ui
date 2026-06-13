'use client'

import React, { useState } from 'react'
import { Image, Video, BarChart3, Calendar, Paperclip, Send } from 'lucide-react'
import { useCreateGroupPost } from '@/hooks/useGroupPosts'
import type { GroupChannelV2 } from '@/hooks/useGroupAdmin'

interface GroupPostComposerProps {
  groupId: string
  channels?: GroupChannelV2[]
}

export default function GroupPostComposer({ groupId, channels }: GroupPostComposerProps) {
  const [body, setBody] = useState('')
  const [channelId, setChannelId] = useState<string | undefined>()
  const [expanded, setExpanded] = useState(false)
  const createPost = useCreateGroupPost(groupId)

  const handlePost = () => {
    if (!body.trim()) return
    createPost.mutate({ body: body.trim(), channel_id: channelId }, {
      onSuccess: () => { setBody(''); setExpanded(false) },
    })
  }

  return (
    <div className="bg-brand-card rounded-2xl border border-brand-divider p-4">
      <p className="text-[10px] font-extrabold text-brand-text/40 uppercase tracking-widest mb-3">
        Share with the group
      </p>

      {/* Channel selector */}
      {channels && channels.length > 1 && (
        <select
          value={channelId ?? ''}
          onChange={(e) => setChannelId(e.target.value || undefined)}
          className="mb-3 text-xs bg-brand-bg border border-brand-divider rounded-lg px-3 py-1.5 text-brand-text outline-none"
        >
          <option value="">All channels</option>
          {channels.map(ch => (
            <option key={ch.id} value={ch.id}>
              {ch.type === 'announcements' ? '📢' : ch.type === 'qa' ? '❓' : '💬'} {ch.name}
            </option>
          ))}
        </select>
      )}

      {/* Input */}
      {!expanded ? (
        <div
          onClick={() => setExpanded(true)}
          className="bg-brand-bg border border-brand-divider rounded-xl px-4 py-2.5 text-sm text-brand-text/35 cursor-pointer hover:border-brand-text/20 transition-all"
        >
          Write something to the group...
        </div>
      ) : (
        <>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What's on your mind?"
            rows={4}
            autoFocus
            className="w-full bg-brand-bg border border-brand-divider rounded-xl px-4 py-3 text-sm text-brand-text placeholder:text-brand-text/30 outline-none focus:border-brand-text/30 resize-none"
          />

          {/* Attachment bar */}
          <div className="flex items-center gap-2 pt-3 border-t border-brand-divider mt-3">
            <button className="flex items-center gap-1.5 text-[10px] text-brand-text/40 hover:text-brand-text/70 px-2 py-1.5 rounded-lg hover:bg-brand-bg transition-all">
              <Image className="w-3.5 h-3.5" /> Photo
            </button>
            <button className="flex items-center gap-1.5 text-[10px] text-brand-text/40 hover:text-brand-text/70 px-2 py-1.5 rounded-lg hover:bg-brand-bg transition-all">
              <Video className="w-3.5 h-3.5" /> Video
            </button>
            <button className="flex items-center gap-1.5 text-[10px] text-brand-text/40 hover:text-brand-text/70 px-2 py-1.5 rounded-lg hover:bg-brand-bg transition-all">
              <BarChart3 className="w-3.5 h-3.5" /> Poll
            </button>
            <button className="flex items-center gap-1.5 text-[10px] text-brand-text/40 hover:text-brand-text/70 px-2 py-1.5 rounded-lg hover:bg-brand-bg transition-all">
              <Calendar className="w-3.5 h-3.5" /> Event
            </button>
            <button className="flex items-center gap-1.5 text-[10px] text-brand-text/40 hover:text-brand-text/70 px-2 py-1.5 rounded-lg hover:bg-brand-bg transition-all">
              <Paperclip className="w-3.5 h-3.5" /> File
            </button>

            <button
              onClick={handlePost}
              disabled={!body.trim() || createPost.isPending}
              className="ml-auto flex items-center gap-1.5 bg-brand-text text-brand-bg text-xs font-bold px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-40 transition-all"
            >
              <Send className="w-3 h-3" />
              Post
            </button>
          </div>
        </>
      )}
    </div>
  )
}
