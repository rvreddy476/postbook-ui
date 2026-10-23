import { describe, expect, test } from "bun:test"

import { afterWait, applyReadError, applyReading, initialPollState, nextStep, POLL_TIMEOUT_MS, type PollState } from "@/features/shop/orders/paymentPoll"

import { checkoutBusy, checkoutReducer, idle, NO_ONLINE_PAYMENT, PAYMENT_FAILED, resetsKey, type CheckoutEvent, type CheckoutPhase } from "../checkout"
import {
  activeLevels,
  activePatch,
  cancelRequest,
  checkoutAlreadyPaid,
  createJoinKeys,
  createTierBody,
  emptyTierForm,
  entitlementParams,
  gatedHref,
  gatedRows,
  gateOptionLabel,
  gateRequest,
  hasAccess,
  canCancel,
  canChangeLevel,
  isMembersOnlyError,
  isMembershipsOff,
  keepKeyAfter,
  levelsThatUnlock,
  membersLocked,
  membershipErrorMessage,
  MISSING_COPY,
  NETWORK_COPY,
  parsePerks,
  parsePricePaise,
  paiseToInput,
  paymentUrl,
  razorpayOpen,
  renewRequest,
  statusLine,
  subscribeRequest,
  tierFormFrom,
  tierPatch,
  toAccess,
  toCheckout,
  toEligibility,
  toMembershipError,
  toMyMemberships,
  toPaymentReading,
  toTierChange,
  toTiers,
  upgradeRequest,
  validateTierForm,
  verifyRequest,
  type LockInput,
  type Tier,
} from "../model"
import { fixture, fixtureNames, httpError, NETWORK_ERROR, SOURCES } from "./fixtures"

const T1 = "6f1c2a10-1111-4a3b-9c00-000000000001"
const T2 = "6f1c2a10-1111-4a3b-9c00-000000000002"
const T3 = "6f1c2a10-1111-4a3b-9c00-000000000003"

describe("fixtures", () => {
  test("every fixture names the Go code it was built from, and every source has its file", () => {
    expect(fixtureNames()).toEqual(Object.keys(SOURCES).sort())
    for (const [name, source] of Object.entries(SOURCES)) expect(source, name).toMatch(/\.go:\d+/)
  })
})

/* ── levels ─────────────────────────────────────────────────────── */

describe("levels: decoding", () => {
  const tiers = toTiers(fixture("tiers_mine_200"))

  test("CreatorTier rows: perks as a list (null → []), inactive kept, price in paise", () => {
    expect(tiers.map((t) => [t.name, t.pricePaise, t.isActive, t.perks.length, t.subscriberCount])).toEqual([
      ["Supporter", 4900, true, 2, 12],
      ["Superfan", 19900, true, 2, 0],
      ["Old level", 9900, false, 0, 3],
    ])
  })

  test("perks that arrive as a JSON string decode too", () => {
    expect(toTiers({ data: [{ id: "x", name: "A", price_paise: 2900, perks: '["one"," ","two"]', is_active: true }] })[0].perks).toEqual(["one", "two"])
  })

  test("active levels, cheapest first; the ones that unlock a level are it and dearer", () => {
    expect(activeLevels(tiers).map((t) => t.id)).toEqual([T1, T2])
    expect(levelsThatUnlock(tiers, T2).map((t) => t.id)).toEqual([T2])
    expect(levelsThatUnlock(tiers, T1).map((t) => t.id)).toEqual([T1, T2])
    // A gate on a turned-off level that is still in the list (the creator's own view): by its price.
    expect(levelsThatUnlock(tiers, T3).map((t) => t.id)).toEqual([T2])
    // A level not in the list at all (the public route lists active ones only), or none: every active level.
    expect(levelsThatUnlock(tiers, "gone").map((t) => t.id)).toEqual([T1, T2])
    expect(levelsThatUnlock(tiers, null).map((t) => t.id)).toEqual([T1, T2])
  })

  test("the Members only choice says 'and above' when a dearer level exists", () => {
    const active = activeLevels(tiers)
    expect(gateOptionLabel(active[0], active)).toBe("Supporter and above")
    expect(gateOptionLabel(active[1], active)).toBe("Superfan")
  })

  test("a PATCH answer carries the tier", () => {
    const body = fixture("tier_patch_200") as { data: { tier: unknown } }
    expect(toTiers({ data: [body.data.tier] })[0].pricePaise).toBe(5900)
  })
})

