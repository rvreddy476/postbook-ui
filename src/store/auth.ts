"use client"

import { useSyncExternalStore } from "react"
import type { User } from "@/types"

const SESSION_CHANGE_EVENT = "postbook:session-changed"

// Cache the snapshot so useSyncExternalStore gets a stable reference.
// Only update when the serialised value actually changes.
let cachedUser: User | null = null
let cachedRaw: string | null = null

function readSnapshot(): User | null {
    const raw = typeof window !== "undefined"
        ? localStorage.getItem("postbook_session")
        : null
    if (raw === cachedRaw) return cachedUser
    try {
        cachedRaw = raw
        cachedUser = raw ? (JSON.parse(raw) as User) : null
    } catch {
        try {
            localStorage.removeItem("postbook_session")
        } catch {
            // ignore storage errors
        }
        cachedRaw = null
        cachedUser = null
    }
    return cachedUser
}

// Minimal auth store compatible with the profile system
// Reads from the existing AuthSessionStore (localStorage)
function subscribe(cb: () => void) {
    const notify = () => cb()
    window.addEventListener("storage", notify)
    window.addEventListener(SESSION_CHANGE_EVENT, notify)
    return () => {
        window.removeEventListener("storage", notify)
        window.removeEventListener(SESSION_CHANGE_EVENT, notify)
    }
}

function getSnapshot() {
    return readSnapshot()
}

function getServerSnapshot() {
    return null
}

export function useAuthUser() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

// Compatibility shim matching web-nextjs's useAuthStore
export const useAuthStore = <T>(selector: (s: { user: { id: string } | null }) => T): T => {
    const user = useAuthUser()
    const compat = user ? { id: user.id } : null
    return selector({ user: compat })
}
