import { describe, expect, test } from "bun:test"

import { contractFixture } from "@/features/posttube/credits/__tests__/contracts"
import { NOTIFICATION_CATEGORIES, categoryTogglePatch, decodeNotificationSettings } from "../_lib/notificationPreferences"

// The Credits category (2026-10-23) against notification-service's golden
// preferences (notification_preferences_credits*.json, byte copies).

describe("notification preferences: Credits", () => {
    test("the page lists a Credits switch", () => {
        expect(NOTIFICATION_CATEGORIES.find((c) => c.key === "credits")).toEqual({ key: "credits", label: "Credits", primary: false })
    })

    test("decodes push_credits / inapp_credits from the server's document", () => {
        const s = decodeNotificationSettings(contractFixture("notification_preferences_credits.json"))!
        expect(s.channels.push_credits).toBe(false)
        expect(s.channels.inapp_credits).toBe(true)
    })

    test("every category switch the server sends has a row on the page", () => {
        const body = (contractFixture("notification_preferences_credits.json") as { data: Record<string, unknown> }).data
        const served = Object.keys(body).filter((k) => k.startsWith("inapp_")).map((k) => k.slice("inapp_".length))
        const listed = NOTIFICATION_CATEGORIES.map((c) => c.key)
        // Food orders, shop orders and Doorstep belong to products the page does not list yet.
        expect(served.filter((k) => !listed.includes(k)).sort()).toEqual(["doorstep", "food_orders", "orders"])
        expect(listed).toContain("credits")
    })

    test("on by default when the server omits the keys", () => {
        const s = decodeNotificationSettings({ data: { push_enabled: true } })!
        expect(s.channels.push_credits).toBe(true)
        expect(s.channels.inapp_credits).toBe(true)
    })

    test("the request fixture is two single-key toggles", () => {
        const request = contractFixture("notification_preferences_credits_request.json")
        expect({ ...categoryTogglePatch("credits", "inapp", true), ...categoryTogglePatch("credits", "push", false) }).toEqual(request as Record<string, boolean>)
    })
})
