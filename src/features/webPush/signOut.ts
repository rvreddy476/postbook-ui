/*
  Signing out removes this device's push registration (founder, 15 Oct 2026).

  Called by the app's sign-out BEFORE the session is cleared, synchronously,
  and it never throws. The sign-out is followed at once by a navigation, so:

    1. the DELETE goes out as a keepalive fetch, which survives the page
       going away, carrying the access token that is still in memory;
    2. the row is also listed as stale, so the same account deletes it again
       at its next sign-in if the DELETE never landed (the route is
       idempotent, and only the owner can delete a row);
    3. the push subscription is dropped (best effort) and the next
       registration on this browser must start from a NEW token — so even a
       row the DELETE missed points at a token FCM has retired, and nothing
       meant for this account can reach whoever uses the browser next.

  The account's "on" choice is kept: when the SAME account signs in again
  and the browser still grants permission, its registration is restored.
  Another account never inherits it.

  Inert when web push is not configured, and when this account never turned
  it on: no request, no storage write. Imports nothing heavy — no Firebase,
  no API client — because the auth service imports it.
*/

import { peekAccessToken } from "@/lib/accessToken"

import { PUSH_SW_SCOPE, devicePath, readWebPushConfig, type WebPushConfig } from "./config"
import { browserWebPushStore, type WebPushStore } from "./state"

export interface SignOutDeps {
    config: WebPushConfig | null
    store: WebPushStore
    accessToken(): string | null
    /** A fetch that outlives the page. */
    send(url: string, init: RequestInit): void
    /** Drops the push subscription, best effort. */
    dropSubscription(): void
    apiBase: string
}

function randomKey(): string | undefined {
    try {
        return crypto.randomUUID()
    } catch {
        return undefined
    }
}

export function browserSignOutDeps(): SignOutDeps {
    return {
        config: readWebPushConfig(),
        store: browserWebPushStore,
        accessToken: peekAccessToken,
        send(url, init) {
            if (typeof fetch !== "function") return
            void fetch(url, init).catch(() => undefined)
        },
        dropSubscription() {
            try {
                if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
                void navigator.serviceWorker
                    .getRegistration(PUSH_SW_SCOPE)
                    .then((reg) => (reg && new URL(reg.scope).pathname === PUSH_SW_SCOPE ? reg.pushManager.getSubscription() : null))
                    .then((sub) => sub?.unsubscribe())
                    .catch(() => undefined)
            } catch {
                /* the next registration drops it instead (resetToken) */
            }
        },
        apiBase: process.env.NEXT_PUBLIC_API_BASE_URL || "",
    }
}

export function noteWebPushSignOut(userId: string | null | undefined, deps?: SignOutDeps): void {
    try {
        if (!userId) return
        const d = deps ?? browserSignOutDeps()
        if (!d.config) return
        const state = d.store.read()
        const rec = state.users[userId]
        if (!rec?.deviceId) return

        const token = d.accessToken()
        if (token) {
            const headers: Record<string, string> = {
                Authorization: `Bearer ${token}`,
                "X-User-Id": userId,
                "X-Requested-With": "XMLHttpRequest",
            }
            const key = randomKey()
            if (key) headers["Idempotency-Key"] = key
            d.send(`${d.apiBase}${devicePath(rec.deviceId)}`, { method: "DELETE", keepalive: true, headers })
        }

        state.stale = [...state.stale.filter((s) => s.deviceId !== rec.deviceId), { userId, deviceId: rec.deviceId }]
        state.users[userId] = { on: rec.on }
        state.resetToken = true
        d.store.write(state)
        d.dropSubscription()
    } catch {
        /* sign-out must never fail because of push */
    }
}
