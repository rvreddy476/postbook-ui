import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { createWebPush, deviceIdFrom, REREGISTER_MS, type RegisterDeviceBody, type WebPushDeps } from "../client"
import { DEVICES_PATH, isWebPushConfigured, readWebPushConfig, type WebPushConfig } from "../config"
import { announceMeaningfulAction, MEANINGFUL_ACTION_EVENT, meaningfulActionFor } from "../meaningfulAction"
import { noteWebPushSignOut, type SignOutDeps } from "../signOut"
import { webPushStore, WEB_PUSH_STATE_KEY, type KeyValueStore } from "../state"
import { deviceSwitchView } from "../useWebPushDevice"

const CONFIG: WebPushConfig = {
    apiKey: "public-api-key",
    projectId: "momentum-test",
    messagingSenderId: "1234",
    appId: "1:1234:web:abc",
    vapidKey: "BPublicVapidKey",
}

function memoryStorage(): KeyValueStore & { map: Map<string, string>; writes: number } {
    const map = new Map<string, string>()
    const s = {
        map,
        writes: 0,
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => {
            s.writes++
            map.set(k, v)
        },
        removeItem: (k: string) => {
            s.writes++
            map.delete(k)
        },
    }
    return s
}

function rig(over: Partial<WebPushDeps> = {}) {
    const calls = {
        register: [] as RegisterDeviceBody[],
        unregister: [] as string[],
        requestPermission: 0,
        registerWorker: 0,
        getToken: 0,
        unsubscribed: 0,
    }
    const env = {
        permission: "default" as NotificationPermission,
        answer: "granted" as NotificationPermission,
        token: "tok-1" as string | null,
        user: "user-a" as string | null,
        now: 1_000_000,
        failUnregister: false,
    }
    const subscription = {
        unsubscribe: async () => {
            calls.unsubscribed++
            return true
        },
    }
    const registration = { pushManager: { getSubscription: async () => subscription } }
    const storage = memoryStorage()
    const store = webPushStore(() => storage)
    const deps: WebPushDeps = {
        config: CONFIG,
        supported: () => true,
        permission: () => env.permission,
        requestPermission: async () => {
            calls.requestPermission++
            env.permission = env.answer
            return env.answer
        },
        registerWorker: async () => {
            calls.registerWorker++
            return registration
        },
        existingWorker: async () => registration,
        getToken: async () => {
            calls.getToken++
            return env.token
        },
        http: {
            register: async (body) => {
                calls.register.push(body)
                return `dev-${calls.register.length}`
            },
            unregister: async (id) => {
                if (env.failUnregister) throw new Error("offline")
                calls.unregister.push(id)
            },
        },
        store,
        userId: () => env.user,
        now: () => env.now,
        ...over,
    }
    const network = () => calls.register.length + calls.unregister.length + calls.getToken + calls.registerWorker
    return { deps, calls, env, store, storage, push: createWebPush(deps), network }
}

describe("configuration", () => {
    test("all five public values or nothing", () => {
        expect(readWebPushConfig(CONFIG)).toEqual(CONFIG)
        for (const key of Object.keys(CONFIG) as (keyof WebPushConfig)[]) {
            expect(readWebPushConfig({ ...CONFIG, [key]: undefined })).toBeNull()
            expect(readWebPushConfig({ ...CONFIG, [key]: "   " })).toBeNull()
        }
        expect(isWebPushConfigured({})).toBe(false)
    })

    test("the test environment has none of them, so the app build here is inert", () => {
        expect(isWebPushConfigured()).toBe(false)
    })
})

