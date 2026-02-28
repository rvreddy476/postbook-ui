"use client"

import { useSyncExternalStore } from "react"
import { AuthSessionStore } from "@/services/auth/AuthSessionStore"
import type { User } from "@/types"

const sessionStore = new AuthSessionStore()

// Cache the snapshot so useSyncExternalStore gets a stable reference.
// Only update when the serialised value actually changes.
let cachedUser: User | null = null
let cachedRaw: string | null = null

function readSnapshot(): User | null {
    const raw = typeof window !== "undefined"
        ? localStorage.getItem("postbook_session")
        : null
    if (raw === cachedRaw) return cachedUser
    cachedRaw = raw
    cachedUser = raw ? (JSON.parse(raw) as User) : null
    return cachedUser
}

// Minimal auth store compatible with the profile system
// Reads from the existing AuthSessionStore (localStorage)
function subscribe(cb: () => void) {
    window.addEventListener("storage", cb)
    return () => window.removeEventListener("storage", cb)
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