describe("levels: the form mirrors the server's rules", () => {
  const ok = { name: "Supporter", price: "49", perks: "a\nb" }
  const v = (form: Partial<typeof ok>, opts = { activeCount: 0, creating: true }) => validateTierForm({ ...ok, ...form }, opts)

  test("a good level has no errors", () => {
    expect(v({})).toEqual({})
  })

  test("name: 1 to 60 characters after trimming, counted as characters", () => {
    expect(v({ name: "   " }).name).toBeDefined()
    expect(v({ name: "x".repeat(60) }).name).toBeUndefined()
    expect(v({ name: "x".repeat(61) }).name).toBeDefined()
    // 60 emoji are 60 characters (the server counts runes), not 120 UTF-16 units.
    expect(v({ name: "😀".repeat(60) }).name).toBeUndefined()
    expect(v({ name: "  padded  " }).name).toBeUndefined()
  })

  test("price: ₹29 to ₹2,999, rupees with up to two decimals, parsed without floats", () => {
    expect(parsePricePaise("29")).toBe(2900)
    expect(parsePricePaise("99.5")).toBe(9950)
    expect(parsePricePaise("99.05")).toBe(9905)
    expect(parsePricePaise("₹1,299")).toBe(129900)
    expect(parsePricePaise("0.29")).toBe(29)
    expect(parsePricePaise("1.234")).toBeNull()
    expect(parsePricePaise("abc")).toBeNull()
    expect(parsePricePaise("")).toBeNull()
    expect(parsePricePaise("-5")).toBeNull()
    expect(v({ price: "28.99" }).price).toBe("The price must be between ₹29 and ₹2,999 a month.")
    expect(v({ price: "29" }).price).toBeUndefined()
    expect(v({ price: "2999" }).price).toBeUndefined()
    expect(v({ price: "2999.01" }).price).toBeDefined()
    expect(v({ price: "free" }).price).toBe("Enter a price in rupees, like 99.")
    expect(paiseToInput(9950)).toBe("99.50")
    expect(paiseToInput(4900)).toBe("49")
  })

  test("perks: blanks dropped, at most 10, each at most 100 characters", () => {
    expect(parsePerks(" a \n\n b \r\n")).toEqual(["a", "b"])
    expect(v({ perks: Array.from({ length: 10 }, (_, i) => `p${i}`).join("\n") }).perks).toBeUndefined()
    expect(v({ perks: Array.from({ length: 11 }, (_, i) => `p${i}`).join("\n") }).perks).toBe("Up to 10 perks.")
    expect(v({ perks: "y".repeat(100) }).perks).toBeUndefined()
    expect(v({ perks: "y".repeat(101) }).perks).toBe("Each perk can be at most 100 characters.")
  })

  test("at most 3 active levels: a fourth is refused before the request; editing one is not counted", () => {
    expect(v({}, { activeCount: 3, creating: true }).form).toContain("up to 3 active levels")
    expect(v({}, { activeCount: 2, creating: true }).form).toBeUndefined()
    expect(v({}, { activeCount: 3, creating: false }).form).toBeUndefined()
  })

  test("the create body: trimmed, paise, INR, perks as a list", () => {
    expect(createTierBody({ name: " Gold ", price: "199.00", perks: "x\n\ny" })).toEqual({ name: "Gold", price_paise: 19900, currency: "INR", perks: ["x", "y"] })
  })
})

describe("levels: PATCH sends only the fields that changed", () => {
  const tier: Tier = toTiers(fixture("tiers_mine_200"))[0]

  test("nothing changed: an empty patch", () => {
    expect(tierPatch(tier, tierFormFrom(tier))).toEqual({})
    // Whitespace the server would trim is not a change.
    expect(tierPatch(tier, { ...tierFormFrom(tier), name: " Supporter ", perks: "Members-only videos\n\nEarly access\n" })).toEqual({})
  })

  test("a price-only edit sends only price_paise (never a blank name or perks)", () => {
    expect(tierPatch(tier, { ...tierFormFrom(tier), price: "59" })).toEqual({ price_paise: 5900 })
  })

  test("name and perks each on their own; a reorder of perks is a change", () => {
    expect(tierPatch(tier, { ...tierFormFrom(tier), name: "Fan club" })).toEqual({ name: "Fan club" })
    expect(tierPatch(tier, { ...tierFormFrom(tier), perks: "Early access\nMembers-only videos" })).toEqual({ perks: ["Early access", "Members-only videos"] })
    expect(tierPatch(tier, { name: "A", price: "30", perks: "" })).toEqual({ name: "A", price_paise: 3000, perks: [] })
  })

  test("turning a level off is a one-field PATCH", () => {
    expect(activePatch(false)).toEqual({ is_active: false })
  })

  test("an empty form starts blank", () => {
    expect(emptyTierForm()).toEqual({ name: "", price: "", perks: "" })
  })
})

