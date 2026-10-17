/**
 * `GET` / `PUT /v1/notifications/preferences/detailed` on notification-service.
 *
 * The wire shape is flat (store/postgres/notification_prefs.go
 * NotificationPreferences): a global block plus an `inapp_<category>` and a
 * `push_<category>` boolean per category. `inapp_*` gates the inbox row and
 * the realtime event; `push_*` gates the device push. The PUT handler
 * (UpdateNotifPreferences in internal/http/handler.go) merges only the keys
 * present in the body, then validates the merged record: email_digest must be
 * never|daily|weekly, and quiet hours, when enabled, need start and end as
 * HH:mm plus an IANA timezone.
 *
 * The category list mirrors Android's NotificationCategory
 * (mobile/android/core/profile/.../SettingsModels.kt), so both clients show
 * the same switches. The old web page wrote `muted_types` and `sms_enabled`
 * to `/v1/notifications/preferences`; neither field exists upstream, which is
 * why its category toggles were ignored.
 */

export interface NotificationCategory {
    key: string
    label: string
    primary: boolean
}

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
    { key: "likes", label: "Likes", primary: true },
    { key: "comments", label: "Comments", primary: true },
    { key: "follows", label: "New followers", primary: true },
    { key: "mentions", label: "Mentions and tags", primary: true },
    { key: "reposts", label: "Reposts", primary: true },
    { key: "live", label: "LIVE", primary: true },
    { key: "new_videos", label: "New videos", primary: true },
    { key: "messages", label: "Messages", primary: true },
    { key: "super_likes", label: "Super likes", primary: false },
    { key: "replies", label: "Replies", primary: false },
    { key: "friend_requests", label: "Connection requests", primary: false },
    { key: "group_posts", label: "Group posts", primary: false },
    { key: "group_mentions", label: "Group mentions", primary: false },
    { key: "channel_updates", label: "Channel updates", primary: false },
    { key: "channel_urgent", label: "Urgent channel updates", primary: false },
    { key: "community_posts", label: "Community posts", primary: false },
    { key: "community_mentions", label: "Community mentions", primary: false },
    { key: "event_reminders", label: "Event reminders", primary: false },
    { key: "system", label: "Security and system", primary: false },
]

export type Channel = "inapp" | "push"

export const inAppKey = (category: string) => `inapp_${category}`
export const pushKey = (category: string) => `push_${category}`
export const channelKey = (channel: Channel, category: string) =>
    channel === "inapp" ? inAppKey(category) : pushKey(category)

export type EmailDigest = "never" | "daily" | "weekly"

export interface NotificationSettings {
    push_enabled: boolean
    email_enabled: boolean
    quiet_hours_enabled: boolean
    quiet_hours_start: string
    quiet_hours_end: string
    quiet_hours_tz: string
    email_digest: EmailDigest
    /** `inapp_<key>` / `push_<key>` for every category in NOTIFICATION_CATEGORIES. */
    channels: Record<string, boolean>
}

function bool(body: Record<string, unknown>, key: string, fallback: boolean): boolean {
    const v = body[key]
    return typeof v === "boolean" ? v : fallback
}

function str(body: Record<string, unknown>, key: string): string {
    const v = body[key]
    return typeof v === "string" ? v : ""
}

/**
 * Decode the GET body (`{ data: NotificationPreferences }`). Defaults match
 * Android's codec and only apply to a key the server omitted. Returns null for
 * a body that is not a preferences document.
 */
export function decodeNotificationSettings(body: unknown): NotificationSettings | null {
    const raw =
        body && typeof body === "object" && "data" in body
            ? (body as { data?: unknown }).data
            : body
    if (!raw || typeof raw !== "object") return null
    const b = raw as Record<string, unknown>
    if (typeof b.push_enabled !== "boolean") return null
    const digest = str(b, "email_digest")
    const channels: Record<string, boolean> = {}
    for (const c of NOTIFICATION_CATEGORIES) {
        channels[inAppKey(c.key)] = bool(b, inAppKey(c.key), true)
        channels[pushKey(c.key)] = bool(b, pushKey(c.key), true)
    }
    return {
        push_enabled: bool(b, "push_enabled", true),
        email_enabled: bool(b, "email_enabled", false),
        quiet_hours_enabled: bool(b, "quiet_hours_enabled", false),
        quiet_hours_start: str(b, "quiet_hours_start"),
        quiet_hours_end: str(b, "quiet_hours_end"),
        quiet_hours_tz: str(b, "quiet_hours_tz"),
        email_digest: digest === "never" || digest === "daily" || digest === "weekly" ? digest : "weekly",
        channels,
    }
}

export type NotificationPatch = Record<string, boolean | string>

/** One category switch: exactly one key, `inapp_<key>` or `push_<key>`. */
export function categoryTogglePatch(category: string, channel: Channel, on: boolean): NotificationPatch {
    return { [channelKey(channel, category)]: on }
}

/** A global switch: push_enabled or email_enabled. */
export function globalTogglePatch(key: "push_enabled" | "email_enabled", on: boolean): NotificationPatch {
    return { [key]: on }
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/

export function isClock(value: string): boolean {
    return CLOCK.test(value)
}

/**
 * Quiet hours are saved as one group because the server validates them as
 * one: enabling them without a start, end and timezone is a 400. Returns an
 * error string instead of a patch when the input cannot pass that check, so
 * the page never sends a request it knows will be refused.
 */
export function quietHoursPatch(input: {
    enabled: boolean
    start: string
    end: string
    timeZone: string
}): { patch: NotificationPatch } | { error: string } {
    if (!input.enabled) return { patch: { quiet_hours_enabled: false } }
    if (!isClock(input.start) || !isClock(input.end)) {
        return { error: "Enter a start and end time." }
    }
    if (input.start === input.end) {
        return { error: "Start and end times must differ." }
    }
    if (!input.timeZone) {
        return { error: "Could not detect your time zone." }
    }
    return {
        patch: {
            quiet_hours_enabled: true,
            quiet_hours_start: input.start,
            quiet_hours_end: input.end,
            quiet_hours_tz: input.timeZone,
        },
    }
}

/** The local state after a patch the server accepted, before the echo is read. */
export function applyNotificationPatch(s: NotificationSettings, patch: NotificationPatch): NotificationSettings {
    const next: NotificationSettings = { ...s, channels: { ...s.channels } }
    for (const [key, value] of Object.entries(patch)) {
        if (key in next.channels && typeof value === "boolean") {
            next.channels[key] = value
        } else if (key in next) {
            ;(next as unknown as Record<string, unknown>)[key] = value
        }
    }
    return next
}
