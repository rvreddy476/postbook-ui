'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Avatar, getInitials } from './shared'
import {
  getOrCreateDirectConversation,
  fetchMessages,
  sendMessage,
  subscribeToMessages,
  subscribeToReactions,
  subscribeToTyping,
  subscribeToReadReceipts,
  subscribeToMessageEdits,
  subscribeToMessageDeletes,
  subscribeToPinUpdates,
  editMessage,
  deleteMessage,
  toggleReaction,
  markConversationRead,
  sendTypingIndicator,
  replyToMessage,
  forwardMessage,
  sendMediaMessage,
  pinMessage,
  unpinMessage,
  getPinnedMessage,
  Message as BackendMessage,
  ReactionUpdate,
  TypingEvent,
  ReadReceiptEvent,
  MessageEditedEvent,
  MessageDeletedEvent,
  PinUpdateEvent,
  PinnedMessage,
} from '@/services/messageService'
import { getSession } from '@/services/authService'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DmChatProps {
  userId: string
  userName: string
  userAvatar: string
  userOnline: boolean
  userLastSeen?: string
  onBack: () => void
}

interface DisplayMessage {
  id: string
  senderId: string
  text: string
  time: string
  ts: string
  type: string
  mediaId?: string
  replyToId?: string
  forwardedFromId?: string
  isEdited?: boolean
  editedAt?: string
  isDeleted?: boolean
  reactions?: { emoji: string; user_ids: string[] }[]
}

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  messageId: string
  senderId: string
  ts: string
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    let h = d.getHours()
    const m = d.getMinutes().toString().padStart(2, '0')
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12 || 12
    return `${h}:${m} ${ampm}`
  } catch {
    return ''
  }
}