describe("not configured: invisible and inert", () => {
    test("no status, no permission prompt, no worker, no token, no request, no storage", async () => {
        const r = rig({ config: null })
        expect(r.push.status()).toEqual({ visible: false, permission: "unsupported", on: false })
        expect(await r.push.enable()).toEqual({ ok: false, reason: "unconfigured" })
        expect(await r.push.disable()).toEqual({ ok: false, reason: "unconfigured" })
        await r.push.sync()
        expect(r.calls.requestPermission).toBe(0)
        expect(r.network()).toBe(0)
        expect(r.storage.writes).toBe(0)
    })

    test("the Settings row is hidden", () => {
        expect(deviceSwitchView(null).hidden).toBe(true)
        expect(deviceSwitchView(rig({ config: null }).push.status()).hidden).toBe(true)
    })

    test("sign-out sends nothing and writes nothing", () => {
        const sent: string[] = []
        const storage = memoryStorage()
        storage.map.set(WEB_PUSH_STATE_KEY, JSON.stringify({ users: { "user-a": { on: true, deviceId: "dev-1" } } }))
        storage.writes = 0
        noteWebPushSignOut("user-a", signOutDeps({ config: null, store: webPushStore(() => storage), send: (url) => void sent.push(url) }))
        expect(sent).toEqual([])
        expect(storage.writes).toBe(0)
    })

    test("meaningful actions are not announced", () => {
        const fired: Event[] = []
        const g = globalThis as unknown as { window?: unknown }
        const prev = g.window
        g.window = { dispatchEvent: (e: Event) => void fired.push(e) }
        try {
            announceMeaningfulAction("follow", false)
            expect(fired).toEqual([])
            announceMeaningfulAction("follow", true)
            expect(fired.map((e) => e.type)).toEqual([MEANINGFUL_ACTION_EVENT])
        } finally {
            g.window = prev
        }
    })

    test("unsupported browser or signed out: hidden, nothing asked", async () => {
        const unsupported = rig({ supported: () => false })
        expect(unsupported.push.status().visible).toBe(false)
        expect(await unsupported.push.enable()).toEqual({ ok: false, reason: "unsupported" })
        const signedOut = rig()
        signedOut.env.user = null
        expect(signedOut.push.status().visible).toBe(false)
        expect(await signedOut.push.enable()).toEqual({ ok: false, reason: "signed-out" })
        expect(unsupported.network() + signedOut.network() + signedOut.calls.requestPermission).toBe(0)
    })
})

describe("enable", () => {
    test("asks permission, registers the worker, then POSTs the device with the FCM token", async () => {
        const r = rig()
        expect(await r.push.enable()).toEqual({ ok: true })
        expect(r.calls.requestPermission).toBe(1)
        expect(r.calls.registerWorker).toBe(1)
        expect(r.calls.register).toEqual([{ platform: "web", push_token: "tok-1", app: "momentum" }])
        expect(r.store.user("user-a")).toEqual({ on: true, deviceId: "dev-1", token: "tok-1", at: r.env.now })
        expect(r.push.status()).toEqual({ visible: true, permission: "granted", on: true })
    })

    test("denied: never asks again and sends nothing; dismissed: nothing sent", async () => {
        const denied = rig()
        denied.env.permission = "denied"
        expect(await denied.push.enable()).toEqual({ ok: false, reason: "denied" })
        expect(denied.calls.requestPermission).toBe(0)
        const dismissed = rig()
        dismissed.env.answer = "default"
        expect(await dismissed.push.enable()).toEqual({ ok: false, reason: "dismissed" })
        expect(denied.network() + dismissed.network()).toBe(0)
    })

    test("no token or a refused registration is a failure, and push stays off", async () => {
        const noToken = rig()
        noToken.env.token = null
        expect(await noToken.push.enable()).toEqual({ ok: false, reason: "failed" })
        expect(noToken.calls.register).toEqual([])
        const refused = rig({ http: { register: async () => Promise.reject(new Error("500")), unregister: async () => {} } })
        expect(await refused.push.enable()).toEqual({ ok: false, reason: "failed" })
        expect(refused.push.status().on).toBe(false)
    })

    test("the 201 body's device id, enveloped or bare", () => {
        expect(deviceIdFrom({ data: { id: "d1", platform: "web" } })).toBe("d1")
        expect(deviceIdFrom({ id: "d2" })).toBe("d2")
        expect(deviceIdFrom({ data: {} })).toBeNull()
        expect(deviceIdFrom(null)).toBeNull()
        expect(DEVICES_PATH).toBe("/v1/notifications/devices")
    })
})

