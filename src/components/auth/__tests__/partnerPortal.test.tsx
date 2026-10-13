import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { NextRequest, NextResponse } from "next/server"
import { middleware } from "@/middleware"
import { GET as logout } from "@/app/api/auth/logout/route"
import { GET as legacyLogout } from "@/app/api/postmatch/auth/logout/route"
import { attachSession } from "@/app/api/auth/_lib/session"
import { AuthShell } from "../AuthShell"
import { BusinessPartnerSelect } from "../BusinessPartnerSelect"
import { PARTNER_MENU, portalEntryHref } from "../portalRoles"
import { businessSelectionError, businessSelections, isPartnerHost, partnerAuthHref, partnerHubHref, partnerReturnPath, portalHostname, portalLogoutDestination } from "../partnerPortal"

describe("business partner choices", () => {
  test("supports multiple types, removes duplicates and never accepts an authorization role", () => {
    expect(businessSelections("ride-partner,admin,shop-partner,ride-partner,customer,__proto__")).toEqual(["shop-partner", "ride-partner"])
    expect(businessSelections("owner,superadmin,customer")).toEqual([])
    expect(businessSelections("x".repeat(513))).toEqual([])
    expect(businessSelections("ride-partner," + "x".repeat(513))).toEqual([])
    expect(businessSelections(PARTNER_MENU.map(item => item.id).join(","))).toHaveLength(5)
  })
  test("dropdown uses native multi-select checkboxes and labels every business", () => {
    const html = renderToStaticMarkup(<BusinessPartnerSelect value={["shop-partner", "ride-partner"]} onChange={() => {}} />)
    expect(html).toContain("2 business types selected")
    expect(html.match(/type="checkbox"/g)).toHaveLength(5)
    expect(html.match(/checked=""/g)).toHaveLength(2)
    for (const item of PARTNER_MENU) expect(html).toContain(item.label)
    expect(html).toContain("Each business has its own application and approval")
  })
  test("empty selection has a useful, accessible validation message", () => {
    expect(businessSelectionError([])).toContain("Choose at least one")
    expect(businessSelectionError(["ride-partner", "delivery-partner"])).toBeUndefined()
    const html = renderToStaticMarkup(<BusinessPartnerSelect value={[]} onChange={() => {}} error="Choose at least one business partner type." />)
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('role="alert"')
    expect(html).toContain("Choose at least one business partner type")
  })
  test("auth links preserve multiple business types across verification and sign in", () => {
    const ids = ["shop-partner", "ride-partner"] as const
    expect(businessSelections(new URL(partnerAuthHref("login", ids), "http://localhost").searchParams.get("businesses"))).toEqual([...ids])
    expect(businessSelections(new URL(partnerHubHref(ids), "http://localhost").searchParams.get("businesses"))).toEqual([...ids])
  })
})

describe("separate partner authentication", () => {
  test("partner shell has its own branding and registration, not a customer signup link", () => {
    const html = renderToStaticMarkup(<AuthShell mode="login" partnerPortal businessIds={["ride-partner"]} redirectTo="/partners">Sign in</AuthShell>)
    expect(html).toContain("Clee Partners")
    expect(html).toContain('aria-label="Partner sign in"')
    expect(html).toContain("/partners/register?")
    expect(html).not.toContain('href="/register"')
    expect(html).toContain("One account. Multiple businesses.")
  })
  test.each([null, "/", "/admin", "/reels", "//evil.test", "https://evil.test", "/shop/selling", "/feast/kitchenette"])("partner return cannot point to customer, admin or external destination %s", value => {
    expect(partnerReturnPath(value)).toBe("/partners")
  })
  test("real partner detail returns are kept", () => {
    expect(partnerReturnPath("/shop/sell/products/123")).toBe("/shop/sell/products/123")
    expect(partnerReturnPath("/partners?businesses=ride-partner,admin")).toBe("/partners?businesses=ride-partner")
  })
  test("partner hostname matching is exact", () => {
    expect(isPartnerHost("PARTNER.CLEESTUDIO.COM")).toBe(true)
    expect(isPartnerHost("partner.cleestudio.com.evil.test")).toBe(false)
    expect(portalHostname("0.0.0.0", "evil.test")).toBe("0.0.0.0")
    expect(portalLogoutDestination("evil.test", "shop-partner")).toBe("/partners/login?businesses=shop-partner")
  })
  test("business-to-business moves stay in one partner session; customer exit logs out", () => {
    expect(portalEntryHref("/shop/sell", "/feast/kitchen", true, true)).toBe("/feast/kitchen")
    expect(portalEntryHref("/partners", "/mopedu/partner", true, true)).toBe("/mopedu/partner")
    expect(portalEntryHref("/partners", "/shop", true, true)).toBe("/api/postmatch/auth/logout?portal=shop-customer")
  })
  test("session cookies remain host-only: no customer-to-partner cookie sharing", () => {
    const response = NextResponse.json({})
    attachSession(response, { refreshToken: "test-only", accessToken: "test-only" })
    expect(response.headers.getSetCookie()).toHaveLength(3)
    for (const cookie of response.headers.getSetCookie()) expect(cookie.toLowerCase()).not.toContain("domain=")
  })
})

