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
import {
  ArrowLeft, Phone, Video, MoreVertical, Plus, Paperclip,
  Send, Pin, Reply, Pencil, Trash2, X, Check, Loader2, Image
} from 'lucide-react'

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

const QUICK_EMOJIS = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDE22', '\uD83D\uDD25']

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
  } catch { return '' }
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
export default function DmChat({ userId, userName, userAvatar, userOnline, userLastSeen, onBack }: DmChatProps) {
  const currentUser = getSession()
  const myId = currentUser?.id ?? ''

  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [replyingTo, setReplyingTo] = useState<DisplayMessage | null>(null)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [readReceipts, setReadReceipts] = useState<Map<string, string[]>>(new Map())
  const [pinnedMessage, setPinnedMessage] = useState<PinnedMessage | null>(null)

  const convIdRef = useRef<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const editInputRef = useRef<HTMLInputElement | null>(null)
  const lastTypingSentRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  // Init conversation & load messages
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
          if (displayed.length > 0) {
            markConversationRead(conversationId, displayed[displayed.length - 1].id).catch(() => { })
          }
          getPinnedMessage(conversationId).then(pinned => {
            if (!cancelled) setPinnedMessage(pinned)
          }).catch(() => { })
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

  // Real-time subscriptions
  useEffect(() => {
    const unsub = subscribeToMessages((msg: BackendMessage) => {
      if (msg.conversation_id !== convIdRef.current) return
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, toDisplay(msg)]
      })
      if (msg.sender_id !== myId && convIdRef.current) {
        markConversationRead(convIdRef.current, msg.id).catch(() => { })
      }
    })
    return unsub
  }, [myId])

  useEffect(() => {
    const unsub = subscribeToMessageEdits((evt: MessageEditedEvent) => {
      if (evt.conversation_id !== convIdRef.current) return
      setMessages(prev => prev.map(m =>
        m.id === evt.msg_id ? { ...m, text: evt.new_text, isEdited: true, editedAt: evt.edited_at } : m
      ))
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeToMessageDeletes((evt: MessageDeletedEvent) => {
      if (evt.conversation_id !== convIdRef.current) return
      setMessages(prev => prev.map(m =>
        m.id === evt.msg_id ? { ...m, isDeleted: true, text: '' } : m
      ))
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeToTyping((evt: TypingEvent) => {
      if (evt.conversation_id !== convIdRef.current || evt.user_id === myId) return
      setTypingUsers(prev => {
        const next = new Set(prev)
        if (evt.is_typing) next.add(evt.user_id)
        else next.delete(evt.user_id)
        return next
      })
      if (evt.is_typing) {
        setTimeout(() => {
          setTypingUsers(prev => { const next = new Set(prev); next.delete(evt.user_id); return next })
        }, 3000)
      }
    })
    return unsub
  }, [myId])

  useEffect(() => {
    const unsub = subscribeToReadReceipts((evt: ReadReceiptEvent) => {
      if (evt.conversation_id !== convIdRef.current || evt.user_id === myId) return
      setReadReceipts(prev => {
        const next = new Map(prev)
        const readers = next.get(evt.message_id) || []
        if (!readers.includes(evt.user_id)) next.set(evt.message_id, [...readers, evt.user_id])
        return next
      })
    })
    return unsub
  }, [myId])

  useEffect(() => {
    const unsub = subscribeToReactions((evt: ReactionUpdate) => {
      if (evt.conversation_id !== convIdRef.current) return
      setMessages(prev => prev.map(m => {
        if (m.id !== evt.message_id) return m
        const reactions = [...(m.reactions || [])]
        const idx = reactions.findIndex(r => r.emoji === evt.emoji)
        if (evt.added) {
          if (idx >= 0) {
            if (!reactions[idx].user_ids.includes(evt.user_id))
              reactions[idx] = { ...reactions[idx], user_ids: [...reactions[idx].user_ids, evt.user_id] }
          } else reactions.push({ emoji: evt.emoji, user_ids: [evt.user_id] })
        } else if (idx >= 0) {
          const filtered = reactions[idx].user_ids.filter(id => id !== evt.user_id)
          if (filtered.length === 0) reactions.splice(idx, 1)
          else reactions[idx] = { ...reactions[idx], user_ids: filtered }
        }
        return { ...m, reactions }
      }))
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeToPinUpdates((evt: PinUpdateEvent) => {
      if (evt.conversation_id !== convIdRef.current) return
      if (evt.action === 'unpin') setPinnedMessage(null)
      else if (convIdRef.current) getPinnedMessage(convIdRef.current).then(pinned => setPinnedMessage(pinned))
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu])

  useEffect(() => {
    if (editingMsgId && editInputRef.current) editInputRef.current.focus()
  }, [editingMsgId])

  // Handlers
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    const now = Date.now()
    if (convIdRef.current && now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now
      sendTypingIndicator(convIdRef.current).catch(() => { })
    }
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || !convIdRef.current) return
    const optimisticId = `opt-${Date.now()}`
    const optimistic: DisplayMessage = {
      id: optimisticId, senderId: myId, text,
      time: formatTime(new Date().toISOString()),
      ts: new Date().toISOString(), type: 'text', replyToId: replyingTo?.id,
    }
    setMessages(prev => [...prev, optimistic])
    setInput('')
    setReplyingTo(null)
    try {
      let res
      if (replyingTo) res = await replyToMessage(convIdRef.current!, replyingTo.id, text)
      else res = await sendMessage(convIdRef.current!, text)
      const real = res.data as BackendMessage
      setMessages(prev => prev.map(m => (m.id === optimisticId ? toDisplay(real) : m)))
    } catch (err) { console.error('[DmChat] send failed:', err) }
  }, [input, myId, replyingTo])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      editingMsgId ? handleSaveEdit() : handleSend()
    }
    if (e.key === 'Escape') {
      if (editingMsgId) { setEditingMsgId(null); setEditText('') }
      if (replyingTo) setReplyingTo(null)
    }
  }

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
    if (!newText || newText === msg.text) { setEditingMsgId(null); setEditText(''); return }
    try {
      await editMessage(convIdRef.current, editingMsgId, newText, msg.ts)
      setMessages(prev => prev.map(m =>
        m.id === editingMsgId ? { ...m, text: newText, isEdited: true, editedAt: new Date().toISOString() } : m
      ))
    } catch (err) { console.error('[DmChat] edit failed:', err) }
    setEditingMsgId(null)
    setEditText('')
  }, [editingMsgId, editText, messages])

  const handleDelete = useCallback(async (msgId: string) => {
    if (!convIdRef.current) return
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return
    try {
      await deleteMessage(convIdRef.current, msgId, msg.ts)
      setMessages(prev => prev.map(m => (m.id === msgId ? { ...m, isDeleted: true, text: '' } : m)))
    } catch (err) { console.error('[DmChat] delete failed:', err) }
    setContextMenu(null)
  }, [messages])

  const handleToggleReaction = useCallback(async (msgId: string, emoji: string) => {
    if (!convIdRef.current) return
    try { await toggleReaction(convIdRef.current, msgId, emoji) }
    catch (err) { console.error('[DmChat] reaction failed:', err) }
    setContextMenu(null)
  }, [])

  const handleReply = useCallback((msg: DisplayMessage) => {
    setReplyingTo(msg)
    setContextMenu(null)
    inputRef.current?.focus()
  }, [])

  const handlePinMessage = useCallback(async (msgId: string) => {
    if (!convIdRef.current) return
    try {
      await pinMessage(convIdRef.current, msgId)
      const pinned = await getPinnedMessage(convIdRef.current)
      setPinnedMessage(pinned)
    } catch (err) { console.error('[DmChat] pin failed:', err) }
    setContextMenu(null)
  }, [])

  const handleUnpinMessage = useCallback(async () => {
    if (!convIdRef.current) return
    try { await unpinMessage(convIdRef.current); setPinnedMessage(null) }
    catch (err) { console.error('[DmChat] unpin failed:', err) }
  }, [])

  const scrollToMessage = useCallback((msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('bg-brand-text/5')
      setTimeout(() => el.classList.remove('bg-brand-text/5'), 1500)
    }
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, msg: DisplayMessage) => {
    e.preventDefault()
    if (msg.isDeleted) return
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, messageId: msg.id, senderId: msg.senderId, ts: msg.ts })
  }, [])

  const handleMediaUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !convIdRef.current) return
    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/media/upload', { method: 'POST', body: formData })
      const uploadJson = await uploadRes.json()
      const mediaId = uploadJson.data?.id || uploadJson.id
      if (!mediaId) throw new Error('Upload failed')
      let messageType = 'file'
      if (file.type.startsWith('image/')) messageType = 'image'
      else if (file.type.startsWith('video/')) messageType = 'video'
      else if (file.type.startsWith('audio/')) messageType = 'audio'
      await sendMediaMessage(convIdRef.current, mediaId, messageType)
    } catch (err) { console.error('[DmChat] media upload failed:', err) }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const statusText = useMemo(() => {
    if (typingUsers.size > 0) return 'typing...'
    if (userOnline) return 'Active now'
    if (userLastSeen) return `Last seen ${userLastSeen}`
    return 'Offline'
  }, [userOnline, userLastSeen, typingUsers])

  const isGroupStart = (i: number) => i === 0 || messages[i].senderId !== messages[i - 1].senderId
  const isGroupEnd = (i: number) => i === messages.length - 1 || messages[i].senderId !== messages[i + 1].senderId

  const lastSentMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === myId && !messages[i].isDeleted) return messages[i].id
    }
    return null
  }, [messages, myId])

  const findMessage = useCallback((msgId: string) => messages.find(m => m.id === msgId), [messages])
  const hasText = input.trim().length > 0

  // ========================================================================
  // Render
  // ========================================================================
  return (
    <div className="flex flex-col h-full bg-brand-card relative">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-brand-divider bg-brand-card/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="group flex h-9 w-9 items-center justify-center rounded-full bg-brand-secondary text-brand-text/60 transition-all hover:bg-brand-secondary hover:text-brand-text active:scale-95"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          </button>

          <div className="relative">
            <Avatar
              user={{ id: userId, name: userName, avatar: userAvatar, isOnline: userOnline }}
              size={44}
              showStatus
              avatarUrl={userAvatar && (userAvatar.startsWith('http') || userAvatar.startsWith('/')) ? userAvatar : null}
            />
          </div>

          <div className="flex shrink-0 flex-col">
            <h3 className="text-[16px] font-extrabold tracking-tight text-brand-text">{userName}</h3>
            <p className={`text-[12px] font-semibold tracking-wide ${typingUsers.size > 0 ? 'text-indigo-500' : userOnline ? 'text-emerald-500' : 'text-brand-text/60'
              }`}>
              {statusText}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {[
            { icon: <Phone className="h-4 w-4" />, title: 'Voice call' },
            { icon: <Video className="h-4 w-4" />, title: 'Video call' },
            { icon: <MoreVertical className="h-4 w-4" />, title: 'More' },
          ].map((btn, i) => (
            <button
              key={i}
              title={btn.title}
              className="flex h-10 w-10 items-center justify-center rounded-full text-brand-text/60 transition-all hover:bg-brand-secondary hover:text-brand-text active:scale-95"
            >
              {btn.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Pinned message banner */}
      {pinnedMessage && (
        <div
          onClick={() => scrollToMessage(pinnedMessage.message_id)}
          className="flex items-center gap-3 px-5 py-2.5 bg-amber-50 border-b border-amber-100 cursor-pointer shrink-0 hover:bg-amber-50/80 transition-colors"
        >
          <Pin className="w-4 h-4 text-amber-500 shrink-0 rotate-45" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Pinned Message</p>
            <p className="text-[12px] text-brand-highlight truncate">{pinnedMessage.message?.text || 'Click to view'}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleUnpinMessage() }}
            className="w-6 h-6 rounded-md hover:bg-amber-100 flex items-center justify-center text-amber-400 hover:text-amber-600 transition-all shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0.5 bg-brand-secondary/50">
        {loading && (
          <div className="flex items-center justify-center flex-1 h-full">
            <div className="flex items-center gap-2 text-brand-text/60 text-[13px]">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading messages...
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center justify-center flex-1 h-full text-rose-400 text-[12px]">
            Could not load messages
          </div>
        )}

        {!loading && messages.map((msg, i) => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id} id={`msg-${msg.id}`} className="flex justify-center py-3 transition-colors">
                <span className="text-[11px] text-brand-text/60 bg-brand-card px-4 py-1.5 rounded-full shadow-sm border border-brand-divider italic">
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
              className={`flex items-end gap-2 transition-colors rounded-lg ${isMe ? 'flex-row-reverse' : ''} ${groupStart ? 'mt-3' : 'mt-0.5'}`}
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
                ) : <div className="w-7 shrink-0" />
              ) : null}

              {/* Bubble */}
              <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {/* Forwarded label */}
                {msg.forwardedFromId && !msg.isDeleted && (
                  <p className="text-[10px] text-brand-text/60 italic mb-0.5">Forwarded</p>
                )}

                {/* Reply preview */}
                {replyTarget && !msg.isDeleted && (
                  <div className="text-[11px] text-brand-text/60 px-3 py-1.5 border-l-2 border-brand-text bg-brand-text/5 rounded-r-lg mb-0.5 max-w-full truncate">
                    {replyTarget.isDeleted ? 'This message was deleted' : replyTarget.text}
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={`group/bubble relative max-w-full break-words px-4 py-2.5 text-[14px] leading-relaxed shadow-sm transition-all ${msg.isDeleted
                      ? 'rounded-2xl bg-brand-secondary text-brand-text/60 italic'
                      : isMe
                        ? `bg-indigo-600 text-white ${groupEnd ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl'}`
                        : `border border-brand-divider bg-brand-card text-brand-text ${groupEnd ? 'rounded-2xl rounded-bl-sm' : 'rounded-2xl'}`
                    }`}
                >
                  {msg.isDeleted ? (
                    'This message was deleted'
                  ) : msg.type === 'image' && msg.mediaId ? (
                    <img src={`/api/media/${msg.mediaId}/serve`} alt="Image" className="max-w-full rounded-xl" />
                  ) : msg.type === 'video' && msg.mediaId ? (
                    <video src={`/api/media/${msg.mediaId}/serve`} controls className="max-w-full rounded-xl" />
                  ) : msg.type === 'audio' && msg.mediaId ? (
                    <audio src={`/api/media/${msg.mediaId}/serve`} controls className="max-w-full" />
                  ) : msg.type === 'file' && msg.mediaId ? (
                    <a href={`/api/media/${msg.mediaId}/serve`} target="_blank" rel="noopener noreferrer"
                      className={`font-semibold underline underline-offset-2 ${isMe ? 'text-white/90 hover:text-white' : 'text-indigo-600 hover:text-indigo-700'}`}>
                      Attached File
                    </a>
                  ) : msg.text}
                </div>

                {/* Edited indicator */}
                {msg.isEdited && !msg.isDeleted && (
                  <p className="text-[10px] text-brand-text/30 mt-0.5">(edited)</p>
                )}

                {/* Reactions */}
                {msg.reactions && msg.reactions.length > 0 && !msg.isDeleted && (
                  <div className={`mt-1 flex flex-wrap gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {msg.reactions.map(r => (
                      <button
                        key={r.emoji}
                        onClick={() => handleToggleReaction(msg.id, r.emoji)}
                        className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold shadow-sm transition-all hover:scale-105 active:scale-95 ${r.user_ids.includes(myId)
                            ? 'border border-indigo-200 bg-indigo-50 text-indigo-700'
                            : 'border border-brand-divider bg-brand-card text-brand-highlight hover:bg-brand-secondary'
                          }`}
                      >
                        <span>{r.emoji}</span>
                        {r.user_ids.length > 1 && <span className="text-[10px] opacity-70">{r.user_ids.length}</span>}
                      </button>
                    ))}
                  </div>
                )}

                {/* Time + read receipt */}
                {groupEnd && (
                  <div className="mt-1.5 flex items-center gap-1.5 px-0.5 text-[11px] font-medium text-brand-text/60">
                    {msg.time}
                    {isMe && msg.id === lastSentMsgId && readReceipts.has(msg.id) && (
                      <span className="flex items-center gap-0.5 text-indigo-500">
                        <Check className="h-3.5 w-3.5" />
                        Seen
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* Context Menu */}
      {contextMenu?.visible && (
        <div
          className="fixed bg-brand-card rounded-xl border border-brand-divider shadow-xl p-1.5 z-50 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick emoji row */}
          <div className="flex gap-1 px-1.5 py-1.5 border-b border-brand-divider mb-1">
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleToggleReaction(contextMenu.messageId, emoji)}
                className="text-lg px-1.5 py-0.5 rounded-md hover:bg-brand-secondary transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>

          <button
            onClick={() => { const msg = messages.find(m => m.id === contextMenu.messageId); if (msg) handleReply(msg) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-brand-highlight hover:bg-brand-secondary transition-colors text-left"
          >
            <Reply className="w-4 h-4 text-brand-text/60" /> Reply
          </button>
          <button
            onClick={() => {
              if (pinnedMessage?.message_id === contextMenu.messageId) handleUnpinMessage()
              else handlePinMessage(contextMenu.messageId)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-brand-highlight hover:bg-brand-secondary transition-colors text-left"
          >
            <Pin className="w-4 h-4 text-brand-text/60" />
            {pinnedMessage?.message_id === contextMenu.messageId ? 'Unpin' : 'Pin'}
          </button>
          {contextMenu.senderId === myId && (
            <>
              <button
                onClick={() => { const msg = messages.find(m => m.id === contextMenu.messageId); if (msg) handleEditStart(msg) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-brand-highlight hover:bg-brand-secondary transition-colors text-left"
              >
                <Pencil className="w-4 h-4 text-brand-text/60" /> Edit
              </button>
              <button
                onClick={() => handleDelete(contextMenu.messageId)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-rose-500 hover:bg-rose-50 transition-colors text-left"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* Reply bar */}
      {replyingTo && (
        <div className="flex shrink-0 items-center justify-between border-t border-brand-divider bg-brand-secondary/80 px-6 py-3 backdrop-blur-md">
          <div className="flex flex-1 flex-col border-l-[3px] border-indigo-500 pl-3">
            <span className="text-[12px] font-bold text-indigo-600">
              Replying to {replyingTo.senderId === myId ? 'yourself' : userName}
            </span>
            <span className="truncate text-[13px] text-brand-highlight">
              {replyingTo.text}
            </span>
          </div>
          <button onClick={() => setReplyingTo(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-brand-text/60 transition-all hover:bg-brand-secondary/80 hover:text-brand-highlight">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Edit bar */}
      {editingMsgId ? (
        <div className="flex shrink-0 items-center gap-3 border-t border-brand-divider bg-brand-card px-6 py-4">
          <input
            ref={editInputRef}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Edit message..."
            className="flex-1 rounded-2xl border border-transparent bg-brand-secondary px-5 py-3 text-[14px] text-brand-text outline-none transition-all placeholder:text-brand-text/60 focus:border-brand-divider focus:bg-brand-card focus:ring-4 focus:ring-brand-divider/50"
          />
          <button onClick={handleSaveEdit} className="flex h-11 items-center justify-center rounded-2xl bg-indigo-600 px-6 font-bold text-white transition-all hover:bg-indigo-700 active:scale-95">
            Save
          </button>
          <button onClick={() => { setEditingMsgId(null); setEditText('') }} className="flex h-11 items-center justify-center rounded-2xl bg-brand-secondary px-5 font-bold text-brand-highlight transition-all hover:bg-brand-secondary/80 active:scale-95">
            Cancel
          </button>
        </div>
      ) : (
        /* Input area */
        <div className="flex shrink-0 items-center gap-3 border-t border-brand-divider bg-brand-card px-6 py-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-brand-text/60 transition-all hover:bg-brand-secondary hover:text-brand-text active:scale-95"
            title="Attach file"
          >
            <Paperclip className="h-5 w-5 transition-transform group-hover:scale-110 group-hover:text-indigo-500" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip"
            onChange={handleMediaUpload} className="hidden" />

          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Write a message..."
            className="flex-1 rounded-2xl border border-transparent bg-brand-secondary px-5 py-3.5 text-[14px] font-medium text-brand-text outline-none transition-all placeholder:text-brand-text/60 focus:border-brand-divider focus:bg-brand-card focus:ring-4 focus:ring-brand-divider/50"
          />

          <button
            onClick={handleSend}
            disabled={!hasText}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-90 ${hasText
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 hover:shadow-indigo-600/40'
                : 'bg-brand-secondary text-brand-text/30'
              }`}
          >
            <Send className={`h-5 w-5 ${hasText ? '-ml-1' : ''}`} />
          </button>
        </div>
      )}
    </div>
  )
}
