'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import data from '@emoji-mart/data'

// Same lazy pattern as ChatWindow / CommentSection: emoji-mart is ~200KB and
// only needed once someone opens a picker.
const EmojiPicker = lazy(() => import('@emoji-mart/react'))
import {
  getOrCreateDirectConversation,
  getConversation,
  sendMessage,
  subscribeToMessages,
  subscribeToReactions,
  subscribeToTyping,
  subscribeToReadReceipts,
  subscribeToMessageEdits,
  subscribeToMessageDeletes,
  subscribeToPinUpdates,
  subscribeToPresenceUpdates,
  editMessage,
  toggleReaction,
  markConversationRead,
  sendTypingIndicator,
  replyToMessage,
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
import {
  deleteMessageScoped,
  fetchMessagePage,
  fetchPresenceDetail,
  fetchReadSummary,
  sendGifMessage,
  sendMediaKindMessage,
  sendStickerMessage,
  sendTypingStop,
  sendVoiceMessage,
  type ReplyRef,
} from '@/services/chatParityApi'
import { getSession } from '@/services/authService'
import { useGlobalToast } from '@/contexts/ToastContext'
import { useConversationPresence, useSetTyping } from '@/hooks/usePresence'
import { useBatchProfiles } from '@/hooks/useProfile'
import { useNotifications } from '@/contexts/NotificationContext'
import { useMessagingSettings } from '@/hooks/useMessagingSettings'
import { initiateCall } from '@/services/callService'
import { uploadMedia } from '@/lib/mediaUpload'
import { useMediaKinds } from '@/hooks/useMediaKinds'
import { toChatSource, useDatingKindChat, type ChatSource } from '@/features/dating/components/KindChat'
import { postCardIds, postCardView, usePostCards } from './postCards'
import type { User } from '@/types'
import type { InboxMember } from '@/lib/chat/contract'
import { presenceLabel } from '@/lib/chat/inbox'
import { bubbleClass, parseBubbleStyle } from '@/lib/chat/bubbleStyle'
import type { GifSendPayload } from '@/lib/chat/giphy'
import { InboxAvatar } from './inbox/InboxAvatar'
import { MessageBody } from './thread/MessageBody'
import { ThreadIntro, TypingBubble } from './thread/ThreadIntro'
import {
  MESSAGE_ACTION_LABELS,
  bubbleKind,
  isBareBubble,
  lastOwnMessageId,
  messageActions,
  prependOlder,
  quoteLabel,
  searchThread,
  shouldBlurMedia,
  toDisplay,
  formatTime,
  type DisplayMessage,
  type MessageAction,
} from './thread/threadModel'
import ChatSettingsPanel from './thread/ChatSettingsPanel'
import SharedReelsViewer from './thread/SharedReelsViewer'
import ForwardSheet from './thread/ForwardSheet'
import ReportMessageSheet from './thread/ReportMessageSheet'
import ReactionsSheet from './thread/ReactionsSheet'
import SeenBySheet from './thread/SeenBySheet'
import { VoiceRecorder } from './thread/VoiceRecorder'
import { StickerGifPanel, useStickerGifAvailability } from './thread/StickerGifPanel'
import './chat-bubbles.css'
import {
  ArrowLeft, Phone, Video, MoreHorizontal, ChevronDown, ChevronUp,
  Send, Pin, Reply, Pencil, Trash2, X, Check, CheckCheck, Loader2, PanelRight,
  Smile, SmilePlus, ImagePlus, Copy, Forward, Flag, Undo2, Sticker, Search, Users,
  type LucideIcon,
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
  /** The peer's last-active time from the inbox row (CONTRACT §1 peer). */
  userLastActiveAt?: string | null
  onBack: () => void
  /** Optional third column, supplied by the messenger page only. */
  detailsOpen?: boolean
  onToggleDetails?: () => void
  /** Reports the resolved conversation id so the details panel can read it. */
  onConversationReady?: (id: string) => void
  /**
   * Open this existing conversation instead of finding the direct thread
   * with userId. Used for inbox rows, dating matches and group chats.
   */
  conversationId?: string
  /** A chat-service group conversation (conversationId is then required). */
  group?: { title: string; avatarUrl: string | null; members: InboxMember[] }
  /** Scroll to this message once loaded (message search). */
  focusMessageId?: string | null
  /** The chat was deleted for me / I left the group. */
  onChatRemoved?: () => void
  onToast?: (text: string) => void
}

interface ContextMenuState {
  visible: boolean
  rect: { left: number; right: number; top: number; bottom: number }
  mine: boolean
  messageId: string
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

const ACTION_ICONS: Record<MessageAction, LucideIcon> = {
  reply: Reply,
  copy: Copy,
  forward: Forward,
  edit: Pencil,
  deleteForMe: Trash2,
  unsend: Undo2,
  report: Flag,
  pin: Pin,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DmChat({
  userId, userName, userAvatar, userOnline, userLastSeen, userLastActiveAt, onBack, detailsOpen, onToggleDetails,
  onConversationReady, conversationId: openConversationId, group, focusMessageId, onChatRemoved, onToast,
}: DmChatProps) {
  const currentUser = getSession()
  const myId = currentUser?.id ?? ''
  const isGroup = Boolean(group)

  const peerAsUser: User = useMemo(
    () => ({ id: userId, name: userName, avatar: userAvatar, isOnline: userOnline }),
    [userId, userName, userAvatar, userOnline],
  )

  const {
    markConversationRead: clearUnreadBadge,
    markConversationAsViewed,
    unmarkConversationAsViewed,
  } = useNotifications()

  const { data: chatSettings } = useMessagingSettings()
  const bubbleStyle = parseBubbleStyle(chatSettings?.chat_bubble_style)
  const sensitiveFilterOn = chatSettings?.dm_sensitive_media_filter === true

  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [olderCursor, setOlderCursor] = useState<string | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showStickers, setShowStickers] = useState(false)
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null)
  const emojiPanelRef = useRef<HTMLDivElement | null>(null)
  const actionBarRef = useRef<HTMLDivElement | null>(null)
  const [actionBarStyle, setActionBarStyle] = useState<React.CSSProperties>({ visibility: 'hidden' })
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [replyingTo, setReplyingTo] = useState<DisplayMessage | null>(null)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [readReceipts, setReadReceipts] = useState<Map<string, string[]>>(new Map())
  const [peerLastReadAt, setPeerLastReadAt] = useState<number | null>(null)
  const [pinnedMessage, setPinnedMessage] = useState<PinnedMessage | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [peerPresence, setPeerPresence] = useState<{ isOnline: boolean | null; lastActiveAt: string | null }>({
    isOnline: userOnline ? true : null,
    lastActiveAt: userLastActiveAt ?? null,
  })
  const [showSettings, setShowSettings] = useState(false)
  const [viewer, setViewer] = useState<{ startPostId: string; postIds: string[] } | null>(null)
  const [forwarding, setForwarding] = useState<DisplayMessage | null>(null)
  const [reporting, setReporting] = useState<DisplayMessage | null>(null)
  const [reactionsFor, setReactionsFor] = useState<DisplayMessage | null>(null)
  const [seenByFor, setSeenByFor] = useState<string | null>(null)
  const [seenByCount, setSeenByCount] = useState<number | null>(null)
  const [threadSearch, setThreadSearch] = useState<string | null>(null)
  const [searchIndex, setSearchIndex] = useState(0)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [recording, setRecording] = useState(false)

  const convIdRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const editInputRef = useRef<HTMLInputElement | null>(null)
  const lastTypingSentRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  /** Set before an older page is prepended, so the view does not jump. */
  const preserveScrollRef = useRef<number | null>(null)
  const lastBottomIdRef = useRef<string | null>(null)
  const toast = useGlobalToast()
  const say = useCallback((text: string) => {
    if (onToast) onToast(text)
    else toast({ type: 'success', title: text })
  }, [onToast, toast])
  const [attachError, setAttachError] = useState<string | null>(null)
  const [isRequestThread, setIsRequestThread] = useState(false)
  const [chatSource, setChatSource] = useState<ChatSource | null>(null)
  const kindChat = useDatingKindChat({ conversationId: openConversationId, conversation: chatSource, myId, peerName: userName, messages })
  const postCards = usePostCards(postCardIds(messages))
  const stickerGif = useStickerGifAvailability()

  const { data: presence } = useConversationPresence(conversationId)
  const setTyping = useSetTyping(conversationId)

  // Names: group members first, then profiles fetched for typing/active/profile cards.
  const memberById = useMemo(() => new Map((group?.members ?? []).map((m) => [m.userId, m])), [group?.members])
  const remoteTypingIds = useMemo(
    () => (presence?.typing_users ?? []).filter((id) => id !== myId),
    [presence?.typing_users, myId]
  )
  const profileCardIds = useMemo(
    () => messages.map((m) => m.extras?.profileUserId).filter((id): id is string => Boolean(id)),
    [messages],
  )
  const groupSenderIds = useMemo(
    () => (isGroup ? Array.from(new Set(messages.map((m) => m.senderId))).filter((id) => id && id !== myId && !memberById.get(id)?.displayName) : []),
    [isGroup, messages, myId, memberById],
  )
  const profileIds = useMemo(
    () => Array.from(new Set([...remoteTypingIds, ...Array.from(typingUsers), ...profileCardIds, ...groupSenderIds])),
    [remoteTypingIds, typingUsers, profileCardIds, groupSenderIds]
  )
  const { data: profiles } = useBatchProfiles(profileIds)

  const nameOf = useCallback((id: string): string => {
    if (id === myId) return 'You'
    const member = memberById.get(id)
    if (member?.displayName) return member.displayName
    const p = profiles?.get(id)
    if (p?.display_name || p?.username) return (p.display_name || p.username)!
    if (!isGroup && id === userId) return userName
    return 'Someone'
  }, [myId, memberById, profiles, isGroup, userId, userName])

  const avatarOf = useCallback((id: string): string | null => {
    const member = memberById.get(id)
    if (member?.avatarMediaId) return `/v1/media/${member.avatarMediaId}/serve`
    const p = profiles?.get(id)
    if (p?.avatar_media_id) return `/v1/media/${p.avatar_media_id}/serve`
    if (!isGroup && id === userId) return userAvatar && (userAvatar.startsWith('http') || userAvatar.startsWith('/')) ? userAvatar : null
    return null
  }, [memberById, profiles, isGroup, userId, userAvatar])

  // ---- Scrolling: stick to the bottom for new messages, hold still for older ones.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (preserveScrollRef.current !== null) {
      el.scrollTop = el.scrollHeight - preserveScrollRef.current
      preserveScrollRef.current = null
      return
    }
    const lastId = messages[messages.length - 1]?.id ?? null
    if (lastId !== lastBottomIdRef.current) {
      lastBottomIdRef.current = lastId
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages])

  const anyTyping = remoteTypingIds.length > 0 || typingUsers.size > 0
  useEffect(() => {
    if (anyTyping) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [anyTyping])

  // ---- Init conversation & first page
  useEffect(() => {
    let cancelled = false
    setConversationId(null)
    setChatSource(null)
    setMessages([])
    setOlderCursor(null)
    lastBottomIdRef.current = null
    const init = async () => {
      try {
        setLoading(true)
        setError(false)
        const convRes = openConversationId
          ? await getConversation(openConversationId)
          : await getOrCreateDirectConversation(userId)
        const conversationId: string =
          convRes.data?.conversation_id || convRes.data?.id || convRes.conversation_id || convRes.id || ''
        if (!conversationId) throw new Error('No conversation id returned')
        convIdRef.current = conversationId
        // A request thread: the first message goes as a request, text only.
        setIsRequestThread(
          Boolean(convRes.data?.is_request ?? (convRes as { is_request?: boolean }).is_request),
        )
        // The peer's durable read watermark (DM only), so "Seen" survives a reload.
        const convMembers = (convRes.data?.members ?? convRes.members ?? []) as Array<{ user_id?: string; last_read_at?: string }>
        const peer = convMembers.find(m => m.user_id && m.user_id !== myId)
        const peerRaw = (convRes.data?.peer ?? null) as { is_online?: boolean; last_active_at?: string } | null
        if (!cancelled) {
          setPeerLastReadAt(!group && peer?.last_read_at ? Date.parse(peer.last_read_at) : null)
          if (peerRaw) {
            setPeerPresence((prev) => ({
              isOnline: typeof peerRaw.is_online === 'boolean' ? peerRaw.is_online : prev.isOnline,
              lastActiveAt: peerRaw.last_active_at || prev.lastActiveAt,
            }))
          }
          setConversationId(conversationId)
          setChatSource(toChatSource(convRes, conversationId))
          onConversationReady?.(conversationId)
          markConversationAsViewed(conversationId)
        }
        const page = await fetchMessagePage(conversationId, null, 30)
        if (!cancelled) {
          const displayed = page.messages.map(m => toDisplay(m)).reverse()
          setMessages(displayed)
          setOlderCursor(page.nextCursor)
          if (displayed.length > 0) {
            const last = displayed[displayed.length - 1]
            markConversationRead(conversationId, last.id).catch(() => { })
            clearUnreadBadge(conversationId, last.ts)
          } else {
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
      if (convIdRef.current) {
        unmarkConversationAsViewed(convIdRef.current)
        sendTypingStop(convIdRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, myId, openConversationId])

  // Presence for the DM peer: the detailed read once, then live frames.
  useEffect(() => {
    if (isGroup || !userId) return
    let cancelled = false
    void fetchPresenceDetail([userId]).then((map) => {
      const p = map[userId]
      if (!cancelled && p) setPeerPresence((prev) => ({ isOnline: p.isOnline ?? prev.isOnline, lastActiveAt: p.lastActiveAt ?? prev.lastActiveAt }))
    })
    const unsub = subscribeToPresenceUpdates((evt) => {
      if (evt.user_id !== userId) return
      setPeerPresence((prev) => ({ isOnline: evt.online, lastActiveAt: evt.last_active_at ?? (evt.online ? prev.lastActiveAt : new Date().toISOString()) }))
    })
    return () => { cancelled = true; unsub() }
  }, [isGroup, userId])

  // Message search jumped here.
  useEffect(() => {
    if (!focusMessageId || loading) return
    const t = setTimeout(() => scrollToMessage(focusMessageId), 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMessageId, loading])

  const loadOlder = useCallback(async () => {
    const id = convIdRef.current
    if (!id || !olderCursor || loadingOlder) return
    setLoadingOlder(true)
    try {
      const page = await fetchMessagePage(id, olderCursor, 30)
      const el = scrollRef.current
      preserveScrollRef.current = el ? el.scrollHeight - el.scrollTop : null
      setMessages((prev) => prependOlder(prev, page.messages.map((m) => toDisplay(m))))
      setOlderCursor(page.nextCursor)
    } catch (err) {
      console.error('[DmChat] older page failed:', err)
    } finally {
      setLoadingOlder(false)
    }
  }, [olderCursor, loadingOlder])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (el && el.scrollTop < 120) void loadOlder()
  }, [loadOlder])

  /** Add a message we just sent (the socket may echo it too; ids dedupe). */
  const appendSent = useCallback((msg: BackendMessage | undefined) => {
    if (!msg?.id) return
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, toDisplay(msg)]))
  }, [])

  // ---- Real-time subscriptions
  useEffect(() => {
    const unsub = subscribeToMessages((msg: BackendMessage) => {
      if (msg.conversation_id !== convIdRef.current) return
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        if (msg.sender_id === myId) {
          const pending = prev.findIndex(m => m.id.startsWith('opt-') && m.text === msg.text)
          if (pending >= 0) {
            const next = [...prev]
            next[pending] = toDisplay(msg)
            return next
          }
        }
        return [...prev, toDisplay(msg)]
      })
      if (msg.sender_id !== myId && convIdRef.current) {
        // Their message ends their typing.
        setTypingUsers(prev => { if (!prev.has(msg.sender_id)) return prev; const n = new Set(prev); n.delete(msg.sender_id); return n })
        markConversationRead(convIdRef.current, msg.id).catch(() => { })
        clearUnreadBadge(convIdRef.current, msg.ts || msg.created_at)
      }
    })
    return unsub
  }, [myId, clearUnreadBadge])

  useEffect(() => subscribeToMessageEdits((evt: MessageEditedEvent) => {
    if (evt.conversation_id !== convIdRef.current) return
    setMessages(prev => prev.map(m => m.id === evt.msg_id ? { ...m, text: evt.new_text, isEdited: true, editedAt: evt.edited_at } : m))
  }), [])

  useEffect(() => subscribeToMessageDeletes((evt: MessageDeletedEvent) => {
    if (evt.conversation_id !== convIdRef.current) return
    setMessages(prev => prev.map(m => m.id === evt.msg_id ? { ...m, isDeleted: true, text: '' } : m))
  }), [])

  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>()
    const unsub = subscribeToTyping((evt: TypingEvent) => {
      if (evt.conversation_id !== convIdRef.current || evt.user_id === myId) return
      setTypingUsers(prev => {
        const next = new Set(prev)
        if (evt.is_typing) next.add(evt.user_id)
        else next.delete(evt.user_id)
        return next
      })
      const old = timers.get(evt.user_id)
      if (old) clearTimeout(old)
      // The server sends stop on a 6 s timeout too; this is the local safety net.
      if (evt.is_typing) {
        timers.set(evt.user_id, setTimeout(() => {
          setTypingUsers(prev => { const next = new Set(prev); next.delete(evt.user_id); return next })
        }, 6500))
      }
    })
    return () => { unsub(); timers.forEach(clearTimeout) }
  }, [myId])

  useEffect(() => subscribeToReadReceipts((evt: ReadReceiptEvent) => {
    if (evt.conversation_id !== convIdRef.current || evt.user_id === myId) return
    setReadReceipts(prev => {
      const next = new Map(prev)
      const readers = next.get(evt.message_id) || []
      if (!readers.includes(evt.user_id)) next.set(evt.message_id, [...readers, evt.user_id])
      return next
    })
    const at = Date.parse(evt.read_at)
    if (!Number.isNaN(at)) setPeerLastReadAt(prev => (prev === null || at > prev ? at : prev))
  }), [myId])

  useEffect(() => subscribeToReactions((evt: ReactionUpdate) => {
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
  }), [])

  useEffect(() => subscribeToPinUpdates((evt: PinUpdateEvent) => {
    if (evt.conversation_id !== convIdRef.current) return
    if (evt.action === 'unpin') setPinnedMessage(null)
    else if (convIdRef.current) getPinnedMessage(convIdRef.current).then(pinned => setPinnedMessage(pinned))
  }), [])

  useEffect(() => {
    if (!contextMenu) return
    const handler = () => { setContextMenu(null); setReactionPickerFor(null) }
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu])

  // Place the action menu beside the bubble, measured after render.
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
    let left = mine ? rect.right - bar.width : rect.left
    left = Math.max(margin, Math.min(left, window.innerWidth - margin - bar.width))
    // Below the bubble when it fits, else above it.
    let top = rect.bottom + gap
    if (top + bar.height > window.innerHeight - margin) top = rect.top - gap - bar.height
    top = Math.max(margin, Math.min(top, window.innerHeight - margin - bar.height))
    setActionBarStyle({ left, top, visibility: 'visible' })
  }, [contextMenu, reactionPickerFor])

  useEffect(() => {
    if (!showEmojiPicker) return
    const onDown = (e: MouseEvent) => {
      if (emojiPanelRef.current && !emojiPanelRef.current.contains(e.target as Node)) setShowEmojiPicker(false)
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

  // Multi-line composer grows with its text, up to a few lines.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [input])

  // ---- Handlers
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const now = Date.now()
    if (convIdRef.current && e.target.value && now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now
      sendTypingIndicator(convIdRef.current).catch(() => { })
    }
    if (e.target.value) setTyping()
    else if (convIdRef.current) sendTypingStop(convIdRef.current)
  }, [setTyping])

  const replyRef = (m: DisplayMessage | null): ReplyRef | undefined =>
    m ? { reply_to_id: m.id, reply_to_preview: m.text || undefined, reply_to_sender_id: m.senderId } : undefined

  const handleSend = useCallback(async (opts?: { kindChecked?: boolean }) => {
    const text = input.trim()
    if (!text || !convIdRef.current) return
    if (kindChat.active && !opts?.kindChecked && !(await kindChat.okToSend(text))) return
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
    sendTypingStop(convIdRef.current)
    lastTypingSentRef.current = 0
    try {
      let res
      if (replyingTo) res = await replyToMessage(convIdRef.current!, replyingTo.id, text, {
        preview: replyingTo.text,
        senderId: replyingTo.senderId,
      })
      else res = await sendMessage(convIdRef.current!, text)
      const real = res.data as BackendMessage
      setMessages(prev => {
        // The socket echo may have landed first; then just drop the optimistic copy.
        if (prev.some(m => m.id === real.id)) return prev.filter(m => m.id !== optimisticId)
        return prev.map(m => (m.id === optimisticId ? toDisplay(real) : m))
      })
      if (isRequestThread && messages.length === 0) {
        toast({
          type: 'success',
          title: 'Message request sent',
          description: 'They will see it once they accept. Accepting connects you.',
        })
      }
    } catch (err) {
      console.error('[DmChat] send failed:', err)
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
      setInput(text)
      setAttachError((err as Error)?.message || "Couldn't send that message.")
    }
  }, [input, myId, replyingTo, isRequestThread, messages.length, toast, kindChat])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as KeyboardEvent).isComposing) {
      e.preventDefault()
      if (editingMsgId) void handleSaveEdit()
      else void handleSend()
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
    } catch (err) { console.error('[DmChat] edit failed:', err); say("Couldn't edit that message") }
    setEditingMsgId(null)
    setEditText('')
  }, [editingMsgId, editText, messages, say])

  const handleDelete = useCallback(async (msg: DisplayMessage, scope: 'everyone' | 'me') => {
    if (!convIdRef.current) return
    setContextMenu(null)
    try {
      await deleteMessageScoped(convIdRef.current, msg.id, msg.ts, scope)
      setMessages(prev => scope === 'me'
        ? prev.filter(m => m.id !== msg.id)
        : prev.map(m => (m.id === msg.id ? { ...m, isDeleted: true, text: '' } : m)))
      if (scope === 'me') say('Deleted for you')
    } catch (err) {
      console.error('[DmChat] delete failed:', err)
      say(scope === 'me' ? "Couldn't delete that message" : "Couldn't unsend that message")
    }
  }, [say])

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

  const runAction = useCallback((action: MessageAction, msg: DisplayMessage) => {
    setContextMenu(null)
    switch (action) {
      case 'reply': return handleReply(msg)
      case 'copy':
        void navigator.clipboard?.writeText(msg.text).then(() => say('Copied'), () => say("Couldn't copy"))
        return
      case 'forward': return setForwarding(msg)
      case 'edit': return handleEditStart(msg)
      case 'deleteForMe': return void handleDelete(msg, 'me')
      case 'unsend': return void handleDelete(msg, 'everyone')
      case 'report': return setReporting(msg)
      default: return
    }
  }, [handleReply, handleEditStart, handleDelete, say])

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

  const handleReactionEmojiSelect = useCallback((emoji: { native: string }) => {
    if (!reactionPickerFor) return
    handleToggleReaction(reactionPickerFor, emoji.native)
    setReactionPickerFor(null)
  }, [reactionPickerFor, handleToggleReaction])

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

  const openActionsFor = useCallback((bubble: HTMLElement, msg: DisplayMessage) => {
    if (msg.isDeleted || msg.id.startsWith('opt-')) return
    const r = bubble.getBoundingClientRect()
    setReactionPickerFor(null)
    setContextMenu({
      visible: true,
      rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
      mine: msg.senderId === myId,
      messageId: msg.id,
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
      const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null
      if (!kind) throw new Error('Pick a photo or a video.')
      const mediaId = await uploadMedia(file, kind, 'chat')
      const sent = await sendMediaKindMessage(convIdRef.current, mediaId, replyRef(replyingTo))
      setReplyingTo(null)
      appendSent(sent)
    } catch (err) {
      console.error('[DmChat] media upload failed:', err)
      setAttachError(err instanceof Error ? err.message : 'Could not send that attachment.')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyingTo, appendSent])

  const handleVoice = useCallback(async (rec: { file: File; durationMs: number; waveform: number[] }) => {
    if (!convIdRef.current) return
    setVoiceBusy(true)
    setAttachError(null)
    try {
      const mediaId = await uploadMedia(rec.file, 'audio', 'chat')
      const sent = await sendVoiceMessage(convIdRef.current, mediaId, rec.durationMs, rec.waveform, replyRef(replyingTo))
      setReplyingTo(null)
      appendSent(sent)
    } catch (err) {
      console.error('[DmChat] voice failed:', err)
      setAttachError("Couldn't send the voice message.")
    } finally {
      setVoiceBusy(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyingTo, appendSent])

  const sendSticker = useCallback(async (stickerId: string) => {
    if (!convIdRef.current) return
    setShowStickers(false)
    try { appendSent(await sendStickerMessage(convIdRef.current, stickerId)) }
    catch { setAttachError("Couldn't send the sticker.") }
  }, [appendSent])

  const sendGif = useCallback(async (gif: GifSendPayload) => {
    if (!convIdRef.current) return
    setShowStickers(false)
    try { appendSent(await sendGifMessage(convIdRef.current, gif)) }
    catch { setAttachError("Couldn't send the GIF.") }
  }, [appendSent])

  // ---- Header line
  const peerPresenceText = isGroup ? null : presenceLabel(peerPresence)
  const statusText = useMemo(() => {
    if (anyTyping) {
      if (presence?.is_big_group) return 'Someone is typing…'
      const ids = Array.from(new Set([...remoteTypingIds, ...Array.from(typingUsers)]))
      if (!isGroup) return 'Typing…'
      const names = ids.map(nameOf)
      return names.length === 1 ? `${names[0]} is typing…` : `${names.length} people are typing…`
    }
    if (isGroup) {
      const n = group?.members.length ?? 0
      return n ? `${n} members` : 'Group'
    }
    if (peerPresenceText) return peerPresenceText
    if (userLastSeen) return `Last seen ${userLastSeen}`
    return null
  }, [anyTyping, presence?.is_big_group, remoteTypingIds, typingUsers, isGroup, nameOf, group?.members.length, peerPresenceText, userLastSeen])

  const isGroupStart = (i: number) => i === 0 || messages[i].senderId !== messages[i - 1].senderId
  const isGroupEnd = (i: number) => i === messages.length - 1 || messages[i].senderId !== messages[i + 1].senderId

  const lastOwnId = useMemo(() => lastOwnMessageId(messages, myId), [messages, myId])

  const isSeenByPeer = useCallback((msg: DisplayMessage): boolean => {
    if (readReceipts.has(msg.id)) return true
    if (peerLastReadAt === null) return false
    const sentAt = Date.parse(msg.ts)
    return !Number.isNaN(sentAt) && sentAt <= peerLastReadAt
  }, [readReceipts, peerLastReadAt])

  // Group "Seen by N" for my last message.
  useEffect(() => {
    if (!isGroup || !lastOwnId || !convIdRef.current) { setSeenByCount(null); return }
    let cancelled = false
    const t = setTimeout(() => {
      void fetchReadSummary(convIdRef.current!, lastOwnId).then((s) => { if (!cancelled) setSeenByCount(s ? s.count : null) }).catch(() => undefined)
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [isGroup, lastOwnId, readReceipts])

  const findMessage = useCallback((msgId: string) => messages.find(m => m.id === msgId), [messages])
  const mediaKinds = useMediaKinds(
    useMemo(() => messages.filter(m => m.mediaId && !m.extras?.media?.kind && m.type !== 'voice').map(m => m.mediaId!), [messages]),
  )
  const hasText = input.trim().length > 0
  const searchHits = useMemo(() => (threadSearch === null ? [] : searchThread(messages, threadSearch)), [messages, threadSearch])
  useEffect(() => {
    if (searchHits.length === 0) return
    const idx = Math.min(searchIndex, searchHits.length - 1)
    scrollToMessage(searchHits[searchHits.length - 1 - idx])
  }, [searchHits, searchIndex, scrollToMessage])

  const contextMsg = contextMenu ? messages.find(m => m.id === contextMenu.messageId) ?? null : null
  const headerAvatar = isGroup ? group?.avatarUrl ?? null : (userAvatar && (userAvatar.startsWith('http') || userAvatar.startsWith('/')) ? userAvatar : null)
  const sharedPostIds = useMemo(() => postCardIds(messages), [messages])
  const settingsPeer = isGroup ? null : { userId, displayName: userName, username: null, avatarUrl: headerAvatar }

  // ========================================================================
  // Render
  // ========================================================================
  return (
    <div className="flex flex-col h-full bg-brand-card relative">
      {/* Header: avatar · name · presence · voice · video · ⋯ */}
      <div className="flex shrink-0 items-center justify-between border-b border-brand-divider bg-brand-card/80 px-4 py-3 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onBack}
            aria-label="Back"
            className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand-text/60 transition-all hover:bg-brand-secondary hover:text-brand-text active:scale-95"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          </button>
          <button type="button" onClick={() => setShowSettings(true)} className="flex min-w-0 items-center gap-3 text-left">
            <InboxAvatar name={userName} src={headerAvatar} size={40} online={!isGroup && peerPresence.isOnline === true} group={isGroup} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[15px] font-bold tracking-tight text-brand-text">{userName}</span>
              {statusText && (
                <span className={`truncate text-[12px] ${anyTyping ? 'text-primary-ink' : peerPresence.isOnline && !isGroup ? 'text-success' : 'text-brand-text/60'}`}>
                  {statusText}
                </span>
              )}
            </span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {!isGroup && (
            <>
              <button title="Voice call" aria-label="Voice call" onClick={() => initiateCall(peerAsUser, 'audio')} className="flex h-10 w-10 items-center justify-center rounded-full text-brand-text/60 transition-colors hover:bg-brand-secondary hover:text-brand-text active:scale-95">
                <Phone className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </button>
              <button title="Video call" aria-label="Video call" onClick={() => initiateCall(peerAsUser, 'video')} className="flex h-10 w-10 items-center justify-center rounded-full text-brand-text/60 transition-colors hover:bg-brand-secondary hover:text-brand-text active:scale-95">
                <Video className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </button>
            </>
          )}
          <button
            title="Chat settings"
            aria-label="Chat settings"
            onClick={() => setShowSettings(true)}
            disabled={!conversationId}
            className="flex h-10 w-10 items-center justify-center rounded-full text-brand-text/60 transition-colors hover:bg-brand-secondary hover:text-brand-text active:scale-95 disabled:opacity-40"
          >
            <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
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

      {/* Search in chat (from Chat settings): matches in the loaded history. */}
      {threadSearch !== null && (
        <div className="flex shrink-0 items-center gap-2 border-b border-brand-divider bg-brand-card px-4 py-2">
          <Search className="h-4 w-4 text-brand-text/40" />
          <input
            autoFocus
            value={threadSearch}
            onChange={(e) => { setThreadSearch(e.target.value); setSearchIndex(0) }}
            placeholder="Search in this chat"
            className="min-w-0 flex-1 bg-transparent py-1 text-[13px] text-brand-text outline-hidden placeholder:text-brand-text/40"
          />
          <span className="text-[11px] tabular-nums text-brand-text/50">
            {searchHits.length ? `${Math.min(searchIndex, searchHits.length - 1) + 1}/${searchHits.length}` : threadSearch.trim().length >= 2 ? '0' : ''}
          </span>
          <button type="button" aria-label="Older match" disabled={searchHits.length < 2} onClick={() => setSearchIndex((i) => Math.min(i + 1, searchHits.length - 1))} className="flex h-7 w-7 items-center justify-center rounded-full text-brand-text/60 hover:bg-brand-secondary disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
          <button type="button" aria-label="Newer match" disabled={searchIndex === 0} onClick={() => setSearchIndex((i) => Math.max(0, i - 1))} className="flex h-7 w-7 items-center justify-center rounded-full text-brand-text/60 hover:bg-brand-secondary disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
          <button type="button" aria-label="Close search" onClick={() => setThreadSearch(null)} className="flex h-7 w-7 items-center justify-center rounded-full text-brand-text/60 hover:bg-brand-secondary"><X className="h-4 w-4" /></button>
        </div>
      )}

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
            aria-label="Unpin"
            className="w-6 h-6 rounded-md hover:bg-brand-secondary flex items-center justify-center text-brand-text/40 hover:text-brand-text/60 transition-all shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5 bg-brand-secondary/50">
        {loadingOlder && (
          <div className="flex justify-center py-2 text-brand-text/40"><Loader2 className="h-4 w-4 animate-spin" /></div>
        )}
        {!loading && !olderCursor && messages.length > 0 && !isGroup && (
          <ThreadIntro userId={userId} fallbackName={userName} fallbackAvatar={headerAvatar} />
        )}
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

        {!loading && !error && messages.length === 0 && (
          isGroup ? (
            <div className="mx-auto my-10 flex max-w-xs flex-col items-center text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-tint text-primary-ink"><Users className="h-7 w-7" /></span>
              <p className="mt-3 text-[15px] font-bold text-brand-text">{userName}</p>
              <p className="text-[12px] text-brand-text/60">Say hello to the group.</p>
            </div>
          ) : (
            <ThreadIntro userId={userId} fallbackName={userName} fallbackAvatar={headerAvatar} />
          )
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
          const kind = bubbleKind(msg, msg.mediaId ? mediaKinds[msg.mediaId] : undefined)
          const bare = isBareBubble(kind) && !msg.replyToId
          const replyTarget = msg.replyToId ? findMessage(msg.replyToId) : null
          const quote = msg.replyToId || msg.extras?.replyKind === 'note'
            ? {
                text: replyTarget
                  ? (replyTarget.isDeleted ? 'This message was deleted' : replyTarget.text || 'Attachment')
                  : (msg.replyToPreview || 'Original message'),
                senderId: replyTarget?.senderId ?? msg.replyToSenderId,
                canNavigate: Boolean(replyTarget),
              }
            : null
          const isHit = threadSearch !== null && searchHits.includes(msg.id)
          const outgoing = bubbleStyle === 'default' ? 'bg-primary-ink text-white' : bubbleClass(bubbleStyle)

          return (
            <div
              key={msg.id}
              id={`msg-${msg.id}`}
              className={`flex items-end gap-2 transition-colors rounded-lg ${isMe ? 'flex-row-reverse' : ''} ${groupStart ? 'mt-3' : 'mt-0.5'}`}
              onContextMenu={(e) => handleContextMenu(e, msg)}
            >
              {!isMe ? (
                groupEnd ? (
                  <InboxAvatar name={nameOf(msg.senderId)} src={avatarOf(msg.senderId)} size={28} />
                ) : <div className="w-7 shrink-0" />
              ) : null}

              <div className={`max-w-[72%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {isGroup && !isMe && groupStart && (
                  <p className="mb-0.5 px-1 text-[11px] font-semibold text-brand-text/60">{msg.extras?.senderDisplayName || nameOf(msg.senderId)}</p>
                )}
                {msg.extras?.forwarded && !msg.isDeleted && (
                  <p className="mb-0.5 flex items-center gap-1 px-1 text-[11px] text-brand-text/50"><Forward className="h-3 w-3" /> Forwarded</p>
                )}

                <div
                  data-bubble
                  role={msg.isDeleted ? undefined : 'button'}
                  tabIndex={msg.isDeleted ? undefined : 0}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('video, audio, a, button')) return
                    e.stopPropagation()
                    openActionsFor(e.currentTarget, msg)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openActionsFor(e.currentTarget, msg) }
                  }}
                  className={`group/bubble relative max-w-full wrap-break-word text-[14px] leading-relaxed transition-all ${msg.isDeleted ? '' : 'cursor-pointer'} ${isHit ? 'ring-2 ring-brand-accent' : ''} ${
                    msg.isDeleted
                      ? 'rounded-2xl bg-brand-secondary px-4 py-2.5 text-brand-text/60 italic'
                      : bare
                        ? 'rounded-2xl'
                        : isMe
                          ? `${outgoing} px-4 py-2.5 shadow-xs ${groupEnd ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl'}`
                          : `border border-brand-divider bg-brand-card px-4 py-2.5 text-brand-text shadow-xs ${groupEnd ? 'rounded-2xl rounded-bl-sm' : 'rounded-2xl'}`
                  }`}
                >
                  {quote && !msg.isDeleted && (
                    <div
                      role={quote.canNavigate ? 'button' : undefined}
                      tabIndex={quote.canNavigate ? 0 : undefined}
                      aria-label={quote.canNavigate ? 'Go to the quoted message' : undefined}
                      onClick={(e) => {
                        if (!quote.canNavigate) return
                        e.stopPropagation()
                        scrollToMessage(msg.replyToId!)
                      }}
                      className={`mb-2 flex gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${quote.canNavigate ? 'cursor-pointer' : ''} ${isMe ? 'bg-brand-bg/15' : 'bg-brand-text/[0.06]'}`}
                    >
                      <span className={`w-[3px] shrink-0 self-stretch rounded-full ${isMe ? 'bg-brand-bg/70' : 'bg-brand-accent'}`} />
                      <span className="min-w-0">
                        {(quote.senderId || msg.extras?.replyKind === 'note') && (
                          <span className={`block text-[11px] font-semibold leading-tight ${isMe ? 'opacity-80' : 'text-primary'}`}>
                            {quoteLabel(msg, quote.senderId ? (quote.senderId === myId ? 'You' : nameOf(quote.senderId)) : nameOf(msg.senderId === myId ? userId : msg.senderId))}
                          </span>
                        )}
                        <span className={`block line-clamp-2 text-[12px] leading-snug ${isMe ? 'opacity-70' : 'text-brand-text/60'}`}>
                          {quote.text}
                        </span>
                      </span>
                    </div>
                  )}

                  <MessageBody
                    msg={msg}
                    kind={kind}
                    mine={isMe}
                    blur={shouldBlurMedia(msg, myId, { filterOn: sensitiveFilterOn, isRequestThread })}
                    postView={msg.postId ? postCardView(msg.postId, { status: postCards.status, posts: postCards.data }) : undefined}
                    onRetryPost={() => void postCards.refetch()}
                    onOpenPost={(postId) => setViewer({ startPostId: postId, postIds: sharedPostIds })}
                    profile={(() => {
                      const id = msg.extras?.profileUserId
                      const p = id ? profiles?.get(id) : null
                      return p ? { name: p.display_name || p.username || 'Profile', username: p.username || null, avatarUrl: p.avatar_media_id ? `/v1/media/${p.avatar_media_id}/serve` : null } : null
                    })()}
                    renderText={(t) => kindChat.bubbleText(msg, t)}
                  />
                </div>
                {kindChat.afterBubble(msg)}

                {msg.isEdited && !msg.isDeleted && (
                  <p className="text-[10px] text-brand-text/40 mt-0.5 px-1">Edited</p>
                )}

                {/* Reactions: tap a chip to see who reacted. */}
                {msg.reactions && msg.reactions.length > 0 && !msg.isDeleted && (
                  <button
                    type="button"
                    onClick={() => setReactionsFor(msg)}
                    aria-label="See who reacted"
                    className={`-mt-1.5 flex items-center gap-1 rounded-full border border-brand-divider bg-brand-card px-1.5 py-0.5 text-[12px] shadow-xs hover:bg-brand-secondary ${isMe ? 'mr-2 self-end' : 'ml-2 self-start'}`}
                  >
                    {msg.reactions.slice(0, 3).map(r => <span key={r.emoji}>{r.emoji}</span>)}
                    {(() => {
                      const total = msg.reactions.reduce((n, r) => n + r.user_ids.length, 0)
                      return total > 1 ? <span className="text-[11px] tabular-nums text-brand-text/60">{total}</span> : null
                    })()}
                  </button>
                )}

                {groupEnd && (
                  <div className="mt-1 flex items-center gap-1.5 px-0.5 text-[11px] font-medium text-brand-text/50">
                    {msg.time}
                    {isMe && !msg.isDeleted && !isGroup && (
                      msg.id.startsWith('opt-') ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isSeenByPeer(msg) ? (
                        <span className="flex items-center text-receipt-seen" title="Seen"><CheckCheck className="h-4 w-4" strokeWidth={2.25} /></span>
                      ) : (
                        <span className="flex items-center text-brand-text/40" title="Sent"><Check className="h-3.5 w-3.5" strokeWidth={2.25} /></span>
                      )
                    )}
                  </div>
                )}
                {/* "Seen" under my last message (DM), "Seen by N" in a group. */}
                {msg.id === lastOwnId && !isGroup && isSeenByPeer(msg) && (
                  <p className="px-1 text-[11px] font-medium text-brand-text/50">Seen</p>
                )}
                {msg.id === lastOwnId && isGroup && seenByCount !== null && seenByCount > 0 && (
                  <button type="button" onClick={() => setSeenByFor(msg.id)} className="px-1 text-[11px] font-medium text-brand-text/50 hover:text-brand-text hover:underline">
                    Seen by {seenByCount}
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {anyTyping && !loading && (
          <TypingBubble label={statusText ?? 'Typing…'} />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Message menu: quick reactions + full picker, then the actions. */}
      {contextMenu?.visible && contextMsg && (
        <div
          role="menu"
          ref={actionBarRef}
          className="fixed z-50 flex flex-col gap-1.5"
          style={actionBarStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-0.5 self-start rounded-full border border-brand-divider bg-brand-card px-1.5 py-1 shadow-xl">
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
          </div>

          {reactionPickerFor === contextMenu.messageId ? (
            <div className="overflow-hidden rounded-2xl border border-brand-divider shadow-xl">
              <Suspense fallback={
                <div className="flex h-[320px] w-[320px] items-center justify-center bg-brand-card">
                  <span className="text-xs font-medium text-brand-text/40">Loading emojis…</span>
                </div>
              }>
                <EmojiPicker
                  data={data}
                  onEmojiSelect={handleReactionEmojiSelect}
                  theme="auto"
                  previewPosition="none"
                  skinTonePosition="none"
                  perLine={8}
                  maxFrequentRows={1}
                />
              </Suspense>
            </div>
          ) : (
            <div className="w-[200px] overflow-hidden rounded-xl border border-brand-divider bg-brand-card py-1 shadow-xl">
              {messageActions(contextMsg, myId).map((action) => {
                const Icon = ACTION_ICONS[action]
                const danger = action === 'unsend' || action === 'deleteForMe' || action === 'report'
                return (
                  <button
                    key={action}
                    type="button"
                    role="menuitem"
                    onClick={() => runAction(action, contextMsg)}
                    className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-[13px] font-medium hover:bg-brand-secondary ${danger ? 'text-danger' : 'text-brand-text'}`}
                  >
                    {MESSAGE_ACTION_LABELS[action]}
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {attachError && (
        <div role="alert" className="flex shrink-0 items-center justify-between gap-3 border-t border-brand-divider bg-danger/10 px-5 py-2.5 text-[12px] text-danger">
          <span>{attachError}</span>
          <button onClick={() => setAttachError(null)} className="shrink-0 font-semibold underline underline-offset-2">Dismiss</button>
        </div>
      )}

      {replyingTo && (
        <div className="flex shrink-0 items-center justify-between border-t border-brand-divider bg-brand-secondary/80 px-5 py-2.5 backdrop-blur-md">
          <div className="flex min-w-0 flex-1 flex-col border-l-[3px] border-brand-accent pl-3">
            <span className="text-[12px] font-bold text-brand-text/60">
              Replying to {replyingTo.senderId === myId ? 'yourself' : nameOf(replyingTo.senderId)}
            </span>
            <span className="truncate text-[13px] text-brand-highlight">{replyingTo.text || 'Attachment'}</span>
          </div>
          <button onClick={() => setReplyingTo(null)} aria-label="Cancel reply" className="flex h-8 w-8 items-center justify-center rounded-full text-brand-text/60 transition-all hover:bg-brand-secondary/80 hover:text-brand-highlight">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {kindChat.nudge(input, { onEdit: () => inputRef.current?.focus(), onSendAnyway: () => void handleSend({ kindChecked: true }) })}
      {kindChat.dialogs}

      {editingMsgId ? (
        <div className="flex shrink-0 items-center gap-3 border-t border-brand-divider bg-brand-card px-5 py-3">
          <input
            ref={editInputRef}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Edit message..."
            className="flex-1 rounded-2xl border border-transparent bg-brand-secondary px-4 py-2.5 text-[14px] text-brand-text outline-hidden transition-all placeholder:text-brand-text/60 focus:border-brand-divider focus:bg-brand-card"
          />
          <button onClick={() => void handleSaveEdit()} className="flex h-10 items-center justify-center rounded-2xl bg-primary-ink px-5 text-[13px] font-bold text-white transition-all active:scale-95">Save</button>
          <button onClick={() => { setEditingMsgId(null); setEditText('') }} className="flex h-10 items-center justify-center rounded-2xl bg-brand-secondary px-4 text-[13px] font-bold text-brand-highlight transition-all active:scale-95">Cancel</button>
        </div>
      ) : (
        /* Composer: emoji · stickers/GIFs · text (multi-line) · gallery · voice · send */
        <div className="relative shrink-0 border-t border-brand-divider bg-brand-card px-3 py-2.5">
          {showEmojiPicker && (
            <div ref={emojiPanelRef} className="absolute bottom-full left-3 mb-2 overflow-hidden rounded-2xl border border-brand-divider shadow-xl">
              <Suspense fallback={
                <div className="flex h-[380px] w-[352px] items-center justify-center bg-brand-card">
                  <span className="text-xs font-medium text-brand-text/40">Loading emojis…</span>
                </div>
              }>
                <EmojiPicker data={data} onEmojiSelect={handleEmojiSelect} theme="auto" previewPosition="none" skinTonePosition="none" perLine={9} maxFrequentRows={2} />
              </Suspense>
            </div>
          )}
          {showStickers && (
            <div className="absolute bottom-full left-3 mb-2 z-20">
              <StickerGifPanel
                onPickSticker={(s) => void sendSticker(s.id)}
                onPickGif={(g) => void sendGif(g)}
                onClose={() => setShowStickers(false)}
              />
            </div>
          )}

          <div className="flex items-end gap-1 rounded-3xl bg-brand-secondary px-1.5 ring-1 ring-transparent transition-colors focus-within:ring-brand-divider">
            {!recording && (
              <>
                <button
                  onClick={() => { setShowEmojiPicker(v => !v); setShowStickers(false) }}
                  aria-label="Emoji"
                  aria-pressed={showEmojiPicker}
                  className={`mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${showEmojiPicker ? 'text-brand-text' : 'text-brand-text/50 hover:text-brand-text'}`}
                >
                  <Smile className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </button>
                {stickerGif.available && !isRequestThread && (
                  <button
                    onClick={() => { setShowStickers(v => !v); setShowEmojiPicker(false) }}
                    aria-label="Stickers and GIFs"
                    data-sticker-gif-toggle
                    aria-pressed={showStickers}
                    className={`mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${showStickers ? 'text-brand-text' : 'text-brand-text/50 hover:text-brand-text'}`}
                  >
                    <Sticker className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  </button>
                )}
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onBlur={() => { if (convIdRef.current && input) sendTypingStop(convIdRef.current) }}
                  placeholder={isRequestThread ? 'Write a message request' : 'Message…'}
                  aria-label="Message"
                  className="min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 text-[14px] leading-5 text-brand-text outline-hidden placeholder:text-brand-text/40"
                />
              </>
            )}
            {!hasText && !isRequestThread && (
              <>
                {!recording && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Add photo or video"
                    className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand-text/50 transition-colors hover:text-brand-text"
                  >
                    <ImagePlus className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  </button>
                )}
                <div className={`mb-0.5 ${recording ? 'flex-1' : ''}`}>
                  {voiceBusy ? (
                    <span className="flex h-9 w-9 items-center justify-center text-brand-text/50"><Loader2 className="h-4 w-4 animate-spin" /></span>
                  ) : (
                    <VoiceRecorder
                      disabled={!conversationId}
                      onRecorded={(r) => void handleVoice(r)}
                      onError={(m) => setAttachError(m)}
                      onRecordingChange={setRecording}
                    />
                  )}
                </div>
              </>
            )}
            <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleMediaUpload} className="hidden" />

            {(hasText || isRequestThread) && !recording && (
              <button
                onClick={() => void handleSend()}
                disabled={!hasText}
                aria-label="Send message"
                className={`mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200 active:scale-90 ${hasText ? 'bg-send text-white hover:bg-send-hover' : 'text-brand-text/30'}`}
              >
                <Send className="h-[18px] w-[18px] -ml-px" strokeWidth={1.75} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chat settings: a page over the thread. */}
      {showSettings && conversationId && (
        <div className="absolute inset-0 z-30 flex">
          <ChatSettingsPanel
            conversationId={conversationId}
            isGroup={isGroup}
            title={userName}
            peer={settingsPeer}
            members={(group?.members ?? []).map((m) => ({ userId: m.userId, displayName: m.displayName, avatarUrl: m.avatarMediaId ? `/v1/media/${m.avatarMediaId}/serve` : null, role: m.role }))}
            onClose={() => setShowSettings(false)}
            onSearchInChat={() => { setShowSettings(false); setThreadSearch(''); setSearchIndex(0) }}
            onOpenSharedPost={(postId, postIds) => setViewer({ startPostId: postId, postIds })}
            onCleared={() => { setMessages([]); setOlderCursor(null); setShowSettings(false); say('Chat cleared') }}
            onDeleted={() => { setShowSettings(false); onChatRemoved?.() }}
            onLeft={() => { setShowSettings(false); onChatRemoved?.() }}
          />
        </div>
      )}

      {viewer && conversationId && (
        <SharedReelsViewer conversationId={conversationId} startPostId={viewer.startPostId} postIds={viewer.postIds} onClose={() => setViewer(null)} />
      )}
      {forwarding && conversationId && (
        <ForwardSheet
          sourceConversationId={conversationId}
          message={{ id: forwarding.id, text: forwarding.text, type: forwarding.type }}
          onClose={() => setForwarding(null)}
          onDone={(summary) => { setForwarding(null); say(summary) }}
        />
      )}
      {reporting && conversationId && (
        <ReportMessageSheet
          conversationId={conversationId}
          messageId={reporting.id}
          onClose={() => setReporting(null)}
          onDone={(text) => { setReporting(null); say(text) }}
        />
      )}
      {reactionsFor && conversationId && (
        <ReactionsSheet
          conversationId={conversationId}
          messageId={reactionsFor.id}
          fallback={reactionsFor.reactions ?? []}
          nameOf={nameOf}
          avatarOf={avatarOf}
          onClose={() => setReactionsFor(null)}
        />
      )}
      {seenByFor && conversationId && (
        <SeenBySheet conversationId={conversationId} messageId={seenByFor} onClose={() => setSeenByFor(null)} />
      )}
    </div>
  )
}
