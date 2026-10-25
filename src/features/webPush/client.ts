/*
  Web push on this device: enable, disable, keep the registration fresh.

  HOW A BROWSER GETS PUSHES
  -------------------------
  notification-service sends every "web" device through FCM HTTP v1
  (internal/push/fcm.go: POST /v1/projects/{id}/messages:send with
  message.token). That `token` must be an FCM registration token. A raw Web
  Push subscription (endpoint + keys) is not one, and FCM v1 has no field for
  it, so the browser has to mint the token the way Firebase does: subscribe
  with the Web Push (VAPID) key, then exchange that subscription with FCM's
  registration API. That exchange is the Firebase JS SDK's getToken(); doing
  it by hand would mean re-implementing Firebase Installations and an
  undocumented registration API. So the SDK is used for that one call — and
  only that call: it is loaded on demand (firebaseToken.ts, a dynamic import)
  when the person turns push on, never on page load and never at all when
  the configuration is missing. The service worker is our own plain file
  (public/push-sw.js); it needs no Firebase code and no configuration.

  The device row: POST /v1/notifications/devices
      { platform: "web", push_token, app: "momentum" }  → 201 { data: { id, … } }
  is an upsert on (user, platform, token); DELETE /v1/notifications/devices/:id
  removes it and answers 200 whether or not the row existed.

  Everything here takes its browser, network and storage as arguments, so the
  rules are tested without a browser (see browser.ts for the real wiring).
*/

import type { WebPushConfig } from "./config"
import type { DeviceRecord, WebPushStore } from "./state"

export type PushPermission = "unsupported" | "default" | "granted" | "denied"

export interface PushSubscriptionLike {
    unsubscribe(): Promise<boolean>
}

export interface PushRegistrationLike {
    pushManager: { getSubscription(): Promise<PushSubscriptionLike | null> }
}

export interface RegisterDeviceBody {
    platform: "web"
    push_token: string
    app: "momentum"
}

export interface WebPushDeps<R extends PushRegistrationLike = PushRegistrationLike> {
    /** null when any NEXT_PUBLIC_FIREBASE_* value is missing: everything is a no-op. */
    config: WebPushConfig | null
    /** Notification, service workers and PushManager all present (and a secure context). */
    supported(): boolean
    permission(): NotificationPermission
    requestPermission(): Promise<NotificationPermission>
    /** Registers (or returns) the push worker and waits until it is active. */
    registerWorker(): Promise<R>
    /** The worker's registration if it already exists; never registers one. */
    existingWorker(): Promise<R | null>
    /** The FCM registration token for this registration (Firebase getToken). */
    getToken(config: WebPushConfig, registration: R): Promise<string | null>
    http: {
        /** Returns the device row id. */
        register(body: RegisterDeviceBody): Promise<string | null>
        unregister(deviceId: string): Promise<void>
    }
    store: WebPushStore
    userId(): string | null
    now(): number
}

export type WebPushFailure = "unconfigured" | "unsupported" | "signed-out" | "denied" | "dismissed" | "failed"
export type WebPushResult = { ok: true } | { ok: false; reason: WebPushFailure }

export interface WebPushStatus {
    /** The Settings row and the soft prompt exist at all. */
    visible: boolean
    permission: PushPermission
    /** Registered for the signed-in account on this device. */
    on: boolean
}

/** A registration older than this is written again even when the token is unchanged. */
export const REREGISTER_MS = 7 * 24 * 60 * 60 * 1000

export const REGISTER_BODY = (token: string): RegisterDeviceBody => ({ platform: "web", push_token: token, app: "momentum" })

/** The device row id out of the 201 body ({ data: { id } }, or a bare row). */
export function deviceIdFrom(body: unknown): string | null {
    if (!body || typeof body !== "object") return null
    const b = body as { id?: unknown; data?: { id?: unknown } }
    const id = b.data && typeof b.data === "object" ? b.data.id : b.id
    return typeof id === "string" && id ? id : null
}

export function permissionOf<R extends PushRegistrationLike>(deps: WebPushDeps<R>): PushPermission {
    if (!deps.config || !deps.supported()) return "unsupported"
    try {
        return deps.permission()
    } catch {
        return "unsupported"
    }
}

export function webPushStatus<R extends PushRegistrationLike>(deps: WebPushDeps<R>): WebPushStatus {
    const user = deps.config ? deps.userId() : null
    const permission = permissionOf(deps)
    if (!deps.config || permission === "unsupported" || !user) return { visible: false, permission, on: false }
    const rec = deps.store.user(user)
    return { visible: true, permission, on: permission === "granted" && !!rec?.on && !!rec.deviceId }
}

async function dropSubscription<R extends PushRegistrationLike>(registration: R | null): Promise<void> {
    try {
        const sub = await registration?.pushManager.getSubscription()
        await sub?.unsubscribe()
    } catch {
        /* nothing subscribed, or the browser refused: FCM retires a dead token itself */
    }
}

