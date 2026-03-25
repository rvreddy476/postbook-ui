'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import {
  MessageCircle,
  Send,
  Smile,
  MoreHorizontal,
  Pin,
  Trash2,
  Pencil,
  Sparkles,
  X,
  ChevronDown,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { LetterAvatar } from '@/components/LetterAvatar'
import api from '@/lib/api'
import { useBatchProfiles } from '@/hooks/useProfile'
import { useGroupMembers } from '@/hooks/useGroups'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthUser } from '@/store/auth'
import { useGroupPostCommentRoom } from '@/hooks/useGroupPostCommentRoom'
import type { GroupCommentUpdate } from '@/services/messageService'
import {
  subscribeToGroupTyping,
  sendGroupPostTyping,
  type GroupTypingEvent,
} from '@/services/messageService'
import emojiData from '@emoji-mart/data'

const EmojiPicker = lazy(() => import('@emoji-mart/react'))

/* ── Types ──────────────────────────────────────────────────── */

interface Comment {
  id: string
  post_id: string
  user_id: string
  user_name?: string
  user_avatar?: string
  body: string
  parent_id?: string
  is_pinned?: boolean
  spark_count: number
  created_at: string
  updated_at?: string
}

interface GroupPostCommentSectionProps {
  postId: string
  groupId: string
  isAdmin?: boolean
}

/* ── Helpers ────────────────────────────────────────────────── */

type SortMode = 'newest' | 'top'
const PAGE_SIZE = 10
const MAX_CHARS = 1000
const POLL_INTERVAL = 15_000

let idCounter = 200

function nextId(): string {
  idCounter += 1
  return `gcmt_${idCounter}_${Date.now()}`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(dateStr).toLocaleDateString()
}

/* ── Fetch comments from API ─────────────────────────────────── */

function normalizeComment(raw: any): Comment {
  return {
    id: raw.id,
    post_id: raw.post_id,
    user_id: raw.author_id || raw.user_id || '',
    user_name: raw.user_name,
    user_avatar: raw.user_avatar,
    body: raw.body,
    parent_id: raw.parent_id || undefined,
    is_pinned: raw.is_pinned || false,
    spark_count: raw.spark_count || 0,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  }
}

async function fetchComments(groupId: string, postId: string): Promise<Comment[]> {
  try {
    const res = await api.get(`/v1/groups/${groupId}/posts/v2/${postId}/comments`, {
      params: { limit: 50 },
    })
    const data = res.data?.data
    if (Array.isArray(data)) return data.map(normalizeComment)
    return []
  } catch {
    return []
  }
}

async function postComment(groupId: string, postId: string, body: string, parentId?: string): Promise<Comment | null> {
  try {
    const res = await api.post(`/v1/groups/${groupId}/posts/v2/${postId}/comments`, {
      body,
      parent_id: parentId || undefined,
    })
    const raw = res.data?.data
    if (raw) return normalizeComment(raw)
    return null
  } catch {
    return null
  }
}

async function deleteCommentApi(groupId: string, postId: string, commentId: string): Promise<boolean> {
  try {
    await api.delete(`/v1/groups/${groupId}/posts/v2/${postId}/comments/${commentId}`)
    return true
  } catch {
    return false
  }
}

/* ── Avatar component ───────────────────────────────────────── */

const CommentAvatar: React.FC<{ name?: string; avatar?: string; size?: 'sm' | 'md' }> = ({
  name,
  avatar,
  size = 'md',
}) => {
  const dim = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8'
  if (avatar) {
    return <img src={avatar} alt={name ?? ''} className={`${dim} rounded-full object-cover flex-shrink-0`} />
  }
  return (
    <LetterAvatar
      name={name || '?'}
      seed={name}
      size={size === 'sm' ? 'xs' : 'sm'}
    />
  )
}

/* ── Dropdown menu ──────────────────────────────────────────── */