/* ── eligibility ────────────────────────────────────────────────── */

describe("eligibility", () => {
  test("missing items in the server's order, each with plain words", () => {
    const e = toEligibility(fixture("eligibility_200_missing"))
    expect(e).toEqual({ eligible: false, missing: ["age", "pan", "followers", "strikes"] })
    expect(e.missing.map((m) => MISSING_COPY[m].title)).toEqual(["Be 18 or older", "Add your PAN", "Reach 500 followers", "No active strikes"])
  })

  test("eligible only with nothing missing; unknown items are ignored", () => {
    expect(toEligibility(fixture("eligibility_200_ok"))).toEqual({ eligible: true, missing: [] })
    expect(toEligibility({ data: { eligible: true, missing: ["pan"] } }).eligible).toBe(false)
    expect(toEligibility({ data: { eligible: false, missing: ["dob", "strikes"] } }).missing).toEqual(["strikes"])
  })

  test("the first-level refusal carries the missing items", () => {
    const e = toMembershipError(httpError(403, "tier_create_403_not_eligible"))
    expect(e).toEqual({ status: 403, code: "MEMBERSHIPS_NOT_ELIGIBLE", missing: ["pan", "followers"] })
  })
})

/* ── checkout ───────────────────────────────────────────────────── */

describe("checkout: decoding and the dialog's options", () => {
  test("201 checkout with a Razorpay session", () => {
    const c = toCheckout(fixture("subscribe_201"))
    expect(c).toEqual({
      subscriptionId: "5ab0c0de-0000-4000-8000-000000000010",
      paymentId: "9a7e0000-0000-4000-8000-000000000020",
      kind: "join",
      status: "pending_payment",
      amountPaise: 4900,
      currency: "INR",
      session: { provider: "razorpay", orderId: "order_Nx1", keyId: "rzp_test_abc", merchantName: "Momentum" },
    })
    expect(razorpayOpen(c, "Supporter")).toEqual({ key: "rzp_test_abc", order_id: "order_Nx1", amount: 4900, currency: "INR", name: "Momentum", description: "Supporter" })
  })

  test("no session (dev), or a blank key or order: no dialog", () => {
    const none = toCheckout(fixture("subscribe_201_no_session"))
    expect(none.session).toBeNull()
    expect(razorpayOpen(none)).toBeNull()
    const c = toCheckout(fixture("subscribe_201"))
    expect(razorpayOpen({ ...c, session: { ...c.session!, keyId: "" } })).toBeNull()
    expect(razorpayOpen({ ...c, session: { ...c.session!, orderId: "" } })).toBeNull()
    expect(razorpayOpen({ ...c, session: { ...c.session!, provider: "stub" } })).toBeNull()
    expect(razorpayOpen({ ...c, session: { ...c.session!, merchantName: "" } })?.name).toBe("Momentum")
  })

  test("a replayed join that is already paid: nothing to collect", () => {
    expect(checkoutAlreadyPaid(toCheckout(fixture("subscribe_201_replay_paid")))).toBe(true)
    expect(checkoutAlreadyPaid(toCheckout(fixture("subscribe_201_no_session")))).toBe(false)
  })

  test("a level change: checkout (up), scheduled (down), applied at once (no difference)", () => {
    const up = toTierChange(fixture("upgrade_201"))
    expect(up.kind).toBe("checkout")
    if (up.kind === "checkout") expect([up.checkout.kind, up.checkout.amountPaise]).toEqual(["upgrade", 7500])
    expect(toTierChange(fixture("upgrade_200_scheduled"))).toEqual({ kind: "scheduled", effectiveAt: "2026-11-23T09:00:00Z" })
    expect(toTierChange(fixture("upgrade_200_upgraded"))).toEqual({ kind: "upgraded" })
  })

  test("the payment read: only paid and failed are verdicts; a late capture is failed and refunding", () => {
    expect(toPaymentReading(fixture("payment_200_confirming"))).toEqual({ state: "confirming", refundStatus: "" })
    expect(toPaymentReading(fixture("payment_200_paid"))).toEqual({ state: "paid", refundStatus: "" })
    expect(toPaymentReading(fixture("payment_200_failed_late"))).toEqual({ state: "failed", refundStatus: "pending" })
    expect(toPaymentReading({ data: { status: "created" } }).state).toBe("confirming")
    expect(toPaymentReading({ data: { status: "paid", refund_status: "failed" } })).toEqual({ state: "paid", refundStatus: "" })
  })
})

