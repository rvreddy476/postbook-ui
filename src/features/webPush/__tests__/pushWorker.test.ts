import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { PUSH_SW_SCOPE, PUSH_SW_URL } from "../config"

/*
  public/push-sw.js, run against fake worker globals: what a push shows, and
  where a click is allowed to go.
*/

const ROOT = join(import.meta.dir, "..", "..", "..", "..")
const SOURCE = readFileSync(join(ROOT, "public", "push-sw.js"), "utf8")
const ORIGIN = "https://app.example"

interface Shown {
    title: string
    options: { body: string; icon: string; tag?: string; data: { path: string | null } }
}

function boot(windows: { url: string }[] = []) {
    const listeners = new Map<string, (event: unknown) => void>()
    const shown: Shown[] = []
    const opened: string[] = []
    const focused: string[] = []
    const clientWindows = windows.map((w) => ({ url: w.url, focus: async () => void focused.push(w.url) }))
    const self = {
        location: { origin: ORIGIN },
        addEventListener: (type: string, fn: (event: unknown) => void) => void listeners.set(type, fn),
        skipWaiting: () => undefined,
        registration: { showNotification: async (title: string, options: Shown["options"]) => void shown.push({ title, options }) },
        clients: {
            claim: async () => undefined,
            matchAll: async () => clientWindows,
            openWindow: async (url: string) => void opened.push(url),
        },
    }
    new Function("self", SOURCE)(self)
    const run = async (type: string, event: Record<string, unknown>) => {
        let pending: Promise<unknown> = Promise.resolve()
        listeners.get(type)!({ ...event, waitUntil: (p: Promise<unknown>) => void (pending = p) })
        await pending
    }
    return {
        listeners,
        shown,
        opened,
        focused,
        push: (payload: unknown) =>
            run("push", {
                data: payload === undefined ? null : { json: () => (typeof payload === "string" ? JSON.parse(payload) : payload), text: () => String(payload) },
            }),
        click: (path: unknown) => {
            let closed = false
            return run("notificationclick", { notification: { data: { path }, close: () => void (closed = true) } }).then(() => closed)
        },
    }
}

// What FCM hands the worker for notification-service's message (fcm.go BuildFCMMessage).
const fcmPayload = (data: Record<string, string>, notification = { title: "Asha replied", body: "Love this!" }) => ({
    from: "1234",
    fcmMessageId: "m1",
    notification,
    data: { type: "comment_reply", priority: "normal", icon: "comment", ...data },
})

describe("push", () => {
    test("shows the server's title and body, keeps a same-origin deep link", async () => {
        const sw = boot()
        await sw.push(fcmPayload({ deep_link: "/post/p1?c=9" }))
        expect(sw.shown).toEqual([{ title: "Asha replied", options: { body: "Love this!", icon: "/favicon.ico", data: { path: "/post/p1?c=9" } } }])
    })

    test("title/body from data when there is no notification block; collapse_key becomes the tag", async () => {
        const sw = boot()
        await sw.push({ data: { title: "Order shipped", body: "Arriving Friday", deep_link: "/shop/orders/o1", collapse_key: "order:o1" } })
        expect(sw.shown[0].title).toBe("Order shipped")
        expect(sw.shown[0].options).toMatchObject({ body: "Arriving Friday", tag: "order:o1", data: { path: "/shop/orders/o1" } })
    })

    test("app-only and foreign links are dropped; an empty push still shows something", async () => {
        const sw = boot()
        await sw.push(fcmPayload({ deep_link: "momentum://doorstep/bookings/b1" }))
        await sw.push(fcmPayload({ deep_link: "https://evil.example/post/1" }))
        await sw.push(undefined)
        expect(sw.shown.map((s) => s.options.data.path)).toEqual([null, null, null])
        expect(sw.shown[2].title).toBe("New notification")
    })
})

describe("notificationclick follows same-origin paths only", () => {
    test("a same-origin path opens in a new window", async () => {
        const sw = boot([{ url: `${ORIGIN}/feed` }])
        expect(await sw.click("/post/p1")).toBe(true)
        expect(sw.opened).toEqual(["/post/p1"])
        expect(sw.focused).toEqual([])
    })

    test("a window already on that page is focused instead", async () => {
        const sw = boot([{ url: `${ORIGIN}/feed` }, { url: `${ORIGIN}/post/p1` }])
        await sw.click("/post/p1")
        expect(sw.focused).toEqual([`${ORIGIN}/post/p1`])
        expect(sw.opened).toEqual([])
    })

    test("anything else is ignored: an open window is focused, or the home page opened", async () => {
        const hostile = [
            "https://evil.example/phish",
            "//evil.example/phish",
            "javascript:alert(1)",
            "data:text/html,hi",
            "momentum://doorstep/bookings/b1",
            "",
            null,
            42,
        ]
        for (const link of hostile) {
            const none = boot()
            await none.click(link)
            expect([link, none.opened]).toEqual([link, ["/"]])
            const one = boot([{ url: `${ORIGIN}/reels` }])
            await one.click(link)
            expect([link, one.opened, one.focused]).toEqual([link, [], [`${ORIGIN}/reels`]])
        }
    })

    test("an absolute URL on our own origin is reduced to its path", async () => {
        const sw = boot()
        await sw.click(`${ORIGIN}/posttube/watch/v1#t=10`)
        expect(sw.opened).toEqual(["/posttube/watch/v1#t=10"])
    })
})

describe("the worker itself", () => {
    test("root scope, separate file, no fetch handler, no cache, no imported code", () => {
        expect(PUSH_SW_URL).toBe("/push-sw.js")
        expect(PUSH_SW_SCOPE).toBe("/")
        const sw = boot()
        expect([...sw.listeners.keys()].sort()).toEqual(["activate", "install", "notificationclick", "push"])
        expect(SOURCE).not.toMatch(/importScripts|caches\.|firebase|apiKey|vapid/i)
    })
})