describe("disable", () => {
    test("DELETEs the device row and drops the subscription so the token dies", async () => {
        const r = rig()
        await r.push.enable()
        expect(await r.push.disable()).toEqual({ ok: true })
        expect(r.calls.unregister).toEqual(["dev-1"])
        expect(r.calls.unsubscribed).toBe(1)
        expect(r.store.user("user-a")).toEqual({ on: false })
        expect(r.push.status().on).toBe(false)
    })

    test("a DELETE that fails is remembered and retried at the next sync", async () => {
        const r = rig()
        await r.push.enable()
        r.env.failUnregister = true
        expect(await r.push.disable()).toEqual({ ok: false, reason: "failed" })
        expect(r.store.user("user-a")?.on).toBe(false)
        expect(r.store.read().stale).toEqual([{ userId: "user-a", deviceId: "dev-1" }])
        r.env.failUnregister = false
        await r.push.sync()
        expect(r.calls.unregister).toEqual(["dev-1"])
        expect(r.store.read().stale).toEqual([])
    })
})

describe("sync: re-register when the token changes", () => {
    test("same token, recent row: nothing sent", async () => {
        const r = rig()
        await r.push.enable()
        await r.push.sync()
        expect(r.calls.register.length).toBe(1)
        expect(r.calls.requestPermission).toBe(1)
    })

    test("a new token is registered and the old row removed", async () => {
        const calls: RegisterDeviceBody[] = []
        const removed: string[] = []
        const r = rig({ http: { register: async (b) => (calls.push(b), `dev-${calls.length}`), unregister: async (id) => void removed.push(id) } })
        await r.push.enable()
        r.env.token = "tok-2"
        await r.push.sync()
        expect(calls.map((c) => c.push_token)).toEqual(["tok-1", "tok-2"])
        expect(removed).toEqual(["dev-1"])
        expect(r.store.user("user-a")).toMatchObject({ on: true, deviceId: "dev-2", token: "tok-2" })
    })

    test("an old row is written again even with the same token", async () => {
        const r = rig()
        await r.push.enable()
        r.env.now += REREGISTER_MS + 1
        await r.push.sync()
        expect(r.calls.register.length).toBe(2)
    })

    test("permission withdrawn in the browser: the row is deleted and push is off", async () => {
        const r = rig()
        await r.push.enable()
        r.env.permission = "denied"
        await r.push.sync()
        expect(r.calls.unregister).toEqual(["dev-1"])
        expect(r.store.user("user-a")).toEqual({ on: false })
    })

    test("never asks for permission and does nothing for an account that never turned it on", async () => {
        const r = rig()
        await r.push.sync()
        expect(r.calls.requestPermission).toBe(0)
        expect(r.network()).toBe(0)
    })
})

function signOutDeps(over: Partial<SignOutDeps> & { store: SignOutDeps["store"] }): SignOutDeps {
    return {
        config: CONFIG,
        accessToken: () => "access-1",
        send: () => {},
        dropSubscription: () => {},
        apiBase: "",
        ...over,
    }
}

