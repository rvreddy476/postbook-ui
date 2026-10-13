import { afterEach, describe, expect, test } from "bun:test"
import { NextRequest } from "next/server"
import { middleware } from "@/middleware"
import { openPartnerWorkspace, requestPartnerPhone } from "../partnerSignIn"

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

describe("partner sign-in transition", () => {
  test("uses document replacement, not a prefetched signed-out route", () => {
    const calls: string[] = []
    openPartnerWorkspace("/doorstep/partner", { replace: value => { calls.push(value) } })
    expect(calls).toEqual(["/doorstep/partner"])
    const signedOut = middleware(new NextRequest("https://partner.cleestudio.com/doorstep/partner"))
    expect(signedOut.status).toBe(307)
    const signedIn = middleware(new NextRequest("https://partner.cleestudio.com/doorstep/partner", { headers: { cookie: "pb_auth=1" } }))
    expect(signedIn.headers.get("location")).toBeNull()
    expect(signedIn.headers.get("x-middleware-next")).toBe("1")
  })
  test("never redirects sign-in to an external or administrator destination", () => {
    for (const value of ["https://evil.test", "//evil.test", "/admin", "/login"]) {
      const calls: string[] = []
      openPartnerWorkspace(value, { replace: value => { calls.push(value) } })
      expect(calls).toEqual(["/partners"])
    }
  })
  test("verification sends same-origin cookies and has a bounded request", async () => {
    globalThis.fetch = (async (url, init) => {
      expect(url).toBe("/api/auth/partner/phone/verify")
      expect(init?.credentials).toBe("same-origin")
      expect(init?.cache).toBe("no-store")
      expect(init?.signal).toBeInstanceOf(AbortSignal)
      return Response.json({ data: { requires_2fa: true } })
    }) as typeof fetch
    expect((await requestPartnerPhone("verify", {})).data.requires_2fa).toBe(true)
  })
  test("network failures and unexpected responses produce visible messages", async () => {
    globalThis.fetch = (async () => { throw new DOMException("Timed out", "TimeoutError") }) as typeof fetch
    await expect(requestPartnerPhone("verify", {})).rejects.toThrow("Check your connection")
    globalThis.fetch = (async () => new Response("<html>unavailable</html>")) as typeof fetch
    await expect(requestPartnerPhone("verify", {})).rejects.toThrow("unexpected response")
    globalThis.fetch = (async () => Response.json({})) as typeof fetch
    await expect(requestPartnerPhone("verify", {})).rejects.toThrow("did not finish")
  })
  test("OTP failures keep the server's useful error", async () => {
    globalThis.fetch = (async () => Response.json({ error: { message: "The code has expired. Request a new code." } }, { status: 401 })) as typeof fetch
    await expect(requestPartnerPhone("verify", {})).rejects.toThrow("The code has expired")
  })
})
