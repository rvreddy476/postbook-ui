'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import data from '@emoji-mart/data'

// Same lazy pattern as ChatWindow / CommentSection: emoji-mart is ~200KB and
// only needed once someone opens a picker.
const EmojiPicker = lazy(() => import('@emoji-mart/react'))
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
import { useGlobalToast } from '@/contexts/ToastContext'
import { useConversationPresence, useSetTyping } from '@/hooks/usePresence'
import { useBatchProfiles } from '@/hooks/useProfile'
import { useNotifications } from '@/contexts/NotificationContext'
import { initiateCall } from '@/services/callService'
import { uploadMedia } from '@/lib/mediaUpload'
import { useMediaKinds } from '@/hooks/useMediaKinds'
import type { User } from '@/types'
import {
  ArrowLeft, Phone, Video, MoreVertical, Plus,
  // Pin stays imported for the pinned-message banner; only the per-message
  // action rail dropped it.
  Send, Pin, Reply, Pencil, Trash2, X, Check, CheckCheck, Loader2, Image, PanelRight,
  Smile, SmilePlus, ImagePlus,
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
  /** Optional third column, supplied by the messenger page only. */
  detailsOpen?: boolean
  onToggleDetails?: () => void
  /** Reports the resolved conversation id so the details panel can read it. */
  onConversationReady?: (id: string) => void
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
  /** Quote snapshot from the server; the only text available when the
   *  original message sits outside the loaded page. */
  replyToPreview?: string
  replyToSenderId?: string
  forwardedFromId?: string
  isEdited?: boolean
  editedAt?: string
  isDeleted?: boolean
  reactions?: { emoji: string; user_ids: string[] }[]
}

interface ContextMenuState {
  visible: boolean
  /** The bubble's viewport rect; the rail is placed against it. */
  rect: { left: number; right: number; top: number; bottom: number }
  /** True when the bubble is mine (right side) — the rail then goes left. */
  mine: boolean
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
    replyToPreview: msg.reply_to_preview,
    replyToSenderId: msg.reply_to_sender_id,
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
export default function DmChat({ userId, userName, userAvatar, userOnline, userLastSeen, onBack, detailsOpen, onToggleDetails, onConversationReady }: DmChatProps) {
  const currentUser = getSession()
  const myId = currentUser?.id ?? ''

  // initiateCall takes the app's User shape; the props carry exactly what
  // a call needs to show — id, name, avatar.
  const peerAsUser: User = useMemo(
    () => ({ id: userId, name: userName, avatar: userAvatar, isOnline: userOnline }),
    [userId, userName, userAvatar, userOnline],
  )

  // The badge is client state, separate from the server's read cursor.
  // markConversationRead() below writes the cursor; these clear the number
  // the user actually sees. DmChat never called them — only the retired
  // floating ChatWindow did — so reading a conversation in the messenger
  // left its count standing for good.
  const {
    markConversationRead: clearUnreadBadge,
    markConversationAsViewed,
    unmarkConversationAsViewed,
  } = useNotifications()

  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  /** The composer's emoji picker. */
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  /** A full emoji picker opened from a message's action bar ("+" after the quick row). */
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null)
  const emojiPanelRef = useRef<HTMLDivElement | null>(null)
  const actionBarRef = useRef<HTMLDivElement | null>(null)
  /**
   * Where the action rail sits. Measured after render rather than guessed:
   * its width depends on whether Edit/Delete are present, and an unmeasured
   * guess would push it off-screen on a narrow column.
   *
   * Placed BESIDE the bubble on the opposite side — my messages sit right,
   * so the rail goes left, and vice versa — falling back to above the
   * bubble when there isn't room on that side.
   */
  const [actionBarStyle, setActionBarStyle] = useState<React.CSSProperties>({ visibility: 'hidden' })
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [replyingTo, setReplyingTo] = useState<DisplayMessage | null>(null)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [readReceipts, setReadReceipts] = useState<Map<string, string[]>>(new Map())
  /** The peer's read watermark (ms), from the conversation's durable cursor. */
  const [peerLastReadAt, setPeerLastReadAt] = useState<number | null>(null)
  const [pinnedMessage, setPinnedMessage] = useState<PinnedMessage | null>(null)
  // Mirror convIdRef into state so the M1 presence hook can react when the
  // direct conversation is resolved (createOrGet is async on first open).
  const [conversationId, setConversationId] = useState<string | null>(null)

  const convIdRef = useRef<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const editInputRef = useRef<HTMLInputElement | null>(null)
  const lastTypingSentRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  // Attachments used to fail into console.error alone, which is why a dead
  // upload route went unnoticed. The composer now says so.
  const toast = useGlobalToast()
  const [attachError, setAttachError] = useState<string | null>(null)
  // See where this is set: the thread is awaiting the other side's accept.
  const [isRequestThread, setIsRequestThread] = useState(false)

