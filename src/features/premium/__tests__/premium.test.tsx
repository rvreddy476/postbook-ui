import { afterEach, describe, expect, mock, spyOn, test } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

mock.module("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, prefetch() {}, back() {}, refresh() {} }),
  usePathname: () => "/premium",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

const { default: api } = await import("@/lib/api")
const { startPremiumCheckout, fetchPremiumPlans, readPremiumPass } = await import("../api")
const M = await import("../model")
const { PremiumBody, PurchaseBanner } = await import("../screens")
const { premiumEntryVisible } = await import("../hooks")
const { SETTINGS_GROUPS, settingsGroups } = await import("@/app/settings/_lib/settingsHub")
const { SettingsHub } = await import("@/app/settings/_components/SettingsHub")

/*
  No golden fixtures: monetization-service has no testdata/contracts for
  Premium, so the bodies below are written from premium_handler.go and
  service/premium.go (the field names and the {"data": …} envelope) and
  are not server fixtures.
*/

const PASS = "5b0c7f4e-1111-4a3b-9c00-000000000001"
const plansBody = {
  data: {
    plans: [
      { code: "premium_30d", name: "Premium, 30 days", duration_days: 30, price_paise: 9900, currency: "INR", available: true },
      { code: "premium_365d", name: "Premium, 365 days", duration_days: 365, price_paise: null, currency: "INR", available: false },
    ],
  },
}
const checkoutBody = {
  data: {
    pass_id: PASS,
    plan: "premium_30d",
    duration_days: 30,
    status: "pending_payment",
    amount_paise: 9900,
    currency: "INR",
    intent_id: "9a9a9a9a-0000-4000-8000-000000000001",
    client_session: { provider: "razorpay", order_id: "order_abc", key_id: "rzp_test_key", merchant_display_name: "Momentum" },
  },
}
const httpError = (status: number, code = "") => ({ response: { status, data: code ? { error: { code, message: "x" } } : {} } })

const spies: { mockRestore(): void }[] = []
afterEach(() => {
  while (spies.length) spies.pop()!.mockRestore()
})

/* ── plans and prices ───────────────────────────────────────────── */

describe("plans and prices", () => {
  const [p30, p365] = M.toPlans(plansBody)

  test("plans are read from the {data:{plans}} envelope, in order", () => {
    expect([p30.code, p365.code]).toEqual(["premium_30d", "premium_365d"])
    expect(p30).toEqual({ code: "premium_30d", name: "Premium, 30 days", durationDays: 30, pricePaise: 9900, currency: "INR", available: true })
    expect(p365.pricePaise).toBeNull()
  })

  test("prices are formatted from paise in rupees (en-IN)", () => {
    expect(M.planPrice(p30)).toBe("₹99")
    expect(M.planPrice({ ...p30, pricePaise: 3_650_000 })).toBe("₹36,500")
    expect(M.planPrice({ ...p30, pricePaise: 9950 })).toBe("₹99.50")
  })

  test("no price, or available=false, is Not available and cannot be bought", () => {
    expect(M.planPrice(p365)).toBe("Not available")
    expect(M.canBuy(p365)).toBe(false)
    const priced = { ...p30, available: false }
    expect(M.planPrice(priced)).toBe("Not available")
    expect(M.canBuy(priced)).toBe(false)
    expect(M.canBuy(p30)).toBe(true)
  })

  test("lengths read 30 days / 365 days", () => {
    expect(M.planLength(p30)).toBe("30 days")
    expect(M.planLength(p365)).toBe("365 days")
  })

  test("the plans request is GET /v1/monetization/premium/plans", async () => {
    const urls: string[] = []
    spies.push(spyOn(api, "get").mockImplementation((async (url: string) => (urls.push(url), { data: plansBody })) as never))
    expect((await fetchPremiumPlans()).length).toBe(2)
    expect(urls).toEqual(["/v1/monetization/premium/plans"])
  })
})

/* ── checkout: the body is the plan and nothing else ────────────── */

describe("checkout", () => {
  test('the body is exactly {"plan": code}; no amount is ever sent', async () => {
    const calls: { url: string; body: unknown; config?: unknown }[] = []
    spies.push(
      spyOn(api, "post").mockImplementation((async (url: string, body: unknown, config?: unknown) => {
        calls.push({ url, body, config })
        return { data: checkoutBody }
      }) as never),
    )
    const out = await startPremiumCheckout("premium_30d")
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe("/v1/monetization/premium/checkout")
    expect(JSON.stringify(calls[0].body)).toBe('{"plan":"premium_30d"}')
    expect(JSON.stringify(calls[0].body)).not.toMatch(/amount|price|paise|currency/)
    expect(calls[0].config).toBeUndefined()
    expect(out.passId).toBe(PASS)
  })

  test("checkoutRequest builds only the plan", () => {
    expect(M.checkoutRequest("premium_365d")).toEqual({ url: "/v1/monetization/premium/checkout", body: { plan: "premium_365d" } })
    expect(Object.keys(M.checkoutRequest("premium_30d").body)).toEqual(["plan"])
  })

  test("the Razorpay dialog opens from the server's client_session and amount only", () => {
    const c = M.toCheckout(checkoutBody)
    expect(M.razorpayOptions(c, "d")).toEqual({ key: "rzp_test_key", order_id: "order_abc", amount: 9900, currency: "INR", name: "Momentum", description: "d" })
    expect(M.razorpayOptions({ ...c, session: null }, "d")).toBeNull()
    expect(M.razorpayOptions({ ...c, session: { ...c.session!, provider: "stub" } }, "d")).toBeNull()
    expect(M.razorpayOptions({ ...c, amountPaise: 0 }, "d")).toBeNull()
  })

  test("the pass is read from GET /passes/:id", async () => {
    const urls: string[] = []
    spies.push(
      spyOn(api, "get").mockImplementation((async (url: string) => {
        urls.push(url)
        return { data: { data: { pass_id: PASS, plan: "premium_30d", status: "paid", amount_paise: 9900, currency: "INR", starts_at: "2026-11-13T00:00:00Z", ends_at: "2026-12-13T00:00:00Z" } } }
      }) as never),
    )
    expect(await readPremiumPass(PASS)).toEqual({ passId: PASS, status: "paid", endsAt: "2026-12-13T00:00:00Z" })
    expect(urls).toEqual([`/v1/monetization/premium/passes/${PASS}`])
  })
})

/* ── the poll ───────────────────────────────────────────────────── */

const reading = (status: string, endsAt: string | null = null) => M.toPass({ data: { pass_id: PASS, status, ends_at: endsAt } })

function run(readings: Array<ReturnType<typeof reading> | number>) {
  let p = M.initialPassPoll
  let state: ReturnType<typeof M.purchaseReducer> = { phase: "confirming", plan: "premium_30d" }
  const waits: number[] = []
  for (const r of readings) {
    const wait = M.nextPassWait(p)
    if (wait === null) break
    waits.push(wait)
    p = typeof r === "number" ? M.passPollError(p, wait, r) : M.passPollRead(p, wait, r)
    state = M.purchaseReducer(state, { type: "poll", poll: p })
  }
  return { p, state, waits }
}

describe("the pass poll", () => {
  test("confirming → paid ends the poll with the pass's end date", () => {
    const { p, state, waits } = run([reading("confirming"), reading("confirming"), reading("paid", "2026-12-13T00:00:00Z"), reading("paid")])
    expect(waits).toEqual([1000, 2000, 3000])
    expect(p.phase).toBe("paid")
    expect(state).toEqual({ phase: "paid", endsAt: "2026-12-13T00:00:00Z" })
    expect(M.paidWords("2026-12-13T00:00:00Z")).toBe("Premium is active until 13 Dec 2026")
  })

  test("confirming → failed, and refunded, are failures with their own words", () => {
    expect(run([reading("confirming"), reading("failed")]).state).toEqual({ phase: "failed", message: M.PREMIUM_WORDS.failed })
    expect(run([reading("refunded")]).state).toEqual({ phase: "failed", message: M.PREMIUM_WORDS.refunded })
  })

  test("an unknown status is still confirming, never paid", () => {
    expect(reading("pending_payment").status).toBe("confirming")
    expect(reading("PAID").status).toBe("confirming")
  })

  test("about two minutes of confirming times out as still confirming (not a failure)", () => {
    const { p, state, waits } = run(Array.from({ length: 100 }, () => reading("confirming")))
    expect(waits.reduce((a, b) => a + b, 0)).toBe(M.PASS_POLL_TIMEOUT_MS)
    expect(M.PASS_POLL_TIMEOUT_MS).toBe(120_000)
    expect(waits.slice(0, 5)).toEqual([1000, 2000, 3000, 4000, 5000])
    expect(p.phase).toBe("timed_out")
    expect(M.nextPassWait(p)).toBeNull()
    expect(state).toEqual({ phase: "still_confirming" })
    // Check again restarts the confirming state.
    expect(M.purchaseReducer(state, { type: "check_again" }).phase).toBe("confirming")
  })

  test("a 5xx or no answer keeps asking; a 404 stops it", () => {
    const flaky = run([503, 0, reading("paid")])
    expect(flaky.state.phase).toBe("paid")
    const gone = run([404, reading("paid")])
    expect(gone.p.phase).toBe("stopped")
    expect(gone.state).toEqual({ phase: "failed", message: M.PREMIUM_WORDS.notFound })
  })
})

/* ── the purchase states and errors ─────────────────────────────── */

describe("purchase states and errors", () => {
  const started = M.purchaseReducer(M.idlePurchase, { type: "start", plan: "premium_30d" })

  test("start → dialog → confirming; a dismissed dialog offers Try again", () => {
    expect(started).toEqual({ phase: "starting", plan: "premium_30d" })
    const dialog = M.purchaseReducer(started, { type: "started", canOpen: true })
    expect(dialog).toEqual({ phase: "dialog", plan: "premium_30d" })
    expect(M.purchaseBusy(dialog)).toBe(true)
    expect(M.purchaseReducer(dialog, { type: "dialog_completed" })).toEqual({ phase: "confirming", plan: "premium_30d" })
    expect(M.purchaseReducer(dialog, { type: "dialog_dismissed" })).toEqual({ phase: "dismissed", plan: "premium_30d" })
  })

  test("no session the web can open is a failure, not a payment", () => {
    expect(M.purchaseReducer(started, { type: "started", canOpen: false })).toEqual({ phase: "failed", message: M.PREMIUM_WORDS.noOnlinePayment })
  })

  test("503 PREMIUM_NOT_ENABLED makes the page say Premium is not available yet", () => {
    const err = httpError(503, "PREMIUM_NOT_ENABLED")
    expect(M.isPremiumOff(err)).toBe(true)
    expect(M.purchaseReducer(started, { type: "start_failed", error: err })).toEqual({ phase: "unavailable" })
    const html = renderToStaticMarkup(
      <PremiumBody off loading={false} plans={null} plansError={err} status={null} statusError={null} purchase={M.idlePurchase} onBuy={() => {}} onCheckAgain={() => {}} onRetry={() => {}} onReset={() => {}} />,
    )
    expect(html).toContain("Premium is not available yet")
    expect(html).not.toContain("Choose a pass")
  })

  test("every writePremiumError code has its own message", () => {
    const cases: Array<[number, string, string]> = [
      [503, "PREMIUM_PRICE_NOT_SET", M.PREMIUM_WORDS.priceNotSet],
      [400, "UNKNOWN_PLAN", M.PREMIUM_WORDS.unknownPlan],
      [503, "PREMIUM_PAYMENTS_UNAVAILABLE", M.PREMIUM_WORDS.paymentsUnavailable],
      [502, "PAYMENT_SESSION_UNAVAILABLE", M.PREMIUM_WORDS.sessionUnavailable],
      [404, "NOT_FOUND", M.PREMIUM_WORDS.notFound],
      [500, "INTERNAL_ERROR", M.PREMIUM_WORDS.generic],
      [503, "MAINTENANCE", M.PREMIUM_WORDS.maintenance],
      [400, "BAD_REQUEST", M.PREMIUM_WORDS.badRequest],
    ]
    for (const [status, code, words] of cases) {
      expect(M.premiumErrorMessage(httpError(status, code))).toBe(words)
      expect(M.purchaseReducer(started, { type: "start_failed", error: httpError(status, code) })).toEqual({ phase: "error", plan: "premium_30d", message: words })
    }
    expect(M.premiumErrorMessage({})).toBe(M.PREMIUM_WORDS.network)
  })
})

/* ── the page ───────────────────────────────────────────────────── */

const body = (over: Partial<React.ComponentProps<typeof PremiumBody>> = {}) =>
  renderToStaticMarkup(
    <PremiumBody
      off={false}
      loading={false}
      plans={M.toPlans(plansBody)}
      plansError={null}
      status={M.toStatus({ data: { active: false, in_grace: false, ends_at: null, grace_ends_at: null, renewal_plans: [] } })}
      statusError={null}
      purchase={M.idlePurchase}
      onBuy={() => {}}
      onCheckAgain={() => {}}
      onRetry={() => {}}
      onReset={() => {}}
      {...over}
    />,
  )

describe("the /premium page", () => {
  test("shows both passes, the price or Not available, the honest perk and the no-auto-renew line", () => {
    const html = body()
    expect(html).toContain('data-premium-plan="premium_30d"')
    expect(html).toContain('data-premium-plan="premium_365d"')
    expect(html).toContain("₹99")
    expect(html).toContain("Not available")
    expect(html).toContain("Post on Echo: notes, threads and quotes.")
    expect(html).toContain("No auto-renew: we&#x27;ll remind you 3 days before it ends.")
    expect(html).toContain("You don&#x27;t have Premium")
  })

  test("status from /me: active until, and the grace wording", () => {
    const active = M.toStatus({ data: { active: true, in_grace: false, ends_at: "2026-12-13T00:00:00Z", grace_ends_at: "2026-12-16T00:00:00Z", renewal_plans: [] } })
    expect(M.statusWords(active).title).toBe("Premium is active until 13 Dec 2026")
    const grace = M.toStatus({ data: { active: true, in_grace: true, ends_at: "2026-12-13T00:00:00Z", grace_ends_at: "2026-12-16T00:00:00Z", renewal_plans: [] } })
    expect(M.statusWords(grace)).toEqual({ tone: "grace", title: "Premium ends on 16 Dec 2026", detail: "Renew to keep posting on Echo." })
    expect(body({ status: grace })).toContain('data-premium-status="grace"')
  })

  test("success says when Premium ends and links Post on Echo → /echo", () => {
    const html = renderToStaticMarkup(<PurchaseBanner purchase={{ phase: "paid", endsAt: "2026-12-13T00:00:00Z" }} onCheckAgain={() => {}} onRetry={() => {}} onReset={() => {}} />)
    expect(html).toContain("Premium is active until 13 Dec 2026")
    expect(html).toMatch(/<a[^>]*href="\/echo"[^>]*>Post on Echo<\/a>/)
  })

  test("failure offers Try again; still confirming offers Check again", () => {
    expect(renderToStaticMarkup(<PurchaseBanner purchase={{ phase: "failed", message: M.PREMIUM_WORDS.failed }} onCheckAgain={() => {}} onRetry={() => {}} onReset={() => {}} />)).toContain("Try again")
    expect(renderToStaticMarkup(<PurchaseBanner purchase={{ phase: "still_confirming" }} onCheckAgain={() => {}} onRetry={() => {}} onReset={() => {}} />)).toContain("Check again")
  })
})

/* ── the Settings entry ─────────────────────────────────────────── */

describe("the Settings entry", () => {
  const keys = (premium: boolean) => settingsGroups({ premium }).flatMap((g) => g.rows.map((r) => r.key))

  test("hidden unless the plans call answered 200 (fails closed)", () => {
    expect(premiumEntryVisible(false, false)).toBe(false) // no answer yet
    expect(premiumEntryVisible(false, true)).toBe(false) // 503 PREMIUM_NOT_ENABLED or any error
    expect(premiumEntryVisible(true, true)).toBe(false)
    expect(premiumEntryVisible(true, false)).toBe(true)
  })

  test("off: no Premium row, the groups unchanged; on: after Memberships, linking /premium", () => {
    expect(settingsGroups({ premium: false })).toBe(SETTINGS_GROUPS)
    expect(keys(false)).not.toContain("premium")
    const account = settingsGroups({ premium: true }).find((g) => g.key === "account")!.rows.map((r) => [r.key, r.href])
    const at = account.findIndex(([k]) => k === "memberships")
    expect(account[at + 1]).toEqual(["premium", "/premium"])
  })

  test("the hub draws the row only when told Premium is available", () => {
    expect(renderToStaticMarkup(<SettingsHub onLogout={() => {}} />)).not.toContain('href="/premium"')
    expect(renderToStaticMarkup(<SettingsHub onLogout={() => {}} premium />)).toContain('href="/premium"')
  })
})
