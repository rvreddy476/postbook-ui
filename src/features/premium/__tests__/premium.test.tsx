import { afterEach, describe, expect, mock, spyOn, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
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
  Golden fixtures: fixtures/{plans,checkout,pass,me}.json are byte-for-byte
  copies of monetization-service testdata/contracts/premium (prices exclude
  GST, 13 Nov 2026). They are parsed here and never edited; the one variant
  a test needs (a plan the server marks unavailable) is derived in code.
*/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fixture = (name: string): any => JSON.parse(readFileSync(join(import.meta.dir, "fixtures", `${name}.json`), "utf8"))
const plansBody = fixture("plans")
const checkoutBody = fixture("checkout")
const passBody = fixture("pass")
const meBody = fixture("me")
const PASS: string = checkoutBody.data.pass_id

const TAX_30 = { taxablePaise: 14900, gstPaise: 2682, totalPaise: 17582, rateBp: 1800, provisional: true }
const TAX_365 = { taxablePaise: 149900, gstPaise: 26982, totalPaise: 176882, rateBp: 1800, provisional: true }

/** The 365-day plan as the server sends it while its price or GST is unknown. */
const unavailable365 = {
  data: {
    plans: [
      plansBody.data.plans[0],
      { ...plansBody.data.plans[1], price_paise: null, taxable_paise: null, gst_paise: null, total_paise: null, gst_rate_bp: null, available: false },
    ],
  },
}

const httpError = (status: number, code = "") => ({ response: { status, data: code ? { error: { code, message: "x" } } : {} } })
const noop = () => {}

const spies: { mockRestore(): void }[] = []
afterEach(() => {
  while (spies.length) spies.pop()!.mockRestore()
})

/* ── plans and prices ───────────────────────────────────────────── */

describe("plans and prices (GST on top)", () => {
  const [p30, p365] = M.toPlans(plansBody)
  const [, gone365] = M.toPlans(unavailable365)

  test("plans are read from the {data:{plans}} envelope, in order, with the server's GST split", () => {
    expect([p30.code, p365.code]).toEqual(["premium_30d", "premium_365d"])
    expect(p30).toEqual({ code: "premium_30d", name: "Momentum Premium, 30 days", durationDays: 30, pricePaise: 14900, tax: TAX_30, currency: "INR", available: true })
    expect(p365.tax).toEqual(TAX_365)
  })

  test("the breakdown is the server's numbers, en-IN: 14900 → 2682 → 17582 and 149900 → 26982 → 176882", () => {
    expect(M.planPrice(p30)).toBe("₹149")
    expect(M.planBreakdown(p30)).toBe("₹149 + ₹26.82 GST (18%) = ₹175.82")
    expect(M.planPrice(p365)).toBe("₹1,499")
    expect(M.planBreakdown(p365)).toBe("₹1,499 + ₹269.82 GST (18%) = ₹1,768.82")
  })

  test("nothing is computed here: odd server numbers are shown as sent", () => {
    expect(M.breakdownLine({ taxablePaise: 10000, gstPaise: 1, totalPaise: 99999, rateBp: 1250, provisional: false })).toBe("₹100 + ₹0.01 GST (12.5%) = ₹999.99")
  })

  test("no price, no GST, or available=false is Not available and cannot be bought", () => {
    expect(M.planPrice(gone365)).toBe("Not available")
    expect(M.planBreakdown(gone365)).toBe("")
    expect(M.canBuy(gone365)).toBe(false)
    const priced = { ...p30, available: false }
    expect(M.planPrice(priced)).toBe("Not available")
    expect(M.canBuy(priced)).toBe(false)
    // A price without its GST is never offered at the pre-tax price alone.
    expect(M.canBuy({ ...p30, tax: null })).toBe(false)
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

  test("/me renewal plans carry the same breakdown", () => {
    const me = M.toStatus(meBody)
    expect(me.active).toBe(true)
    expect(me.renewalPlans.map(M.planBreakdown)).toEqual(["₹149 + ₹26.82 GST (18%) = ₹175.82", "₹1,499 + ₹269.82 GST (18%) = ₹1,768.82"])
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
    expect(JSON.stringify(calls[0].body)).not.toMatch(/amount|price|paise|currency|gst|tax|total/)
    expect(calls[0].config).toBeUndefined()
    expect(out.passId).toBe(PASS)
    expect(out.amountPaise).toBe(17582)
    expect(out.tax).toEqual(TAX_30)
  })

  test("checkoutRequest builds only the plan", () => {
    expect(M.checkoutRequest("premium_365d")).toEqual({ url: "/v1/monetization/premium/checkout", body: { plan: "premium_365d" } })
    expect(Object.keys(M.checkoutRequest("premium_30d").body)).toEqual(["plan"])
  })

  test("Razorpay gets the server's amount_paise, the GST total, from its client_session", () => {
    const c = M.toCheckout(checkoutBody)
    const opts = M.razorpayOptions(c, "d")
    // The fixture's client_session has no merchant_display_name: the fallback name is used.
    expect(opts).toEqual({ key: "rzp_test_key", order_id: "order_b2222222", amount: 17582, currency: "INR", name: "Momentum", description: "d" })
    expect(opts!.amount).toBe(c.tax!.totalPaise)
    expect(opts!.amount).not.toBe(c.tax!.taxablePaise)
    expect(M.razorpayOptions({ ...c, session: null }, "d")).toBeNull()
    expect(M.razorpayOptions({ ...c, session: { ...c.session!, provider: "stub" } }, "d")).toBeNull()
    expect(M.razorpayOptions({ ...c, amountPaise: 0 }, "d")).toBeNull()
  })

  test("amount_paise and total_paise disagreeing never opens the dialog", () => {
    const c = M.toCheckout(checkoutBody)
    expect(M.checkoutAmountsDisagree(c)).toBe(false)
    expect(M.checkoutAmountsDisagree({ ...c, amountPaise: 14900 })).toBe(true)
    expect(M.razorpayOptions({ ...c, amountPaise: 14900 }, "d")).toBeNull()
  })

  test("the pass is read from GET /passes/:id, with what it cost", async () => {
    const urls: string[] = []
    spies.push(spyOn(api, "get").mockImplementation((async (url: string) => (urls.push(url), { data: passBody })) as never))
    expect(await readPremiumPass(PASS)).toEqual({ passId: PASS, status: "paid", endsAt: "2026-12-13T10:00:00Z", receipt: { amountPaise: 17582, tax: TAX_30 } })
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
    expect(state).toEqual({ phase: "paid", endsAt: "2026-12-13T00:00:00Z", receipt: null })
    expect(M.paidWords("2026-12-13T00:00:00Z")).toBe("Premium is active until 13 Dec 2026")
  })

  test("the paid read (the golden pass) carries its receipt into the paid state", () => {
    const { state } = run([reading("confirming"), M.toPass(passBody)])
    expect(state).toEqual({ phase: "paid", endsAt: "2026-12-13T10:00:00Z", receipt: { amountPaise: 17582, tax: TAX_30 } })
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
  const checkout = M.toCheckout(checkoutBody)

  test("start → review → Pay → dialog → confirming; a dismissed dialog offers Try again", () => {
    expect(started).toEqual({ phase: "starting", plan: "premium_30d" })
    const review = M.purchaseReducer(started, { type: "started", canOpen: true, checkout })
    expect(review).toEqual({ phase: "review", plan: "premium_30d", checkout })
    expect(M.purchaseBusy(review)).toBe(true)
    expect(M.purchaseReducer(review, { type: "reset" })).toEqual(M.idlePurchase)
    expect(M.purchaseReducer(started, { type: "pay" })).toBe(started)
    const dialog = M.purchaseReducer(review, { type: "pay" })
    expect(dialog).toEqual({ phase: "dialog", plan: "premium_30d" })
    expect(M.purchaseBusy(dialog)).toBe(true)
    expect(M.purchaseReducer(dialog, { type: "dialog_completed" })).toEqual({ phase: "confirming", plan: "premium_30d" })
    expect(M.purchaseReducer(dialog, { type: "dialog_dismissed" })).toEqual({ phase: "dismissed", plan: "premium_30d" })
  })

  test("no session the web can open is a failure, not a payment", () => {
    expect(M.purchaseReducer(started, { type: "started", canOpen: false, checkout })).toEqual({ phase: "failed", message: M.PREMIUM_WORDS.noOnlinePayment })
  })

  test("a checkout whose amount is not its GST total is refused before any dialog", () => {
    expect(M.purchaseReducer(started, { type: "started", canOpen: true, checkout: { ...checkout, amountPaise: 14900 } })).toEqual({
      phase: "failed",
      message: M.PREMIUM_WORDS.amountMismatch,
    })
  })

  test("503 PREMIUM_NOT_ENABLED makes the page say Premium is not available yet", () => {
    const err = httpError(503, "PREMIUM_NOT_ENABLED")
    expect(M.isPremiumOff(err)).toBe(true)
    expect(M.purchaseReducer(started, { type: "start_failed", error: err })).toEqual({ phase: "unavailable" })
    const html = renderToStaticMarkup(
      <PremiumBody off loading={false} plans={null} plansError={err} status={null} statusError={null} purchase={M.idlePurchase} onBuy={noop} onPay={noop} onCheckAgain={noop} onRetry={noop} onReset={noop} />,
    )
    expect(html).toContain("Premium is not available yet")
    expect(html).not.toContain("Choose a pass")
  })

  test("every writePremiumError code has its own message, including the GST ones", () => {
    const cases: Array<[number, string, string]> = [
      [503, "PREMIUM_PRICE_NOT_SET", M.PREMIUM_WORDS.priceNotSet],
      [503, "PREMIUM_TAX_UNAVAILABLE", M.PREMIUM_WORDS.taxUnavailable],
      [503, "PREMIUM_AMOUNT_MISMATCH", M.PREMIUM_WORDS.amountMismatch],
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
    expect(new Set(cases.map(([, , w]) => w)).size).toBe(cases.length)
    expect(M.PREMIUM_WORDS.taxUnavailable).toContain("GST")
    expect(M.PREMIUM_WORDS.amountMismatch).toContain("haven't been charged")
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
      onBuy={noop}
      onPay={noop}
      onCheckAgain={noop}
      onRetry={noop}
      onReset={noop}
      {...over}
    />,
  )

describe("the /premium page", () => {
  test("each pass card shows ₹149 + GST and the server's breakdown line", () => {
    const html = body()
    expect(html).toContain('data-premium-plan="premium_30d"')
    expect(html).toContain('data-premium-plan="premium_365d"')
    expect(html).toMatch(/<span[^>]*>₹149<\/span><span[^>]*>\+ GST<\/span>/)
    expect(html).toMatch(/<span[^>]*>₹1,499<\/span><span[^>]*>\+ GST<\/span>/)
    expect(html).toContain("₹149 + ₹26.82 GST (18%) = ₹175.82")
    expect(html).toContain("₹1,499 + ₹269.82 GST (18%) = ₹1,768.82")
    expect(html).not.toContain("Not available")
    expect(html).toContain("Post on Echo: notes, threads and quotes.")
    expect(html).toContain("No auto-renew: we&#x27;ll remind you 3 days before it ends.")
    expect(html).toContain("You don&#x27;t have Premium")
  })

  test("a plan the server marks unavailable stays Not available, with no price or GST", () => {
    const html = body({ plans: M.toPlans(unavailable365) })
    expect(html).toContain("Not available")
    expect(html).not.toContain("₹1,499")
    expect(html).toContain("₹149 + ₹26.82 GST (18%) = ₹175.82")
  })

  test("status from /me: active until, and the grace wording", () => {
    const active = M.toStatus({ data: { active: true, in_grace: false, ends_at: "2026-12-13T00:00:00Z", grace_ends_at: "2026-12-16T00:00:00Z", renewal_plans: [] } })
    expect(M.statusWords(active).title).toBe("Premium is active until 13 Dec 2026")
    const grace = M.toStatus({ data: { active: true, in_grace: true, ends_at: "2026-12-13T00:00:00Z", grace_ends_at: "2026-12-16T00:00:00Z", renewal_plans: [] } })
    expect(M.statusWords(grace)).toEqual({ tone: "grace", title: "Premium ends on 16 Dec 2026", detail: "Renew to keep posting on Echo." })
    expect(body({ status: grace })).toContain('data-premium-status="grace"')
  })

  test("the confirm step shows price, GST and total again; Pay names the server's amount", () => {
    const checkout = M.toCheckout(checkoutBody)
    expect(M.checkoutLines(checkout)).toEqual([
      { label: "Price", value: "₹149" },
      { label: "GST (18%)", value: "₹26.82" },
      { label: "Total to pay", value: "₹175.82" },
    ])
    const html = renderToStaticMarkup(<PurchaseBanner purchase={{ phase: "review", plan: "premium_30d", checkout }} onPay={noop} onCheckAgain={noop} onRetry={noop} onReset={noop} />)
    for (const t of ["Confirm your pass", "Price", "GST (18%)", "₹26.82", "Total to pay", "Pay ₹175.82", "Cancel"]) expect(html).toContain(t)
  })

  test("success says when Premium ends, shows price, GST and total paid, and links Post on Echo → /echo", () => {
    const receipt = M.toPass(passBody).receipt!
    expect(M.receiptLines(receipt)).toEqual([
      { label: "Price", value: "₹149" },
      { label: "GST (18%)", value: "₹26.82" },
      { label: "Total paid", value: "₹175.82" },
    ])
    const html = renderToStaticMarkup(<PurchaseBanner purchase={{ phase: "paid", endsAt: "2026-12-13T10:00:00Z", receipt }} onCheckAgain={noop} onRetry={noop} onReset={noop} />)
    expect(html).toContain("Premium is active until 13 Dec 2026")
    for (const t of ["Price", "₹149", "GST (18%)", "₹26.82", "Total paid", "₹175.82"]) expect(html).toContain(t)
    expect(html).toMatch(/<a[^>]*href="\/echo"[^>]*>Post on Echo<\/a>/)
  })

  test("a pass opened before GST shows only the total it was charged", () => {
    expect(M.receiptLines({ amountPaise: 9900, tax: null })).toEqual([{ label: "Total paid", value: "₹99" }])
  })

  test("failure offers Try again; still confirming offers Check again", () => {
    expect(renderToStaticMarkup(<PurchaseBanner purchase={{ phase: "failed", message: M.PREMIUM_WORDS.failed }} onCheckAgain={noop} onRetry={noop} onReset={noop} />)).toContain("Try again")
    expect(renderToStaticMarkup(<PurchaseBanner purchase={{ phase: "still_confirming" }} onCheckAgain={noop} onRetry={noop} onReset={noop} />)).toContain("Check again")
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
    expect(renderToStaticMarkup(<SettingsHub onLogout={noop} />)).not.toContain('href="/premium"')
    expect(renderToStaticMarkup(<SettingsHub onLogout={noop} premium />)).toContain('href="/premium"')
  })
})