describe("partner host routing", () => {
  const visit = (path: string, signedIn = false) => middleware(new NextRequest(`https://partner.cleestudio.com${path}`, { headers: signedIn ? { cookie: "pb_auth=1" } : undefined }))
  test("signed-out partner root asks for partner login, never displays the customer homepage", () => {
    const response = visit("/")
    expect(response.headers.get("x-middleware-next")).toBeNull()
    expect(new URL(response.headers.get("location")!).searchParams.get("redirect")).toBe("/partners")
    expect(response.headers.get("cache-control")).toContain("no-store")
  })
  test("login and register use the distinct partner pages", () => {
    for (const path of ["/login", "/register"]) expect(new URL(visit(path).headers.get("x-middleware-rewrite")!).pathname).toBe("/partners" + path)
  })
  test("signed-in root renders the partner hub; private business pages stay gated", () => {
    expect(new URL(visit("/", true).headers.get("x-middleware-rewrite")!).pathname).toBe("/partners")
    expect(visit("/shop/sell").headers.get("location")).toContain("/login")
    expect(visit("/partners/private").headers.get("location")).toContain("/login")
  })
  test("customer root is unchanged; entering partners first clears the customer session", () => {
    expect(middleware(new NextRequest("https://cleestudio.com/")).headers.get("x-middleware-next")).toBe("1")
    const response = middleware(new NextRequest("https://cleestudio.com/partners/register?businesses=shop-partner,ride-partner,admin", { headers: { cookie: "pb_auth=1" } }))
    const target = new URL(response.headers.get("location")!, "https://cleestudio.com")
    expect(target.pathname).toBe("/api/postmatch/auth/logout")
    expect(target.searchParams.get("intent")).toBe("register")
    expect(businessSelections(target.searchParams.get("businesses"))).toEqual(["shop-partner", "ride-partner"])
  })
})

describe("cross-domain logout handoff", () => {
  test("both logout responses clear cookies before a fixed partner-domain redirect; multi-select survives", async () => {
    const saved = globalThis.fetch
    const calls: string[] = []
    globalThis.fetch = (async (url: unknown) => { calls.push(String(url)); return new Response("{}", { status: 200 }) }) as typeof fetch
    try {
      const first = await legacyLogout(new NextRequest("https://cleestudio.com/api/postmatch/auth/logout?partner=1&intent=register&businesses=ride-partner,shop-partner,admin", { headers: { cookie: "pm_rt=test-only" } }))
      expect(first.headers.getSetCookie().join(";")).toContain("pm_rt=")
      const next = new URL(first.headers.get("location")!, "https://cleestudio.com")
      expect(businessSelections(next.searchParams.get("businesses"))).toEqual(["shop-partner", "ride-partner"])
      const last = await logout(new NextRequest(next, { headers: { cookie: "pb_rt=test-only" } }))
      expect(last.headers.getSetCookie().join(";")).toContain("pb_rt=")
      expect(last.headers.getSetCookie().join(";")).toContain("pb_auth=")
      const destination = new URL(last.headers.get("location")!)
      expect(destination.origin).toBe("https://partner.cleestudio.com")
      expect(destination.pathname).toBe("/register")
      expect(businessSelections(destination.searchParams.get("businesses"))).toEqual(["shop-partner", "ride-partner"])
      expect(last.headers.get("cache-control")).toContain("no-store")
      expect(calls).toHaveLength(2)
      expect(destination.search).not.toContain("test-only")
    } finally { globalThis.fetch = saved }
  })
})
