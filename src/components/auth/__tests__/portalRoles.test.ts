import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { NextRequest } from "next/server"
import { GET as legacyGET } from "@/app/api/postmatch/auth/logout/route"
import { GET } from "@/app/api/auth/logout/route"
import { AuthRepository } from "@/services/auth/AuthRepository"
import type { AuthStrategy } from "@/services/auth/types"
import type { AuthSessionStore } from "@/services/auth/AuthSessionStore"
import { PORTAL_ROLES, portalRole, roleForPath, roleChooserHref, portalEntryHref, portalLoginHref, logoutRedirect } from "../portalRoles"
import { beginPortalSwitch } from "../portalSwitch"

describe("portal roles", () => {
  for (const role of PORTAL_ROLES) test(`${role.id}: ships a real portal and a safe login return`, () => {
    expect(existsSync(resolve("src/app", role.href.slice(1), "page.tsx"))).toBe(true)
    expect(roleForPath(role.href).id).toBe(role.id)
    expect(new URL(portalLoginHref(role.id), "http://localhost").searchParams.get("redirect")).toBe(role.href)
  })
  test("partner boundaries are exact and take precedence over customer roots", () => {
    expect(roleForPath("/shop/sell/products/1").id).toBe("shop-partner")
    expect(roleForPath("/shop/selling").id).toBe("shop-customer")
    expect(roleForPath("/feast/kitchen/orders").id).toBe("feast-partner")
    expect(roleForPath("/feast/kitchenette").id).toBe("feast-customer")
    expect(roleForPath("/doorstep/partnership").id).toBe("doorstep-customer")
    expect(roleForPath("/reels").id).toBe("customer")
  })
  for (const bad of [null, "", "owner", "admin", "mopedu-partner", "https://evil.test", "//evil.test", "/shop/sell", "__proto__"]) test(`refuse arbitrary portal ${bad}`, () => {
    expect(portalRole(bad)).toBeUndefined()
    expect(logoutRedirect(bad)).toBe("/login")
    expect(beginPortalSwitch(bad, { signedIn: true, cancelQueries() { throw Error("unexpected") }, clearQueries() { throw Error("unexpected") }, prepareLogout() { throw Error("unexpected") }, navigate() { throw Error("unexpected") } })).toBe(false)
  })
  test("customer -> partner and partner -> customer ask to end the old session", () => {
    expect(portalEntryHref("/doorstep", "/doorstep/partner", true)).toBe(roleChooserHref("/doorstep", "doorstep-partner"))
    expect(portalEntryHref("/shop", "/shop/sell", true)).toBe(roleChooserHref("/shop", "shop-partner"))
    expect(portalEntryHref("/feast", "/feast/kitchen", true)).toBe(roleChooserHref("/feast", "feast-partner"))
    expect(portalEntryHref("/feast/kitchen", "/feast/orders", true)).toBe(roleChooserHref("/feast/kitchen", "feast-customer"))
    expect(portalEntryHref("/shop/sell/products", "/shop", true)).toBe(roleChooserHref("/shop/sell", "shop-customer"))
  })
  test("normal in-workspace links and customer browsing do not log out", () => {
    expect(portalEntryHref("/shop/sell", "/shop/sell/products", true)).toBe("/shop/sell/products")
    expect(portalEntryHref("/doorstep/partner", "/doorstep/partner", true)).toBe("/doorstep/partner")
    expect(portalEntryHref("/shop", "/feast", true)).toBe("/feast")
    expect(portalEntryHref("/", "/reels", true)).toBe("/reels")
  })
  test("partner sign-in never uses the login page's already-signed-in shortcut", () => {
    expect(portalEntryHref("/doorstep", "/login?redirect=%2Fdoorstep%2Fpartner", true)).toBe(roleChooserHref("/doorstep", "doorstep-partner"))
    expect(portalEntryHref("/doorstep", "/login?redirect=%2Fdoorstep%2Fpartner", false)).toBe(portalLoginHref("doorstep-partner"))
  })
  test("signed-out partner entry goes to login without a logout cycle", () => {
    expect(portalEntryHref("/shop", "/shop/sell", false)).toBe(portalLoginHref("shop-partner"))
  })
})

