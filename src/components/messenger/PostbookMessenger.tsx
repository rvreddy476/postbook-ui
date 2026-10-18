'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { getGroupColor } from './shared'
import DmChat from './DmChat'
import ThreadDetails from './ThreadDetails'
import MessengerTopBar from './MessengerTopBar'
import NewMessageSheet from './NewMessageSheet'
import NewChannelSheet from './NewChannelSheet'
import GroupPanel from './GroupPanel'
import ChannelPanel from './ChannelPanel'
import CreateGroupPanel from './CreateGroupPanel'
import { getSession } from '@/services/authService'
import api from '@/lib/api'
import {
  getConversation,
  acceptMessageRequest,
  declineMessageRequest,
} from '@/services/messageService'
import { useMyGroups } from '@/hooks/useGroups'
import { useMyBroadcastChannels } from '@/hooks/useBroadcastChannels'
import { useMyProfile } from '@/hooks/useEditProfile'
import type { User } from '@/types'
import { decodeRequestSender, type ChatPeer, type InboxRow } from '@/lib/chat/contract'
import { inboxUnreadTotal, rowName, rowPreview, unreadPillText } from '@/lib/chat/inbox'
import { useInbox } from './inbox/useInbox'
import { InboxRowItem, type RowAction } from './inbox/InboxRowItem'
import { InboxAvatar } from './inbox/InboxAvatar'
import { NotesRow } from './inbox/NotesRow'
import { ActivityStatusButton } from './inbox/ActivityStatus'
import { InboxSearch } from './inbox/InboxSearch'
import {
  Users, MessageCircle, Plus, Hash, Search, Bell, UserPlus,
  Lock, Shield, ChevronRight, Send, MailQuestion, Check, X, Loader2,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */
function SidebarSkeleton() {
  return (
    <div className="space-y-1 px-3 py-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
          <div className="h-12 w-12 rounded-full bg-brand-secondary shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 bg-brand-secondary rounded-sm" />
            <div className="h-2.5 w-16 bg-brand-secondary rounded-sm" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Empty state (shown when no DM is selected)                         */
/* ------------------------------------------------------------------ */
function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-brand-text/10 to-brand-text/5 flex items-center justify-center mb-5">
        <Send className="w-8 h-8 text-brand-text/40" />
      </div>
      <h3 className="text-lg font-bold text-brand-text mb-1">Your Messages</h3>
      <p className="text-sm text-brand-text/60 max-w-xs text-center">
        Select a conversation to start messaging or pick a group to chat with your community.
      </p>
    </div>
  )
}

/** A confirm step for the destructive row actions. */
function ConfirmDialog({ title, body, confirm, onCancel, onConfirm, busy }: {
  title: string; body: string; confirm: string; onCancel: () => void; onConfirm: () => void; busy?: boolean
}) {
  return (
    <div className="fixed inset-0 z-1100 flex items-center justify-center bg-brand-text/30 p-4" onClick={onCancel}>
      <div role="alertdialog" aria-label={title} onClick={(e) => e.stopPropagation()} className="w-full max-w-xs rounded-2xl border border-brand-divider bg-brand-card p-4 shadow-2xl">
        <h2 className="text-[15px] font-semibold text-brand-text">{title}</h2>
        <p className="mt-1 text-[13px] text-brand-text/70">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-[13px] font-semibold text-brand-text hover:bg-brand-secondary">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-danger px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{confirm}
          </button>
        </div>
      </div>
    </div>
  )
}

/** A chat-service group conversation open in the middle column. */
interface OpenGroupChat {
  conversationId: string
  title: string
  avatarUrl: string | null
  members: InboxRow['members']
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export default function PostbookMessenger() {
  // The scopes the chip row shows, in that order. Requests only appears
  // when someone is actually waiting.
  const [contactTab, setContactTab] = useState<'channels' | 'groups' | 'friends' | 'requests'>('friends')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [activeDm, setActiveDm] = useState<(User & { lastActiveAt?: string | null }) | null>(null)
  /**
   * The conversation the open DM belongs to, when it is known (opened from a
   * row, a request or ?conversation=<id>). The DM then opens exactly this
   * conversation rather than resolving one by person.
   */
  const [urlConversation, setUrlConversation] = useState<{ peerId: string; conversationId: string } | null>(null)
  /** A message to scroll to once the thread opens (from message search). */
  const [focusMessageId, setFocusMessageId] = useState<string | null>(null)
  const [activeGroupChat, setActiveGroupChat] = useState<OpenGroupChat | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(true)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null)
  const [requestFilter, setRequestFilter] = useState<'all' | 'filtered'>('all')
  const [confirmDelete, setConfirmDelete] = useState<InboxRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const currentUser = getSession()
  const myId = currentUser?.id ?? ''
  const { data: myProfile } = useMyProfile()
  const { data: myGroups } = useMyGroups()

  const openConversationId = activeGroupChat?.conversationId ?? activeConversationId
  const inbox = useInbox(myId, openConversationId)
  const { rows, requests, filteredRequests, loading: isLoading } = inbox.state

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }, [])

  /*
    The server's reason, when it gave one. A flat 'Could not accept request'
    hid "only the recipient can accept this request" for days.
  */
  const serverMessage = (err: unknown, fallback: string): string => {
    const body = (err as { body?: { error?: { message?: string } } })?.body
    const fromBody = body?.error?.message
    if (fromBody) return fromBody
    const msg = (err as { message?: string })?.message
    return msg && msg !== 'Request failed' ? msg : fallback
  }

  const clearOpen = () => {
    setActiveDm(null)
    setActiveGroupChat(null)
    setActiveGroupId(null)
    setActiveChannelId(null)
    setShowCreateGroup(false)
  }

  /** Open a person's DM. With a conversation id, exactly that conversation. */
  const openPerson = useCallback((person: { id: string; name: string; avatar: string; isOnline?: boolean; lastActiveAt?: string | null }, conversationId?: string) => {
    clearOpen()
    setUrlConversation(conversationId ? { peerId: person.id, conversationId } : null)
    setActiveDm({ id: person.id, name: person.name, avatar: person.avatar, isOnline: person.isOnline ?? false, lastActiveAt: person.lastActiveAt ?? null })
    if (conversationId) inbox.markOpened(conversationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inbox.markOpened])

  const openRow = useCallback((row: InboxRow, messageId?: string) => {
    setFocusMessageId(messageId ?? null)
    if (row.isGroup) {
      clearOpen()
      setUrlConversation(null)
      setActiveGroupChat({ conversationId: row.id, title: rowName(row, myId), avatarUrl: row.avatarUrl, members: row.members })
      inbox.markOpened(row.id)
      return
    }
    if (!row.peer) return
    openPerson(
      { id: row.peer.userId, name: row.peer.displayName, avatar: row.peer.avatarUrl ?? '', isOnline: row.peer.isOnline === true, lastActiveAt: row.peer.lastActiveAt },
      row.id,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, openPerson, inbox.markOpened])

  const openPeer = useCallback((p: ChatPeer) => {
    const row = rows.find((r) => !r.isGroup && r.peer?.userId === p.userId)
    if (row) return openRow(row)
    openPerson({ id: p.userId, name: p.displayName, avatar: p.avatarUrl ?? '', isOnline: p.isOnline === true, lastActiveAt: p.lastActiveAt })
  }, [rows, openRow, openPerson])

  const onRowAction = useCallback(async (row: InboxRow, action: RowAction) => {
    try {
      if (action === 'pin') { await inbox.pin(row); showToast(row.isPinned ? 'Unpinned' : 'Pinned to top') }
      else if (action === 'mute') { await inbox.mute(row); showToast(row.isMuted ? 'Unmuted' : 'Muted') }
      else if (action === 'archive' && showArchived) { await inbox.unarchive(row); showToast('Moved back to your chats') }
      else if (action === 'archive') { await inbox.archive(row); showToast('Chat archived') }
      else if (action === 'read') { await inbox.markRead(row) }
      else if (action === 'unread') {
        const ok = await inbox.markUnread(row)
        showToast(ok ? 'Marked as unread' : "Marking chats unread isn't available yet")
      }
      else if (action === 'delete') setConfirmDelete(row)
    } catch (err) {
      showToast(serverMessage(err, "Couldn't update that chat"))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inbox, showToast, showArchived])

  const doDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      const ok = await inbox.removeForMe(confirmDelete)
      if (!ok) showToast("Deleting chats isn't available yet")
      else {
        showToast('Chat deleted')
        if (openConversationId === confirmDelete.id) clearOpen()
      }
    } catch (err) {
      showToast(serverMessage(err, "Couldn't delete that chat"))
    } finally {
      setDeleting(false)
      setConfirmDelete(null)
    }
  }

  const filteredGroups = useMemo(() => {
    let list = myGroups ?? []
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((g) => g.name.toLowerCase().includes(q))
    }
    return [...list]
  }, [myGroups, search])

  const visibleRows = useMemo(() => (unreadOnly ? rows.filter((r) => r.unreadCount > 0) : rows), [rows, unreadOnly])
  const unreadConversationCount = useMemo(() => rows.filter((r) => r.unreadCount > 0).length, [rows])
  const unreadTotal = useMemo(() => inboxUnreadTotal(rows, myId), [rows, myId])

  // Channels the signed-in user belongs to.
  const { data: myChannels } = useMyBroadcastChannels()
  const filteredChannels = useMemo(() => {
    const list = myChannels ?? []
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(
      (c) => c.name.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q)
    )
  }, [myChannels, search])

  const selectedGroup = useMemo(
    () => (myGroups ?? []).find((g) => g.id === activeGroupId) ?? null,
    [myGroups, activeGroupId]
  )

  /*
    Requests (spec §3.3, CONTRACT §7). Direction matters: `created_by` is the
    requester, so a request is INCOMING only when somebody else created it.
    A request I SENT stays in Direct, marked as waiting.
  */
  const sentRequestIds = useMemo(
    () => new Set(rows.filter((r) => r.isRequest && r.createdBy === myId).map((r) => r.id)),
    [rows, myId]
  )
  const requestList = requestFilter === 'filtered' && filteredRequests ? filteredRequests : requests
  const filteredRequestList = useMemo(() => {
    if (!search.trim()) return requestList
    const q = search.toLowerCase()
    return requestList.filter((r) => [rowName(r, myId), r.peer?.username ?? ''].join(' ').toLowerCase().includes(q))
  }, [requestList, search, myId])

  /**
   * Open a lane named in the address: /messenger?lane=requests — where the
   * message-request notification lands.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const lane = new URLSearchParams(window.location.search).get('lane')
    if (lane === 'requests') setContactTab('requests')
    else if (lane === 'groups' || lane === 'channels') setContactTab(lane)
  }, [])

  /** /messenger?lane=channels&channel=<id>: this panel is the only channel surface. */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const wanted = new URLSearchParams(window.location.search).get('channel')
    if (!wanted) return
    setContactTab('channels')
    setActiveChannelId(wanted)
    setActiveDm(null)
    setActiveGroupId(null)
  }, [])

  /**
   * /messenger?conversation=<id>: one existing conversation, fetched by id and
   * never resolved through the person (a dating match's chat is its own).
   */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const wanted = new URLSearchParams(window.location.search).get('conversation')
    if (!wanted) return
    let cancelled = false
    void (async () => {
      try {
        const res = await getConversation(wanted)
        const conv = (res?.data ?? res ?? {}) as {
          id?: string
          type?: string
          title?: string
          members?: Array<{ user_id?: string; display_name?: string; avatar_media_id?: string }>
          sender?: unknown
        }
        if (cancelled || !conv.id) return
        if (conv.type === 'group') {
          setActiveGroupChat({
            conversationId: conv.id,
            title: conv.title || 'Group',
            avatarUrl: null,
            members: (conv.members ?? []).filter((m) => m.user_id).map((m) => ({ userId: m.user_id!, role: null, displayName: m.display_name || null, avatarMediaId: m.avatar_media_id || null, lastReadAt: null })),
          })
          return
        }
        const peer = (conv.members ?? []).find((m) => m.user_id && m.user_id !== myId)
        // A request's detail carries the sender: "Deleted account", their name, or @username.
        const sender = decodeRequestSender(conv.sender)
        const peerId = peer?.user_id || (sender?.peer && sender.peer.userId !== myId ? sender.peer.userId : null)
        if (!peerId) return
        const fromSender = sender !== null && (sender.deleted || sender.peer?.userId === peerId)
        const memberAvatar = peer?.avatar_media_id ? `/v1/media/${peer.avatar_media_id}/serve` : ''
        setUrlConversation({ peerId, conversationId: conv.id })
        setActiveDm({
          id: peerId,
          name: fromSender ? sender.label : peer?.display_name || 'Someone',
          avatar: sender?.deleted ? '' : (fromSender ? sender.peer?.avatarUrl : null) || memberAvatar,
          isOnline: false,
        })
        setActiveGroupId(null)
        setActiveChannelId(null)
      } catch {
        // Not a member, or the id is gone: leave the list usable.
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * /messenger?user=<id>: how the feed's contact list hands someone over.
   * Their existing conversation opens when it is in the inbox; otherwise the
   * profile is fetched and the DM resolves the direct thread.
   */
  const openedFromUrlRef = useRef<string | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const wanted = new URLSearchParams(window.location.search).get('user')
    if (!wanted || openedFromUrlRef.current === wanted) return
    const known = rows.find((r) => !r.isGroup && r.peer?.userId === wanted)
    if (known) {
      openedFromUrlRef.current = wanted
      openRow(known)
      return
    }
    if (isLoading) return
    let cancelled = false
    openedFromUrlRef.current = wanted
    void (async () => {
      try {
        const res = await api.get<{ data: Record<string, any> }>(`/v1/profiles/${wanted}`)
        if (cancelled) return
        const p = (res.data?.data?.profile ?? res.data?.data ?? {}) as Record<string, any>
        openPerson({
          id: wanted,
          name: p.display_name || (p.username ? `@${p.username}` : 'Someone'),
          avatar: p.avatar_media_id ? `/v1/media/${p.avatar_media_id}/serve` : '',
        })
      } catch {
        // A bad or unreachable id should leave the list usable, not blank.
      }
    })()
    return () => { cancelled = true }
  }, [rows, isLoading, openRow, openPerson])

  const handleGroupClick = useCallback((groupId: string) => {
    clearOpen()
    setActiveGroupId(groupId)
  }, [])

  const handleChannelClick = useCallback((channelId: string) => {
    clearOpen()
    setActiveChannelId(channelId)
  }, [])

  const handleNewGroup = useCallback(() => {
    clearOpen()
    setShowCreateGroup(true)
  }, [])

  const handleAcceptRequest = useCallback(
    async (row: InboxRow) => {
      if (pendingRequestId) return
      setPendingRequestId(row.id)
      try {
        await acceptMessageRequest(row.id)
        await inbox.reload()
        showToast('Request accepted')
        setContactTab('friends')
        openRow({ ...row, isRequest: false })
      } catch (err) {
        console.error('Failed to accept message request:', err)
        showToast(serverMessage(err, 'Could not accept request'))
      } finally {
        setPendingRequestId(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingRequestId, inbox.reload, showToast, openRow]
  )

  const handleDeclineRequest = useCallback(
    async (row: InboxRow) => {
      if (pendingRequestId) return
      setPendingRequestId(row.id)
      try {
        await declineMessageRequest(row.id)
        await inbox.reload()
        showToast('Request declined')
      } catch (err) {
        console.error('Failed to decline message request:', err)
        showToast(serverMessage(err, 'Could not decline request'))
      } finally {
        setPendingRequestId(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingRequestId, inbox.reload, showToast]
  )

  // Infinite scroll: the sentinel at the end of the list loads the next page.
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !inbox.state.hasMore) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void inbox.loadMore()
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inbox.loadMore, inbox.state.hasMore])

  const anyOpen = Boolean(activeDm || activeGroupChat || activeGroupId || activeChannelId)
  const myName = myProfile?.display_name || currentUser?.name || 'You'
  const myAvatar = myProfile?.avatar_media_id ? `/v1/media/${myProfile.avatar_media_id}/serve` : null
  const searching = search.trim().length > 0

  return (
    <div className="flex h-screen w-screen flex-col font-sans text-brand-text overflow-hidden">
      <MessengerTopBar
        onCompose={() => setShowNewMessage(true)}
        unread={unreadTotal}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* ============================================================ */}
      {/*  LEFT SIDEBAR                                                 */}
      {/* ============================================================ */}
      <div className={`w-full md:w-[360px] shrink-0 flex flex-col border-r border-brand-divider ${anyOpen ? 'hidden md:flex' : 'flex'}`}>
        {/* Header: add people · "Messages" + activity status · unread filter */}
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          <button
            type="button"
            onClick={() => setShowNewMessage(true)}
            aria-label="New message"
            title="New message"
            className="flex h-9 w-9 items-center justify-center rounded-full text-brand-text/70 hover:bg-brand-secondary hover:text-brand-text"
          >
            <UserPlus className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
          <div className="flex items-center gap-1">
            <h1 className="text-[15px] font-bold text-brand-text">Messages</h1>
            <ActivityStatusButton />
          </div>
          {unreadConversationCount > 0 ? (
            <button
              onClick={() => {
                setUnreadOnly((v) => !v)
                setContactTab('friends')
              }}
              aria-pressed={unreadOnly}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors active:scale-95 ${
                unreadOnly
                  ? 'bg-primary-ink text-white'
                  : 'bg-primary-tint text-primary-ink hover:bg-primary-outline/50'
              }`}
            >
              <span className="tabular-nums">{unreadConversationCount}</span>
              Unread
            </button>
          ) : <span className="w-9" />}
        </div>

        <div className="px-4 pt-3 pb-3">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text/30" />
            <input
              type="search"
              placeholder="Search people, chats and messages"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-transparent bg-brand-secondary py-2.5 pl-9 pr-4 text-[13px] text-brand-text outline-hidden transition-colors placeholder:text-brand-text/40 focus:border-primary-outline focus:bg-brand-bg"
            />
          </div>

          <div className="flex items-center gap-1.5" role="tablist" aria-label="Conversations">
            {([
              { id: 'friends' as const, label: 'Direct', badge: 0 },
              { id: 'groups' as const, label: 'Groups', badge: 0 },
              { id: 'channels' as const, label: 'Channels', badge: 0 },
              ...(requests.length > 0
                ? [{ id: 'requests' as const, label: 'Requests', badge: requests.length }]
                : []),
            ]).map((chip) => {
              const active = contactTab === chip.id
              return (
                <button
                  key={chip.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setContactTab(chip.id)
                    if (chip.id !== 'friends') setUnreadOnly(false)
                  }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    active
                      ? 'bg-primary-ink text-white'
                      : 'bg-brand-secondary text-brand-text/60 hover:text-brand-text'
                  }`}
                >
                  {chip.label}
                  {chip.badge > 0 && (
                    <span className={`tabular-nums text-[11px] font-bold ${active ? 'text-white/70' : 'text-primary-ink'}`}>
                      {chip.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="h-px shrink-0 bg-brand-divider" />

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto px-2 pt-2 pb-3">
          {contactTab === 'channels' ? (
            <>
            {filteredChannels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Hash className="w-10 h-10 text-brand-secondary mb-2" />
                <p className="text-[13px] font-medium text-brand-text/60">
                  {search ? 'No channels match your search' : 'No channels yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredChannels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => handleChannelClick(channel.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${
                      activeChannelId === channel.id
                        ? 'bg-primary-ink/5 border border-brand-divider'
                        : 'border border-transparent hover:border-brand-divider hover:bg-primary-ink/5'
                    }`}
                  >
                    <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-brand-secondary text-brand-text/60">
                      <Hash className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="block truncate text-sm font-bold text-brand-text group-hover:text-primary-ink transition-colors">
                        {channel.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs leading-tight tracking-wide text-brand-text/60">
                        @{channel.handle}
                        <span className="px-1.5 text-brand-text/30">·</span>
                        {channel.subscriber_count} {channel.subscriber_count === 1 ? 'subscriber' : 'subscribers'}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-brand-text/30" />
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowNewChannel(true)}
              className="w-full mt-2 py-4 text-[11px] font-bold tracking-wide rounded-2xl bg-primary-ink text-brand-bg flex items-center justify-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              New Channel
            </button>
            </>
          ) : contactTab === 'friends' ? (
            searching ? (
              <InboxSearch query={search} rows={rows} myId={myId} onOpenPerson={openPeer} onOpenRow={openRow} />
            ) : isLoading ? (
              <SidebarSkeleton />
            ) : showArchived ? (
              <>
                <div className="flex items-center justify-between px-3 pb-2 pt-1">
                  <h2 className="text-[13px] font-semibold text-brand-text">Archived chats</h2>
                  <button type="button" onClick={() => setShowArchived(false)} className="text-[12px] font-semibold text-primary-ink hover:underline">Back to chats</button>
                </div>
                {inbox.archived === null ? (
                  <SidebarSkeleton />
                ) : inbox.archived.length === 0 ? (
                  <p className="px-3 py-10 text-center text-[13px] text-brand-text/60">No archived chats. Archive a chat from its menu to tuck it away here.</p>
                ) : (
                  <div className="space-y-0.5">
                    {inbox.archived.map((row) => (
                      <InboxRowItem key={row.id} row={row} myId={myId} archived active={openConversationId === row.id} onOpen={(r) => openRow(r)} onAction={(r, a) => void onRowAction(r, a)} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {!unreadOnly && (
                  <>
                    <NotesRow myName={myName} myAvatar={myAvatar} onOpenPerson={(u) => openPeer({ userId: u.id, displayName: u.name, username: null, avatarUrl: u.avatar || null, isOnline: null, lastActiveAt: null })} />
                    {/* Pinned rows: Activity, then Requests with their count. */}
                    <Link href="/notifications" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-brand-secondary">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-ink">
                        <Bell className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-brand-text">Activity</span>
                        <span className="block truncate text-[12px] text-brand-text/60">Likes, comments, follows and mentions</span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-brand-text/30" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => { setContactTab('requests'); setRequestFilter('all') }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-brand-secondary"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-brand-text/70">
                        <MailQuestion className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-brand-text">Message requests</span>
                        <span className="block truncate text-[12px] text-brand-text/60">
                          {requests.length > 0
                            ? (requests.length > 1 ? `${rowName(requests[0], myId)} and ${requests.length - 1} more want to message you` : `${rowName(requests[0], myId)} wants to message you`)
                            : 'No pending requests'}
                        </span>
                      </span>
                      {requests.length > 0 && (
                        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary-ink px-1.5 text-[10px] font-bold tabular-nums text-white">
                          {unreadPillText(requests.length)}
                        </span>
                      )}
                    </button>
                  </>
                )}

                {inbox.state.error && rows.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <p className="text-[13px] text-brand-text/60">Couldn&apos;t load your chats.</p>
                    <button type="button" onClick={() => void inbox.reload()} className="mt-2 text-[13px] font-semibold text-primary-ink hover:underline">Try again</button>
                  </div>
                ) : visibleRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <MessageCircle className="w-10 h-10 text-brand-secondary mb-2" />
                    <p className="text-[13px] font-medium text-brand-text/60">
                      {unreadOnly ? 'Nothing unread' : 'No conversations yet'}
                    </p>
                    {!unreadOnly && (
                      <button type="button" onClick={() => setShowNewMessage(true)} className="mt-2 text-[13px] font-semibold text-primary-ink hover:underline">Start a chat</button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {visibleRows.map((row) => (
                      <InboxRowItem
                        key={row.id}
                        row={row}
                        myId={myId}
                        active={openConversationId === row.id}
                        sentRequestWaiting={sentRequestIds.has(row.id)}
                        onOpen={(r) => openRow(r)}
                        onAction={(r, a) => void onRowAction(r, a)}
                      />
                    ))}
                    <div ref={sentinelRef} />
                    {!inbox.state.hasMore && !unreadOnly && (
                      <button type="button" onClick={() => { setShowArchived(true); void inbox.loadArchived() }} className="mx-auto mt-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-brand-text/60 hover:bg-brand-secondary hover:text-brand-text">
                        Archived chats
                      </button>
                    )}
                    {inbox.state.loadingMore && (
                      <div className="flex justify-center py-3 text-brand-text/40"><Loader2 className="h-4 w-4 animate-spin" /></div>
                    )}
                  </div>
                )}
              </>
            )
          ) : contactTab === 'requests' ? (
            <>
              {filteredRequests && filteredRequests.length > 0 && (
                <div className="flex items-center gap-1.5 px-2 pb-2" role="tablist" aria-label="Requests">
                  {(['all', 'filtered'] as const).map((f) => (
                    <button
                      key={f}
                      role="tab"
                      aria-selected={requestFilter === f}
                      onClick={() => setRequestFilter(f)}
                      className={`rounded-lg px-3 py-1 text-[12px] font-semibold ${requestFilter === f ? 'bg-brand-text text-brand-bg' : 'bg-brand-secondary text-brand-text/60'}`}
                    >
                      {f === 'all' ? `All ${requests.length}` : `Filtered ${filteredRequests.length}`}
                    </button>
                  ))}
                </div>
              )}
              {requestFilter === 'filtered' && (
                <p className="px-3 pb-2 text-[12px] text-brand-text/60">
                  Requests that might be spam or unsafe. Photos and videos stay blurred until you tap them.
                </p>
              )}
              {filteredRequestList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <MailQuestion className="w-10 h-10 text-brand-secondary mb-2" />
                  <p className="text-[13px] font-medium text-brand-text/60">
                    {search ? 'No requests match your search' : 'No message requests'}
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredRequestList.map((row) => {
                    const name = rowName(row, myId)
                    const busy = pendingRequestId === row.id
                    return (
                      <div key={row.id} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-brand-secondary">
                        {/* Opening the request opens the conversation. Typing a
                            reply there accepts it server-side. */}
                        <button onClick={() => openRow(row)} className="flex flex-1 min-w-0 items-center gap-3 text-left">
                          <InboxAvatar name={name} src={row.peerDeleted ? null : row.peer?.avatarUrl} size={48} />
                          <div className="flex-1 min-w-0">
                            <span className="block truncate text-[14px] font-semibold text-brand-text">{name}</span>
                            {row.peer?.username && !row.peerDeleted && name !== `@${row.peer.username}` && (
                              <span className="block truncate text-[11px] leading-tight text-brand-text/40">@{row.peer.username}</span>
                            )}
                            <span className="mt-0.5 block truncate text-[12px] text-brand-text/60">
                              {rowPreview(row, myId).text}
                            </span>
                          </div>
                        </button>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => handleAcceptRequest(row)} disabled={busy} aria-label="Accept request" className="w-8 h-8 rounded-lg bg-primary-ink text-brand-bg flex items-center justify-center transition-all disabled:opacity-50">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeclineRequest(row)} disabled={busy} aria-label="Decline request" className="w-8 h-8 rounded-lg bg-brand-secondary text-brand-text/60 hover:text-brand-text flex items-center justify-center transition-all disabled:opacity-50">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            /* Groups list */
            <>
              {filteredGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Users className="w-10 h-10 text-brand-secondary mb-2" />
                  <p className="text-[13px] font-medium text-brand-text/60">
                    {search ? 'No groups match your search' : 'No groups yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredGroups.map((group) => {
                    const isActive = activeGroupId === group.id
                    const groupAvatarUrl = group.avatar_media_id
                      ? `/v1/media/${group.avatar_media_id}/serve`
                      : null
                    const privacy = group.privacy_level ?? 'public'
                    return (
                      <button
                        key={group.id}
                        onClick={() => handleGroupClick(group.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${
                          isActive
                            ? 'bg-primary-ink/5 border border-brand-divider'
                            : 'hover:bg-primary-ink/5 border border-transparent hover:border-brand-divider'
                        }`}
                      >
                        <InboxAvatar name={group.name} src={groupAvatarUrl} size={42} group />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-sm font-bold truncate ${isActive ? 'text-primary-ink' : 'text-brand-text'} group-hover:text-primary-ink transition-colors`}>
                              {group.name}
                            </span>
                            {privacy === 'private' && <Lock className="w-3 h-3 text-brand-text/30 shrink-0" />}
                            {privacy === 'restricted' && <Shield className="w-3 h-3 text-brand-text/30 shrink-0" />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-brand-text/60 flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {group.member_count}
                            </span>
                            {group.handle && (
                              <span className="text-[11px] text-brand-text/30">@{group.handle}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-brand-secondary shrink-0" />
                      </button>
                    )
                  })}
                </div>
              )}
              <button
                onClick={handleNewGroup}
                className="w-full mt-2 py-4 text-[11px] font-bold tracking-wide rounded-2xl bg-primary-ink text-brand-bg flex items-center justify-center gap-2 transition-all"
              >
                <Plus className="w-4 h-4" />
                New Group
              </button>
            </>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  MAIN CONTENT                                                  */}
      {/* ============================================================ */}
      <div className={`flex-1 flex flex-col min-w-0 bg-brand-secondary ${!anyOpen ? 'hidden md:flex' : 'flex'}`}>
        {activeDm ? (
          <DmChat
            key={`dm-${activeDm.id}-${urlConversation?.conversationId ?? ''}`}
            userId={activeDm.id}
            userName={activeDm.name}
            userAvatar={activeDm.avatar}
            userOnline={activeDm.isOnline ?? false}
            userLastActiveAt={activeDm.lastActiveAt ?? null}
            onBack={() => setActiveDm(null)}
            detailsOpen={showDetails}
            onToggleDetails={() => setShowDetails((v) => !v)}
            onConversationReady={setActiveConversationId}
            conversationId={urlConversation?.peerId === activeDm.id ? urlConversation.conversationId : undefined}
            focusMessageId={focusMessageId}
            onChatRemoved={() => { clearOpen(); void inbox.reload() }}
            onToast={showToast}
          />
        ) : activeGroupChat ? (
          <DmChat
            key={`group-${activeGroupChat.conversationId}`}
            userId=""
            userName={activeGroupChat.title}
            userAvatar={activeGroupChat.avatarUrl ?? ''}
            userOnline={false}
            onBack={() => setActiveGroupChat(null)}
            onConversationReady={setActiveConversationId}
            conversationId={activeGroupChat.conversationId}
            group={{ title: activeGroupChat.title, avatarUrl: activeGroupChat.avatarUrl, members: activeGroupChat.members }}
            focusMessageId={focusMessageId}
            onChatRemoved={() => { clearOpen(); void inbox.reload() }}
            onToast={showToast}
          />
        ) : activeGroupId && selectedGroup ? (
          <GroupPanel
            groupId={activeGroupId}
            groupName={selectedGroup.name}
            groupColor={getGroupColor(activeGroupId)}
            groupAvatarUrl={
              selectedGroup.avatar_media_id
                ? `/v1/media/${selectedGroup.avatar_media_id}/serve`
                : null
            }
            onClose={() => setActiveGroupId(null)}
            onCreateGroup={handleGroupClick}
          />
        ) : activeChannelId ? (
          <ChannelPanel
            channelId={activeChannelId}
            onBack={() => setActiveChannelId(null)}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Third column: who you are talking to. DMs only, from xl. */}
      {activeDm && showDetails && (
        <div className="hidden xl:flex">
          <ThreadDetails
            peerId={activeDm.id}
            conversationId={activeConversationId}
            onClose={() => setShowDetails(false)}
          />
        </div>
      )}

      {showCreateGroup && (
        <CreateGroupPanel
          onClose={() => setShowCreateGroup(false)}
          onCreated={(groupId) => {
            setShowCreateGroup(false)
            setActiveGroupId(groupId)
            showToast('Group created!')
          }}
        />
      )}

      </div>

      {/* Compose: recents + people search; pick several to start a group. */}
      {showNewMessage && (
        <div className="fixed inset-0 z-1000 flex items-start justify-center bg-brand-text/20 p-4 pt-16">
          <div className="relative h-[560px] max-h-[85vh] w-full max-w-md overflow-hidden rounded-2xl border border-brand-divider bg-brand-bg shadow-2xl">
            <NewMessageSheet
              recents={rows}
              onClose={() => setShowNewMessage(false)}
              onOpened={(user, conversationId) => openPerson({ id: user.id, name: user.name, avatar: user.avatar }, conversationId)}
              onOpenedGroup={(conversationId, title, members) => {
                clearOpen()
                setActiveGroupChat({ conversationId, title, avatarUrl: null, members })
                void inbox.reload()
              }}
            />
          </div>
        </div>
      )}

      {showNewChannel && (
        <div className="fixed inset-0 z-1000 flex items-start justify-center bg-brand-text/20 p-4 pt-16">
          <div className="relative max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-brand-divider bg-brand-bg shadow-2xl">
            <NewChannelSheet
              onClose={() => setShowNewChannel(false)}
              onCreated={(channelId) => {
                setShowNewChannel(false)
                handleChannelClick(channelId)
                showToast('Channel created!')
              }}
            />
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this chat?"
          body="It's removed from your inbox and your copy of the history is cleared. The other person keeps theirs. A new message brings the chat back."
          confirm="Delete"
          busy={deleting}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => void doDelete()}
        />
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-9999 px-6 py-3 bg-primary-ink text-white text-[13px] font-semibold rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toast}
        </div>
      )}
    </div>
  )
}
