/*
  Web push configuration (founder, 15 Oct 2026).

  Web push is switched on by configuration alone. The five values below are
  PUBLIC identifiers of the Firebase web app and its Web Push certificate —
  no secret is involved — but none of them is written into the code: each is
  a NEXT_PUBLIC_* variable, inlined into the browser bundle at build time.

  When ANY of them is missing the whole feature is invisible and inert: no
  Settings row, no soft prompt, no service worker, no Firebase code loaded,
  and no network request of any kind.

  Each variable is read with a literal `process.env.NEXT_PUBLIC_…` access on
  purpose: that is the only form Next inlines into the client bundle.
*/

export interface WebPushConfig {
    apiKey: string
    projectId: string
    messagingSenderId: string
    appId: string
    vapidKey: string
}

export type WebPushEnv = Partial<Record<keyof WebPushConfig, string | undefined>>

function buildEnv(): WebPushEnv {
    return {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    }
}

const KEYS: (keyof WebPushConfig)[] = ["apiKey", "projectId", "messagingSenderId", "appId", "vapidKey"]

/** The complete configuration, or null when any value is missing or blank. */
export function readWebPushConfig(env: WebPushEnv = buildEnv()): WebPushConfig | null {
    const out: Partial<WebPushConfig> = {}
    for (const key of KEYS) {
        const value = env[key]?.trim()
        if (!value) return null
        out[key] = value
    }
    return out as WebPushConfig
}

export function isWebPushConfigured(env?: WebPushEnv): boolean {
    return readWebPushConfig(env) !== null
}

/** The messaging worker: hand-written, root scope, separate from /offline-sw.js. */
export const PUSH_SW_URL = "/push-sw.js"
export const PUSH_SW_SCOPE = "/"

/** notification-service routes (internal/http/handler.go). */
export const DEVICES_PATH = "/v1/notifications/devices"
export const devicePath = (deviceId: string) => `${DEVICES_PATH}/${encodeURIComponent(deviceId)}`
