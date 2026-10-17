/*
  What this browser remembers about web push, per account.

  localStorage, and every access is wrapped: storage that is missing, blocked,
  full or corrupt reads as "nothing remembered" and a write that fails is
  dropped. Nothing here is authoritative — notification-service holds the
  device rows — so losing this record only means the next enable registers
  the device again.

  users[userId]
    on        the account asked for push on this device ("Push on this device")
    deviceId  the user_devices row id notification-service returned
    token     the FCM registration token that row holds
    at        when that row was last written (epoch ms)

  stale      device rows a sign-out tried to delete. The DELETE is fired as the
             page navigates away and may never land; the same account deletes
             them again at its next sign-in (the route is idempotent and only
             the owner may delete a row).
  resetToken a sign-out happened: the next registration drops the old push
             subscription first, so Firebase mints a NEW token and the old one
             is dead whatever happened to the DELETE.
*/

export interface KeyValueStore {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
}

export interface DeviceRecord {
    on: boolean
    deviceId?: string
    token?: string
    at?: number
}

export interface StaleDevice {
    userId: string
    deviceId: string
}

export interface WebPushState {
    users: Record<string, DeviceRecord>
    stale: StaleDevice[]
    resetToken: boolean
}

export const WEB_PUSH_STATE_KEY = "momentum-web-push"
export const SOFT_PROMPT_SNOOZE_KEY = "momentum-web-push-snoozed-until"

const empty = (): WebPushState => ({ users: {}, stale: [], resetToken: false })

function str(v: unknown): string | undefined {
    return typeof v === "string" && v ? v : undefined
}

function parse(raw: string | null | undefined): WebPushState {
    const state = empty()
    if (!raw) return state
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        return state
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return state
    const p = parsed as Record<string, unknown>
    if (p.users && typeof p.users === "object" && !Array.isArray(p.users)) {
        for (const [id, rec] of Object.entries(p.users as Record<string, unknown>)) {
            if (!id || !rec || typeof rec !== "object") continue
            const r = rec as Record<string, unknown>
            state.users[id] = {
                on: r.on === true,
                deviceId: str(r.deviceId),
                token: str(r.token),
                at: typeof r.at === "number" && Number.isFinite(r.at) ? r.at : undefined,
            }
        }
    }
    if (Array.isArray(p.stale)) {
        for (const s of p.stale) {
            if (s && typeof s === "object" && str((s as StaleDevice).userId) && str((s as StaleDevice).deviceId)) {
                state.stale.push({ userId: (s as StaleDevice).userId, deviceId: (s as StaleDevice).deviceId })
            }
        }
    }
    state.resetToken = p.resetToken === true
    return state
}

export interface WebPushStore {
    read(): WebPushState
    write(state: WebPushState): void
    user(userId: string): DeviceRecord | undefined
    setUser(userId: string, record: DeviceRecord): void
    snoozedUntil(): number
    snooze(until: number): void
}

/** Never throws. */
export function webPushStore(storage: () => KeyValueStore | null): WebPushStore {
    const read = (): WebPushState => {
        try {
            return parse(storage()?.getItem(WEB_PUSH_STATE_KEY))
        } catch {
            return empty()
        }
    }
    const write = (state: WebPushState) => {
        try {
            storage()?.setItem(WEB_PUSH_STATE_KEY, JSON.stringify(state))
        } catch {
            /* best effort: see the header */
        }
    }
    return {
        read,
        write,
        user: (userId) => read().users[userId],
        setUser(userId, record) {
            const state = read()
            state.users[userId] = record
            write(state)
        },
        snoozedUntil() {
            try {
                const n = Number(storage()?.getItem(SOFT_PROMPT_SNOOZE_KEY) ?? 0)
                return Number.isFinite(n) ? n : 0
            } catch {
                return 0
            }
        },
        snooze(until) {
            try {
                storage()?.setItem(SOFT_PROMPT_SNOOZE_KEY, String(until))
            } catch {
                /* the card simply comes back sooner */
            }
        },
    }
}

function browserStorage(): KeyValueStore | null {
    try {
        return typeof localStorage !== "undefined" ? localStorage : null
    } catch {
        return null
    }
}

export const browserWebPushStore: WebPushStore = webPushStore(browserStorage)
