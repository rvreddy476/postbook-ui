'use client'

import React, { useState, useEffect } from 'react'
import { Send, HelpCircle } from 'lucide-react'
import { useCreateCommunityPost } from '@/hooks/useCommunityPosts'
import { useCommunitySpaces } from '@/hooks/useCommunities'

interface CommunityPostComposerProps {
  communityId: string
}

export default function CommunityPostComposer({ communityId }: CommunityPostComposerProps) {
  const [expanded, setExpanded] = useState(false)
  const [body, setBody] = useState('')
  const [title, setTitle] = useState('')
  const [contentType, setContentType] = useState<'text' | 'qa_question'>('text')
  const [selectedSpaceId, setSelectedSpaceId] = useState('')

  // Silently fetch spaces to get a spaceId for the API (required by backend)
  const { data: spaces } = useCommunitySpaces(communityId)

  useEffect(() => {
    if (!selectedSpaceId && spaces && spaces.length > 0) {
      setSelectedSpaceId(spaces[0].id)
    }
  }, [spaces, selectedSpaceId])

  const createPost = useCreateCommunityPost(communityId, selectedSpaceId)

  const handleSubmit = () => {
    if (!body.trim() || !selectedSpaceId) return
    createPost.mutate(
      {
        body: body.trim(),
        content_type: contentType,
        title: contentType === 'qa_question' ? title.trim() : undefined,
      },
      {
        onSuccess: () => {
          setBody('')
          setTitle('')
          setContentType('text')
          setExpanded(false)
        },
      }
    )
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full bg-brand-card border border-brand-divider rounded-2xl px-4 py-3.5 text-left text-sm text-brand-text/40 hover:border-brand-text/20 transition-colors"
      >
        Share with the community...
      </button>
    )
  }

  return (
    <div className="bg-brand-card border border-brand-divider rounded-2xl p-4">
      {/* Content type toggle */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setContentType(contentType === 'text' ? 'qa_question' : 'text')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            contentType === 'qa_question'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'text-brand-text/50 hover:bg-brand-bg'
          }`}
        >
          <HelpCircle className="w-3 h-3" />
          Q&A
        </button>
      </div>

      {/* Title (Q&A only) */}
      {contentType === 'qa_question' && (
        <input
          type="text"
          placeholder="Question title..."
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full px-0 py-2 text-[15px] font-bold text-brand-text placeholder:text-brand-text/30 border-none outline-none bg-transparent"
        />
      )}

      {/* Body */}
      <textarea
        placeholder={contentType === 'qa_question' ? 'Describe your question in detail...' : 'Share with the community...'}
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={3}
        autoFocus
        className="w-full px-0 py-2 text-sm text-brand-text placeholder:text-brand-text/30 border-none outline-none bg-transparent resize-none"
      />

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-brand-divider">
        <button
          onClick={() => { setExpanded(false); setBody(''); setTitle('') }}
          className="text-xs text-brand-text/50 hover:text-brand-text transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!body.trim() || !selectedSpaceId || createPost.isPending}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-text text-brand-bg text-xs font-bold rounded-lg hover:bg-brand-text/90 transition-colors disabled:opacity-40"
        >
          <Send className="w-3 h-3" />
          {createPost.isPending ? 'Posting...' : 'Post'}
        </button>
      </div>
    </div>
  )
}
