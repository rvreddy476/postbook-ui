'use client'

/*
  The Messages inbox, from GET /v1/chat/conversations (CONTRACT §1).

  This replaced a Direct list built from /v1/profiles/discover — a list of
  PEOPLE, so a real conversation with anyone not in that page never showed,
  and strangers with no conversation did. Now a row exists exactly when a
  conversation does. Dating chats stay out (messengerConversations rule).
*/

import { useCallback, useEffect, useRef, useState } from 'react'

import { subscribeToMessages, subscribeToPresenceUpdates, markConversationRead, type Message } from '@/services/messageService'
import {
  deleteChatForMe,
  fetchInbox,
  fetchMessagePage,
  fetchRequestsPage,
  setConversationUnread,
  updateConversationPrefs,
  type PrefsPatch,
} from '@/services/chatParityApi'
import type { InboxRow } from '@/lib/chat/contract'
import { alertPrefsCache, asAlertTone } from '@/lib/chat/alertTone'
import {
  applyLiveMessage,
  archivedLane,
  filteredLaneOrNull,
  isIncomingRequest,
  markedUnreadPatch,
  mergeInboxPages,
  patchRow,
  primaryRows,
  READ_PATCH,
  withoutDating,
} from '@/lib/chat/inbox'

/** The inbox list carries each chat's tone and mute: the alert sound reads them. */
function primeAlerts(rows: readonly InboxRow[]): void {
  for (const r of rows) {
    if (r.alertTone) alertPrefsCache.set(r.id, { tone: asAlertTone(r.alertTone), muted: r.isMuted })
  }
}

const PAGE = 30

export interface InboxState {
  rows: InboxRow[]
  requests: InboxRow[]
  filteredRequests: InboxRow[] | null
  loading: boolean
  error: boolean
  hasMore: boolean
  loadingMore: boolean
}