function toDisplay(msg: BackendMessage): DisplayMessage {
  return {
    id: msg.id,
    senderId: msg.sender_id,
    text: msg.text ?? '',
    time: formatTime(msg.created_at || msg.ts),
    ts: msg.ts || msg.created_at,
    type: msg.type || 'text',
    mediaId: msg.media_id,
    replyToId: msg.reply_to_id,
    forwardedFromId: msg.forwarded_from_id,
    isEdited: msg.is_edited,
    editedAt: msg.edited_at,
    isDeleted: msg.is_deleted,
    reactions: msg.reactions,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DmChat({
  userId,
  userName,
  userAvatar,
  userOnline,
  userLastSeen,
  onBack,
}: DmChatProps) {
  const currentUser = getSession()
  const myId = currentUser?.id ?? ''

  // Core state
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Hover states
  const [inputHover, setInputHover] = useState(false)
  const [sendHover, setSendHover] = useState(false)
  const [backHover, setBackHover] = useState(false)
  const [plusHover, setPlusHover] = useState(false)

  // New feature state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [replyingTo, setReplyingTo] = useState<DisplayMessage | null>(null)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [readReceipts, setReadReceipts] = useState<Map<string, string[]>>(new Map())
  const [pinnedMessage, setPinnedMessage] = useState<PinnedMessage | null>(null)
  const [attachHover, setAttachHover] = useState(false)

  const convIdRef = useRef<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const editInputRef = useRef<HTMLInputElement | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingSentRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ---- Scroll to bottom ----
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // ---- Init conversation & load messages ----
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        setLoading(true)
        setError(false)

        const convRes = await getOrCreateDirectConversation(userId)
        const conversationId: string =
          convRes.data?.conversation_id ?? convRes.data?.id ?? convRes.conversation_id ?? convRes.id ?? ''

        if (!conversationId) throw new Error('No conversation id returned')
        convIdRef.current = conversationId

        const msgRes = await fetchMessages(conversationId)
        const raw: BackendMessage[] = Array.isArray(msgRes.data) ? msgRes.data : []

        if (!cancelled) {
          const displayed = raw.map(m => toDisplay(m)).reverse()
          setMessages(displayed)

          // Auto mark-read on load
          if (displayed.length > 0) {
            const lastMsg = displayed[displayed.length - 1]
            markConversationRead(conversationId, lastMsg.id).catch(() => {})
          }

          // Load pinned message
          getPinnedMessage(conversationId).then(pinned => {
            if (!cancelled) setPinnedMessage(pinned)
          }).catch(() => {})
        }
      } catch (err) {
        console.error('[DmChat] init failed:', err)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [userId, myId])

  // ---- Real-time message subscription ----
  useEffect(() => {
    const unsub = subscribeToMessages((msg: BackendMessage) => {
      if (msg.conversation_id !== convIdRef.current) return
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, toDisplay(msg)]
      })
      // Auto mark-read for incoming messages
      if (msg.sender_id !== myId && convIdRef.current) {
        markConversationRead(convIdRef.current, msg.id).catch(() => {})
      }
    })
    return unsub
  }, [myId])

  // ---- Message edit subscription ----
  useEffect(() => {
    const unsub = subscribeToMessageEdits((evt: MessageEditedEvent) => {
      if (evt.conversation_id !== convIdRef.current) return
      setMessages(prev =>
        prev.map(m =>
          m.id === evt.msg_id
            ? { ...m, text: evt.new_text, isEdited: true, editedAt: evt.edited_at }
            : m
        )
      )
    })
    return unsub
  }, [])

  // ---- Message delete subscription ----
  useEffect(() => {
    const unsub = subscribeToMessageDeletes((evt: MessageDeletedEvent) => {
      if (evt.conversation_id !== convIdRef.current) return
      setMessages(prev =>
        prev.map(m =>
          m.id === evt.msg_id ? { ...m, isDeleted: true, text: '' } : m
        )
      )
    })
    return unsub
  }, [])

  // ---- Typing subscription ----
  useEffect(() => {
    const unsub = subscribeToTyping((evt: TypingEvent) => {
      if (evt.conversation_id !== convIdRef.current) return
      if (evt.user_id === myId) return
      setTypingUsers(prev => {
        const next = new Set(prev)
        if (evt.is_typing) {
          next.add(evt.user_id)
        } else {
          next.delete(evt.user_id)
        }
        return next
      })
      // Auto-clear typing after 3s
      if (evt.is_typing) {
        setTimeout(() => {
          setTypingUsers(prev => {
            const next = new Set(prev)
            next.delete(evt.user_id)
            return next
          })
        }, 3000)
      }
    })
    return unsub
  }, [myId])

  // ---- Read receipt subscription ----
  useEffect(() => {
    const unsub = subscribeToReadReceipts((evt: ReadReceiptEvent) => {
      if (evt.conversation_id !== convIdRef.current) return
      if (evt.user_id === myId) return
      setReadReceipts(prev => {
        const next = new Map(prev)
        const readers = next.get(evt.message_id) || []
        if (!readers.includes(evt.user_id)) {
          next.set(evt.message_id, [...readers, evt.user_id])
        }
        return next
      })
    })
    return unsub
  }, [myId])

  // ---- Reaction subscription ----
  useEffect(() => {
    const unsub = subscribeToReactions((evt: ReactionUpdate) => {
      if (evt.conversation_id !== convIdRef.current) return
      setMessages(prev =>
        prev.map(m => {
          if (m.id !== evt.message_id) return m
          const reactions = [...(m.reactions || [])]
          const idx = reactions.findIndex(r => r.emoji === evt.emoji)
          if (evt.added) {
            if (idx >= 0) {
              if (!reactions[idx].user_ids.includes(evt.user_id)) {
                reactions[idx] = { ...reactions[idx], user_ids: [...reactions[idx].user_ids, evt.user_id] }
              }
            } else {
              reactions.push({ emoji: evt.emoji, user_ids: [evt.user_id] })
            }
          } else {
            if (idx >= 0) {
              const filtered = reactions[idx].user_ids.filter(id => id !== evt.user_id)
              if (filtered.length === 0) {
                reactions.splice(idx, 1)
              } else {
                reactions[idx] = { ...reactions[idx], user_ids: filtered }
              }
            }
          }
          return { ...m, reactions }
        })
      )
    })
    return unsub
  }, [])

  // ---- Pin update subscription ----
  useEffect(() => {
    const unsub = subscribeToPinUpdates((evt: PinUpdateEvent) => {
      if (evt.conversation_id !== convIdRef.current) return
      if (evt.action === 'unpin') {
        setPinnedMessage(null)
      } else if (convIdRef.current) {
        getPinnedMessage(convIdRef.current).then(pinned => setPinnedMessage(pinned))
      }
    })
    return unsub
  }, [])

  // ---- Close context menu on click outside ----
  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu])

  // ---- Focus edit input when entering edit mode ----
  useEffect(() => {
    if (editingMsgId && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [editingMsgId])

  // ---- Typing indicator (debounced) ----
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    const now = Date.now()
    if (convIdRef.current && now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now
      sendTypingIndicator(convIdRef.current).catch(() => {})
    }
  }, [])

  // ---- Send handler ----
  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || !convIdRef.current) return

    const optimisticId = `opt-${Date.now()}`
    const optimistic: DisplayMessage = {
      id: optimisticId,
      senderId: myId,
      text,
      time: formatTime(new Date().toISOString()),
      ts: new Date().toISOString(),
      type: 'text',
      replyToId: replyingTo?.id,
    }

    setMessages(prev => [...prev, optimistic])
    setInput('')
    setReplyingTo(null)

    try {
      let res
      if (replyingTo) {
        res = await replyToMessage(convIdRef.current!, replyingTo.id, text)
      } else {
        res = await sendMessage(convIdRef.current!, text)
      }
      const real = res.data as BackendMessage
      setMessages(prev =>
        prev.map(m => (m.id === optimisticId ? toDisplay(real) : m)),
      )
    } catch (err) {
      console.error('[DmChat] send failed:', err)
    }
  }, [input, myId, replyingTo])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (editingMsgId) {
        handleSaveEdit()
      } else {
        handleSend()
      }
    }
    if (e.key === 'Escape') {
      if (editingMsgId) {
        setEditingMsgId(null)
        setEditText('')
      }
      if (replyingTo) {
        setReplyingTo(null)
      }
    }
  }

  // ---- Edit handlers ----
  const handleEditStart = useCallback((msg: DisplayMessage) => {
    setEditingMsgId(msg.id)
    setEditText(msg.text)
    setContextMenu(null)
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!editingMsgId || !convIdRef.current) return
    const msg = messages.find(m => m.id === editingMsgId)
    if (!msg) return
    const newText = editText.trim()
    if (!newText || newText === msg.text) {
      setEditingMsgId(null)
      setEditText('')
      return
    }
    try {
      await editMessage(convIdRef.current, editingMsgId, newText, msg.ts)
      setMessages(prev =>
        prev.map(m =>
          m.id === editingMsgId
            ? { ...m, text: newText, isEdited: true, editedAt: new Date().toISOString() }
            : m
        )
      )
    } catch (err) {
      console.error('[DmChat] edit failed:', err)
    }
    setEditingMsgId(null)
    setEditText('')
  }, [editingMsgId, editText, messages])

  // ---- Delete handler ----
  const handleDelete = useCallback(async (msgId: string) => {
    if (!convIdRef.current) return
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return
    try {
      await deleteMessage(convIdRef.current, msgId, msg.ts)
      setMessages(prev =>
        prev.map(m => (m.id === msgId ? { ...m, isDeleted: true, text: '' } : m))
      )
    } catch (err) {
      console.error('[DmChat] delete failed:', err)
    }
    setContextMenu(null)
  }, [messages])

  // ---- Reaction handler ----
  const handleToggleReaction = useCallback(async (msgId: string, emoji: string) => {
    if (!convIdRef.current) return
    try {
      await toggleReaction(convIdRef.current, msgId, emoji)
    } catch (err) {
      console.error('[DmChat] reaction failed:', err)
    }
    setContextMenu(null)
  }, [])

  // ---- Reply handler ----
  const handleReply = useCallback((msg: DisplayMessage) => {
    setReplyingTo(msg)
    setContextMenu(null)
    inputRef.current?.focus()
  }, [])

  // ---- Pin handler ----
  const handlePinMessage = useCallback(async (msgId: string) => {
    if (!convIdRef.current) return
    try {
      await pinMessage(convIdRef.current, msgId)
      const pinned = await getPinnedMessage(convIdRef.current)
      setPinnedMessage(pinned)
    } catch (err) {
      console.error('[DmChat] pin failed:', err)
    }
    setContextMenu(null)
  }, [])

  // ---- Unpin handler ----
  const handleUnpinMessage = useCallback(async () => {
    if (!convIdRef.current) return
    try {
      await unpinMessage(convIdRef.current)
      setPinnedMessage(null)
    } catch (err) {
      console.error('[DmChat] unpin failed:', err)
    }
  }, [])

  // ---- Scroll to message ----
  const scrollToMessage = useCallback((msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.style.background = 'rgba(99,102,241,0.15)'
      setTimeout(() => { el.style.background = '' }, 1500)
    }
  }, [])

  // ---- Context menu ----
  const handleContextMenu = useCallback((e: React.MouseEvent, msg: DisplayMessage) => {
    e.preventDefault()
    if (msg.isDeleted) return
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      messageId: msg.id,
      senderId: msg.senderId,
      ts: msg.ts,
    })
  }, [])

  // ---- Media upload handler ----
  const handleMediaUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !convIdRef.current) return

    try {
      // Upload via media service proxy
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      })
      const uploadJson = await uploadRes.json()
      const mediaId = uploadJson.data?.id || uploadJson.id

      if (!mediaId) throw new Error('Upload failed')

      let messageType = 'file'
      if (file.type.startsWith('image/')) messageType = 'image'
      else if (file.type.startsWith('video/')) messageType = 'video'
      else if (file.type.startsWith('audio/')) messageType = 'audio'

      await sendMediaMessage(convIdRef.current, mediaId, messageType)
    } catch (err) {
      console.error('[DmChat] media upload failed:', err)
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  // ---- Determine status text ----
  const statusText = useMemo(() => {
    if (typingUsers.size > 0) return 'typing...'
    if (userOnline) return 'Active now'
    if (userLastSeen) return `Last seen ${userLastSeen}`
    return 'Offline'
  }, [userOnline, userLastSeen, typingUsers])

  // ---- Message grouping helpers ----
  const isGroupStart = (i: number) =>
    i === 0 || messages[i].senderId !== messages[i - 1].senderId

  const isGroupEnd = (i: number) =>
    i === messages.length - 1 || messages[i].senderId !== messages[i + 1].senderId

  // Find the last message sent by me for read receipt display
  const lastSentMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === myId && !messages[i].isDeleted) return messages[i].id
    }
    return null
  }, [messages, myId])

  // Find reply target message
  const findMessage = useCallback((msgId: string) => {
    return messages.find(m => m.id === msgId)
  }, [messages])

  const hasText = input.trim().length > 0

  // ========================================================================
  // Render
  // ========================================================================
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0d0d1a',
        fontFamily: "'Outfit', sans-serif",
        color: '#E5E7EB',
        position: 'relative',
      }}
    >
      {/* ---- Header ---- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          gap: 10,
        }}
      >
        <button
          onClick={onBack}
          onMouseEnter={() => setBackHover(true)}
          onMouseLeave={() => setBackHover(false)}
          style={{
            background: backHover ? 'rgba(255,255,255,0.06)' : 'transparent',
            border: 'none',
            color: '#9CA3AF',
            fontSize: 18,
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            transition: 'background 0.15s',
          }}
        >
          &#8592;
        </button>

        <Avatar
          user={{ id: userId, name: userName, avatar: userAvatar, isOnline: userOnline }}
          size={36}
          showStatus
          avatarUrl={userAvatar && (userAvatar.startsWith('http') || userAvatar.startsWith('/')) ? userAvatar : null}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#F3F4F6',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {userName}
          </div>
          <div style={{ fontSize: 11, color: typingUsers.size > 0 ? '#6366F1' : userOnline ? '#22C55E' : '#6B7280' }}>
            {statusText}
          </div>
        </div>

        {[
          { label: '\uD83D\uDCDE', title: 'Voice call' },
          { label: '\uD83D\uDCF9', title: 'Video call' },
          { label: '\u22EF', title: 'More' },
        ].map((btn, i) => (
          <ActionIcon key={i} label={btn.label} title={btn.title} />
        ))}
      </div>

      {/* ---- Pinned message banner ---- */}
      {pinnedMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 16px',
            background: 'rgba(99,102,241,0.06)',
            borderBottom: '1px solid rgba(99,102,241,0.12)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          onClick={() => scrollToMessage(pinnedMessage.message_id)}
        >
          {/* Pin icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pinned Message
            </div>
            <div style={{ fontSize: 12, color: '#D1D5DB', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {pinnedMessage.message?.text || 'Click to view'}
            </div>
          </div>
          {/* Unpin button */}
          <button
            onClick={(e) => { e.stopPropagation(); handleUnpinMessage() }}
            title="Unpin message"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6B7280',
              cursor: 'pointer',
              fontSize: 14,
              padding: '2px 6px',
              borderRadius: 6,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            ✕
          </button>
        </div>
      )}

      {/* ---- Messages area ---- */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {loading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              color: '#6B7280',
              fontSize: 13,
            }}
          >
            Loading...
          </div>
        )}

        {error && !loading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              color: '#EF4444',
              fontSize: 12,
              opacity: 0.7,
            }}
          >
            Could not load messages
          </div>
        )}

        {!loading &&
          messages.map((msg, i) => {
            // ---- System message styling ----
            if (msg.type === 'system') {
              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '8px 0',
                    transition: 'background 0.3s',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: '#6B7280',
                      background: 'rgba(255,255,255,0.04)',
                      padding: '4px 14px',
                      borderRadius: 12,
                      fontStyle: 'italic',
                    }}
                  >
                    {msg.text || 'System message'}
                  </span>
                </div>
              )
            }

            const isMe = msg.senderId === myId
            const groupStart = isGroupStart(i)
            const groupEnd = isGroupEnd(i)
            const replyTarget = msg.replyToId ? findMessage(msg.replyToId) : null

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                style={{
                  display: 'flex',
                  flexDirection: isMe ? 'row-reverse' : 'row',
                  alignItems: 'flex-end',
                  gap: 8,
                  marginTop: groupStart ? 10 : 1,
                  animation: 'fadeSlide 0.2s ease',
                  transition: 'background 0.3s',
                }}
                onContextMenu={(e) => handleContextMenu(e, msg)}
              >
                {/* Avatar */}
                {!isMe ? (
                  groupEnd ? (
                    <Avatar
                      user={{ id: userId, name: userName, avatar: userAvatar }}
                      size={28}
                      avatarUrl={userAvatar && (userAvatar.startsWith('http') || userAvatar.startsWith('/')) ? userAvatar : null}
                    />
                  ) : (
                    <div style={{ width: 28, flexShrink: 0 }} />
                  )
                ) : null}

                {/* Bubble */}
                <div
                  style={{
                    maxWidth: '70%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start',
                  }}
                >
                  {/* Forwarded label */}
                  {msg.forwardedFromId && !msg.isDeleted && (
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 2, fontStyle: 'italic' }}>
                      Forwarded
                    </div>
                  )}

                  {/* Reply preview */}
                  {replyTarget && !msg.isDeleted && (
                    <div
                      style={{
                        fontSize: 11,
                        color: '#9CA3AF',
                        padding: '4px 10px',
                        borderLeft: '2px solid #6366F1',
                        background: 'rgba(99,102,241,0.08)',
                        borderRadius: '0 8px 8px 0',
                        marginBottom: 2,
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {replyTarget.isDeleted ? 'This message was deleted' : replyTarget.text}
                    </div>
                  )}

                  {/* Message bubble */}
                  <div
                    style={{
                      padding: msg.isDeleted ? '8px 14px' : '8px 14px',
                      fontSize: 13,
                      lineHeight: 1.45,
                      color: msg.isDeleted ? '#6B7280' : '#F3F4F6',
                      fontStyle: msg.isDeleted ? 'italic' : 'normal',
                      background: msg.isDeleted
                        ? 'rgba(255,255,255,0.03)'
                        : isMe
                          ? 'linear-gradient(135deg, #6366F1, #7C3AED)'
                          : 'rgba(255,255,255,0.07)',
                      borderRadius: isMe
                        ? groupEnd
                          ? '18px 18px 4px 18px'
                          : '18px 18px 18px 18px'
                        : groupEnd
                          ? '18px 18px 18px 4px'
                          : '18px 18px 18px 18px',
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.isDeleted ? (
                      'This message was deleted'
                    ) : msg.type === 'image' && msg.mediaId ? (
                      <img
                        src={`/api/media/${msg.mediaId}/serve`}
                        alt="Image"
                        style={{ maxWidth: '100%', borderRadius: 12, display: 'block' }}
                      />
                    ) : msg.type === 'video' && msg.mediaId ? (
                      <video
                        src={`/api/media/${msg.mediaId}/serve`}
                        controls
                        style={{ maxWidth: '100%', borderRadius: 12, display: 'block' }}
                      />
                    ) : msg.type === 'audio' && msg.mediaId ? (
                      <audio src={`/api/media/${msg.mediaId}/serve`} controls style={{ maxWidth: '100%' }} />
                    ) : msg.type === 'file' && msg.mediaId ? (
                      <a
                        href={`/api/media/${msg.mediaId}/serve`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#A5B4FC', textDecoration: 'underline' }}
                      >
                        📎 Attachment
                      </a>
                    ) : (
                      msg.text
                    )}
                  </div>

                  {/* Edited indicator */}
                  {msg.isEdited && !msg.isDeleted && (
                    <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>
                      (edited)
                    </div>
                  )}

                  {/* Reactions row */}
                  {msg.reactions && msg.reactions.length > 0 && !msg.isDeleted && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {msg.reactions.map(r => (
                        <button
                          key={r.emoji}
                          onClick={() => handleToggleReaction(msg.id, r.emoji)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '2px 8px',
                            borderRadius: 12,
                            border: r.user_ids.includes(myId)
                              ? '1px solid rgba(99,102,241,0.5)'
                              : '1px solid rgba(255,255,255,0.1)',
                            background: r.user_ids.includes(myId)
                              ? 'rgba(99,102,241,0.15)'
                              : 'rgba(255,255,255,0.05)',
                            fontSize: 12,
                            cursor: 'pointer',
                            color: '#E5E7EB',
                          }}
                        >
                          <span>{r.emoji}</span>
                          <span style={{ fontSize: 10, color: '#9CA3AF' }}>{r.user_ids.length}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Time + read receipt */}
                  {groupEnd && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10,
                        color: '#6B7280',
                        marginTop: 3,
                        paddingLeft: isMe ? 0 : 2,
                        paddingRight: isMe ? 2 : 0,
                      }}
                    >
                      {msg.time}
                      {isMe && msg.id === lastSentMsgId && readReceipts.has(msg.id) && (
                        <span style={{ color: '#6366F1' }}>Seen</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

        <div ref={bottomRef} />
      </div>

      {/* ---- Context Menu (floating) ---- */}
      {contextMenu?.visible && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: '#1a1a2e',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: 6,
            zIndex: 1000,
            minWidth: 160,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick emoji row */}
          <div style={{ display: 'flex', gap: 4, padding: '4px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 4 }}>
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleToggleReaction(contextMenu.messageId, emoji)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 18,
                  cursor: 'pointer',
                  padding: '2px 4px',
                  borderRadius: 6,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Action items */}
          <ContextMenuItem
            label="Reply"
            onClick={() => {
              const msg = messages.find(m => m.id === contextMenu.messageId)
              if (msg) handleReply(msg)
            }}
          />
          <ContextMenuItem
            label={pinnedMessage?.message_id === contextMenu.messageId ? 'Unpin' : 'Pin'}
            onClick={() => {
              if (pinnedMessage?.message_id === contextMenu.messageId) {
                handleUnpinMessage()
              } else {
                handlePinMessage(contextMenu.messageId)
              }
            }}
          />
          {contextMenu.senderId === myId && (
            <>
              <ContextMenuItem
                label="Edit"
                onClick={() => {
                  const msg = messages.find(m => m.id === contextMenu.messageId)
                  if (msg) handleEditStart(msg)
                }}
              />
              <ContextMenuItem
                label="Delete"
                danger
                onClick={() => handleDelete(contextMenu.messageId)}
              />
            </>
          )}
        </div>
      )}

      {/* ---- Reply bar ---- */}
      {replyingTo && (
        <div
          style={{
            padding: '6px 14px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(99,102,241,0.06)',
          }}
        >
          <div
            style={{
              flex: 1,
              fontSize: 12,
              color: '#9CA3AF',
              borderLeft: '2px solid #6366F1',
              paddingLeft: 8,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ color: '#A5B4FC' }}>Replying to </span>
            {replyingTo.senderId === myId ? 'yourself' : userName}
            <span style={{ color: '#6B7280', marginLeft: 6 }}>
              {replyingTo.text.slice(0, 50)}{replyingTo.text.length > 50 ? '...' : ''}
            </span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6B7280',
              cursor: 'pointer',
              fontSize: 14,
              padding: '2px 6px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ---- Edit bar (replaces input when editing) ---- */}
      {editingMsgId ? (
        <div
          style={{
            padding: '8px 14px 14px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(99,102,241,0.04)',
          }}
        >
          <input
            ref={editInputRef}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Edit message..."
            style={{
              flex: 1,
              height: 38,
              borderRadius: 20,
              border: '1px solid rgba(99,102,241,0.4)',
              background: 'rgba(255,255,255,0.04)',
              color: '#E5E7EB',
              fontSize: 13,
              padding: '0 16px',
              outline: 'none',
              fontFamily: "'Outfit', sans-serif",
            }}
          />
          <button
            onClick={handleSaveEdit}
            style={{
              padding: '6px 16px',
              borderRadius: 16,
              border: 'none',
              background: 'linear-gradient(135deg, #6366F1, #7C3AED)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Save
          </button>
          <button
            onClick={() => { setEditingMsgId(null); setEditText('') }}
            style={{
              padding: '6px 12px',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: '#9CA3AF',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        /* ---- Input area ---- */
        <div
          style={{
            padding: '8px 14px 14px',
            borderTop: replyingTo ? 'none' : '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* + button (media upload) */}
          <button
            onMouseEnter={() => setPlusHover(true)}
            onMouseLeave={() => setPlusHover(false)}
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              border: 'none',
              background: plusHover ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
              color: '#9CA3AF',
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
            title="Upload media"
          >
            ＋
          </button>

          {/* Paperclip attachment button */}
          <button
            onMouseEnter={() => setAttachHover(true)}
            onMouseLeave={() => setAttachHover(false)}
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              border: 'none',
              background: attachHover ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: attachHover ? '#A5B4FC' : '#6B7280',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip"
            onChange={handleMediaUpload}
            style={{ display: 'none' }}
          />

          {/* Text input */}
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setInputHover(true)}
            onBlur={() => setInputHover(false)}
            placeholder={`Message ${userName.split(' ')[0]}...`}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 20,
              border: inputHover
                ? '1px solid rgba(99,102,241,0.4)'
                : '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: '#E5E7EB',
              fontSize: 13,
              padding: '0 16px',
              outline: 'none',
              fontFamily: "'Outfit', sans-serif",
              transition: 'border 0.15s',
            }}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!hasText}
            onMouseEnter={() => setSendHover(true)}
            onMouseLeave={() => setSendHover(false)}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: 'none',
              background: hasText
                ? sendHover
                  ? 'linear-gradient(135deg, #4F46E5, #6D28D9)'
                  : 'linear-gradient(135deg, #6366F1, #7C3AED)'
                : 'rgba(255,255,255,0.06)',
              color: hasText ? '#fff' : '#4B5563',
              fontSize: 16,
              cursor: hasText ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            ↑
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small sub-components
// ---------------------------------------------------------------------------
function ActionIcon({ label, title }: { label: string; title: string }) {
  const [hover, setHover] = useState(false)

  return (
    <button
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: 'none',
        background: hover ? 'rgba(255,255,255,0.08)' : 'transparent',
        color: '#9CA3AF',
        fontSize: 16,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function ContextMenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  const [hover, setHover] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '7px 12px',
        border: 'none',
        borderRadius: 8,
        background: hover ? 'rgba(255,255,255,0.06)' : 'transparent',
        color: danger ? '#EF4444' : '#E5E7EB',
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: "'Outfit', sans-serif",
        transition: 'background 0.15s',
      }}
    >
      {label}
    </button>
  )
}
