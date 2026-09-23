"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * People this viewer has already sent a message request to.
 *
 * Suggestion lists filtered on `connection_status === 'pending_sent'`, which
 * was right while the control sent a CONNECTION request. It sends a MESSAGE
 * request now, and that never touches connection_status — so the filter
 * stopped matching, and somebody you had just messaged sat in "People you may
 * know" asking to be messaged again, every time, pushing out someone you could
 * actually act on.
 *
 * This is the client's own record, kept so the row disappears the instant the
 * request is sent rather than after some service recomputes. It is a module
 * store rather than component state because two surfaces show suggestions —
 * the right rail and the people strip — and they must agree: sending from one
 * has to remove the person from the other.
 *
 * sessionStorage, not localStorage: it needs to survive a reload during a
 * session, and it is a display hint rather than a fact about the account.
 * Losing it costs one redundant row, and the durable answer belongs in the
 * suggestion source, which should not offer somebody you already have a
 * conversation with.
 */

const KEY = "postbook_sent_message_requests"

let ids = new Set<string>()
let loaded = false
const listeners = new Set<() => void>()
/** useSyncExternalStore compares by reference, so the snapshot is cached. */
let snapshot: ReadonlySet<string> = ids

function load() {
    if (loaded || typeof window === "undefined") return
    loaded = true
    try {
        const raw = sessionStorage.getItem(KEY)
        if (raw) {
            ids = new Set(JSON.parse(raw) as string[])
            snapshot = ids
        }
    } catch {
        // A private window, blocked storage, or something else in the key:
        // an empty set shows one extra row, which is the harmless outcome.
    }
}

function emit() {
    // A NEW set each time: mutating in place would leave the reference equal
    // and useSyncExternalStore would not re-render.
    snapshot = new Set(ids)
    ids = snapshot as Set<string>
    listeners.forEach((l) => l())
}

export function markRequestSent(userId: string) {
    if (!userId) return
    load()
    if (ids.has(userId)) return
    ids = new Set(ids).add(userId)
    try {
        sessionStorage.setItem(KEY, JSON.stringify([...ids]))
    } catch {
        // Storage is a convenience here; the in-memory set still works.
    }
    emit()
}

function subscribe(listener: () => void) {
    load()
    listeners.add(listener)
    return () => { listeners.delete(listener) }
}

function getSnapshot(): ReadonlySet<string> {
    load()
    return snapshot
}

/** The server renders suggestions too; it has no session storage to read. */
function getServerSnapshot(): ReadonlySet<string> {
    return EMPTY
}
const EMPTY: ReadonlySet<string> = new Set()

export function useSentRequests() {
    const sent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

    const hasSent = useCallback((userId: string) => sent.has(userId), [sent])

    return { sent, hasSent, markRequestSent }
}
