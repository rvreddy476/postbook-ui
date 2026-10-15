import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"

import { ToastProvider } from "@/contexts/ToastContext"

import type { WebPush, WebPushStatus } from "../client"
import { shouldOfferSoftPrompt, SOFT_PROMPT_SNOOZE_MS, type SoftPromptInput } from "../softPrompt"
import { webPushStore, type KeyValueStore } from "../state"
import WebPushRoot, { createSoftPromptController } from "../WebPushRoot"

const DAY = 24 * 60 * 60 * 1000

const base: SoftPromptInput = {
    visible: true,
    permission: "default",
    deviceOn: false,
    snoozedUntil: 0,
    now: 10 * DAY,
    offeredThisPage: false,
    userActivated: true,
}

describe("soft prompt rules", () => {
    test("offered after a meaningful action when the browser has not been asked", () => {
        expect(shouldOfferSoftPrompt(base)).toBe(true)
    })

    test("never when not configured, unsupported or signed out (not visible)", () => {
        expect(shouldOfferSoftPrompt({ ...base, visible: false })).toBe(false)
        expect(shouldOfferSoftPrompt({ ...base, permission: "unsupported" })).toBe(false)
    })

    test("never when the browser already answered — granted or denied — or push is on", () => {
        expect(shouldOfferSoftPrompt({ ...base, permission: "denied" })).toBe(false)
        expect(shouldOfferSoftPrompt({ ...base, permission: "granted" })).toBe(false)
        expect(shouldOfferSoftPrompt({ ...base, deviceOn: true })).toBe(false)
    })

    test("never twice on one page, and never before the person has interacted", () => {
        expect(shouldOfferSoftPrompt({ ...base, offeredThisPage: true })).toBe(false)
        expect(shouldOfferSoftPrompt({ ...base, userActivated: false })).toBe(false)
    })

    test("Not now holds for 14 days", () => {
        expect(SOFT_PROMPT_SNOOZE_MS).toBe(14 * DAY)
        const until = base.now + SOFT_PROMPT_SNOOZE_MS
        expect(shouldOfferSoftPrompt({ ...base, snoozedUntil: until, now: until - 1 })).toBe(false)
        expect(shouldOfferSoftPrompt({ ...base, snoozedUntil: until, now: until })).toBe(true)
    })
})

function memory(): KeyValueStore {
    const m = new Map<string, string>()
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }
}

function fakePush(status: WebPushStatus): WebPush & { enabled: number } {
    const p = {
        enabled: 0,
        status: () => status,
        enable: async () => {
            p.enabled++
            return { ok: true as const }
        },
        disable: async () => ({ ok: true as const }),
        sync: async () => {},
    }
    return p
}

describe("soft prompt controller", () => {
    const visible: WebPushStatus = { visible: true, permission: "default", on: false }

    test("only the first meaningful action on a page offers it", () => {
        const c = createSoftPromptController({ push: fakePush(visible), store: webPushStore(memory), now: () => 0, userActivated: () => true })
        expect(c.offer()).toBe(true)
        expect(c.offer()).toBe(false)
        expect(c.offer()).toBe(false)
    })

    test("Not now snoozes it across pages for 14 days", () => {
        const storage = memory()
        let now = 100 * DAY
        const make = () => createSoftPromptController({ push: fakePush(visible), store: webPushStore(() => storage), now: () => now, userActivated: () => true })
        const first = make()
        expect(first.offer()).toBe(true)
        first.notNow()
        now += 13 * DAY
        expect(make().offer()).toBe(false)
        now += 1 * DAY
        expect(make().offer()).toBe(true)
    })

    test("never when the browser denied, or when not configured", () => {
        for (const status of [
            { visible: true, permission: "denied", on: false },
            { visible: true, permission: "granted", on: false },
            { visible: false, permission: "unsupported", on: false },
        ] as WebPushStatus[]) {
            const c = createSoftPromptController({ push: fakePush(status), store: webPushStore(memory), now: () => 0, userActivated: () => true })
            expect(c.offer()).toBe(false)
        }
    })

    test("Turn on enables push", async () => {
        const push = fakePush(visible)
        const c = createSoftPromptController({ push, store: webPushStore(memory), now: () => 0, userActivated: () => true })
        expect(await c.turnOn()).toEqual({ ok: true })
        expect(push.enabled).toBe(1)
    })
})

describe("on page load", () => {
    test("renders nothing (and, not configured here, loads nothing)", () => {
        const fetched: unknown[] = []
        const prevFetch = globalThis.fetch
        globalThis.fetch = (async (...args: unknown[]) => {
            fetched.push(args)
            return new Response("{}")
        }) as typeof fetch
        try {
            const html = renderToStaticMarkup(
                <ToastProvider>
                    <WebPushRoot />
                </ToastProvider>,
            )
            expect(html).not.toContain("Get notified")
            expect(html).not.toContain("dialog")
            expect(fetched).toEqual([])
        } finally {
            globalThis.fetch = prevFetch
        }
    })
})