describe("sign-out removes the device", () => {
    test("a keepalive DELETE with the still-live token, the row listed as stale, the token reset", async () => {
        const r = rig()
        await r.push.enable()
        const sent: { url: string; init: RequestInit }[] = []
        let dropped = 0
        noteWebPushSignOut(
            "user-a",
            signOutDeps({ store: r.store, send: (url, init) => void sent.push({ url, init }), dropSubscription: () => void dropped++ }),
        )
        expect(sent.length).toBe(1)
        expect(sent[0].url).toBe("/v1/notifications/devices/dev-1")
        expect(sent[0].init.method).toBe("DELETE")
        expect(sent[0].init.keepalive).toBe(true)
        expect((sent[0].init.headers as Record<string, string>).Authorization).toBe("Bearer access-1")
        expect((sent[0].init.headers as Record<string, string>)["X-User-Id"]).toBe("user-a")
        expect(dropped).toBe(1)
        const state = r.store.read()
        expect(state.users["user-a"]).toEqual({ on: true })
        expect(state.stale).toEqual([{ userId: "user-a", deviceId: "dev-1" }])
        expect(state.resetToken).toBe(true)
    })

    test("the same account signing in again: leftovers deleted, a fresh subscription, registered again", async () => {
        const r = rig()
        await r.push.enable()
        noteWebPushSignOut("user-a", signOutDeps({ store: r.store }))
        r.env.token = "tok-2"
        await r.push.sync()
        expect(r.calls.unregister).toEqual(["dev-1"])
        expect(r.calls.unsubscribed).toBe(1)
        expect(r.calls.register.map((b) => b.push_token)).toEqual(["tok-1", "tok-2"])
        expect(r.store.read()).toMatchObject({ stale: [], resetToken: false })
    })

    test("another account on the same browser inherits nothing", async () => {
        const r = rig()
        await r.push.enable()
        noteWebPushSignOut("user-a", signOutDeps({ store: r.store }))
        r.env.user = "user-b"
        const before = r.network()
        await r.push.sync()
        expect(r.network()).toBe(before)
        expect(r.push.status().on).toBe(false)
    })

    test("no token in memory: nothing sent now, the row is still listed for the next sign-in", async () => {
        const r = rig()
        await r.push.enable()
        const sent: string[] = []
        noteWebPushSignOut("user-a", signOutDeps({ store: r.store, accessToken: () => null, send: (u) => void sent.push(u) }))
        expect(sent).toEqual([])
        expect(r.store.read().stale).toEqual([{ userId: "user-a", deviceId: "dev-1" }])
    })

    test("an account with push off: nothing at all", () => {
        const storage = memoryStorage()
        const sent: string[] = []
        noteWebPushSignOut("user-a", signOutDeps({ store: webPushStore(() => storage), send: (u) => void sent.push(u) }))
        noteWebPushSignOut(null, signOutDeps({ store: webPushStore(() => storage), send: (u) => void sent.push(u) }))
        expect(sent).toEqual([])
        expect(storage.writes).toBe(0)
    })

    test("both sign-out paths call it before the session is cleared", () => {
        const src = readFileSync(join(import.meta.dir, "..", "..", "..", "services", "authService.ts"), "utf8")
        const logout = src.slice(src.indexOf("export const logoutUser"), src.indexOf("export const getSession"))
        const first = logout.indexOf("noteWebPushSignOut(")
        expect(first).toBeGreaterThan(-1)
        expect(first).toBeLessThan(logout.indexOf("authRepository.logout()"))
        const second = logout.indexOf("noteWebPushSignOut(", first + 1)
        expect(second).toBeGreaterThan(-1)
        expect(second).toBeLessThan(logout.indexOf("authRepository.prepareLogoutNavigation()"))
    })
})

describe("storage that misbehaves", () => {
    test("blocked or corrupt storage reads as nothing and never throws", () => {
        const throwing = webPushStore(() => {
            throw new Error("SecurityError")
        })
        expect(throwing.read()).toEqual({ users: {}, stale: [], resetToken: false })
        expect(() => throwing.setUser("u", { on: true })).not.toThrow()
        expect(throwing.snoozedUntil()).toBe(0)
        expect(() => throwing.snooze(5)).not.toThrow()
        const corrupt = memoryStorage()
        corrupt.map.set(WEB_PUSH_STATE_KEY, "{not json")
        expect(webPushStore(() => corrupt).read().users).toEqual({})
    })
})

describe("meaningful actions", () => {
    test("follows, comments and posts the server accepted; nothing else", () => {
        const cases: [string, string, string | null][] = [
            ["post", "/v1/graph/follow", "follow"],
            ["post", "/v1/pages/p1/follow", "follow"],
            ["post", "/v1/posts/p1/comments", "comment"],
            ["post", "/v1/comments/c1/reply", "comment"],
            ["post", "/v1/groups/g1/posts/v2/p1/comments", "comment"],
            ["post", "/v1/broadcast-channels/c1/updates/u1/comments", "comment"],
            ["post", "/v1/qa/answers/a1/comments", "comment"],
            ["post", "/v1/posts", "post"],
            ["POST", "/v1/posts?draft=0", "post"],
            ["post", "/v1/groups/g1/posts/v2", "post"],
            ["post", "/v1/communities/c1/spaces/s1/posts", "post"],
            ["get", "/v1/posts", null],
            ["delete", "/v1/pages/p1/follow", null],
            ["post", "/v1/graph/unfollow", null],
            ["post", "/v1/posts/p1/share", null],
            ["post", "/v1/comments/c1/heart", null],
            ["post", "/v1/posts/p1/comments/extra", null],
            ["post", "/v1/notifications/devices", null],
        ]
        for (const [method, url, want] of cases) expect([method, url, meaningfulActionFor(method, url)]).toEqual([method, url, want])
        expect(meaningfulActionFor(undefined, "/v1/posts")).toBeNull()
        expect(meaningfulActionFor("post", undefined)).toBeNull()
    })
})
