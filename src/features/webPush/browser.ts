/*
  The real browser wiring for client.ts: Notification, the push worker,
  Firebase (loaded on demand), the API client and localStorage.
*/

import api, { getCurrentUserId } from "@/lib/api"

import { createWebPush, deviceIdFrom, type WebPush, type WebPushDeps } from "./client"
import { DEVICES_PATH, PUSH_SW_SCOPE, PUSH_SW_URL, devicePath, readWebPushConfig } from "./config"
import { browserWebPushStore } from "./state"

/** Notification, service workers and PushManager, in a secure context. */
export function browserSupportsWebPush(): boolean {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false
    try {
        return (
            window.isSecureContext !== false &&
            "Notification" in window &&
            "serviceWorker" in navigator &&
            "PushManager" in window
        )
    } catch {
        return false
    }
}

const ACTIVATE_TIMEOUT_MS = 15_000

/** pushManager.subscribe needs an ACTIVE worker; a fresh registration is still installing. */
function whenActive(registration: ServiceWorkerRegistration): Promise<void> {
    if (registration.active) return Promise.resolve()
    const worker = registration.installing ?? registration.waiting
    if (!worker) return Promise.resolve()
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("push worker did not activate")), ACTIVATE_TIMEOUT_MS)
        worker.addEventListener("statechange", () => {
            if (worker.state === "activated") {
                clearTimeout(timer)
                resolve()
            } else if (worker.state === "redundant") {
                clearTimeout(timer)
                reject(new Error("push worker became redundant"))
            }
        })
    })
}

async function existingRegistration(): Promise<ServiceWorkerRegistration | null> {
    const reg = await navigator.serviceWorker.getRegistration(PUSH_SW_SCOPE)
    // Only a root-scoped registration covers "/", so this is ours; the Offline
    // page's worker (scope /posttube/offline) is never returned.
    return reg && new URL(reg.scope).pathname === PUSH_SW_SCOPE ? reg : null
}

export function browserWebPushDeps(): WebPushDeps<ServiceWorkerRegistration> {
    return {
        config: readWebPushConfig(),
        supported: browserSupportsWebPush,
        permission: () => Notification.permission,
        requestPermission: () => Notification.requestPermission(),
        registerWorker: async () => {
            const registration = await navigator.serviceWorker.register(PUSH_SW_URL, { scope: PUSH_SW_SCOPE })
            await whenActive(registration)
            return registration
        },
        existingWorker: existingRegistration,
        getToken: async (config, registration) => (await import("./firebaseToken")).firebaseToken(config, registration),
        http: {
            register: async (body) => deviceIdFrom((await api.post(DEVICES_PATH, body)).data),
            unregister: async (deviceId) => {
                await api.delete(devicePath(deviceId))
            },
        },
        store: browserWebPushStore,
        userId: getCurrentUserId,
        now: () => Date.now(),
    }
}

let shared: WebPush | null = null

/** One instance per page, so its operations queue behind each other. */
export function browserWebPush(): WebPush {
    shared ??= createWebPush(browserWebPushDeps())
    return shared
}