export function useInbox(myId: string, openConversationId: string | null) {
  const [rows, setRows] = useState<InboxRow[]>([])
  const [requests, setRequests] = useState<InboxRow[]>([])
  const [filteredRequests, setFilteredRequests] = useState<InboxRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const openRef = useRef(openConversationId)
  openRef.current = openConversationId
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadRequests = useCallback(async () => {
    let all: InboxRow[] = []
    try {
      const page = await fetchRequestsPage(myId, 'all')
      all = withoutDating(page.rows).filter((r) => isIncomingRequest({ ...r, isRequest: true }, myId))
      setRequests(all)
    } catch {
      setRequests([])
    }
    try {
      const filtered = await fetchRequestsPage(myId, 'filtered')
      setFilteredRequests(filteredLaneOrNull(all, withoutDating(filtered.rows)))
    } catch {
      setFilteredRequests(null)
    }
  }, [myId])

  /** Archived chats, read on demand (lane=archived). */
  const [archived, setArchived] = useState<InboxRow[] | null>(null)
  const loadArchived = useCallback(async () => {
    try {
      const page = await fetchInbox(myId, { lane: 'archived', limit: 50 })
      setArchived(archivedLane(page.rows, rows))
    } catch {
      setArchived([])
    }
  }, [myId, rows])

  const unarchive = async (row: InboxRow) => {
    setArchived((prev) => (prev ?? []).filter((r) => r.id !== row.id))
    await updateConversationPrefs(row.id, { label: 'none' })
    void reload()
  }

  const reload = useCallback(async () => {
    if (!myId) return
    try {
      const page = await fetchInbox(myId, { lane: 'primary', limit: PAGE })
      // A full reload replaces the list (a hidden/archived row must go).
      primeAlerts(page.rows)
      setRows(mergeInboxPages([], page.rows))
      setCursor(page.nextCursor)
      setError(false)
    } catch (err) {
      console.error('[inbox] load failed:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
    void loadRequests()
  }, [myId, loadRequests])

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await fetchInbox(myId, { lane: 'primary', cursor, limit: PAGE })
      primeAlerts(page.rows)
      setRows((prev) => mergeInboxPages(prev, page.rows))
      setCursor(page.nextCursor)
    } catch (err) {
      console.error('[inbox] next page failed:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [cursor, loadingMore, myId])

  useEffect(() => {
    void reload()
  }, [reload])

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) return
    refetchTimer.current = setTimeout(() => {
      refetchTimer.current = null
      void reload()
    }, 600)
  }, [reload])

  // Live: a message moves its row up; an unknown conversation triggers a refetch.
  useEffect(() => {
    return subscribeToMessages((m: Message) => {
      if (!m?.conversation_id) return
      setRows((prev) => {
        const next = applyLiveMessage(
          prev,
          { conversationId: m.conversation_id, senderId: m.sender_id, type: m.type, text: m.text, at: m.created_at || m.ts || new Date().toISOString() },
          myId,
          openRef.current,
        )
        if (next === null) {
          scheduleRefetch()
          return prev
        }
        return next
      })
    })
  }, [myId, scheduleRefetch])

  // Live presence: patch the peer of every DM with that person.
  useEffect(() => {
    return subscribeToPresenceUpdates((evt) => {
      setRows((prev) =>
        prev.map((r) =>
          r.peer && r.peer.userId === evt.user_id
            ? { ...r, peer: { ...r.peer, isOnline: evt.online, lastActiveAt: evt.last_active_at ?? r.peer.lastActiveAt } }
            : r,
        ),
      )
    })
  }, [])

  useEffect(() => () => { if (refetchTimer.current) clearTimeout(refetchTimer.current) }, [])

  const rowsRef = useRef(rows)
  rowsRef.current = rows

  /**
   * Opening a thread reads it. The thread's own POST /read clears a mark I
   * set; a thread with nothing to read never sends one, so the mark is
   * cleared here too.
   */
  const markOpened = useCallback((conversationId: string) => {
    const wasMarked = rowsRef.current.some((r) => r.id === conversationId && r.markedUnread)
    setRows((prev) => prev.map((r) => (r.id === conversationId && (r.unreadCount > 0 || r.markedUnread) ? { ...r, ...READ_PATCH } : r)))
    if (wasMarked) void setConversationUnread(conversationId, false).catch(() => undefined)
  }, [])

  const setPrefs = useCallback(async (row: InboxRow, patch: PrefsPatch, local: Partial<InboxRow>) => {
    const before = rows
    setRows((prev) => patchRow(prev, row.id, local))
    try {
      await updateConversationPrefs(row.id, patch)
    } catch (err) {
      setRows(before)
      throw err
    }
  }, [rows])

  const pin = (row: InboxRow) =>
    setPrefs(row, { is_pinned: !row.isPinned }, { isPinned: !row.isPinned, pinnedAt: !row.isPinned ? new Date().toISOString() : null })
  const mute = async (row: InboxRow) => {
    await setPrefs(row, { is_muted: !row.isMuted }, { isMuted: !row.isMuted })
    alertPrefsCache.patch(row.id, { muted: !row.isMuted, muteUntil: null })
  }

  const archive = async (row: InboxRow) => {
    const before = rows
    setRows((prev) => prev.filter((r) => r.id !== row.id))
    try {
      await updateConversationPrefs(row.id, { label: 'archived' })
    } catch (err) {
      setRows(before)
      throw err
    }
  }

  /** Delete chat = hide for me + clear my history. false when the route is not there yet. */
  const removeForMe = async (row: InboxRow): Promise<boolean> => {
    const res = await deleteChatForMe(row.id)
    if (res === null) return false
    setRows((prev) => prev.filter((r) => r.id !== row.id))
    return true
  }

  /** Mark read: the server cursor moves to the newest message we know of. */
  const markRead = async (row: InboxRow, latestMessageId?: string) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...READ_PATCH } : r)))
    // A mark I set goes with it, even when there is nothing new to read.
    if (row.markedUnread) await setConversationUnread(row.id, false).catch(() => undefined)
    let id = latestMessageId
    if (!id) {
      try {
        id = (await fetchMessagePage(row.id, null, 1)).messages[0]?.id
      } catch {
        id = undefined
      }
    }
    if (id) await markConversationRead(row.id, id).catch(() => undefined)
  }

  /**
   * Mark unread (PUT /unread): the row shows unread until I open or read it.
   * false when the server has no route yet (the row is put back); a server
   * error puts it back and throws.
   */
  const markUnread = async (row: InboxRow): Promise<boolean> => {
    const before = rowsRef.current.find((r) => r.id === row.id)
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...markedUnreadPatch(r) } : r)))
    const restore = () => {
      if (before) setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, unreadCount: before.unreadCount, markedUnread: before.markedUnread } : r)))
    }
    try {
      const res = await setConversationUnread(row.id, true)
      if (res === null) {
        restore()
        return false
      }
      return true
    } catch (err) {
      restore()
      throw err
    }
  }

  return {
    state: {
      rows: primaryRows(rows, myId),
      requests,
      filteredRequests,
      loading,
      error,
      hasMore: Boolean(cursor),
      loadingMore,
    } satisfies InboxState,
    allRows: rows,
    archived,
    loadArchived,
    unarchive,
    reload,
    loadMore,
    markOpened,
    pin,
    mute,
    archive,
    removeForMe,
    markRead,
    markUnread,
  }
}
