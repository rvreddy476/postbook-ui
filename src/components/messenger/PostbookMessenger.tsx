'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Avatar, GRADS, getGroupColor, getInitials, hashId } from './shared'
import DmChat from './DmChat'
import ThreadDetails from './ThreadDetails'
import MessengerTopBar from './MessengerTopBar'
import NewMessageSheet from './NewMessageSheet'
import GroupPanel from './GroupPanel'
import ChannelPanel from './ChannelPanel'
import CreateGroupPanel from './CreateGroupPanel'
import { fetchUsers } from '@/services/userService'
import { getSession } from '@/services/authService'
import api from '@/lib/api'
import {
  fetchConversations,
  subscribeToPresenceUpdates,
  acceptMessageRequest,
  declineMessageRequest,
  type Conversation,
} from '@/services/messageService'
import { useMyGroups } from '@/hooks/useGroups'
import { useMyBroadcastChannels } from '@/hooks/useBroadcastChannels'
import { useNotifications } from '@/contexts/NotificationContext'
import type { User } from '@/types'
import {
  Users, MessageCircle, Plus, Hash, Search, SlidersHorizontal,
  Globe, Lock, Shield, ChevronRight, Send, MailQuestion, Check, X
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */
function SidebarSkeleton() {
  return (
    <div className="space-y-1 px-3 py-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-brand-secondary shrink-0" />
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

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export default function PostbookMessenger() {
  // No useRouter here any more: every surface this page can open — direct,
  // group, channel — opens in the column beside the list rather than
  // navigating somewhere else.
  // The four scopes the mockup's chip row shows, plus Requests, which only
  // appears when someone is actually waiting. 'unread' and 'friends' render
  // the same list from different slices of it.
  const [contactTab, setContactTab] = useState<'unread' | 'channels' | 'groups' | 'friends' | 'requests'>('friends')
  // The sliders button beside the title. A filter, not decoration.
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [activeDm, setActiveDm] = useState<User | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  // Thread details: open by default on wide screens. The conversation id is
  // reported up by DmChat, which is what resolves or creates it.
  const [showDetails, setShowDetails] = useState(true)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [friends, setFriends] = useState<User[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null)

  const currentUser = getSession()
  const { data: myGroups } = useMyGroups()
  const { getUnreadCountForUser } = useNotifications()

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const users = await fetchUsers(50, 0)
        if (cancelled) return
        const filtered = currentUser ? users.filter((u) => u.id !== currentUser.id) : users
        setFriends(filtered)
      } catch (err) {
        console.error('Failed to fetch users:', err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadConversations = useCallback(async () => {
    try {
      const result = await fetchConversations(50)
      setConversations((result.data ?? []) as Conversation[])
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const result = await fetchConversations(50)
        if (cancelled) return
        setConversations((result.data ?? []) as Conversation[])
      } catch (err) {
        console.error('Failed to fetch conversations:', err)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Real-time presence updates
  useEffect(() => {
    return subscribeToPresenceUpdates((evt) => {
      setFriends(prev =>
        prev.map(f => f.id === evt.user_id ? { ...f, isOnline: evt.online } : f)
      )
    })
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }, [])

  const getLastMessage = useCallback(
    (userId: string): { text: string; time: string; unread: number } | null => {
      // Main inbox only — request conversations are surfaced in the
      // dedicated "Requests" folder (spec §3.3) and excluded here.
      const conv = conversations.find(
        (c) =>
          !c.is_request &&
          (c.members?.some((m) => m.user_id === userId) ||
            (c as { participants?: string[] }).participants?.includes(userId) ||
            (c as { other_user_id?: string }).other_user_id === userId)
      )
      if (!conv) return null
      const lastMsg =
        conv.last_message ?? (conv as { lastMessage?: typeof conv.last_message }).lastMessage
      if (!lastMsg) return null
      const msgTime = lastMsg.created_at || lastMsg.ts || ''
      let timeDisplay = ''
      if (msgTime) {
        try {
          const d = new Date(msgTime)
          const now = new Date()
          const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
          if (diffMin < 1) timeDisplay = 'now'
          else if (diffMin < 60) timeDisplay = `${diffMin}m`
          else if (diffMin < 1440) timeDisplay = `${Math.floor(diffMin / 60)}h`
          else timeDisplay = `${Math.floor(diffMin / 1440)}d`
        } catch { timeDisplay = '' }
      }
      return { text: lastMsg.text || '(media)', time: timeDisplay, unread: getUnreadCountForUser(userId) }
    },
    [conversations, getUnreadCountForUser]
  )

  const filteredFriends = useMemo(() => {
    let list = friends
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((f) => f.name.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      const aU = getUnreadCountForUser(a.id), bU = getUnreadCountForUser(b.id)
      if (aU !== bU) return bU - aU
      return (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0)
    })
  }, [friends, search, getUnreadCountForUser])

  const filteredGroups = useMemo(() => {
    let list = myGroups ?? []
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((g) => g.name.toLowerCase().includes(q))
    }
    return [...list]
  }, [myGroups, search])

  /**
   * What the Direct and Unread chips actually show.
   *
   * Both draw the same rows: Unread is Direct narrowed to conversations with
   * something waiting, so there is one list component and no second code path
   * to drift. The sliders filter narrows either of them to people online.
   */
  const visibleFriends = useMemo(() => {
    let list = filteredFriends
    if (contactTab === 'unread') list = list.filter((f) => getUnreadCountForUser(f.id) > 0)
    if (onlineOnly) list = list.filter((f) => f.isOnline)
    return list
  }, [filteredFriends, contactTab, onlineOnly, getUnreadCountForUser])

  const unreadConversationCount = useMemo(
    () => friends.filter((f) => getUnreadCountForUser(f.id) > 0).length,
    [friends, getUnreadCountForUser]
  )

  // Channels the signed-in user belongs to. Rows leave for the channel page:
  // a broadcast channel is not a conversation this messenger can render.
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

  // Message Requests folder (spec §3.3) — conversations awaiting the
  // recipient's accept/decline decision, kept out of the main inbox.
  const requestConversations = useMemo(
    () => conversations.filter((c) => c.is_request === true),
    [conversations]
  )

  // Resolves the counterparty of a 1:1 request conversation into a
  // User-shaped object for display and for opening the DM on accept.
  const requestPeer = useCallback(
    (conv: Conversation): User => {
      const other = conv.members?.find((m) => m.user_id !== currentUser?.id)
      const member = other ?? conv.members?.[0]
      return {
        id: member?.user_id ?? '',
        name: member?.display_name || conv.title || 'Message request',
        avatar: member?.avatar_media_id
          ? `/v1/media/${member.avatar_media_id}/serve`
          : '',
      }
    },
    [currentUser?.id]
  )

  const filteredRequests = useMemo(() => {
    if (!search.trim()) return requestConversations
    const q = search.toLowerCase()
    return requestConversations.filter((c) =>
      requestPeer(c).name.toLowerCase().includes(q)
    )
  }, [requestConversations, search, requestPeer])

  const handleFriendClick = useCallback((friend: User) => {
    setActiveDm(friend)
    setActiveGroupId(null)
    setActiveChannelId(null)
    setShowCreateGroup(false)
  }, [])

  /**
   * Open a conversation named in the address: /messenger?user=<id>.
   *
   * That is how the feed's contact list and right rail hand someone over now
   * that the floating window is gone, so landing on an empty list would make
   * every one of those clicks feel broken.
   *
   * Read from window.location rather than useSearchParams, which would force
   * this page into a Suspense boundary. It runs once per id: the person comes
   * from the already-loaded list when possible, and is fetched only when the
   * list does not contain them.
   */
  const openedFromUrlRef = useRef<string | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const wanted = new URLSearchParams(window.location.search).get('user')
    if (!wanted || openedFromUrlRef.current === wanted) return

    const known = friends.find((f) => f.id === wanted)
    if (known) {
      openedFromUrlRef.current = wanted
      setActiveDm(known)
      setActiveGroupId(null)
      return
    }
    if (isLoading) return // the list may still arrive with this person in it

    let cancelled = false
    openedFromUrlRef.current = wanted
    void (async () => {
      try {
        const res = await api.get<{ data: Record<string, any> }>(`/v1/profiles/${wanted}`)
        if (cancelled) return
        const p = (res.data?.data?.profile ?? res.data?.data ?? {}) as Record<string, any>
        setActiveDm({
          id: wanted,
          name: p.display_name || p.username || 'Conversation',
          avatar: p.avatar_media_id ? `/v1/media/${p.avatar_media_id}/serve` : '',
          isOnline: false,
        })
        setActiveGroupId(null)
      } catch {
        // A bad or unreachable id should leave the list usable, not blank.
      }
    })()
    return () => { cancelled = true }
  }, [friends, isLoading])

  const handleGroupClick = useCallback((groupId: string) => {
    setActiveGroupId(groupId)
    setActiveDm(null)
    setActiveChannelId(null)
    setShowCreateGroup(false)
  }, [])

  // A channel opens in the middle column like everything else here, rather
  // than navigating to /channels/<id> and leaving the messenger behind.
  const handleChannelClick = useCallback((channelId: string) => {
    setActiveChannelId(channelId)
    setActiveDm(null)
    setActiveGroupId(null)
    setShowCreateGroup(false)
  }, [])

  const handleNewGroup = useCallback(() => {
    setShowCreateGroup(true)
    setActiveDm(null)
    setActiveGroupId(null)
    setActiveChannelId(null)
  }, [])

  const handleAcceptRequest = useCallback(
    async (conv: Conversation) => {
      if (pendingRequestId) return
      setPendingRequestId(conv.id)
      try {
        await acceptMessageRequest(conv.id)
        await loadConversations()
        showToast('Request accepted')
        // Promote into the main inbox by opening the conversation.
        const peer = requestPeer(conv)
        if (peer.id) {
          setContactTab('friends')
          setActiveDm(peer)
          setActiveGroupId(null)
          setShowCreateGroup(false)
        }
      } catch (err) {
        console.error('Failed to accept message request:', err)
        showToast('Could not accept request')
      } finally {
        setPendingRequestId(null)
      }
    },
    [pendingRequestId, loadConversations, showToast, requestPeer]
  )

  const handleDeclineRequest = useCallback(
    async (conv: Conversation) => {
      if (pendingRequestId) return
      setPendingRequestId(conv.id)
      try {
        await declineMessageRequest(conv.id)
        await loadConversations()
        showToast('Request declined')
      } catch (err) {
        console.error('Failed to decline message request:', err)
        showToast('Could not decline request')
      } finally {
        setPendingRequestId(null)
      }
    },
    [pendingRequestId, loadConversations, showToast]
  )

  const friendsUnreadTotal = useMemo(
    () => friends.reduce((sum, f) => sum + getUnreadCountForUser(f.id), 0),
    [friends, getUnreadCountForUser]
  )

  return (
    <div className="flex h-screen w-screen flex-col font-sans text-brand-text overflow-hidden">
      {/* The page sits outside the app shell, so it carries its own bar:
          a way home, global search, notifications, settings and compose. */}
      <MessengerTopBar
        onCompose={() => setShowNewMessage(true)}
        unread={friendsUnreadTotal}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* ============================================================ */}
      {/*  LEFT SIDEBAR                                                 */}
      {/* ============================================================ */}
      <div className={`w-full md:w-[340px] shrink-0 flex flex-col border-r border-brand-divider ${activeDm || activeGroupId || activeChannelId ? 'hidden md:flex' : 'flex'}`}>
        {/* Column header: what this list is, how much is unread, and the
            one filter. Who you are signed in as is no longer repeated here —
            the top bar carries the avatar, home and settings. */}
        <div className="flex items-center justify-between gap-2 px-5 pt-5">
          <h1 className="text-[13px] font-bold uppercase tracking-[0.08em] text-brand-text">
            Messages
          </h1>
          <div className="flex items-center gap-1.5">
            {friendsUnreadTotal > 0 && (
              <span className="rounded-lg bg-primary-tint px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] tabular-nums text-primary-ink">
                {friendsUnreadTotal} unread
              </span>
            )}
            <button
              onClick={() => setOnlineOnly((v) => !v)}
              aria-pressed={onlineOnly}
              aria-label="Show only people who are online"
              title={onlineOnly ? 'Showing online only' : 'Show online only'}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                onlineOnly
                  ? 'bg-primary-ink text-white'
                  : 'text-brand-text/50 hover:bg-brand-secondary hover:text-brand-text'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="px-5 pt-3 pb-3">
          {/* Filters the list beside it. The bar's search is the global one
              (people, posts, everything) and goes to /search, so the two
              fields do different jobs rather than repeating each other. */}
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text/30" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-transparent bg-brand-secondary py-2.5 pl-9 pr-4 text-sm text-brand-text outline-hidden transition-colors placeholder:text-brand-text/40 focus:border-primary-outline focus:bg-brand-bg"
            />
          </div>

          {/* The scopes, as the mockup draws them: chips, not a sliding pill.
              Requests is the one addition and appears only when somebody is
              waiting — a chip that is always empty is just noise. */}
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Conversations">
            {([
              { id: 'unread' as const, label: 'Unread', badge: unreadConversationCount },
              { id: 'channels' as const, label: 'Channels', badge: 0 },
              { id: 'groups' as const, label: 'Groups', badge: 0 },
              { id: 'friends' as const, label: 'Direct', badge: 0 },
              ...(requestConversations.length > 0
                ? [{ id: 'requests' as const, label: 'Requests', badge: requestConversations.length }]
                : []),
            ]).map((chip) => {
              const active = contactTab === chip.id
              return (
                <button
                  key={chip.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setContactTab(chip.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    active
                      ? 'bg-primary-ink text-white'
                      : 'bg-brand-secondary text-brand-text/60 hover:text-brand-text'
                  }`}
                >
                  {chip.label}
                  {chip.badge > 0 && (
                    <span
                      className={`tabular-nums text-[11px] font-bold ${
                        active ? 'text-white/70' : 'text-primary-ink'
                      }`}
                    >
                      {chip.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {isLoading ? (
            <SidebarSkeleton />
          ) : contactTab === 'channels' ? (
            /* Channels you belong to. These open the channel page: a
               broadcast channel is not a conversation this view renders. */
            filteredChannels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Hash className="w-10 h-10 text-brand-secondary mb-2" />
                <p className="text-[13px] font-medium text-brand-text/60">
                  {search ? 'No channels match your search' : 'No channels yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredChannels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => handleChannelClick(channel.id)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all group ${
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
                        {channel.subscriber_count} subscribers
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-brand-text/30" />
                  </button>
                ))}
              </div>
            )
          ) : contactTab === 'friends' || contactTab === 'unread' ? (
            /* Direct, and Unread, which is the same list narrowed down */
            visibleFriends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <MessageCircle className="w-10 h-10 text-brand-secondary mb-2" />
                <p className="text-[13px] font-medium text-brand-text/60">
                  {search
                    ? 'No friends match your search'
                    : contactTab === 'unread'
                      ? 'Nothing unread'
                      : onlineOnly
                        ? 'Nobody online right now'
                        : 'No conversations yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {visibleFriends.map((friend) => {
                  const isActive = activeDm?.id === friend.id
                  const avatarUrl = friend.avatar && (friend.avatar.startsWith('http') || friend.avatar.startsWith('/'))
                    ? friend.avatar : undefined
                  const lastMsg = getLastMessage(friend.id)
                  const unread = getUnreadCountForUser(friend.id)

                  return (
                    <button
                      key={friend.id}
                      onClick={() => handleFriendClick(friend)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all group ${
                        isActive
                          ? 'bg-primary-ink/5 border border-brand-divider'
                          : 'hover:bg-primary-ink/5 border border-transparent hover:border-brand-divider'
                      }`}
                    >
                      <Avatar user={friend} size={42} showStatus avatarUrl={avatarUrl} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-bold truncate ${isActive ? 'text-primary-ink' : 'text-brand-text'} group-hover:text-primary-ink transition-colors`}>
                            {friend.name}
                          </span>
                          {lastMsg?.time && (
                            <span className="text-[10px] text-brand-text/40 font-bold shrink-0 ml-2">{lastMsg.time}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-xs text-brand-text/60 truncate flex-1 tracking-wide leading-tight">
                            {lastMsg?.text ?? (friend.isOnline ? 'Online' : 'Offline')}
                          </span>
                          {unread > 0 && (
                            <span className="bg-primary-ink text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold px-1 shrink-0 ml-2">
                              {unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          ) : contactTab === 'requests' ? (
            /* Message Requests list (spec §3.3) */
            filteredRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <MailQuestion className="w-10 h-10 text-brand-secondary mb-2" />
                <p className="text-[13px] font-medium text-brand-text/60">
                  {search ? 'No requests match your search' : 'No message requests'}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredRequests.map((conv) => {
                  const peer = requestPeer(conv)
                  const avatarUrl =
                    peer.avatar && (peer.avatar.startsWith('http') || peer.avatar.startsWith('/'))
                      ? peer.avatar
                      : undefined
                  const lastMsg = conv.last_message?.text
                  const busy = pendingRequestId === conv.id
                  return (
                    <div
                      key={conv.id}
                      className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-transparent hover:border-brand-divider hover:bg-primary-ink/5 transition-all"
                    >
                      <Avatar user={peer} size={42} avatarUrl={avatarUrl} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold truncate block text-brand-text">
                          {peer.name}
                        </span>
                        <span className="text-xs text-brand-text/60 truncate block tracking-wide leading-tight mt-0.5">
                          {lastMsg || 'Wants to send you a message'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleAcceptRequest(conv)}
                          disabled={busy}
                          aria-label="Accept request"
                          className="w-8 h-8 rounded-lg bg-primary-ink text-brand-bg flex items-center justify-center transition-all disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeclineRequest(conv)}
                          disabled={busy}
                          aria-label="Decline request"
                          className="w-8 h-8 rounded-lg bg-brand-secondary text-brand-text/60 hover:text-brand-text flex items-center justify-center transition-all disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
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
                <div className="space-y-1.5">
                  {filteredGroups.map((group) => {
                    const isActive = activeGroupId === group.id
                    const groupColor = getGroupColor(group.id)
                    const groupAvatarUrl = group.avatar_media_id
                      ? `/v1/media/${group.avatar_media_id}/serve`
                      : null
                    const privacy = group.privacy_level ?? 'public'

                    return (
                      <button
                        key={group.id}
                        onClick={() => handleGroupClick(group.id)}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all group ${
                          isActive
                            ? 'bg-primary-ink/5 border border-brand-divider'
                            : 'hover:bg-primary-ink/5 border border-transparent hover:border-brand-divider'
                        }`}
                      >
                        {/* Group avatar */}
                        {groupAvatarUrl ? (
                          <img
                            src={groupAvatarUrl}
                            alt={group.name}
                            className="w-[42px] h-[42px] rounded-xl object-cover shrink-0"
                          />
                        ) : (
                          <div
                            className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0"
                            style={{ background: groupColor }}
                          >
                            {group.name.charAt(0).toUpperCase()}
                          </div>
                        )}

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

              {/* New Group button */}
              <button
                onClick={handleNewGroup}
                className="w-full mt-2 py-4 text-[10px] font-black tracking-widest rounded-2xl bg-primary-ink text-brand-bg flex items-center justify-center gap-2 transition-all"
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
      <div className={`flex-1 flex flex-col min-w-0 bg-brand-secondary ${!activeDm && !activeGroupId && !activeChannelId ? 'hidden md:flex' : 'flex'}`}>
        {/* One column, one open thing. A direct chat, a group and a channel
            are three shapes of the same conversation slot; GroupPanel used
            to render as a sibling of this column, which put an empty-state
            panel alongside the group you had just opened. */}
        {activeDm ? (
          <DmChat
            userId={activeDm.id}
            userName={activeDm.name}
            userAvatar={activeDm.avatar}
            userOnline={activeDm.isOnline ?? false}
            onBack={() => setActiveDm(null)}
            detailsOpen={showDetails}
            onToggleDetails={() => setShowDetails((v) => !v)}
            onConversationReady={setActiveConversationId}
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
            // Without this, creating a group from inside the panel falls
            // back to router.push('/groups/<id>') and leaves the messenger.
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

      {/* Third column: who you are talking to, and what is in the thread.
          Only for direct conversations — a group already has GroupPanel — and
          only from xl, below which the conversation needs the whole width. */}
      {activeDm && showDetails && (
        <div className="hidden xl:flex">
          <ThreadDetails
            peerId={activeDm.id}
            conversationId={activeConversationId}
            onClose={() => setShowDetails(false)}
          />
        </div>
      )}

      {/* GroupPanel moved into the conversation column above. CreateGroup
          is a portalled modal, so it stays here. */}
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

      {/* Compose: the same sheet the feed's chat panel uses, so starting a
          conversation works identically wherever you begin it. */}
      {showNewMessage && (
        <div className="fixed inset-0 z-1000 flex items-start justify-center bg-brand-text/20 p-4 pt-16">
          <div className="relative h-[520px] w-full max-w-md overflow-hidden rounded-2xl border border-brand-divider bg-brand-bg shadow-2xl">
            <NewMessageSheet
              onClose={() => setShowNewMessage(false)}
              onOpened={(user) => {
                setActiveDm(user)
                setActiveGroupId(null)
              }}
            />
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-9999 px-6 py-3 bg-primary-ink text-white text-[13px] font-semibold rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toast}
        </div>
      )}
    </div>
  )
}