const ActionMenu: React.FC<{
  items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[]
  onClose: () => void
}> = ({ items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute right-0 top-6 z-50 w-40 rounded-xl bg-white shadow-lg border border-brand-divider overflow-hidden"
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            item.onClick()
            onClose()
          }}
          className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] font-medium transition hover:bg-brand-secondary ${
            item.danger ? 'text-red-600' : 'text-brand-text'
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}

/* ── Inline reply input ──────────────────────────────────────── */

const InlineReplyInput: React.FC<{
  parentId: string
  parentUserName: string
  currentUserName: string
  currentUserAvatar?: string
  onSubmit: (body: string, parentId: string) => void
  onCancel: () => void
}> = ({ parentId, parentUserName, currentUserName, currentUserAvatar, onSubmit, onCancel }) => {
  const [text, setText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)
  const overLimit = text.length > MAX_CHARS

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmoji(false)
    }
    if (showEmoji) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showEmoji])

  const handleSubmit = () => {
    const body = text.trim()
    if (!body || overLimit) return
    onSubmit(body, parentId)
    setText('')
    setShowEmoji(false)
  }

  const handleEmojiSelect = (emoji: { native: string }) => {
    setText(prev => prev + emoji.native)
    setShowEmoji(false)
    inputRef.current?.focus()
  }

  return (
    <div className="ml-10 mt-2 mb-1 pl-3 border-l-2 border-brand-divider">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[11px] text-brand-text/50">
          Replying to <span className="font-semibold text-brand-text/70">@{parentUserName}</span>
        </span>
        <button onClick={onCancel} className="p-0.5 rounded-full hover:bg-brand-secondary transition">
          <X className="w-3 h-3 text-brand-text/40" />
        </button>
      </div>
      <div className="flex gap-2 items-start">
        <CommentAvatar name={currentUserName} avatar={currentUserAvatar} size="sm" />
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder={`Reply to @${parentUserName}...`}
            rows={1}
            maxLength={MAX_CHARS + 50}
            className="w-full rounded-xl bg-brand-secondary px-3 py-2 pr-14 text-[12px] text-brand-text placeholder:text-brand-text/40 outline-none ring-1 ring-transparent focus:ring-brand-text/20 transition resize-none"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            <div className="relative" ref={emojiRef}>
              <button
                type="button"
                onClick={() => setShowEmoji(!showEmoji)}
                className="p-1 rounded-full hover:bg-brand-divider transition text-brand-text/30"
                title="Emoji"
              >
                <Smile className="w-3.5 h-3.5" />
              </button>
              {showEmoji && (
                <div className="absolute bottom-8 right-0 z-50">
                  <Suspense fallback={<div className="w-[352px] h-[435px] bg-white rounded-2xl shadow-xl border border-brand-divider flex items-center justify-center"><div className="w-5 h-5 border-2 border-brand-divider border-t-brand-text/80 rounded-full animate-spin" /></div>}>
                    <EmojiPicker data={emojiData} onEmojiSelect={handleEmojiSelect} theme="light" previewPosition="none" skinTonePosition="none" perLine={9} maxFrequentRows={2} />
                  </Suspense>
                </div>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || overLimit}
              className={`p-1 rounded-full transition ${
                text.trim() && !overLimit
                  ? 'bg-brand-text text-white hover:bg-brand-text/90'
                  : 'text-brand-text/20'
              }`}
            >
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
      {text.length > 0 && (
        <div className="flex justify-end mt-0.5 mr-1">
          <span className={`text-[10px] ${overLimit ? 'text-red-500 font-semibold' : 'text-brand-text/30'}`}>
            {text.length}/{MAX_CHARS}
          </span>
        </div>
      )}
    </div>
  )
}

/* ── Single comment row ─────────────────────────────────────── */