describe("checkout: request builders", () => {
  test("join: POST /subscribe/:creatorId {tier_id} with the Idempotency-Key header", () => {
    expect(subscribeRequest("c 1", T1, "key-1")).toEqual({ url: "/v1/monetization/subscribe/c%201", body: { tier_id: T1 }, headers: { "Idempotency-Key": "key-1" } })
  })

  test("renew, change level (tier_id, the contract's field), cancel at period end (never immediate)", () => {
    expect(renewRequest("s1", "k").url).toBe("/v1/monetization/subscriptions/s1/renew")
    expect(upgradeRequest("s1", T2, "k")).toEqual({ url: "/v1/monetization/subscriptions/s1/upgrade", body: { tier_id: T2 }, headers: { "Idempotency-Key": "k" } })
    expect(cancelRequest("s1")).toEqual({ url: "/v1/monetization/subscriptions/s1/cancel", body: {} })
  })

  test("the payment poll and the advisory verify", () => {
    expect(paymentUrl("p1")).toBe("/v1/monetization/memberships/payments/p1")
    expect(verifyRequest("p1", { razorpay_order_id: "o", razorpay_payment_id: "p", razorpay_signature: "s" })).toEqual({
      url: "/v1/monetization/memberships/payments/p1/verify",
      body: { razorpay_order_id: "o", razorpay_payment_id: "p", razorpay_signature: "s" },
    })
  })

  test("the gate: a level sets it, null (or empty) clears it", () => {
    expect(gateRequest("p1", T1)).toEqual({ url: "/v1/posts/p1/membership", body: { tier_required_id: T1 } })
    expect(gateRequest("p1", null)).toEqual({ url: "/v1/posts/p1/membership", body: { tier_required_id: null } })
    expect(gateRequest("p1", "")).toEqual({ url: "/v1/posts/p1/membership", body: { tier_required_id: null } })
  })

  test("entitlement params", () => {
    expect(entitlementParams("c1", T1)).toEqual({ creator_id: "c1", tier_id: T1 })
    expect(entitlementParams("c1", null)).toEqual({ creator_id: "c1" })
  })
})

describe("checkout: one Idempotency-Key per decision to pay", () => {
  test("a retry of the same intent reuses the key; another level gets a new one; a verdict resets", () => {
    let n = 0
    const keys = createJoinKeys(() => `k${++n}`)
    const first = keys.keyFor("join:c:t1")
    expect(keys.keyFor("join:c:t1")).toBe(first)
    expect(keys.keyFor("join:c:t1")).toBe(first)
    expect(keys.keyFor("join:c:t2")).toBe("k2")
    keys.reset()
    expect(keys.keyFor("join:c:t2")).toBe("k3")
  })

  test("a start with no answer or a 5xx keeps the key; a refusal, the switch off or an expired checkout does not", () => {
    expect(keepKeyAfter(NETWORK_ERROR)).toBe(true)
    expect(keepKeyAfter(httpError(502))).toBe(true)
    expect(keepKeyAfter(httpError(500))).toBe(true)
    expect(keepKeyAfter(httpError(503, "subscribe_503_not_enabled"))).toBe(false)
    expect(keepKeyAfter(httpError(409, "subscribe_409_already"))).toBe(false)
    expect(keepKeyAfter({ response: { status: 409, data: { error: { code: "CHECKOUT_EXPIRED" } } } })).toBe(false)
    expect(keepKeyAfter(httpError(400))).toBe(false)
  })
})