describe("switch session ordering", () => {
  test("cancel and clear old queries, forget local session, then navigate to server logout", () => {
    const calls: string[] = []
    beginPortalSwitch("doorstep-partner", { signedIn: true, cancelQueries: () => { calls.push("cancel") }, clearQueries: () => { calls.push("clear") }, prepareLogout: () => { calls.push("forget") }, navigate: href => { calls.push(href) } })
    expect(calls).toEqual(["cancel", "clear", "forget", "/api/postmatch/auth/logout?portal=doorstep-partner"])
  })
  test("missing local session still clears server cookies", () => {
    const calls: string[] = []
    beginPortalSwitch("shop-partner", { signedIn: false, cancelQueries: () => { calls.push("cancel") }, clearQueries: () => { calls.push("clear") }, prepareLogout: () => { calls.push("forget") }, navigate: href => { calls.push(href) } })
    expect(calls).toEqual(["cancel", "clear", "forget", "/api/postmatch/auth/logout?portal=shop-partner"])
  })
  test("local preparation clears once and never starts a second server logout", () => {
    let cleared = 0
    const repo = new AuthRepository({ logout() { throw Error("racing background request") } } as unknown as AuthStrategy, { clear() { cleared++ } } as unknown as AuthSessionStore)
    repo.prepareLogoutNavigation()
    expect(cleared).toBe(1)
  })
  test("all shared account menus expose the Partner dropdown", () => {
    for (const path of ["src/components/Header.tsx", "src/components/MinimalHeader.tsx", "src/features/reels/components/ProfileDropdown.tsx", "src/features/shop/components/ShopHeader.tsx", "src/components/auth/AuthShell.tsx"]) expect(readFileSync(path, "utf8")).toContain("<RoleMenuLink")
  })
})

describe("server logout navigation", () => {
  test("revokes the one refresh session, clears cookies, and redirects to partner login", async () => {
    const previous = globalThis.fetch
    const calls: RequestInit[] = []
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => { calls.push(init!); return new Response("{}", { status: 200 }) }) as typeof fetch
    try {
      const response = await GET(new NextRequest("http://localhost/api/auth/logout?portal=doorstep-partner", { headers: { cookie: "pb_rt=test-session" } }))
      expect(calls).toHaveLength(1)
      expect((calls[0].headers as Record<string, string>).Cookie).toBe("refresh_token=test-session")
      expect(response.status).toBe(303)
      expect(response.headers.get("location")).toBe("/partners/login?businesses=doorstep-partner")
      const cookies = response.headers.getSetCookie().join(";")
      expect(cookies).toContain("pb_auth=")
      expect(cookies).toContain("pb_rt=")
      expect(cookies).toContain("access_token=")
      expect(cookies).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT")
      expect(response.headers.get("cache-control")).toContain("no-store")
    } finally { globalThis.fetch = previous }
  })
  test("arbitrary redirect query is ignored", async () => {
    const previous = globalThis.fetch
    globalThis.fetch = (async () => new Response("{}", { status: 200 })) as typeof fetch
    try {
      const response = await GET(new NextRequest("http://localhost/api/auth/logout?portal=admin&redirect=https://evil.test", { headers: { cookie: "pb_rt=test-session" } }))
      expect(response.headers.get("location")).toBe("/login")
    } finally { globalThis.fetch = previous }
  })
  test("Docker bind host and untrusted proxy headers cannot change the browser origin", async () => {
    const previous = globalThis.fetch
    globalThis.fetch = (async () => new Response("{}", { status: 200 })) as typeof fetch
    try {
      const response = await GET(new NextRequest("http://0.0.0.0:3000/api/auth/logout?portal=shop-partner", { headers: { cookie: "pb_rt=test-session", host: "evil.test", "x-forwarded-host": "evil.test", "x-forwarded-proto": "https" } }))
      expect(response.headers.get("location")).toBe("/partners/login?businesses=shop-partner")
      expect(new URL(response.headers.get("location")!, "https://cleestudio.com").origin).toBe("https://cleestudio.com")
    } finally { globalThis.fetch = previous }
  })
})


describe("legacy session navigation", () => {
  test("legacy session is revoked at its cookie path before main logout", async () => {
    const previous = globalThis.fetch
    const calls: RequestInit[] = []
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => { calls.push(init!); return new Response("{}", { status: 200 }) }) as typeof fetch
    try {
      const res = await legacyGET(new NextRequest("http://0.0.0.0:3000/api/postmatch/auth/logout?portal=ride-partner", { headers: { cookie: "pm_rt=test-legacy" } }))
      expect(calls).toHaveLength(1)
      expect(JSON.parse(calls[0].body as string).refresh_token).toBe("test-legacy")
      expect(res.headers.get("location")).toBe("/api/auth/logout?portal=ride-partner")
      expect(res.headers.getSetCookie().join(";")).toContain("pm_rt=")
      expect(res.headers.get("cache-control")).toContain("no-store")
    } finally { globalThis.fetch = previous }
  })
})