export interface WebPush {
    status(): WebPushStatus
    /** Turn on: ask permission, register the worker, mint a token, register the device. */
    enable(): Promise<WebPushResult>
    /** Turn off: delete the device row and drop the subscription so the token dies. */
    disable(): Promise<WebPushResult>
    /**
     * At sign-in / page load: delete this account's leftovers, and when push is
     * on, re-register if the token changed or the row is old. Never asks for
     * permission and never throws.
     */
    sync(): Promise<void>
}

export function createWebPush<R extends PushRegistrationLike>(deps: WebPushDeps<R>): WebPush {
    // One operation at a time: a Settings click must not race the load-time sync.
    let queue: Promise<unknown> = Promise.resolve()
    const serial = <T>(fn: () => Promise<T>): Promise<T> => {
        const run = queue.then(fn, fn)
        queue = run.catch(() => undefined)
        return run
    }

    /** Registers the current token for `user`; the caller has checked permission. */
    const register = async (config: WebPushConfig, user: string, force: boolean): Promise<WebPushResult> => {
        const registration = await deps.registerWorker()
        const state = deps.store.read()
        if (state.resetToken) {
            // A sign-out happened on this browser: never reuse its token.
            await dropSubscription(registration)
            state.resetToken = false
            deps.store.write(state)
        }
        const token = await deps.getToken(config, registration)
        if (!token) return { ok: false, reason: "failed" }
        const prev: DeviceRecord | undefined = deps.store.user(user)
        const fresh = prev?.at !== undefined && deps.now() - prev.at < REREGISTER_MS
        if (!force && prev?.on && prev.deviceId && prev.token === token && fresh) return { ok: true }
        const deviceId = await deps.http.register(REGISTER_BODY(token))
        if (!deviceId) return { ok: false, reason: "failed" }
        if (prev?.deviceId && prev.deviceId !== deviceId) {
            await deps.http.unregister(prev.deviceId).catch(() => undefined)
        }
        deps.store.setUser(user, { on: true, deviceId, token, at: deps.now() })
        return { ok: true }
    }

    const clearStale = async (user: string) => {
        const mine = deps.store.read().stale.filter((s) => s.userId === user)
        for (const s of mine) {
            try {
                await deps.http.unregister(s.deviceId)
                const state = deps.store.read()
                state.stale = state.stale.filter((x) => !(x.userId === s.userId && x.deviceId === s.deviceId))
                deps.store.write(state)
            } catch {
                /* try again next time */
            }
        }
    }

    return {
        status: () => webPushStatus(deps),

        enable: () =>
            serial(async (): Promise<WebPushResult> => {
                const config = deps.config
                if (!config) return { ok: false, reason: "unconfigured" }
                if (permissionOf(deps) === "unsupported") return { ok: false, reason: "unsupported" }
                const user = deps.userId()
                if (!user) return { ok: false, reason: "signed-out" }
                try {
                    let permission = deps.permission()
                    if (permission === "denied") return { ok: false, reason: "denied" }
                    if (permission === "default") permission = await deps.requestPermission()
                    if (permission !== "granted") return { ok: false, reason: permission === "denied" ? "denied" : "dismissed" }
                    return await register(config, user, true)
                } catch {
                    return { ok: false, reason: "failed" }
                }
            }),

        disable: () =>
            serial(async (): Promise<WebPushResult> => {
                if (!deps.config) return { ok: false, reason: "unconfigured" }
                const user = deps.userId()
                if (!user) return { ok: false, reason: "signed-out" }
                const rec = deps.store.user(user)
                // Local first: whatever the network does, this device stops asking.
                deps.store.setUser(user, { on: false })
                let failed = false
                if (rec?.deviceId) {
                    try {
                        await deps.http.unregister(rec.deviceId)
                    } catch {
                        failed = true
                        const state = deps.store.read()
                        state.stale.push({ userId: user, deviceId: rec.deviceId })
                        deps.store.write(state)
                    }
                }
                // Kill the token too, so a row the DELETE missed can never deliver here.
                if (deps.supported()) await dropSubscription(await deps.existingWorker().catch(() => null))
                return failed ? { ok: false, reason: "failed" } : { ok: true }
            }),

        sync: () =>
            serial(async () => {
                const config = deps.config
                if (!config || !deps.supported()) return
                const user = deps.userId()
                if (!user) return
                try {
                    await clearStale(user)
                    const rec = deps.store.user(user)
                    if (!rec?.on) return
                    if (deps.permission() !== "granted") {
                        // Permission was withdrawn in the browser: the row can never deliver.
                        if (rec.deviceId) await deps.http.unregister(rec.deviceId).catch(() => undefined)
                        deps.store.setUser(user, { on: false })
                        return
                    }
                    await register(config, user, false)
                } catch {
                    /* the next load tries again */
                }
            }),
    }
}