const CommentRow: React.FC<{
  comment: Comment
  isAdmin: boolean
  currentUserId: string
  currentUserName: string
  currentUserAvatar?: string
  isReply?: boolean
  replyOpen: boolean
  onToggleReply: (commentId: string, userName: string) => void
  onSubmitReply: (body: string, parentId: string) => void
  onCancelReply: () => void
  onDelete: (commentId: string) => void
  onEdit: (commentId: string, newBody: string) => void
  onPin: (commentId: string) => void
  onSpark: (commentId: string) => void
  sparkedIds: Set<string>
}> = ({
  comment, isAdmin, currentUserId, currentUserName, currentUserAvatar,
  isReply, replyOpen, onToggleReply, onSubmitReply, onCancelReply,
  onDelete, onEdit, onPin, onSpark, sparkedIds,
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(comment.body)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isOwnComment = comment.user_id === currentUserId
  const sparked = sparkedIds.has(comment.id)
  const displaySparkCount = comment.spark_count + (sparked ? 1 : 0)

  const menuItems: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] = []

  if (isOwnComment) {
    menuItems.push({
      label: 'Edit',
      icon: <Pencil className="w-3.5 h-3.5" />,
      onClick: () => {
        setEditing(true)
        setEditText(comment.body)
      },
    })
  }
  if (isOwnComment || isAdmin) {
    menuItems.push({
      label: 'Delete',
      icon: <Trash2 className="w-3.5 h-3.5" />,
      onClick: () => setConfirmDelete(true),
      danger: true,
    })
  }
  if (isAdmin) {
    menuItems.push({
      label: comment.is_pinned ? 'Unpin' : 'Pin',
      icon: <Pin className="w-3.5 h-3.5" />,
      onClick: () => onPin(comment.id),
    })
  }

  const hasMenu = menuItems.length > 0

  const handleSaveEdit = () => {
    const trimmed = editText.trim()
    if (!trimmed || trimmed === comment.body) {
      setEditing(false)
      return
    }
    onEdit(comment.id, trimmed)
    setEditing(false)
  }

  return (
    <div className={`${isReply ? 'ml-10 border-l-2 border-brand-divider pl-3' : ''} py-3 border-b border-brand-divider`}>
      {/* Pinned badge */}
      {comment.is_pinned && !isReply && (
        <div className="flex items-center gap-1 text-[11px] font-semibold text-brand-text/50 mb-1.5">
          <Pin className="w-3 h-3" /> Pinned
        </div>
      )}

      <div className="flex gap-2.5">
        <CommentAvatar name={comment.user_name} avatar={comment.user_avatar} size={isReply ? 'sm' : 'md'} />

        <div className="flex-1 min-w-0">
          {/* Name + time + menu */}
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-brand-text truncate">
              {comment.user_name || 'User'}
            </span>
            <span className="text-[11px] text-brand-text/40 flex-shrink-0">{timeAgo(comment.created_at)}</span>
            {comment.updated_at && (
              <span className="text-[10px] italic text-brand-text/30 flex-shrink-0">Edited</span>
            )}
            <div className="flex-1" />
            {hasMenu && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-1 rounded-full hover:bg-brand-secondary transition text-brand-text/40 hover:text-brand-text"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {menuOpen && <ActionMenu items={menuItems} onClose={() => setMenuOpen(false)} />}
              </div>
            )}
          </div>

          {/* Body or edit form */}
          {editing ? (
            <div className="mt-1.5 space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full rounded-xl bg-brand-secondary px-3 py-2 text-[13px] text-brand-text outline-none ring-1 ring-brand-divider focus:ring-brand-text/40 transition resize-none"
                rows={2}
                maxLength={MAX_CHARS}
                autoFocus
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-brand-text/30">{editText.length}/{MAX_CHARS}</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setEditing(false)}
                    className="text-[12px] font-medium text-brand-text/60 px-3 py-1 rounded-full hover:bg-brand-secondary transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={!editText.trim()}
                    className="text-[12px] font-semibold px-3 py-1 bg-brand-text text-white rounded-full disabled:opacity-40 transition hover:bg-brand-text/90"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-brand-text/80 leading-relaxed mt-0.5">{comment.body}</p>
          )}

          {/* Actions: Spark + Reply */}
          {!editing && (
            <div className="flex items-center gap-3.5 mt-1.5">
              <button
                onClick={() => onSpark(comment.id)}
                className={`flex items-center gap-1 text-[12px] transition ${
                  sparked
                    ? 'text-amber-500 font-semibold'
                    : 'text-brand-text/40 hover:text-amber-500'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${sparked ? 'fill-amber-500' : ''}`} />
                {displaySparkCount > 0 && <span>{displaySparkCount}</span>}
              </button>
              {!isReply && !comment.parent_id && (
                <button
                  onClick={() => onToggleReply(comment.id, comment.user_name || 'User')}
                  className={`flex items-center gap-1 text-[12px] transition ${
                    replyOpen
                      ? 'text-brand-text font-semibold'
                      : 'text-brand-text/40 hover:text-brand-text'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Reply
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Inline reply box — appears directly under this comment */}
      {replyOpen && !isReply && (
        <InlineReplyInput
          parentId={comment.id}
          parentUserName={comment.user_name || 'User'}
          currentUserName={currentUserName}
          currentUserAvatar={currentUserAvatar}
          onSubmit={onSubmitReply}
          onCancel={onCancelReply}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="mt-2 ml-10 flex items-center gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-[12px] text-red-700 flex-1">Delete this comment?</span>
          <button
            onClick={() => setConfirmDelete(false)}
            className="text-[12px] font-medium text-brand-text/60 px-2.5 py-1 rounded-full hover:bg-white transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onDelete(comment.id)
              setConfirmDelete(false)
            }}
            className="text-[12px] font-semibold text-white bg-red-600 px-2.5 py-1 rounded-full hover:bg-red-700 transition"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Skeleton loader ────────────────────────────────────────── */

const CommentSkeleton: React.FC = () => (
  <div className="space-y-4 p-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex gap-2.5 animate-pulse">
        <div className="w-8 h-8 rounded-full bg-brand-secondary flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <div className="h-3 w-20 rounded bg-brand-secondary" />
            <div className="h-3 w-12 rounded bg-brand-secondary" />
          </div>
          <div className="h-3 w-full rounded bg-brand-secondary" />
          <div className="h-3 w-3/4 rounded bg-brand-secondary" />
        </div>
      </div>
    ))}
  </div>
)

/* ── Main GroupPostCommentSection ────────────────────────────── */

export default function GroupPostCommentSection({ postId, groupId, isAdmin = false }: GroupPostCommentSectionProps) {
  // Auth user
  const authUser = useAuthUser()
  const currentUserId = authUser?.id ?? ''
  const currentUserName = authUser?.name ?? 'You'
  const currentUserAvatar = authUser?.avatar ?? undefined

  // State
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [sort, setSort] = useState<SortMode>('newest')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [inputText, setInputText] = useState('')
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null)
  const [sparkedIds, setSparkedIds] = useState<Set<string>>(new Set())
  const [optimisticError, setOptimisticError] = useState<string | null>(null)

  const [showMainEmoji, setShowMainEmoji] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const mainEmojiRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)
  const qc = useQueryClient()

  // Resolve author profiles via batch profiles + group members as fallback
  const authorIds = useMemo(
    () => [...new Set(comments.map(c => c.user_id).filter(id => id && id !== currentUserId))],
    [comments, currentUserId]
  )
  const { data: profileMap } = useBatchProfiles(authorIds)
  const { data: members } = useGroupMembers(groupId)

  // Build a merged lookup: batch profiles first, then group members as fallback
  const memberLookup = useMemo(() => {
    const map = new Map<string, { name: string; avatar?: string }>()
    // Group members (lower priority)
    if (members) {
      for (const m of members) {
        const name = m.display_name || m.username || ''
        if (name) {
          map.set(m.user_id, {
            name,
            avatar: m.avatar_media_id ? `/v1/media/${m.avatar_media_id}/serve` : undefined,
          })
        }
      }
    }
    // Batch profiles (higher priority — overwrites members)
    if (profileMap) {
      for (const [uid, p] of profileMap) {
        const name = p.display_name || (p.first_name || p.last_name ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : '') || p.username || ''
        if (name) {
          map.set(uid, {
            name,
            avatar: p.avatar_media_id ? `/v1/media/${p.avatar_media_id}/serve` : undefined,
          })
        }
      }
    }
    return map
  }, [profileMap, members])

  const resolveAuthorName = useCallback((userId: string): string => {
    if (!userId || userId === currentUserId) return currentUserName
    return memberLookup.get(userId)?.name || 'User'
  }, [memberLookup, currentUserId, currentUserName])

  const resolveAuthorAvatar = useCallback((userId: string): string | undefined => {
    if (!userId || userId === currentUserId) return currentUserAvatar
    return memberLookup.get(userId)?.avatar
  }, [memberLookup, currentUserId, currentUserAvatar])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Close main emoji picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (mainEmojiRef.current && !mainEmojiRef.current.contains(e.target as Node)) setShowMainEmoji(false)
    }
    if (showMainEmoji) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMainEmoji])

  const handleMainEmojiSelect = useCallback((emoji: { native: string }) => {
    setInputText(prev => prev + emoji.native)
    setShowMainEmoji(false)
    inputRef.current?.focus()
  }, [])

  // Load comments from API — merge-based: preserve optimistic + WS-delivered comments
  const doFetch = useCallback(() => {
    if (!groupId || !postId) return
    fetchComments(groupId, postId).then(data => {
      if (!mountedRef.current) return
      setComments(prev => {
        const serverIds = new Set(data.map(c => c.id))
        // Keep local-only comments: optimistic (temp IDs) or WS-delivered not yet in server
        const localOnly = prev.filter(c => !serverIds.has(c.id))
        return [...data, ...localOnly]
      })
      setLoading(false)
    }).catch(() => {
      if (!mountedRef.current) return
      setError(true)
      setLoading(false)
    })
  }, [groupId, postId])

  // Initial fetch + polling every 15 seconds
  useEffect(() => {
    if (!groupId || !postId) return
    setLoading(true)
    setError(false)
    doFetch()
    const interval = setInterval(doFetch, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [groupId, postId, doFetch])

  // Realtime comment handler — merges WS events into local state
  const handleRealtimeEvent = useCallback((event: GroupCommentUpdate) => {
    if (!mountedRef.current) return

    if (event.update_type === 'comment_created') {
      setComments(prev => {
        // Skip if already present (own optimistic insert or duplicate)
        if (prev.some(c => c.id === event.comment_id)) return prev
        const newComment: Comment = {
          id: event.comment_id,
          post_id: event.post_id,
          user_id: event.author_id || '',
          body: event.body || '',
          parent_id: event.parent_id || undefined,
          spark_count: 0,
          created_at: event.created_at || new Date().toISOString(),
        }
        return [...prev, newComment]
      })
    } else if (event.update_type === 'comment_deleted') {
      setComments(prev => prev.filter(c => c.id !== event.comment_id && c.parent_id !== event.comment_id))
    }
  }, [])

  // Subscribe to realtime comment updates via WebSocket
  useGroupPostCommentRoom(postId, groupId, handleRealtimeEvent)

  // ── Typing indicators ──────────────────────────────────────
  const [typingUsers, setTypingUsers] = useState<Map<string, number>>(new Map())
  const lastTypingSentRef = useRef(0)
  const TYPING_THROTTLE = 3000
  const TYPING_EXPIRE = 5000

  // Send typing indicator: leading throttle — fires immediately, then throttles for 3s
  const handleTypingInput = useCallback(() => {
    if (!postId) return
    const now = Date.now()
    if (now - lastTypingSentRef.current < TYPING_THROTTLE) return
    lastTypingSentRef.current = now
    sendGroupPostTyping(postId)
  }, [postId])

  // Listen for remote typing events and auto-expire after 5s
  useEffect(() => {
    if (!postId) return

    const unsub = subscribeToGroupTyping((evt: GroupTypingEvent) => {
      if (evt.post_id !== postId) return
      if (evt.user_id === currentUserId) return
      setTypingUsers(prev => {
        const next = new Map(prev)
        next.set(evt.user_id, Date.now())
        return next
      })
    })

    // Expire stale typing indicators every 2s
    const expiry = setInterval(() => {
      setTypingUsers(prev => {
        const now = Date.now()
        let changed = false
        const next = new Map(prev)
        for (const [uid, ts] of next) {
          if (now - ts > TYPING_EXPIRE) {
            next.delete(uid)
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 2000)

    return () => {
      unsub()
      clearInterval(expiry)
    }
  }, [postId, currentUserId])

  const typingCount = typingUsers.size

  // Sorted + structured comments
  const topLevelComments = comments.filter((c) => !c.parent_id)
  const repliesByParent = comments.reduce<Record<string, Comment[]>>((acc, c) => {
    if (c.parent_id) {
      if (!acc[c.parent_id]) acc[c.parent_id] = []
      acc[c.parent_id].push(c)
    }
    return acc
  }, {})

  const pinnedComment = topLevelComments.find((c) => c.is_pinned)
  const unpinned = topLevelComments.filter((c) => !c.is_pinned)

  const sorted = [...unpinned].sort((a, b) => {
    if (sort === 'top') return b.spark_count - a.spark_count
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const orderedComments = pinnedComment ? [pinnedComment, ...sorted] : sorted
  const visibleComments = orderedComments.slice(0, visibleCount)
  const hasMore = orderedComments.length > visibleCount
  const totalCount = comments.length

  // Handlers
  const handleRetry = useCallback(() => {
    setLoading(true)
    setError(false)
    doFetch()
  }, [doFetch])

  const handleAddComment = useCallback(async (body?: string, parentId?: string) => {
    const text = body ?? inputText.trim()
    if (!text || text.length > MAX_CHARS || !groupId) return

    // Optimistic add
    const tempId = nextId()
    const newComment: Comment = {
      id: tempId,
      post_id: postId,
      user_id: currentUserId,
      user_name: currentUserName,
      user_avatar: currentUserAvatar,
      body: text,
      parent_id: parentId,
      spark_count: 0,
      created_at: new Date().toISOString(),
    }
    setComments((prev) => [...prev, newComment])
    if (!body) {
      setInputText('')
      setShowMainEmoji(false)
    }
    setActiveReplyId(null)
    setOptimisticError(null)
    // Reset typing throttle so next keystroke sends immediately
    lastTypingSentRef.current = 0

    const result = await postComment(groupId, postId, text, parentId)
    if (!mountedRef.current) return
    if (result) {
      // Replace optimistic comment with server response
      setComments(prev => prev.map(c => c.id === tempId ? result : c))
      // Invalidate feed cache so comment_count in engagement rail syncs
      qc.invalidateQueries({ queryKey: ['group-feed-v2', groupId] })
    } else {
      // Remove optimistic comment on failure
      setComments(prev => prev.filter(c => c.id !== tempId))
      setOptimisticError('Failed to post comment. Please try again.')
    }
  }, [inputText, postId, groupId, currentUserId, currentUserName, currentUserAvatar, qc])

  const handleTopLevelSubmit = useCallback(() => {
    handleAddComment()
  }, [handleAddComment])

  const handleReplySubmit = useCallback((body: string, parentId: string) => {
    handleAddComment(body, parentId)
  }, [handleAddComment])

  const handleDelete = useCallback(async (commentId: string) => {
    // Optimistic delete
    const backup = comments
    setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_id !== commentId))
    if (groupId) {
      const ok = await deleteCommentApi(groupId, postId, commentId)
      if (!ok && mountedRef.current) {
        setComments(backup)
        setOptimisticError('Failed to delete comment.')
      } else if (ok) {
        qc.invalidateQueries({ queryKey: ['group-feed-v2', groupId] })
      }
    }
  }, [groupId, postId, comments, qc])

  const handleEdit = useCallback((commentId: string, newBody: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, body: newBody, updated_at: new Date().toISOString() } : c,
      ),
    )
  }, [])

  const handlePin = useCallback((commentId: string) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) return { ...c, is_pinned: !c.is_pinned }
        if (c.is_pinned) return { ...c, is_pinned: false }
        return c
      }),
    )
  }, [])

  const handleSpark = useCallback((commentId: string) => {
    setSparkedIds((prev) => {
      const next = new Set(prev)
      if (next.has(commentId)) {
        next.delete(commentId)
      } else {
        next.add(commentId)
      }
      return next
    })
  }, [])

  const handleToggleReply = useCallback((commentId: string) => {
    setActiveReplyId(prev => prev === commentId ? null : commentId)
  }, [])

  const handleCancelReply = useCallback(() => {
    setActiveReplyId(null)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleTopLevelSubmit()
      }
    },
    [handleTopLevelSubmit],
  )

  const charsLeft = MAX_CHARS - inputText.length
  const overLimit = charsLeft < 0

  return (
    <div className="bg-white rounded-b-2xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-2">
        <h3 className="text-[14px] font-bold text-brand-text flex items-center gap-1.5">
          <MessageCircle className="w-4 h-4" />
          Comments
          {!loading && !error && (
            <span className="text-[12px] font-normal text-brand-text/40 ml-1">({totalCount})</span>
          )}
        </h3>

        {/* Sort toggle */}
        {!loading && !error && topLevelComments.length > 1 && (
          <div className="flex items-center gap-0.5 bg-brand-secondary rounded-full p-0.5">
            {(['newest', 'top'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSort(mode)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold transition ${
                  sort === mode
                    ? 'bg-white text-brand-text shadow-sm'
                    : 'text-brand-text/50 hover:text-brand-text'
                }`}
              >
                {mode === 'newest' ? 'Newest' : 'Top'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Comment input */}
      <div className="pb-3">
        <div className="flex gap-2.5 items-start">
          <CommentAvatar name={currentUserName} avatar={currentUserAvatar} size="md" />
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value)
                setOptimisticError(null)
                handleTypingInput()
              }}
              onKeyDown={handleKeyDown}
              placeholder="Add a comment..."
              rows={1}
              maxLength={MAX_CHARS + 50}
              className="w-full rounded-xl bg-brand-secondary px-3.5 py-2.5 pr-16 text-[13px] text-brand-text placeholder:text-brand-text/40 outline-none ring-1 ring-transparent focus:ring-brand-text/20 transition resize-none"
            />
            {/* Input actions */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <div className="relative" ref={mainEmojiRef}>
                <button
                  type="button"
                  onClick={() => setShowMainEmoji(!showMainEmoji)}
                  className="p-1.5 rounded-full hover:bg-brand-divider transition text-brand-text/30"
                  title="Emoji"
                >
                  <Smile className="w-4 h-4" />
                </button>
                {showMainEmoji && (
                  <div className="absolute bottom-10 right-0 z-50">
                    <Suspense fallback={<div className="w-[352px] h-[435px] bg-white rounded-2xl shadow-xl border border-brand-divider flex items-center justify-center"><div className="w-5 h-5 border-2 border-brand-divider border-t-brand-text/80 rounded-full animate-spin" /></div>}>
                      <EmojiPicker data={emojiData} onEmojiSelect={handleMainEmojiSelect} theme="light" previewPosition="none" skinTonePosition="none" perLine={9} maxFrequentRows={2} />
                    </Suspense>
                  </div>
                )}
              </div>
              <button
                onClick={handleTopLevelSubmit}
                disabled={!inputText.trim() || overLimit}
                className={`p-1.5 rounded-full transition ${
                  inputText.trim() && !overLimit
                    ? 'bg-brand-text text-white hover:bg-brand-text/90'
                    : 'text-brand-text/20'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        {/* Character counter */}
        {inputText.length > 0 && (
          <div className="flex items-center justify-end mt-1 mr-1">
            <span className={`text-[10px] ${overLimit ? 'text-red-500 font-semibold' : 'text-brand-text/30'}`}>
              {inputText.length}/{MAX_CHARS}
            </span>
          </div>
        )}
        {/* Typing indicator */}
        {typingCount > 0 && (
          <div className="mt-1 ml-10 flex items-center gap-1.5 text-[11px] text-brand-text/50 animate-pulse">
            <span className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-brand-text/40 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-brand-text/40 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full bg-brand-text/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            <span>
              {typingCount === 1
                ? `${resolveAuthorName([...typingUsers.keys()][0])} is typing...`
                : 'Multiple members are typing...'}
            </span>
          </div>
        )}
        {/* Optimistic error */}
        {optimisticError && (
          <div className="mt-1.5 ml-10 flex items-center gap-1.5 text-[12px] text-red-500">
            <AlertCircle className="w-3.5 h-3.5" />
            {optimisticError}
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && <CommentSkeleton />}

      {/* Error state */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-10 px-4">
          <AlertCircle className="w-8 h-8 text-brand-text/20 mb-2" />
          <p className="text-[13px] font-medium text-brand-text/60">Failed to load comments</p>
          <button
            onClick={handleRetry}
            className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-brand-text/70 hover:text-brand-text transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && comments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 px-4">
          <div className="w-12 h-12 rounded-full bg-brand-secondary flex items-center justify-center mb-3">
            <MessageCircle className="w-5 h-5 text-brand-text/20" />
          </div>
          <p className="text-[13px] font-medium text-brand-text/50">No comments yet.</p>
          <p className="text-[12px] text-brand-text/30 mt-0.5">Be the first to share your thoughts!</p>
        </div>
      )}

      {/* Comment list */}
      {!loading && !error && visibleComments.length > 0 && (
        <div>
          {visibleComments.map((comment) => (
            <React.Fragment key={comment.id}>
              <CommentRow
                comment={{
                  ...comment,
                  user_name: resolveAuthorName(comment.user_id),
                  user_avatar: resolveAuthorAvatar(comment.user_id),
                }}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                currentUserAvatar={currentUserAvatar}
                replyOpen={activeReplyId === comment.id}
                onToggleReply={handleToggleReply}
                onSubmitReply={handleReplySubmit}
                onCancelReply={handleCancelReply}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onPin={handlePin}
                onSpark={handleSpark}
                sparkedIds={sparkedIds}
              />
              {/* Threaded replies */}
              {repliesByParent[comment.id]?.map((reply) => (
                <CommentRow
                  key={reply.id}
                  comment={{
                    ...reply,
                    user_name: resolveAuthorName(reply.user_id),
                    user_avatar: resolveAuthorAvatar(reply.user_id),
                  }}
                  isAdmin={isAdmin}
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                  currentUserAvatar={currentUserAvatar}
                  isReply
                  replyOpen={false}
                  onToggleReply={handleToggleReply}
                  onSubmitReply={handleReplySubmit}
                  onCancelReply={handleCancelReply}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onPin={handlePin}
                  onSpark={handleSpark}
                  sparkedIds={sparkedIds}
                />
              ))}
            </React.Fragment>
          ))}

          {/* Show more */}
          {hasMore && (
            <div className="py-3 text-center">
              <button
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="text-xs font-semibold text-brand-text/50 underline hover:text-brand-text transition inline-flex items-center gap-1"
              >
                <ChevronDown className="w-3 h-3" />
                Show {Math.min(PAGE_SIZE, orderedComments.length - visibleCount)} more comments
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bottom padding */}
      <div className="h-2" />
    </div>
  )
}