  // M1 conversation presence — enter/heartbeat/leave + 10s polled rollup.
  const { data: presence } = useConversationPresence(conversationId)
  const setTyping = useSetTyping(conversationId)

  // Hydrate display names for "X is typing…" / active-now indicators.
  // Self is filtered before passing to the batch hook to keep the payload
  // tight (the batch endpoint is capped at 100 anyway) and to avoid
  // requesting the viewer's own profile just to drop them later.
  const remoteTypingIds = useMemo(
    () => (presence?.typing_users ?? []).filter((id) => id !== myId),
    [presence?.typing_users, myId]
  )
  const remoteActiveIds = useMemo(
    () => (presence?.active_users ?? []).filter((id) => id !== myId),
    [presence?.active_users, myId]
  )
  const presenceUserIds = useMemo(
    () => Array.from(new Set([...remoteTypingIds, ...remoteActiveIds])),
    [remoteTypingIds, remoteActiveIds]
  )
  const { data: presenceProfiles } = useBatchProfiles(presenceUserIds)

  const formatNameList = useCallback(
    (ids: string[]): string => {
      const names = ids.map((id) => {
        const profile = presenceProfiles?.get(id)
        return (
          profile?.display_name ||
          profile?.username ||
          // Fall back to the DM peer's name when the batch hook hasn't
          // resolved yet — in a 1:1 chat that's the only "other" user.
          (id === userId ? userName : 'Someone')
        )
      })
      if (names.length === 0) return ''
      if (names.length === 1) return names[0]
      if (names.length === 2) return `${names[0]} and ${names[1]}`
      return `${names[0]}, ${names[1]} and ${names.length - 2} more`
    },
    [presenceProfiles, userId, userName]
  )

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  // Init conversation & load messages
  useEffect(() => {
    let cancelled = false
    setConversationId(null)
    const init = async () => {
      try {
        setLoading(true)
        setError(false)
        const convRes = await getOrCreateDirectConversation(userId)
        const conversationId: string =
          convRes.data?.conversation_id ?? convRes.data?.id ?? convRes.conversation_id ?? convRes.id ?? ''
        if (!conversationId) throw new Error('No conversation id returned')
        convIdRef.current = conversationId
        /*
          A conversation the server marks is_request is one the other person
          has not accepted. The first message goes through as a REQUEST: text
          only, one message, nothing more until they accept — and accepting is
          what forms the connection (message-service calls
          ensureGraphConnection on accept).

          Worth saying out loud after the send. Nothing else on screen
          distinguishes a request from an ordinary thread, so without it a
          message that is sitting unaccepted looks exactly like one that was
          delivered and ignored.
        */
        setIsRequestThread(
          Boolean(convRes.data?.is_request ?? (convRes as { is_request?: boolean }).is_request),
        )

        // The peer's durable read watermark. The live `read_receipt` frame
        // only arrives while this conversation is open, so without this a
        // reload lost every "Seen" mark. The server withholds it when the
        // reader has read receipts switched off, so rendering it is safe.
        const convMembers = (convRes.data?.members ?? convRes.members ?? []) as Array<{
          user_id?: string
          last_read_at?: string
        }>
        const peer = convMembers.find(m => m.user_id && m.user_id !== myId)
        if (!cancelled) {
          setPeerLastReadAt(peer?.last_read_at ? Date.parse(peer.last_read_at) : null)
        }
        if (!cancelled) {
          setConversationId(conversationId)
          onConversationReady?.(conversationId)
          // While this conversation is on screen, an arriving message is
          // already read — it must not add to the badge.
          markConversationAsViewed(conversationId)
        }
        const msgRes = await fetchMessages(conversationId)
        const raw: BackendMessage[] = Array.isArray(msgRes.data) ? msgRes.data : []
        if (!cancelled) {
          const displayed = raw.map(m => toDisplay(m)).reverse()
          setMessages(displayed)
          if (displayed.length > 0) {
            const last = displayed[displayed.length - 1]
            markConversationRead(conversationId, last.id).catch(() => { })
            clearUnreadBadge(conversationId, last.ts)
          } else {
            // An empty conversation still clears a stale count.
            clearUnreadBadge(conversationId)
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
    return () => {
      cancelled = true
      // Leaving the conversation: later arrivals count again.
      if (convIdRef.current) unmarkConversationAsViewed(convIdRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, myId])

  // Real-time subscriptions
  useEffect(() => {
    const unsub = subscribeToMessages((msg: BackendMessage) => {
      if (msg.conversation_id !== convIdRef.current) return
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        // The server now delivers a message to the sender's OWN sessions
        // too, so a second tab or the phone sees it. That means this tab
        // gets its own message back while an optimistic copy is still on
        // screen. Settle it in place rather than appending a twin — the
        // send's own response settles the same entry, and whichever
        // arrives first wins.
        if (msg.sender_id === myId) {
          const pending = prev.findIndex(
            m => m.id.startsWith('opt-') && m.text === msg.text,
          )
          if (pending >= 0) {
            const next = [...prev]
            next[pending] = toDisplay(msg)
            return next
          }
        }
        return [...prev, toDisplay(msg)]
      })
      if (msg.sender_id !== myId && convIdRef.current) {
        markConversationRead(convIdRef.current, msg.id).catch(() => { })
        // You are looking at it, so it is read on both sides of the app:
        // the server cursor above and the badge here.
        clearUnreadBadge(convIdRef.current, msg.ts || msg.created_at)
      }
    })
    return unsub
  }, [myId, clearUnreadBadge])

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
  }, [myId, clearUnreadBadge])

  useEffect(() => {
    const unsub = subscribeToReadReceipts((evt: ReadReceiptEvent) => {
      if (evt.conversation_id !== convIdRef.current || evt.user_id === myId) return
      setReadReceipts(prev => {
        const next = new Map(prev)
        const readers = next.get(evt.message_id) || []
        if (!readers.includes(evt.user_id)) next.set(evt.message_id, [...readers, evt.user_id])
        return next
      })
      // Advance the watermark too, so every earlier message shows as seen —
      // the peer reading message N means they read everything before it.
      const at = Date.parse(evt.read_at)
      if (!Number.isNaN(at)) setPeerLastReadAt(prev => (prev === null || at > prev ? at : prev))
    })
    return unsub
  }, [myId, clearUnreadBadge])

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
    const handler = () => { setContextMenu(null); setReactionPickerFor(null) }
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu])

