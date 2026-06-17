"use client"

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { subscribeToMessages, fetchConversations, fetchMessages, Message } from "@/services/messageService"
import { playNotificationSound } from "@/hooks/useNotificationSound"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UnreadState {
    counts: Record<string, number>              // conversationId → unread count
    lastSeenTimestamps: Record<string, string>  // conversationId → ISO timestamp
    userConvMap: Record<string, string>          // userId → conversationId
}

interface NotificationContextValue {
    unreadCounts: Record<string, number>
    totalUnread: number
    soundEnabled: boolean
    markConversationAsViewed: (convId: string) => void
    unmarkConversationAsViewed: (convId: string) => void
    markConversationRead: (convId: string, lastMsgTs?: string) => void
    registerConversationMapping: (userId: string, convId: string) => void
    getUnreadCountForUser: (userId: string) => number
    clearAllUnread: () => void
    toggleSound: (enabled: boolean) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

/* ------------------------------------------------------------------ */
/*  localStorage helpers                                               */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "postbook_unread_state"

function loadState(): UnreadState {
    if (typeof window === "undefined") return { counts: {}, lastSeenTimestamps: {}, userConvMap: {} }
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) return JSON.parse(raw) as UnreadState
    } catch { /* corrupted */ }
    return { counts: {}, lastSeenTimestamps: {}, userConvMap: {} }
}