describe("checkout: the state machine", () => {
  const run = (events: CheckoutEvent[], from: CheckoutPhase = idle) => events.reduce(checkoutReducer, from)
  const checkout = toCheckout(fixture("subscribe_201"))
  const poll = (p: Partial<PollState>): CheckoutEvent => ({ type: "poll", poll: { ...initialPollState, ...p } })

  test("join → dialog → confirming → paid", () => {
    expect(run([{ type: "start" }])).toEqual({ phase: "starting" })
    expect(run([{ type: "start" }, { type: "started", checkout, canOpen: true }])).toEqual({ phase: "dialog" })
    const s = run([{ type: "start" }, { type: "started", checkout, canOpen: true }, { type: "dialog_completed" }, poll({ phase: "confirming", reads: 1 })])
    expect(s).toEqual({ phase: "confirming" })
    expect(checkoutReducer(s, poll({ phase: "paid" }))).toEqual({ phase: "paid", refunding: false })
    expect(checkoutReducer(s, poll({ phase: "paid", refundStatus: "pending" }))).toEqual({ phase: "paid", refunding: true })
  })

  test("failed, timed out (check again), stopped by a permanent 4xx", () => {
    const confirming: CheckoutPhase = { phase: "confirming" }
    expect(checkoutReducer(confirming, poll({ phase: "failed" }))).toEqual({ phase: "failed", message: PAYMENT_FAILED })
    const late = checkoutReducer(confirming, poll({ phase: "timed_out" }))
    expect(late).toEqual({ phase: "still_confirming" })
    expect(checkoutReducer(late, { type: "check_again" })).toEqual({ phase: "confirming" })
    expect(checkoutReducer(confirming, poll({ phase: "stopped", stoppedByStatus: 404 })).phase).toBe("failed")
  })

  test("the dialog closed without paying: dismissed, and the key survives for Pay now", () => {
    const s = run([{ type: "start" }, { type: "started", checkout, canOpen: true }, { type: "dialog_dismissed" }])
    expect(s).toEqual({ phase: "dismissed" })
    expect(resetsKey({ type: "dialog_dismissed" })).toBe(false)
  })

  test("refusals become their own states: switched off, already a member, anything else in words", () => {
    expect(run([{ type: "start" }, { type: "start_failed", error: httpError(503, "subscribe_503_not_enabled") }])).toEqual({ phase: "unavailable" })
    expect(run([{ type: "start" }, { type: "start_failed", error: httpError(409, "subscribe_409_already") }])).toEqual({ phase: "already" })
    expect(run([{ type: "start" }, { type: "start_failed", error: NETWORK_ERROR }])).toEqual({ phase: "error", message: NETWORK_COPY })
  })

  test("no usable session: failed in words, unless the replay says it is already paid", () => {
    expect(checkoutReducer({ phase: "starting" }, { type: "started", checkout: toCheckout(fixture("subscribe_201_no_session")), canOpen: false })).toEqual({ phase: "failed", message: NO_ONLINE_PAYMENT })
    expect(checkoutReducer({ phase: "starting" }, { type: "started", checkout: toCheckout(fixture("subscribe_201_replay_paid")), canOpen: false })).toEqual({ phase: "paid", refunding: false })
  })

  test("a downgrade is scheduled; a free upgrade is done", () => {
    expect(checkoutReducer({ phase: "starting" }, { type: "scheduled", effectiveAt: "2026-11-23T09:00:00Z" })).toEqual({ phase: "scheduled", effectiveAt: "2026-11-23T09:00:00Z" })
    expect(checkoutReducer({ phase: "starting" }, { type: "upgraded" })).toEqual({ phase: "paid", refunding: false })
  })

  test("which events end the decision to pay (and so the key)", () => {
    expect(resetsKey({ type: "start_failed", error: NETWORK_ERROR })).toBe(false)
    expect(resetsKey({ type: "start_failed", error: httpError(409, "subscribe_409_already") })).toBe(true)
    expect(resetsKey(poll({ phase: "paid" }))).toBe(true)
    expect(resetsKey(poll({ phase: "failed" }))).toBe(true)
    expect(resetsKey(poll({ phase: "timed_out" }))).toBe(false)
    expect(resetsKey(poll({ phase: "confirming" }))).toBe(false)
    expect(resetsKey({ type: "started", checkout, canOpen: true })).toBe(false)
    expect(resetsKey({ type: "started", checkout, canOpen: false })).toBe(true)
    expect(resetsKey({ type: "reset" })).toBe(false)
  })

  test("busy while starting, in the dialog and confirming", () => {
    expect([idle, { phase: "starting" }, { phase: "dialog" }, { phase: "confirming" }, { phase: "dismissed" }].map((s) => checkoutBusy(s as CheckoutPhase))).toEqual([false, true, true, true, false])
  })

  test("the shop's poll, fed by the membership payment read, reaches each verdict", () => {
    const step = nextStep(initialPollState, true)!
    expect(step.delayMs).toBe(1000)
    const read = (name: string) => applyReading(afterWait(initialPollState, step.delayMs), toPaymentReading(fixture(name)))
    expect(read("payment_200_confirming").phase).toBe("confirming")
    expect(read("payment_200_paid").phase).toBe("paid")
    expect(read("payment_200_failed_late")).toMatchObject({ phase: "failed", refundStatus: "pending" })
    // 404 (not the payer's) stops; a 503 is "not known yet".
    expect(applyReadError(initialPollState, 404).phase).toBe("stopped")
    expect(applyReadError(initialPollState, 503).phase).toBe("confirming")
    expect(nextStep({ ...initialPollState, elapsedMs: POLL_TIMEOUT_MS }, true)).toBeNull()
  })
})