  // Position the rail once it has been measured.
  useLayoutEffect(() => {
    if (!contextMenu?.visible) {
      setActionBarStyle({ visibility: 'hidden' })
      return
    }
    const el = actionBarRef.current
    if (!el) return
    const { rect, mine } = contextMenu
    const bar = el.getBoundingClientRect()
    const gap = 8
    const margin = 8

    // Preferred side: opposite the bubble.
    let left = mine ? rect.left - gap - bar.width : rect.right + gap
    // If it does not fit there, try the other side before giving up.
    if (left < margin) {
      const flipped = rect.right + gap
      left = flipped + bar.width <= window.innerWidth - margin ? flipped : margin
    } else if (left + bar.width > window.innerWidth - margin) {
      const flipped = rect.left - gap - bar.width
      left = flipped >= margin ? flipped : window.innerWidth - margin - bar.width
    }

    // Vertically centred on the bubble, clamped into the viewport.
    let top = rect.top + (rect.bottom - rect.top) / 2 - bar.height / 2
    top = Math.max(margin, Math.min(top, window.innerHeight - margin - bar.height))

    setActionBarStyle({ left, top, visibility: 'visible' })
    // The picker changes the element's height, so re-measure when it opens.
  }, [contextMenu, reactionPickerFor])

  // The composer's emoji panel closes on a click anywhere outside it, and
  // on Escape — same rule ChatWindow's picker follows.
  useEffect(() => {
    if (!showEmojiPicker) return
    const onDown = (e: MouseEvent) => {
      if (emojiPanelRef.current && !emojiPanelRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false)
      }
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowEmojiPicker(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [showEmojiPicker])

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
    // M1: also push a `typing.start` over the persistent WS so other
    // participants see the indicator instantly (the legacy HTTP POST
    // above stays for back-compat). useSetTyping throttles to 3s.
    setTyping()
  }, [setTyping])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || !convIdRef.current) return
    const optimisticId = `opt-${Date.now()}`
    const optimistic: DisplayMessage = {
      id: optimisticId, senderId: myId, text,
      time: formatTime(new Date().toISOString()),
      ts: new Date().toISOString(), type: 'text', replyToId: replyingTo?.id,
      replyToPreview: replyingTo?.text, replyToSenderId: replyingTo?.senderId,
    }
    setMessages(prev => [...prev, optimistic])
    setInput('')
    setReplyingTo(null)
    try {
      let res
      if (replyingTo) res = await replyToMessage(convIdRef.current!, replyingTo.id, text, {
        preview: replyingTo.text,
        senderId: replyingTo.senderId,
      })
      else res = await sendMessage(convIdRef.current!, text)
      const real = res.data as BackendMessage
      setMessages(prev => prev.map(m => (m.id === optimisticId ? toDisplay(real) : m)))
      // Only the FIRST message of a request needs saying; after that the
      // banner above the thread carries it.
      if (isRequestThread && messages.length === 0) {
        toast({
          type: 'success',
          title: 'Message request sent',
          description: 'They will see it once they accept. Accepting connects you.',
        })
      }
    } catch (err) { console.error('[DmChat] send failed:', err) }
  }, [input, myId, replyingTo, isRequestThread, messages.length, toast])

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

  /** Composer picker: insert at the caret, keep focus, leave the panel open. */
  const handleEmojiSelect = useCallback((emoji: { native: string }) => {
    const el = inputRef.current
    const start = el?.selectionStart ?? input.length
    const end = el?.selectionEnd ?? input.length
    const next = input.slice(0, start) + emoji.native + input.slice(end)
    setInput(next)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const pos = start + emoji.native.length
      el.setSelectionRange(pos, pos)
    })
  }, [input])

  /** Message action bar "+": react with any emoji, not just the quick six. */
  const handleReactionEmojiSelect = useCallback((emoji: { native: string }) => {
    if (!reactionPickerFor) return
    handleToggleReaction(reactionPickerFor, emoji.native)
    setReactionPickerFor(null)
  }, [reactionPickerFor, handleToggleReaction])

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

  /**
   * Open the action bar for a message, anchored just above its bubble.
   *
   * This used to be a right-click-only menu placed at the mouse position —
   * which on a phone does not exist. A tap on the bubble now opens it, and
   * it sits above the message the way WhatsApp's does, so the thing you are
   * reacting to stays in view under it.
   */
  const openActionsFor = useCallback((bubble: HTMLElement, msg: DisplayMessage) => {
    if (msg.isDeleted) return
    const r = bubble.getBoundingClientRect()
    setReactionPickerFor(null)
    setContextMenu({
      visible: true,
      rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
      mine: msg.senderId === myId,
      messageId: msg.id,
      senderId: msg.senderId,
      ts: msg.ts,
    })
  }, [myId])

  const handleContextMenu = useCallback((e: React.MouseEvent, msg: DisplayMessage) => {
    e.preventDefault()
    const bubble = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-bubble]')
    if (bubble) openActionsFor(bubble, msg)
  }, [openActionsFor])

  const handleMediaUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !convIdRef.current) return
    setAttachError(null)
    try {
      // media-service's three-step flow, the same one the composer and avatar
      // pickers use. The old code POSTed a FormData to /api/media/upload,
      // which is not a route in this app at all — it 404'd, the JSON parse
      // threw, and the catch below swallowed it. Every chat attachment has
      // failed silently.
      const kind = file.type.startsWith('image/') ? 'image'
        : file.type.startsWith('video/') ? 'video'
        : file.type.startsWith('audio/') ? 'audio'
        : null
      if (!kind) throw new Error(`Unsupported attachment type: ${file.type || 'unknown'}`)
      const mediaId = await uploadMedia(file, kind, 'chat')
      await sendMediaMessage(convIdRef.current, mediaId, kind)
    } catch (err) {
      console.error('[DmChat] media upload failed:', err)
      setAttachError(err instanceof Error ? err.message : 'Could not send that attachment.')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const statusText = useMemo(() => {
    // Prefer the M1 polled rollup for typing — it's authoritative across
    // tabs/devices — and fall back to the legacy local set for snappier
    // first-keystroke feedback.
    const anyTyping = remoteTypingIds.length > 0 || typingUsers.size > 0
    if (anyTyping) {
      if (presence?.is_big_group) return 'Someone is typing...'
      const label = formatNameList(remoteTypingIds)
      return label ? `${label} is typing...` : 'typing...'
    }
    if (presence && presence.active_count > 1) {
      // The viewer themselves count toward active_count, so >1 means at
      // least one peer is in the chat right now. For 1:1 chats this is a
      // stronger signal than the global online dot.
      return 'Active in chat'
    }
    if (userOnline) return 'Active now'
    if (userLastSeen) return `Last seen ${userLastSeen}`
    return 'Offline'
  }, [
    userOnline,
    userLastSeen,
    typingUsers,
    remoteTypingIds,
    presence,
    formatNameList,
  ])

  const isGroupStart = (i: number) => i === 0 || messages[i].senderId !== messages[i - 1].senderId
  const isGroupEnd = (i: number) => i === messages.length - 1 || messages[i].senderId !== messages[i + 1].senderId

  const lastSentMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === myId && !messages[i].isDeleted) return messages[i].id
    }
    return null
  }, [messages, myId])

  /**
   * Has the peer seen this message of mine?
   *
   * Two sources, because either alone is incomplete: the live receipt frame
   * (exact, but only while the conversation is open) and the peer's durable
   * watermark (survives a reload, and covers every message before it).
   */
  const isSeenByPeer = useCallback((msg: DisplayMessage): boolean => {
    if (readReceipts.has(msg.id)) return true
    if (peerLastReadAt === null) return false
    const sentAt = Date.parse(msg.ts)
    return !Number.isNaN(sentAt) && sentAt <= peerLastReadAt
  }, [readReceipts, peerLastReadAt])

  const findMessage = useCallback((msgId: string) => messages.find(m => m.id === msgId), [messages])
  // The wire says only "media"; media-service says what it is.
  const mediaKinds = useMediaKinds(
    useMemo(() => messages.map(m => m.mediaId).filter((id): id is string => Boolean(id)), [messages]),
  )
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
            <p className={`text-[12px] font-semibold tracking-wide ${(remoteTypingIds.length > 0 || typingUsers.size > 0) ? 'text-brand-text/60' : userOnline ? 'text-success' : 'text-brand-text/60'
              }`}>
              {statusText}
            </p>
          </div>

          {/* M1 presence pill — count for big groups, avatar names
              otherwise. Hidden when the only active user is the viewer. */}
          {presence && remoteActiveIds.length > 0 && (
            <div
              className="hidden md:flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full bg-brand-secondary border border-brand-divider"
              title={
                presence.is_big_group
                  ? `${presence.active_count} active in this conversation`
                  : `Active now: ${formatNameList(remoteActiveIds)}`
              }
            >
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              <span className="text-[11px] font-bold text-success">
                {presence.is_big_group
                  ? `${presence.active_count} active`
                  : remoteActiveIds.length === 1
                    ? `${formatNameList(remoteActiveIds)} active`
                    : `${remoteActiveIds.length} active`}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* These had no onClick at all — the only wired call buttons lived
              in the floating ChatWindow, which is rendered nowhere. So on the
              messenger, the page people actually use, Phone and Video were
              decorative and "calls do nothing" was exactly true. */}
          {[
            {
              icon: <Phone className="h-4 w-4" />,
              title: 'Voice call',
              onClick: () => initiateCall(peerAsUser, 'audio'),
            },
            {
              icon: <Video className="h-4 w-4" />,
              title: 'Video call',
              onClick: () => initiateCall(peerAsUser, 'video'),
            },
            { icon: <MoreVertical className="h-4 w-4" />, title: 'More', onClick: undefined },
          ].map((btn, i) => (
            <button
              key={i}
              title={btn.title}
              aria-label={btn.title}
              onClick={btn.onClick}
              className="flex h-10 w-10 items-center justify-center rounded-full text-brand-text/60 transition-colors duration-200 hover:bg-brand-secondary hover:text-brand-text active:scale-95"
            >
              {btn.icon}
            </button>
          ))}
          {/* Thread details. Only rendered when the parent offers the panel,
              so DmChat used anywhere else is unchanged. */}
          {onToggleDetails && (
            <button
              onClick={onToggleDetails}
              title={detailsOpen ? 'Hide thread details' : 'Show thread details'}
              aria-pressed={!!detailsOpen}
              className={`hidden h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 active:scale-95 xl:flex ${detailsOpen ? 'bg-primary-tint text-primary-ink' : 'text-brand-text/60 hover:bg-brand-secondary hover:text-brand-text'}`}
            >
              <PanelRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Pinned message banner */}
      {pinnedMessage && (
        <div
          onClick={() => scrollToMessage(pinnedMessage.message_id)}
          className="flex items-center gap-3 px-5 py-2.5 bg-brand-secondary border-b border-brand-divider cursor-pointer shrink-0 hover:bg-brand-secondary/80 transition-colors"
        >
          <Pin className="w-4 h-4 text-brand-text/50 shrink-0 rotate-45" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-brand-text/60 tracking-wider">Pinned Message</p>
            <p className="text-[12px] text-brand-highlight truncate">{pinnedMessage.message?.text || 'Click to view'}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleUnpinMessage() }}
            className="w-6 h-6 rounded-md hover:bg-brand-secondary flex items-center justify-center text-brand-text/40 hover:text-brand-text/60 transition-all shrink-0"
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
          <div className="flex items-center justify-center flex-1 h-full text-danger/70 text-[12px]">
            Could not load messages
          </div>
        )}

        {!loading && messages.map((msg, i) => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id} id={`msg-${msg.id}`} className="flex justify-center py-3 transition-colors">
                <span className="text-[11px] text-brand-text/60 bg-brand-card px-4 py-1.5 rounded-full shadow-xs border border-brand-divider italic">
                  {msg.text || 'System message'}
                </span>
              </div>
            )
          }

          const isMe = msg.senderId === myId
          const groupStart = isGroupStart(i)
          const groupEnd = isGroupEnd(i)
          const replyTarget = msg.replyToId ? findMessage(msg.replyToId) : null
          // A just-sent message still carries the kind the picker knew;
          // everything read back from the server says only 'media'.
          const mediaKind = msg.mediaId
            ? (['image', 'video', 'audio'].includes(msg.type) ? msg.type : mediaKinds[msg.mediaId])
            : undefined
          // The live message wins, because it reflects a later edit or delete.
          // The server's send-time snapshot is all that is left when the
          // original is not in this page â the usual case for an older
          // message, since this view loads exactly one page and never pages
          // back. Navigation is offered only when the original is on screen.
          const quote = msg.replyToId
            ? {
                text: replyTarget
                  ? (replyTarget.isDeleted ? 'This message was deleted' : replyTarget.text)
                  : (msg.replyToPreview || 'Original message'),
                senderId: replyTarget?.senderId ?? msg.replyToSenderId,
                canNavigate: Boolean(replyTarget),
              }
            : null

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

                {/* Message bubble */}
                <div
                  data-bubble
                  role={msg.isDeleted ? undefined : 'button'}
                  tabIndex={msg.isDeleted ? undefined : 0}
                  onClick={(e) => {
                    // A tap opens the action bar above this bubble. Media
                    // controls inside the bubble keep their own clicks.
                    if ((e.target as HTMLElement).closest('video, audio, a')) return
                    e.stopPropagation()
                    openActionsFor(e.currentTarget, msg)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openActionsFor(e.currentTarget, msg) }
                  }}
                  className={`group/bubble relative max-w-full wrap-break-word px-4 py-2.5 text-[14px] leading-relaxed shadow-xs transition-all ${msg.isDeleted ? '' : 'cursor-pointer'} ${msg.isDeleted
                      ? 'rounded-2xl bg-brand-secondary text-brand-text/60 italic'
                      : isMe
                        ? `bg-brand-text text-brand-bg ${groupEnd ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl'}`
                        : `border border-brand-divider bg-brand-card text-brand-text ${groupEnd ? 'rounded-2xl rounded-bl-sm' : 'rounded-2xl'}`
                    }`}
                >
                  {/*
                    The quoted message: a card INSIDE the reply, one step
                    quieter than the body above it, so the reply reads as the
                    message and the quote as its context. It used to render as
                    a sibling before the bubble, which made every reply look
                    like two messages.
                  */}
                  {quote && !msg.isDeleted && (
                    <div
                      role={quote.canNavigate ? 'button' : undefined}
                      tabIndex={quote.canNavigate ? 0 : undefined}
                      aria-label={quote.canNavigate ? 'Go to the quoted message' : undefined}
                      onClick={(e) => {
                        if (!quote.canNavigate) return
                        // Without this the tap also opens the action rail.
                        e.stopPropagation()
                        scrollToMessage(msg.replyToId!)
                      }}
                      onKeyDown={(e) => {
                        if (!quote.canNavigate) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          scrollToMessage(msg.replyToId!)
                        }
                      }}
                      className={`mb-2 flex gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${quote.canNavigate ? 'cursor-pointer' : ''} ${isMe
                          ? `bg-brand-bg/15 ${quote.canNavigate ? 'hover:bg-brand-bg/25' : ''}`
                          : `bg-brand-text/[0.06] ${quote.canNavigate ? 'hover:bg-brand-text/10' : ''}`
                        }`}
                    >
                      <span className={`w-[3px] shrink-0 self-stretch rounded-full ${isMe ? 'bg-brand-bg/70' : 'bg-brand-accent'}`} />
                      <span className="min-w-0">
                        {quote.senderId && (
                          <span className={`block text-[11px] font-semibold leading-tight ${isMe ? 'text-brand-bg/80' : 'text-primary'}`}>
                            {quote.senderId === myId ? 'You' : userName}
                          </span>
                        )}
                        <span className={`block line-clamp-2 text-[12px] leading-snug ${isMe ? 'text-brand-bg/70' : 'text-brand-text/60'}`}>
                          {quote.text}
                        </span>
                      </span>
                    </div>
                  )}

                  {msg.isDeleted ? (
                    'This message was deleted'
                  ) : mediaKind === 'image' && msg.mediaId ? (
                    <img src={`/v1/media/${msg.mediaId}/serve`} alt="Image" className="max-w-full rounded-xl" />
                  ) : mediaKind === 'video' && msg.mediaId ? (
                    <video src={`/v1/media/${msg.mediaId}/serve`} controls className="max-w-full rounded-xl" />
                  ) : mediaKind === 'audio' && msg.mediaId ? (
                    <audio src={`/v1/media/${msg.mediaId}/serve`} controls className="max-w-full" />
                  ) : msg.mediaId ? (
                    // Kind not resolved yet, or media-service would not say.
                    // A link always works; guessing <img> would draw a broken
                    // image for every clip.
                    <a href={`/v1/media/${msg.mediaId}/serve`} target="_blank" rel="noopener noreferrer"
                      className={`font-semibold underline underline-offset-2 ${isMe ? 'text-white/90 hover:text-white' : 'text-brand-text/60 hover:text-brand-text/60'}`}>
                      Attachment
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
                        className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold shadow-xs transition-all hover:scale-105 active:scale-95 ${r.user_ids.includes(myId)
                            ? 'border border-brand-divider bg-brand-secondary text-brand-text/60'
                            : 'border border-brand-divider bg-brand-card text-brand-highlight hover:bg-brand-secondary'
                          }`}
                      >
                        <span>{r.emoji}</span>
                        {r.user_ids.length > 1 && <span className="text-[10px] opacity-70">{r.user_ids.length}</span>}
                      </button>
                    ))}
                  </div>
                )}

                {/* Time + delivery state.
                    Ticks on EVERY message of mine, not only the last, and
                    the seen state is a colour change rather than the word
                    "Seen" — the WhatsApp convention the founder asked for.
                    A single grey tick is sent; double blue is read. Nothing
                    renders for the peer's messages. */}
                {groupEnd && (
                  <div className="mt-1.5 flex items-center gap-1.5 px-0.5 text-[11px] font-medium text-brand-text/60">
                    {msg.time}
                    {isMe && !msg.isDeleted && (
                      isSeenByPeer(msg) ? (
                        <span className="flex items-center text-receipt-seen" title="Seen">
                          <CheckCheck className="h-4 w-4" strokeWidth={2.25} />
                        </span>
                      ) : (
                        <span className="flex items-center text-brand-text/40" title="Sent">
                          <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* Message action bar — sits just above the tapped bubble, the way
          WhatsApp's does: a row of quick reactions with a "+" for the full
          picker, and a row of actions under it. Opened by tap or by
          right-click. */}
      {contextMenu?.visible && (
        <div
          role="menu"
          ref={actionBarRef}
          className="fixed z-50 flex flex-col gap-1.5"
          style={actionBarStyle}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ONE row: quick reactions, "+" for the full picker, then the
              actions. It sits BESIDE the bubble on the side the bubble is
              not on — my messages are on the right, so the rail is on the
              left, and the other way round for theirs. Pin was removed at
              the founder's request. */}
          <div className="flex items-center gap-0.5 rounded-full border border-brand-divider bg-brand-card px-1.5 py-1 shadow-xl">
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleToggleReaction(contextMenu.messageId, emoji)}
                aria-label={`React ${emoji}`}
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition-transform hover:scale-125 active:scale-95"
              >
                {emoji}
              </button>
            ))}
            <button
              onClick={() => setReactionPickerFor(p => (p === contextMenu.messageId ? null : contextMenu.messageId))}
              aria-label="More reactions"
              title="More reactions"
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${reactionPickerFor === contextMenu.messageId ? 'bg-brand-secondary text-brand-text' : 'text-brand-text/60 hover:bg-brand-secondary hover:text-brand-text'}`}
            >
              <SmilePlus className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>

            <span className="mx-0.5 h-5 w-px shrink-0 bg-brand-divider" aria-hidden="true" />

            <button
              onClick={() => { const msg = messages.find(m => m.id === contextMenu.messageId); if (msg) handleReply(msg) }}
              aria-label="Reply"
              title="Reply"
              className="flex h-8 w-8 items-center justify-center rounded-full text-brand-text/70 transition-colors hover:bg-brand-secondary hover:text-brand-text"
            >
              <Reply className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
            {contextMenu.senderId === myId && (
              <>
                <button
                  onClick={() => { const msg = messages.find(m => m.id === contextMenu.messageId); if (msg) handleEditStart(msg) }}
                  aria-label="Edit"
                  title="Edit"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-brand-text/70 transition-colors hover:bg-brand-secondary hover:text-brand-text"
                >
                  <Pencil className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => handleDelete(contextMenu.messageId)}
                  aria-label="Delete"
                  title="Delete"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-danger transition-colors hover:bg-danger/10"
                >
                  <Trash2 className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </button>
              </>
            )}
          </div>

          {/* Full picker, under the rail so it never covers the message */}
          {reactionPickerFor === contextMenu.messageId && (
            <div className={`overflow-hidden rounded-2xl border border-brand-divider shadow-xl ${contextMenu.mine ? 'self-end' : 'self-start'}`}>
              <Suspense fallback={
                <div className="flex h-[320px] w-[320px] items-center justify-center bg-brand-card">
                  <span className="text-xs font-medium text-brand-text/40">Loading emojis…</span>
                </div>
              }>
                <EmojiPicker
                  data={data}
                  onEmojiSelect={handleReactionEmojiSelect}
                  theme="light"
                  previewPosition="none"
                  skinTonePosition="none"
                  perLine={8}
                  maxFrequentRows={1}
                />
              </Suspense>
            </div>
          )}
        </div>
      )}

      {/* A failed attachment is said out loud. It used to be a console.error
          only, which is how a dead upload route survived this long. */}
      {attachError && (
        <div
          role="alert"
          className="flex shrink-0 items-center justify-between gap-3 border-t border-brand-divider bg-danger/10 px-6 py-2.5 text-[12px] text-danger"
        >
          <span>{attachError}</span>
          <button
            onClick={() => setAttachError(null)}
            className="shrink-0 font-semibold underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Reply bar */}
      {replyingTo && (

        <div className="flex shrink-0 items-center justify-between border-t border-brand-divider bg-brand-secondary/80 px-6 py-3 backdrop-blur-md">
          <div className="flex flex-1 flex-col border-l-[3px] border-brand-accent pl-3">
            <span className="text-[12px] font-bold text-brand-text/60">
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
            className="flex-1 rounded-2xl border border-transparent bg-brand-secondary px-5 py-3 text-[14px] text-brand-text outline-hidden transition-all placeholder:text-brand-text/60 focus:border-brand-divider focus:bg-brand-card focus:ring-4 focus:ring-brand-divider/50"
          />
          <button onClick={handleSaveEdit} className="flex h-11 items-center justify-center rounded-2xl bg-brand-text px-6 font-bold text-white transition-all hover:bg-brand-text/85 active:scale-95">
            Save
          </button>
          <button onClick={() => { setEditingMsgId(null); setEditText('') }} className="flex h-11 items-center justify-center rounded-2xl bg-brand-secondary px-5 font-bold text-brand-highlight transition-all hover:bg-brand-secondary/80 active:scale-95">
            Cancel
          </button>
        </div>
      ) : (
        /* Composer — one horizontal bar: attach on the left, field in the
           middle, send on the right, all inside the same rounded box so the
           send control can never be clipped by the panel edge. */
        <div className="relative shrink-0 border-t border-brand-divider bg-brand-card px-4 py-3">
          {/* Emoji picker, floated above the bar */}
          {showEmojiPicker && (
            <div ref={emojiPanelRef} className="absolute bottom-full left-4 mb-2 overflow-hidden rounded-2xl border border-brand-divider shadow-xl">
              <Suspense fallback={
                <div className="flex h-[380px] w-[352px] items-center justify-center bg-brand-card">
                  <span className="text-xs font-medium text-brand-text/40">Loading emojis…</span>
                </div>
              }>
                <EmojiPicker
                  data={data}
                  onEmojiSelect={handleEmojiSelect}
                  theme="light"
                  previewPosition="none"
                  skinTonePosition="none"
                  perLine={9}
                  maxFrequentRows={2}
                />
              </Suspense>
            </div>
          )}

          <div className="flex items-center gap-1 rounded-full bg-brand-secondary px-1.5 ring-1 ring-transparent transition-colors focus-within:ring-brand-divider">
            <button
              onClick={() => setShowEmojiPicker(v => !v)}
              aria-label="Emoji"
              aria-pressed={showEmojiPicker}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${showEmojiPicker ? 'text-brand-text' : 'text-brand-text/50 hover:text-brand-text'}`}
            >
              <Smile className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
            {/* A photo icon, not a paperclip: what people attach in a chat
                is a picture or a clip, and the paperclip read as "document". */}
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Add photo or video"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand-text/50 transition-colors hover:text-brand-text"
            >
              <ImagePlus className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*"
              onChange={handleMediaUpload} className="hidden" />

            <input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Write a message"
              className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-sm text-brand-text outline-hidden placeholder:text-brand-text/40"
            />

            {/* The one coloured thing here: the founder's sampled #b36077,
                4.32:1 on white, which clears the 3.00:1 bar for an icon. It
                only takes colour once there is something to send. */}
            <button
              onClick={handleSend}
              disabled={!hasText}
              aria-label="Send message"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200 active:scale-90 ${hasText
                  ? 'bg-send text-white hover:bg-send-hover'
                  : 'text-brand-text/30'
                }`}
            >
              <Send className="h-[18px] w-[18px] -ml-px" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
