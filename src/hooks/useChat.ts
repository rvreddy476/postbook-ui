'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ChatMessage {
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

export interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  messageId: string
  senderId: string
  ts: string
}

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

function toChat(msg: BackendMessage): ChatMessage {
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
// Hook
// ---------------------------------------------------------------------------
export function useChat(conversationId: string | null | undefined, currentUserId: string) {
  // Core state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)

  // Feature state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [readReceipts, setReadReceipts] = useState<Map<string, string[]>>(new Map())
  const [pinnedMessage, setPinnedMessage] = useState<PinnedMessage | null>(null)

  const lastTypingSentRef = useRef(0)

  // ---- Load messages ----
  useEffect(() => {
    if (!conversationId) { setLoading(false); return }
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const res = await fetchMessages(conversationId, 50)
        const raw: BackendMessage[] = Array.isArray(res.data) ? res.data : []
        if (!cancelled) {
          const displayed = raw.map(toChat).reverse()
          setMessages(displayed)
          // Auto mark-read
          if (displayed.length > 0) {
            markConversationRead(conversationId, displayed[displayed.length - 1].id).catch(() => {})
          }
        }
      } catch (err) {
        console.error('[useChat] load failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [conversationId])

  // ---- Load pinned message ----
  useEffect(() => {
    if (!conversationId) return
    let cancelled = false
    getPinnedMessage(conversationId).then(pinned => {
      if (!cancelled) setPinnedMessage(pinned)
    })
    return () => { cancelled = true }
  }, [conversationId])

  // ---- Pin update subscription ----
  useEffect(() => {
    if (!conversationId) return
    const unsub = subscribeToPinUpdates((evt: PinUpdateEvent) => {
      if (evt.conversation_id !== conversationId) return
      if (evt.action === 'unpin') {
        setPinnedMessage(null)
      } else {
        // Refetch pinned message to get full data
        getPinnedMessage(conversationId).then(pinned => setPinnedMessage(pinned))
      }
    })
    return unsub
  }, [conversationId])

  // ---- Real-time message subscription ----
  useEffect(() => {
    if (!conversationId) return
    const unsub = subscribeToMessages((msg: BackendMessage) => {
      if (msg.conversation_id !== conversationId) return
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, toChat(msg)]
      })
      if (msg.sender_id !== currentUserId) {
        markConversationRead(conversationId, msg.id).catch(() => {})
      }
    })
    return unsub
  }, [conversationId, currentUserId])

  // ---- Message edit subscription ----
  useEffect(() => {
    if (!conversationId) return
    const unsub = subscribeToMessageEdits((evt: MessageEditedEvent) => {
      if (evt.conversation_id !== conversationId) return
      setMessages(prev =>
        prev.map(m =>
          m.id === evt.msg_id
            ? { ...m, text: evt.new_text, isEdited: true, editedAt: evt.edited_at }
            : m
        )
      )
    })
    return unsub
  }, [conversationId])

  // ---- Message delete subscription ----
  useEffect(() => {
    if (!conversationId) return
    const unsub = subscribeToMessageDeletes((evt: MessageDeletedEvent) => {
      if (evt.conversation_id !== conversationId) return
      setMessages(prev =>
        prev.map(m =>
          m.id === evt.msg_id ? { ...m, isDeleted: true, text: '' } : m
        )
      )
    })
    return unsub
  }, [conversationId])

  // ---- Typing subscription ----
  useEffect(() => {
    if (!conversationId) return
    const unsub = subscribeToTyping((evt: TypingEvent) => {
      if (evt.conversation_id !== conversationId) return
      if (evt.user_id === currentUserId) return
      setTypingUsers(prev => {
        const next = new Set(prev)
        if (evt.is_typing) {
          next.add(evt.user_id)
        } else {
          next.delete(evt.user_id)
        }
        return next
      })
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
  }, [conversationId, currentUserId])

  // ---- Read receipt subscription ----
  useEffect(() => {
    if (!conversationId) return
    const unsub = subscribeToReadReceipts((evt: ReadReceiptEvent) => {
      if (evt.conversation_id !== conversationId) return
      if (evt.user_id === currentUserId) return
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
  }, [conversationId, currentUserId])

  // ---- Reaction subscription ----
  useEffect(() => {
    if (!conversationId) return
    const unsub = subscribeToReactions((evt: ReactionUpdate) => {
      if (evt.conversation_id !== conversationId) return
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
  }, [conversationId])

  // ---- Close context menu on click outside ----
  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu])

  // ---- Input change with typing indicator ----
  const handleInputChange = useCallback((value: string) => {
    setInput(value)
    const now = Date.now()
    if (conversationId && now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now
      sendTypingIndicator(conversationId).catch(() => {})
    }
  }, [conversationId])

  // ---- Send handler ----
  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || !conversationId) return

    const optimisticId = `opt-${Date.now()}`
    const optimistic: ChatMessage = {
      id: optimisticId,
      senderId: currentUserId,
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
        res = await replyToMessage(conversationId, replyingTo.id, text)
      } else {
        res = await sendMessage(conversationId, text)
      }
      const real = res.data as BackendMessage
      setMessages(prev =>
        prev.map(m => (m.id === optimisticId ? toChat(real) : m)),
      )
    } catch (err) {
      console.error('[useChat] send failed:', err)
    }
  }, [input, currentUserId, conversationId, replyingTo])

  // ---- Edit handlers ----
  const handleEditStart = useCallback((msg: ChatMessage) => {
    setEditingMsgId(msg.id)
    setEditText(msg.text)
    setContextMenu(null)
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!editingMsgId || !conversationId) return
    const msg = messages.find(m => m.id === editingMsgId)
    if (!msg) return
    const newText = editText.trim()
    if (!newText || newText === msg.text) {
      setEditingMsgId(null)
      setEditText('')
      return
    }
    try {
      await editMessage(conversationId, editingMsgId, newText, msg.ts)
      setMessages(prev =>
        prev.map(m =>
          m.id === editingMsgId
            ? { ...m, text: newText, isEdited: true, editedAt: new Date().toISOString() }
            : m
        )
      )
    } catch (err) {
      console.error('[useChat] edit failed:', err)
    }
    setEditingMsgId(null)
    setEditText('')
  }, [editingMsgId, editText, messages, conversationId])

  // ---- Delete handler ----
  const handleDelete = useCallback(async (msgId: string) => {
    if (!conversationId) return
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return
    try {
      await deleteMessage(conversationId, msgId, msg.ts)
      setMessages(prev =>
        prev.map(m => (m.id === msgId ? { ...m, isDeleted: true, text: '' } : m))
      )
    } catch (err) {
      console.error('[useChat] delete failed:', err)
    }
    setContextMenu(null)
  }, [messages, conversationId])

  // ---- Reaction handler ----
  const handleToggleReaction = useCallback(async (msgId: string, emoji: string) => {
    if (!conversationId) return
    try {
      await toggleReaction(conversationId, msgId, emoji)
    } catch (err) {
      console.error('[useChat] reaction failed:', err)
    }
    setContextMenu(null)
  }, [conversationId])

  // ---- Reply handler ----
  const handleReply = useCallback((msg: ChatMessage) => {
    setReplyingTo(msg)
    setContextMenu(null)
  }, [])

  // ---- Pin handler ----
  const handlePinMessage = useCallback(async (msgId: string) => {
    if (!conversationId) return
    try {
      await pinMessage(conversationId, msgId)
      // Refetch pinned message
      const pinned = await getPinnedMessage(conversationId)
      setPinnedMessage(pinned)
    } catch (err) {
      console.error('[useChat] pin failed:', err)
    }
    setContextMenu(null)
  }, [conversationId])

  // ---- Unpin handler ----
  const handleUnpinMessage = useCallback(async () => {
    if (!conversationId) return
    try {
      await unpinMessage(conversationId)
      setPinnedMessage(null)
    } catch (err) {
      console.error('[useChat] unpin failed:', err)
    }
  }, [conversationId])

  // ---- Forward handler ----
  const handleForward = useCallback(async (targetConvId: string, msg: ChatMessage) => {
    try {
      await forwardMessage(targetConvId, msg.id, msg.text)
    } catch (err) {
      console.error('[useChat] forward failed:', err)
    }
  }, [])

  // ---- Context menu ----
  const handleContextMenu = useCallback((e: React.MouseEvent, msg: ChatMessage) => {
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

  // ---- Media upload ----
  const handleSendMedia = useCallback(async (mediaId: string, messageType: string, text?: string) => {
    if (!conversationId) return
    try {
      await sendMediaMessage(conversationId, mediaId, messageType, text)
    } catch (err) {
      console.error('[useChat] media send failed:', err)
    }
  }, [conversationId])

  // ---- Find message for reply preview ----
  const findMessage = useCallback((msgId: string) => {
    return messages.find(m => m.id === msgId)
  }, [messages])

  // ---- Last sent message ID (for read receipts) ----
  const lastSentMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === currentUserId && !messages[i].isDeleted) return messages[i].id
    }
    return null
  }, [messages, currentUserId])

  return {
    messages,
    input,
    loading,
    contextMenu,
    editingMsgId,
    editText,
    replyingTo,
    typingUsers,
    readReceipts,
    lastSentMsgId,
    pinnedMessage,
    setInput,
    setEditText,
    setEditingMsgId,
    setReplyingTo,
    setContextMenu,
    handleInputChange,
    handleSend,
    handleEditStart,
    handleSaveEdit,
    handleDelete,
    handleToggleReaction,
    handleReply,
    handleForward,
    handleContextMenu,
    handleSendMedia,
    handlePinMessage,
    handleUnpinMessage,
    findMessage,
  }
}