/* ── my memberships ─────────────────────────────────────────────── */

describe("my memberships", () => {
  const list = toMyMemberships(fixture("memberships_200"))

  test("rows: creator id, level at its locked price, status; Go's zero time reads as none", () => {
    expect(list.map((m) => [m.creatorId.slice(-1), m.tier.name, m.tier.pricePaise, m.status, m.currentPeriodEnd, m.accessUntil, m.renewAvailable])).toEqual([
      ["1", "Supporter", 4900, "active", "2026-11-23T09:00:00Z", "2026-11-23T09:00:00Z", true],
      ["2", "Gold", 29900, "expired", "2026-10-10T09:00:00Z", "", true],
      ["3", "Fan", 2900, "pending_payment", "", "", false],
    ])
  })

  test("access, cancel and change level follow the server's status rules", () => {
    expect(list.map(hasAccess)).toEqual([true, false, false])
    expect(list.map(canCancel)).toEqual([true, false, false])
    expect(list.map(canChangeLevel)).toEqual([true, false, false])
    expect(canCancel({ status: "grace" })).toBe(true)
    expect(canCancel({ status: "cancelled_at_period_end" })).toBe(false)
  })

  test("one line each: renewal is by reminder, cancelled keeps access, ended", () => {
    expect(statusLine(list[0])).toBe("Active. Renew by 23 Nov 2026 to keep access.")
    expect(statusLine({ ...list[0], status: "cancelled_at_period_end" })).toBe("Cancelled. You keep access until 23 Nov 2026.")
    expect(statusLine(list[1], new Date("2026-10-23T00:00:00Z"))).toBe("Ended 10 Oct 2026.")
    expect(statusLine(list[2])).toBe("Waiting for payment.")
  })
})

/* ── access and the lock ────────────────────────────────────────── */

describe("entitlement", () => {
  test("allowed / denied / unknown", () => {
    expect(toAccess(fixture("entitlement_200_allowed"))).toBe("allowed")
    expect(toAccess(fixture("entitlement_200_denied"))).toBe("denied")
    expect(toAccess({ data: {} })).toBe("unknown")
  })
})