function saveState(state: UnreadState) {
    if (typeof window === "undefined") return
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch { /* quota */ }
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

interface ProviderProps {
    currentUserId: string
    /** Deprecated — the new-message toast was removed; kept optional so
     *  existing callers that still pass it don't break. */
    onOpenChat?: (contact: { id: string; name: string; avatar: string }) => void
    children: React.ReactNode
}

export function NotificationProvider({ currentUserId, children }: ProviderProps) {
    const [state, setState] = useState<UnreadState>(loadState)
    const [viewedConversations, setViewedConversations] = useState<Set<string>>(new Set())
    const [soundEnabled, setSoundEnabled] = useState(true)

    const stateRef = useRef(state)
    stateRef.current = state

    const viewedRef = useRef(viewedConversations)
    viewedRef.current = viewedConversations

    // Debounced localStorage persistence
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const persistState = useCallback((next: UnreadState) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => saveState(next), 100)
    }, [])

    // Deduplicate messages — track last 200 message IDs
    const seenIdsRef = useRef<Set<string>>(new Set())

    /* ---- Message subscription ---- */
    useEffect(() => {
        const unsub = subscribeToMessages((msg: Message) => {
            // Skip own messages
            if (msg.sender_id === currentUserId) return

            // Skip duplicates
            if (seenIdsRef.current.has(msg.id)) return
            seenIdsRef.current.add(msg.id)
            if (seenIdsRef.current.size > 200) {
                const iter = seenIdsRef.current.values()
                seenIdsRef.current.delete(iter.next().value as string)
            }

            const convId = msg.conversation_id

            // If conversation is currently viewed (open ChatWindow), auto-mark read
            if (viewedRef.current.has(convId)) {
                setState((prev) => {
                    const next = {
                        ...prev,
                        lastSeenTimestamps: { ...prev.lastSeenTimestamps, [convId]: msg.created_at },
                        userConvMap: { ...prev.userConvMap, [msg.sender_id]: convId },
                    }
                    persistState(next)
                    return next
                })
                return
            }

            // Increment unread count
            setState((prev) => {
                const next = {
                    ...prev,
                    counts: { ...prev.counts, [convId]: (prev.counts[convId] || 0) + 1 },
                    userConvMap: { ...prev.userConvMap, [msg.sender_id]: convId },
                }
                persistState(next)
                return next
            })

            // Sound only — the on-screen "new message" toast was removed
            // (it showed a raw user-id and duplicated the unread badges).
            if (soundEnabled) {
                playNotificationSound()
            }
        })

        return unsub
    }, [currentUserId, soundEnabled, persistState])

    /* ---- Offline recovery on mount ---- */
    useEffect(() => {
        // No user = nothing to recover
        if (!currentUserId) return

        const recoverOffline = async () => {
            try {
                // background=true: a stale/expired token must NOT force-logout here
                const convResult = await fetchConversations(50, undefined, true)
                const conversations = convResult.data ?? []

                for (const conv of conversations) {
                    const convId = conv.conversation_id || conv.id
                    if (!convId) continue

                    const lastSeen = stateRef.current.lastSeenTimestamps[convId]

                    // Fetch latest message
                    const msgResult = await fetchMessages(convId, 1, undefined, true)
                    const msgs: Message[] = msgResult.data ?? []
                    if (msgs.length === 0) continue

                    const latestMsg = msgs[0]

                    // Skip own messages
                    if (latestMsg.sender_id === currentUserId) continue

                    // If we've never seen this convo or there are newer messages
                    if (!lastSeen || new Date(latestMsg.created_at) > new Date(lastSeen)) {
                        // Fetch up to 30 messages and count unread
                        const batchResult = await fetchMessages(convId, 30, undefined, true)
                        const batch: Message[] = batchResult.data ?? []
                        let unreadCount = 0
                        for (const m of batch) {
                            if (m.sender_id === currentUserId) continue
                            if (lastSeen && new Date(m.created_at) <= new Date(lastSeen)) continue
                            unreadCount++
                        }

                        if (unreadCount > 0) {
                            setState((prev) => {
                                const next = {
                                    ...prev,
                                    counts: { ...prev.counts, [convId]: unreadCount },
                                    userConvMap: {
                                        ...prev.userConvMap,
                                        [latestMsg.sender_id]: convId,
                                    },
                                }
                                persistState(next)
                                return next
                            })
                        }
                    }
                }
            } catch (err) {
                // Silently ignore — expired token or network error during recovery
                // should never kick the user out of the app.
                if (process.env.NODE_ENV === 'development') {
                    console.warn("Offline recovery skipped:", (err as Error).message)
                }
            }
        }

        recoverOffline()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUserId])

    /* ---- Context actions ---- */

    const markConversationAsViewed = useCallback((convId: string) => {
        setViewedConversations((prev) => new Set(prev).add(convId))
    }, [])

    const unmarkConversationAsViewed = useCallback((convId: string) => {
        setViewedConversations((prev) => {
            const next = new Set(prev)
            next.delete(convId)
            return next
        })
    }, [])

    const markConversationRead = useCallback((convId: string, lastMsgTs?: string) => {
        setState((prev) => {
            const next = {
                ...prev,
                counts: { ...prev.counts, [convId]: 0 },
                lastSeenTimestamps: lastMsgTs
                    ? { ...prev.lastSeenTimestamps, [convId]: lastMsgTs }
                    : prev.lastSeenTimestamps,
            }
            persistState(next)
            return next
        })
    }, [persistState])

    const registerConversationMapping = useCallback((userId: string, convId: string) => {
        setState((prev) => {
            if (prev.userConvMap[userId] === convId) return prev
            const next = {
                ...prev,
                userConvMap: { ...prev.userConvMap, [userId]: convId },
            }
            persistState(next)
            return next
        })
    }, [persistState])

    const getUnreadCountForUser = useCallback(
        (userId: string): number => {
            const convId = state.userConvMap[userId]
            if (!convId) return 0
            return state.counts[convId] || 0
        },
        [state.userConvMap, state.counts]
    )

    const totalUnread = useMemo(
        () => Object.values(state.counts).reduce((sum, n) => sum + n, 0),
        [state.counts]
    )

    const clearAllUnread = useCallback(() => {
        const next: UnreadState = { counts: {}, lastSeenTimestamps: {}, userConvMap: {} }
        setState(next)
        saveState(next)
    }, [])

    const toggleSound = useCallback((enabled: boolean) => {
        setSoundEnabled(enabled)
    }, [])

    const value = useMemo<NotificationContextValue>(
        () => ({
            unreadCounts: state.counts,
            totalUnread,
            soundEnabled,
            markConversationAsViewed,
            unmarkConversationAsViewed,
            markConversationRead,
            registerConversationMapping,
            getUnreadCountForUser,
            clearAllUnread,
            toggleSound,
        }),
        [
            state.counts,
            totalUnread,
            soundEnabled,
            markConversationAsViewed,
            unmarkConversationAsViewed,
            markConversationRead,
            registerConversationMapping,
            getUnreadCountForUser,
            clearAllUnread,
            toggleSound,
        ]
    )

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    )
}

const NOOP_VALUE: NotificationContextValue = {
    unreadCounts: {},
    totalUnread: 0,
    soundEnabled: false,
    markConversationAsViewed: () => {},
    unmarkConversationAsViewed: () => {},
    markConversationRead: () => {},
    registerConversationMapping: () => {},
    getUnreadCountForUser: () => 0,
    clearAllUnread: () => {},
    toggleSound: () => {},
}

export function useNotifications() {
    const ctx = useContext(NotificationContext)
    return ctx ?? NOOP_VALUE
}
