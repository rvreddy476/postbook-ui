import { describe, expect, test } from "bun:test"

import {
    NOTIFICATION_CATEGORIES,
    applyNotificationPatch,
    categoryTogglePatch,
    decodeNotificationSettings,
    globalTogglePatch,
    quietHoursPatch,
} from "../_lib/notificationPreferences"
import { NOTIFICATION_PREFERENCES_PATH } from "@/hooks/useActivityNotifications"

// The shape notification-service returns from
// GET /v1/notifications/preferences/detailed (store NotificationPreferences).
function serverBody(overrides: Record<string, unknown> = {}) {
    const body: Record<string, unknown> = {
        user_id: "u1",
        push_enabled: true,
        email_enabled: false,
        quiet_hours_enabled: false,
        email_digest: "weekly",
    }
    for (const c of NOTIFICATION_CATEGORIES) {
        body[`push_${c.key}`] = true
        body[`inapp_${c.key}`] = true
    }
    return { data: { ...body, ...overrides } }
}

describe("notification preferences (T-06)", () => {
    test("uses the detailed endpoint", () => {
        expect(NOTIFICATION_PREFERENCES_PATH).toBe("/v1/notifications/preferences/detailed")
    })

    test("categories mirror Android's NotificationCategory keys", () => {
        expect(NOTIFICATION_CATEGORIES.map((c) => c.key)).toEqual([
            "likes",
            "comments",
            "follows",
            "mentions",
            "reposts",
            "live",
            "new_videos",
            "messages",
            "super_likes",
            "replies",
            "friend_requests",
            "group_posts",
            "group_mentions",
            "channel_updates",
            "channel_urgent",
            "community_posts",
            "community_mentions",
            "event_reminders",
            "system",
        ])
    })

    test("decodes push_* and inapp_* per category", () => {
        const s = decodeNotificationSettings(serverBody({ push_likes: false, inapp_comments: false }))
        expect(s?.channels.push_likes).toBe(false)
        expect(s?.channels.inapp_likes).toBe(true)
        expect(s?.channels.inapp_comments).toBe(false)
        expect(s?.push_enabled).toBe(true)
    })

    test("turning off likes push sends exactly push_likes=false, nothing else", () => {
        expect(categoryTogglePatch("likes", "push", false)).toEqual({ push_likes: false })
        expect(categoryTogglePatch("mentions", "inapp", false)).toEqual({ inapp_mentions: false })
    })

    test("never sends the retired muted_types or sms_enabled fields", () => {
        const patches = [
            categoryTogglePatch("likes", "push", false),
            globalTogglePatch("push_enabled", false),
            globalTogglePatch("email_enabled", true),
        ]
        for (const p of patches) {
            expect(Object.keys(p)).not.toContain("muted_types")
            expect(Object.keys(p)).not.toContain("sms_enabled")
        }
    })

    test("quiet hours are sent as one valid group, with the timezone", () => {
        expect(quietHoursPatch({ enabled: true, start: "22:00", end: "07:00", timeZone: "Asia/Kolkata" })).toEqual({
            patch: {
                quiet_hours_enabled: true,
                quiet_hours_start: "22:00",
                quiet_hours_end: "07:00",
                quiet_hours_tz: "Asia/Kolkata",
            },
        })
        expect(quietHoursPatch({ enabled: false, start: "", end: "", timeZone: "" })).toEqual({
            patch: { quiet_hours_enabled: false },
        })
    })

    test("quiet hours the server would reject are not sent", () => {
        expect("error" in quietHoursPatch({ enabled: true, start: "", end: "07:00", timeZone: "UTC" })).toBe(true)
        expect("error" in quietHoursPatch({ enabled: true, start: "07:00", end: "07:00", timeZone: "UTC" })).toBe(true)
        expect("error" in quietHoursPatch({ enabled: true, start: "22:00", end: "07:00", timeZone: "" })).toBe(true)
    })

    test("a decoded document round-trips a patch locally", () => {
        const s = decodeNotificationSettings(serverBody())!
        const next = applyNotificationPatch(s, { push_likes: false, email_enabled: true })
        expect(next.channels.push_likes).toBe(false)
        expect(next.email_enabled).toBe(true)
        expect(s.channels.push_likes).toBe(true)
    })

    test("a body without the document decodes to null (error state, not defaults)", () => {
        expect(decodeNotificationSettings({ data: {} })).toBeNull()
    })
})