describe("the lock decision", () => {
  const base: LockInput = { tierRequiredId: T1, bodyRedacted: false, isOwner: false, access: "unknown", trustServedBody: false }
  const locked = (over: Partial<LockInput>) => membersLocked({ ...base, ...over })

  test("an ungated post is never locked", () => {
    expect(locked({ tierRequiredId: null })).toBe(false)
    expect(locked({ tierRequiredId: undefined, access: "denied" })).toBe(false)
  })

  test("the author always sees their own", () => {
    expect(locked({ isOwner: true })).toBe(false)
    expect(locked({ isOwner: true, bodyRedacted: true })).toBe(false)
  })

  test("a redacted row is locked whatever the entitlement says (the body is not there)", () => {
    expect(locked({ bodyRedacted: true, access: "allowed", trustServedBody: true })).toBe(true)
    expect(locked({ tierRequiredId: null, bodyRedacted: true })).toBe(true)
  })

  test("watch page (does not trust a served body): locked until access is known to be allowed — fail closed", () => {
    expect(locked({ access: "unknown" })).toBe(true)
    expect(locked({ access: "denied" })).toBe(true)
    expect(locked({ access: "allowed" })).toBe(false)
  })

  test("a card (post-service redacts for non-members, fail closed) trusts a served body, unless the entitlement says no", () => {
    expect(locked({ trustServedBody: true, access: "unknown" })).toBe(false)
    expect(locked({ trustServedBody: true, access: "denied" })).toBe(true)
  })
})

describe("members-only rows (the Members tab)", () => {
  const body = fixture("by_author_200_mixed") as { data: unknown[] }
  const rows = gatedRows(body.data)

  test("only rows with tier_required_id; redacted rows keep title, cover and length", () => {
    expect(rows.map((r) => [r.id.slice(-1), r.contentType, r.bodyRedacted, r.title, r.durationMs])).toEqual([
      ["2", "long_video", true, "Behind the scenes", 754000],
      ["3", "flick", true, "", 42000],
      ["4", "post", false, "For members: the full plan", 0],
    ])
    expect(rows[0].coverMediaId).toBe("cccc0000-0000-4000-8000-000000000002")
    // A served post with no cover: its first image.
    expect(rows[2].coverMediaId).toBe("dddd0000-0000-4000-8000-000000000004")
  })

  test("each opens where it plays", () => {
    expect(rows.map(gatedHref)).toEqual(["/posttube/watch/a0000000-0000-4000-8000-000000000002", "/reels/a0000000-0000-4000-8000-000000000003", "/post/a0000000-0000-4000-8000-000000000004"])
  })

  test("the tile lock: the server's redaction decides, the owner never sees a lock", () => {
    const lockOf = (isOwner: boolean) => rows.map((r) => membersLocked({ tierRequiredId: r.tierRequiredId, bodyRedacted: r.bodyRedacted, isOwner, access: "unknown", trustServedBody: true }))
    expect(lockOf(false)).toEqual([true, true, false])
    expect(lockOf(true)).toEqual([false, false, false])
  })
})

/* ── errors in words ────────────────────────────────────────────── */

describe("refusals as sentences", () => {
  test("the codes the screens meet", () => {
    expect(membershipErrorMessage(httpError(409, "tier_create_409_limit"))).toBe("You can have up to 3 active levels. Turn one off before adding another.")
    expect(membershipErrorMessage(httpError(409, "subscribe_409_already"))).toBe("You're already a member of this creator.")
    expect(membershipErrorMessage(httpError(503, "subscribe_503_not_enabled"))).toBe("Memberships aren't available yet.")
    expect(membershipErrorMessage(httpError(403, "tier_create_403_not_eligible"))).toBe("You can't offer memberships yet.")
    expect(membershipErrorMessage(NETWORK_ERROR)).toBe(NETWORK_COPY)
    // Never the server's own message.
    expect(membershipErrorMessage({ response: { status: 500, data: { error: { code: "INTERNAL_ERROR", message: "pq: deadlock" } } } })).toBe("Something went wrong. Try again.")
    expect(membershipErrorMessage({ response: { status: 503, data: {} } })).toBe("Memberships aren't available yet.")
  })

  test("the switch being off, and a members-only comment thread", () => {
    expect(isMembershipsOff(httpError(503, "subscribe_503_not_enabled"))).toBe(true)
    expect(isMembershipsOff({ response: { status: 503, data: { error: { code: "MONETIZATION_NOT_LAUNCHED" } } } })).toBe(true)
    expect(isMembershipsOff(httpError(409, "subscribe_409_already"))).toBe(false)
    expect(isMembersOnlyError(httpError(403, "comments_403_members_only"))).toBe(true)
    expect(isMembersOnlyError(httpError(404))).toBe(false)
    expect(isMembersOnlyError({ response: { status: 403, data: { error: { code: "FORBIDDEN" } } } })).toBe(false)
  })
})
