import { describe, expect, it } from "bun:test"

import { parseFrame } from "../hooks/live"
import { formBody, parsePin, resolveChosen, validateForm, EMPTY_FORM } from "../model/address"
import { canDecideExtra, customerPhotos, extrasTotals, newerFix, otpToShow, timeline } from "../model/booking"
import { ATTEMPT_STORAGE_KEY, attemptFor, attemptSignature, bookWithSavedKey, readAttempt, type AttemptStore } from "../model/bookingAttempt"
import { LENIENT, STRICT } from "../model/decode"
import { addPaise, formatPaise, formatRateBps, percentOff, timesPaise } from "../model/money"
import { nextPaymentPollDelay, paymentRoute, readPayment, runStubLeg } from "../model/payment"
import { isNotOpen, refusalLine } from "../model/refusals"
import {
  effectiveFemalePref,
  femaleToggleVisible,
  genderRuleNote,
  initialSelection,
  previewDurationMinutes,
  previewTotalPaise,
  quoteBody,
  selectionProblems,
  setQuantity,
  toggleAddon,
} from "../model/selection"
import { dateStrip, firstOpenDate, formatCountdown, holdExpired, holdRemainingMs, openSlots, slotStillOpen } from "../model/slots"
import { decodeAddressList, decodeBooking, decodeBookingPayments, decodeExtra, decodePaymentIntent, decodeServicePage, decodeSlotDays, type Booking, type BookingStatus, type GenderRule } from "../model/wire"
import { fixtureData, fixtureError } from "./fixtures"
import * as S from "./samples"

class MemoryStore implements AttemptStore {
  map = new Map<string, string>()
  getItem(k: string) {
    return this.map.has(k) ? (this.map.get(k) as string) : null
  }
  setItem(k: string, v: string) {
    this.map.set(k, v)
  }
  removeItem(k: string) {
    this.map.delete(k)
  }
}

const service = () => decodeServicePage(fixtureData("service_get_200"), STRICT).service
/** booking_get_200 (confirmed, paid) with some keys changed. */
const booking = (over: Record<string, unknown> = {}): Booking => decodeBooking({ ...(fixtureData("booking_get_200") as object), ...over }, STRICT)
/** The golden payment intent (razorpay session), raw. */
const intentRaw = () => fixtureData("booking_payment_intent_post_200") as Record<string, unknown>
const step = (from: string | null, to: string) => ({ from_status: from, to_status: to, created_at: "2026-10-04T06:30:00Z" })

/* ── money ────────────────────────────────────────────────────────── */

describe("money is integer paise", () => {
  it("adds and multiplies integers only", () => {
    expect(addPaise(129900, 19900, 29900)).toBe(179700)
    expect(addPaise()).toBe(0)
    expect(timesPaise(44900, 3)).toBe(134700)
    expect(() => addPaise(100, 0.5)).toThrow()
    expect(() => timesPaise(100.5, 2)).toThrow()
    expect(() => addPaise(Number.MAX_SAFE_INTEGER, 1)).toThrow()
  })

  it("formats with Indian grouping, paise only when there are any", () => {
    expect(formatPaise(224800)).toBe("₹2,248")
    expect(formatPaise(22480050)).toBe("₹2,24,800.50")
    expect(formatPaise(9900)).toBe("₹99")
    expect(formatPaise(5)).toBe("₹0.05")
    expect(formatPaise(-7500)).toBe("−₹75")
    expect(formatPaise(1.5)).toBe("₹—")
  })

  it("rates and discounts", () => {
    expect(formatRateBps(1800)).toBe("18%")
    expect(formatRateBps(500)).toBe("5%")
    expect(formatRateBps(250)).toBe("2.5%")
    expect(percentOff(129900, 149900)).toBe(13)
    expect(percentOff(69900, null)).toBeNull()
    expect(percentOff(99900, 99900)).toBeNull()
  })
})

/* ── the service sheet ────────────────────────────────────────────── */

describe("the service sheet", () => {
  it("starts on the default option and needs the required pick-one group", () => {
    const s = service()
    const sel = initialSelection(s)
    expect(sel.optionId).toBe("3418c19d-9e25-5e7d-89a9-57d66209a97f")
    expect(selectionProblems(s, sel).map((p) => p.groupId)).toEqual(["1bf67262-b425-5be4-a26f-388795d86a43"])
    expect(quoteBody(s, sel, { lat: 17.44, lng: 78.35 })).toBeNull()
  })

  it("a pick-one group swaps; a full group refuses a new pick", () => {
    const s = service()
    const [mask, extras] = s.addonGroups
    let sel = initialSelection(s)
    sel = toggleAddon(mask, sel, mask.addons[0].id)
    sel = toggleAddon(mask, sel, mask.addons[1].id)
    expect(sel.addons[mask.id]).toEqual([mask.addons[1].id])
    sel = toggleAddon(extras, sel, extras.addons[0].id)
    sel = toggleAddon(extras, sel, extras.addons[1].id)
    expect(sel.addons[extras.id]).toHaveLength(2)
    expect(selectionProblems(s, sel)).toEqual([])
  })

  it("the preview matches the server's salon quote for the same picks", () => {
    const s = service()
    const [mask, extras] = s.addonGroups
    let sel = initialSelection(s)
    sel = toggleAddon(mask, sel, "2d492586-bb1a-5131-94ff-5a08fdc929ea") // charcoal
    sel = toggleAddon(extras, sel, "da1d8a3b-2a87-535c-8619-3003cd0f65df") // head massage
    const quote = fixtureData("quote_post_201_salon") as { total_paise: number; duration_minutes: number }
    expect(previewTotalPaise(s, sel)).toBe(quote.total_paise)
    expect(previewDurationMinutes(s, sel)).toBe(quote.duration_minutes)
    expect(quoteBody(s, sel, { lat: 17.44, lng: 78.35 })).toEqual({
      service_id: s.id,
      option_id: "3418c19d-9e25-5e7d-89a9-57d66209a97f",
      quantity: 1,
      addons: [{ addon_id: "2d492586-bb1a-5131-94ff-5a08fdc929ea" }, { addon_id: "da1d8a3b-2a87-535c-8619-3003cd0f65df" }],
      lat: 17.44,
      lng: 78.35,
    })
  })

  it("quantity stays within 1..max_quantity", () => {
    const s = service()
    const sel = initialSelection(s)
    expect(setQuantity(s, sel, 5).quantity).toBe(1)
    expect(setQuantity(s, sel, 0).quantity).toBe(1)
  })
})

/* ── gender ───────────────────────────────────────────────────────── */

describe("the woman-professional toggle", () => {
  const rules: GenderRule[] = ["any", "female_pros_only", "male_pros_only"]
  it("is visible only where the category allows anyone", () => {
    expect(rules.map(femaleToggleVisible)).toEqual([true, false, false])
  })
  it("is sent only where it is offered", () => {
    expect(rules.map((r) => effectiveFemalePref(r, true))).toEqual([true, false, false])
    expect(effectiveFemalePref("any", false)).toBe(false)
  })
  it("single-gender categories say so instead", () => {
    expect(genderRuleNote("female_pros_only")).toMatch(/women/)
    expect(genderRuleNote("male_pros_only")).toMatch(/men/)
    expect(genderRuleNote("any")).toBeNull()
  })
})

/* ── idempotency ──────────────────────────────────────────────────── */

describe("the booking Idempotency-Key is saved before the call", () => {
  const sig = attemptSignature({ quoteId: "q1", addressId: "a1", slotStart: "2026-10-04T09:30:00Z", requireFemalePro: false })
  const created = { booking: { id: "b1" } }

  it("the key is in storage when the request is made", async () => {
    const store = new MemoryStore()
    let seen: string | null = null
    await bookWithSavedKey(store, sig, async (key) => {
      seen = readAttempt(store)?.key ?? null
      expect(seen).toBe(key)
      return created
    }, () => 0, () => "k-1")
    expect(seen).toBe("k-1")
    expect(readAttempt(store)?.bookingId).toBe("b1")
  })

  it("a lost answer keeps the key; the retry sends the SAME key", async () => {
    const store = new MemoryStore()
    const keys: string[] = []
    const lost = await bookWithSavedKey(store, sig, async (key) => {
      keys.push(key)
      throw new Error("network")
    }, () => 0, () => "k-lost")
    expect(lost.kind).toBe("lost")
    await bookWithSavedKey(store, sig, async (key) => {
      keys.push(key)
      return created
    }, () => 0, () => "k-other")
    expect(keys).toEqual(["k-lost", "k-lost"])
  })

  it("a refusal clears the key; the next decision gets a new one", async () => {
    const store = new MemoryStore()
    const out = await bookWithSavedKey(store, sig, async () => {
      throw new Error("409")
    }, () => 409, () => "k-refused")
    expect(out.kind).toBe("refused")
    expect(store.getItem(ATTEMPT_STORAGE_KEY)).toBeNull()
  })

  it("a booking already made is reused, never made again", async () => {
    const store = new MemoryStore()
    await bookWithSavedKey(store, sig, async () => created, () => 0, () => "k")
    let called = false
    const again = await bookWithSavedKey(store, sig, async () => {
      called = true
      return created
    }, () => 0)
    expect(called).toBe(false)
    expect(again.kind).toBe("reused")
  })

  it("another slot is another decision", () => {
    const store = new MemoryStore()
    const a = attemptFor(store, sig, () => "k1")
    const b = attemptFor(store, attemptSignature({ quoteId: "q1", addressId: "a1", slotStart: "2026-10-04T10:30:00Z", requireFemalePro: false }), () => "k2")
    expect([a.key, b.key]).toEqual(["k1", "k2"])
  })
})

/* ── payment ──────────────────────────────────────────────────────── */

describe("paid comes only from the payment status", () => {
  const ref = { referenceType: "doorstep_booking" as const, referenceId: S.BOOKING_ID }
  const pay = (statuses: string[], refunds: { status: string }[] = []) =>
    decodeBookingPayments(
      {
        payments: statuses.map((status, i) => ({ ...intentRaw(), payment_id: `p${i}`, status })),
        refunds: refunds.map((r, i) => ({ id: `r${i}`, payment_id: "p0", cause: "customer_cancel", amount_paise: 100, status: r.status, created_at: "2026-10-04T07:00:00Z" })),
      },
      STRICT,
    )

  it("succeeded → paid; created/pending → confirming; failed → failed", () => {
    expect(readPayment(pay(["succeeded"]), ref)).toBe("paid")
    expect(readPayment(pay(["created"]), ref)).toBe("confirming")
    expect(readPayment(pay(["pending"]), ref)).toBe("confirming")
    expect(readPayment(pay(["failed"]), ref)).toBe("failed")
    expect(readPayment(pay(["failed", "succeeded"]), ref)).toBe("paid")
  })

  it("no row for this reference is never paid", () => {
    expect(readPayment(pay([]), ref)).toBe("confirming")
    expect(readPayment(pay(["succeeded"]), { referenceType: "doorstep_extras", referenceId: S.BOOKING_ID })).toBe("confirming")
    expect(readPayment(pay(["succeeded"]), { ...ref, referenceId: "another-booking" })).toBe("confirming")
  })

  it("a refund outranks paid", () => {
    expect(readPayment(pay(["succeeded"], [{ status: "pending" }]), ref)).toBe("refund_pending")
    expect(readPayment(pay(["succeeded"], [{ status: "succeeded" }]), ref)).toBe("refunded")
    expect(readPayment(pay(["refunded"]), ref)).toBe("refunded")
  })

  it("an intent's own status never reaches the reading (only GET /payment does)", () => {
    const intent = decodePaymentIntent({ ...intentRaw(), status: "succeeded" }, STRICT)
    expect(readPayment({ payments: [], refunds: [] }, { referenceType: intent.referenceType, referenceId: intent.referenceId })).toBe("confirming")
  })

  it("the poll backs off, then stops at 180 s", () => {
    expect(nextPaymentPollDelay(0)).toBe(2000)
    expect(nextPaymentPollDelay(31_000)).toBe(5000)
    expect(nextPaymentPollDelay(180_000)).toBeNull()
  })

  it("Razorpay opens only from a complete server session; the stub only when allowed", () => {
    const rzp = decodePaymentIntent(intentRaw(), STRICT)
    const r = paymentRoute(rzp, { description: "x", stubAllowed: false })
    expect(r.kind).toBe("razorpay")
    if (r.kind === "razorpay") expect([r.options.key, r.options.order_id, r.options.amount, r.options.name]).toEqual(["rzp_test_fixture", "order_FixtureDoorstep01", 224800, "Doorstep"])
    const noKey = decodePaymentIntent({ ...intentRaw(), checkout: { provider: "razorpay", order_id: "o", key_id: "" } }, STRICT)
    expect(paymentRoute(noKey, { description: "x", stubAllowed: true }).kind).toBe("unavailable")
    const stub = decodePaymentIntent({ ...intentRaw(), checkout: { provider: "stub", order_id: "order_stub_1", key_id: "" } }, STRICT)
    expect(paymentRoute(stub, { description: "x", stubAllowed: true }).kind).toBe("stub")
    expect(paymentRoute(stub, { description: "x", stubAllowed: false }).kind).toBe("unavailable")
    const none = decodePaymentIntent({ ...intentRaw(), checkout: {} }, STRICT)
    expect(paymentRoute(none, { description: "x", stubAllowed: true }).kind).toBe("unavailable")
    // A stub-looking order id is not a stub session: only provider "stub" is.
    const guessed = decodePaymentIntent({ ...intentRaw(), checkout: { provider: "", order_id: "order_stub_1", key_id: "" } }, LENIENT)
    expect(paymentRoute(guessed, { description: "x", stubAllowed: true }).kind).toBe("unavailable")
    // The real razorpay session never takes the stub path, even with the stub allowed.
    expect(paymentRoute(rzp, { description: "x", stubAllowed: true }).kind).toBe("razorpay")
  })

  it("the paid source fixtures read pending → confirming, succeeded → paid, refund → refund_pending", () => {
    const read = (name: string) => readPayment(decodeBookingPayments(fixtureData(name), STRICT), ref)
    expect(read("booking_payment_get_200_pending")).toBe("confirming")
    expect(read("booking_payment_get_200")).toBe("paid")
    expect(read("booking_payment_get_200_refund")).toBe("refund_pending")
  })
})

/* ── the dev stub can never mark paid ─────────────────────────────── */

describe("the dev stub leg", () => {
  const bookingRef = { referenceType: "doorstep_booking" as const, referenceId: S.BOOKING_ID, bookingId: S.BOOKING_ID }
  const toRefusal = (e: unknown) => e as { status: number; code: string; message: string }

  it("asks stub-confirm for the booking, then only ever hands back to the poll (even when the answer says succeeded)", async () => {
    const asked: string[] = []
    const succeeded = fixtureData("booking_payment_get_200")
    const leg = await runStubLeg(bookingRef, async (id) => {
      asked.push(id)
      return succeeded
    }, toRefusal)
    expect(asked).toEqual([S.BOOKING_ID])
    expect(leg).toEqual({ next: "poll", asked: true, refusal: null })
  })

  it("a refusal (not a dev stack, or a real provider) is shown, and still the poll decides", async () => {
    const refused = { ...fixtureError("booking_payment_stub_confirm_404"), status: 404 }
    const leg = await runStubLeg(bookingRef, async () => {
      throw refused
    }, (e) => {
      const r = e as typeof refused
      return { status: r.status, code: r.code, message: r.message }
    })
    expect(leg.next).toBe("poll")
    expect(leg.refusal?.code).toBe("DOORSTEP_NOT_FOUND")
  })

  it("an extras bill has no stub-confirm route: nothing is sent", async () => {
    let called = false
    const leg = await runStubLeg({ referenceType: "doorstep_extras", referenceId: S.BILL_ID, bookingId: S.BOOKING_ID }, async () => {
      called = true
    }, toRefusal)
    expect(called).toBe(false)
    expect(leg).toEqual({ next: "poll", asked: false, refusal: null })
  })

  it("the hook settles only from the poll's GET /payment reading (one settle call site)", async () => {
    const src = await Bun.file(new URL("../hooks/payment.ts", import.meta.url)).text()
    const calls = src.match(/\bsettle\(/g) ?? []
    expect(calls).toHaveLength(1)
    expect(src).toMatch(/const reading = readPayment\(await getBookingPayments\(t\.bookingId\), t\)[\s\S]*settle\(reading as /)
    // Nothing but the poll reads a payment verdict, and no phase is set to settled by hand.
    expect(src.match(/readPayment\(/g) ?? []).toHaveLength(1)
    expect(src).not.toMatch(/kind: "settled"[^}]*reading: "paid"/)
    expect(src.match(/kind: "settled"/g) ?? []).toHaveLength(2) // the type, and settle() itself
  })
})

/* ── OTPs ─────────────────────────────────────────────────────────── */

describe("OTP visibility", () => {
  const all: BookingStatus[] = ["pending_payment", "confirmed", "assigned", "en_route", "arrived", "in_progress", "awaiting_extras_payment", "completed", "cancelled", "expired", "customer_no_show", "pro_no_show"]

  it("the start code shows only from acceptance until the job starts", () => {
    const shown = all.filter((status) => otpToShow(booking({ status, start_otp: "4821" }))?.kind === "start")
    expect(shown).toEqual(["assigned", "en_route", "arrived"])
  })

  it("the end code shows only while the job is in progress", () => {
    const shown = all.filter((status) => otpToShow(booking({ status, start_otp: "4821", end_otp: "7310" }))?.kind === "end")
    expect(shown).toEqual(["in_progress"])
  })

  it("a code the server sent outside its window, or a blank one, is not shown", () => {
    expect(otpToShow(booking({ status: "completed", start_otp: "4821", end_otp: "7310" }))).toBeNull()
    expect(otpToShow(booking({ status: "confirmed", start_otp: "4821" }))).toBeNull()
    expect(otpToShow(booking({ status: "assigned", start_otp: "  " }))).toBeNull()
    expect(otpToShow(booking({ status: "in_progress", start_otp: "4821" }))).toBeNull()
  })
})

/* ── extras ───────────────────────────────────────────────────────── */

describe("extras", () => {
  const ex = (status: string, total: number) => decodeExtra({ ...S.extra, status, unit_price_paise: total, total_paise: total }, STRICT)

  it("approved and billed are owed; proposed waits; declined and withdrawn are nothing", () => {
    const t = extrasTotals([ex("approved", 34900), ex("billed", 10000), ex("proposed", 5000), ex("declined", 99900), ex("withdrawn", 12300)])
    expect(t).toEqual({ approvedPaise: 44900, pendingPaise: 5000, pendingCount: 1 })
    expect(extrasTotals([])).toEqual({ approvedPaise: 0, pendingPaise: 0, pendingCount: 0 })
  })

  it("only a proposed extra on a running job can be decided", () => {
    expect(canDecideExtra("in_progress", { status: "proposed" })).toBe(true)
    expect(canDecideExtra("arrived", { status: "proposed" })).toBe(true)
    expect(canDecideExtra("completed", { status: "proposed" })).toBe(false)
    expect(canDecideExtra("in_progress", { status: "approved" })).toBe(false)
  })
})

/* ── slots and the hold ───────────────────────────────────────────── */

describe("slots and the hold", () => {
  // slots_get_200: Sunday 4 Oct has no hours; Monday on, the 03:30-10:00 UTC starts are open.
  const days = decodeSlotDays(fixtureData("slots_get_200"), STRICT)

  it("taken slots are never drawn", () => {
    expect(openSlots(days.days[0])).toEqual([])
    expect(openSlots(days.days[1]).map((s) => s.start).slice(0, 2)).toEqual(["2026-10-05T03:30:00Z", "2026-10-05T04:00:00Z"])
    expect(openSlots(days.days[1])).toHaveLength(14)
    expect(dateStrip(days)).toEqual(["04", "05", "06", "07", "08", "09", "10"].map((d) => ({ date: `2026-10-${d}`, open: d === "04" ? 0 : 14 })))
    expect(firstOpenDate(days)).toBe("2026-10-05")
  })

  it("a picked slot that became taken is no longer open", () => {
    expect(slotStillOpen(days, "2026-10-05T08:30:00Z")).toBe(true)
    expect(slotStillOpen(days, "2026-10-05T10:30:00Z")).toBe(false)
    expect(slotStillOpen(days, "2026-10-04T08:30:00Z")).toBe(false)
    expect(slotStillOpen(days, null)).toBe(false)
  })

  it("the hold counts down from the server's timestamp and lapses at zero", () => {
    const end = "2026-10-04T06:40:00Z"
    const at = (iso: string) => Date.parse(iso)
    expect(holdRemainingMs(end, at("2026-10-04T06:30:00Z"))).toBe(600_000)
    expect(formatCountdown(holdRemainingMs(end, at("2026-10-04T06:30:01Z")))).toBe("9:59")
    expect(holdExpired(end, at("2026-10-04T06:39:59Z"))).toBe(false)
    expect(holdExpired(end, at("2026-10-04T06:40:00Z"))).toBe(true)
    expect(holdExpired(end, at("2026-10-04T07:00:00Z"))).toBe(true)
  })

  it("a missing or unreadable hold counts as lapsed, never forever", () => {
    expect(holdExpired(null, 0)).toBe(true)
    expect(holdExpired("soon", 0)).toBe(true)
  })
})

/* ── timeline and live ────────────────────────────────────────────── */

describe("timeline and live frames", () => {
  const states = (b: Booking) => timeline(b).map((s) => [s.label, s.state])

  it("draws the server's history, the last step current, then what is ahead", () => {
    expect(states(decodeBooking(fixtureData("booking_get_200"), STRICT))).toEqual([
      ["Booked", "done"],
      ["Payment confirmed", "current"],
      ["Professional assigned", "todo"],
      ["On the way", "todo"],
      ["Arrived", "todo"],
      ["Job started", "todo"],
      ["Completed", "todo"],
    ])
    expect(states(decodeBooking(fixtureData("booking_get_200_pending_payment"), STRICT)).slice(0, 2)).toEqual([
      ["Booked", "current"],
      ["Payment confirmed", "todo"],
    ])
    expect(timeline(decodeBooking(fixtureData("booking_get_200"), STRICT))[0].at).toBe("2026-10-04T06:30:00Z")
  })

  it("ends an off-path booking with its own end, exactly as recorded", () => {
    expect(states(decodeBooking(fixtureData("booking_cancel_post_200"), STRICT))).toEqual([
      ["Booked", "done"],
      ["Payment confirmed", "done"],
      ["Cancelled", "stopped"],
    ])
    const expired = booking({ status: "expired", paid_paise: 0, status_history: [step(null, "pending_payment"), step("pending_payment", "expired")] })
    expect(states(expired)).toEqual([
      ["Booked", "done"],
      ["Expired", "stopped"],
    ])
  })

  it("never draws a step the server did not record, whatever the status implies", () => {
    // en_route with only the first two steps recorded: assigned is NOT drawn as reached.
    const b = booking({ status: "en_route", status_history: [step(null, "pending_payment"), step("pending_payment", "confirmed")] })
    expect(states(b)).toEqual([
      ["Booked", "done"],
      ["Payment confirmed", "done"],
      ["On the way", "current"],
      ["Arrived", "todo"],
      ["Job started", "todo"],
      ["Completed", "todo"],
    ])
    expect(timeline(b)[2].at).toBeNull()
  })

  it("a completed booking is all done; extras due sits before Completed", () => {
    const all = ["pending_payment", "confirmed", "assigned", "en_route", "arrived", "in_progress", "completed"]
    const chain = (to: string[]) => to.map((t, i) => step(i ? to[i - 1] : null, t))
    const done = booking({ status: "completed", status_history: chain(all) })
    expect(timeline(done).every((s) => s.state === "done")).toBe(true)
    const due = booking({ status: "awaiting_extras_payment", status_history: chain([...all.slice(0, 6), "awaiting_extras_payment"]) })
    expect(states(due).slice(-2)).toEqual([
      ["Extras payment due", "current"],
      ["Completed", "todo"],
    ])
  })

  it("customers see before and after photos only", () => {
    const photo = (phase: string, n: number) => ({ id: `p${n}`, booking_id: S.BOOKING_ID, phase, media_id: `m${n}`, created_at: "2026-10-04T09:00:00Z" })
    const b = booking({ photos: [photo("before", 1), photo("kit_seal", 2), photo("after", 3), photo("extra_evidence", 4), photo("before", 5)] })
    const p = customerPhotos(b.photos)
    expect(p.before.map((x) => x.mediaId)).toEqual(["m1", "m5"])
    expect(p.after.map((x) => x.mediaId)).toEqual(["m3"])
  })

  it("a pro_location frame is a fix; anything else is a change", () => {
    expect(parseFrame(JSON.stringify({ event_type: "pro_location", data: { lat: 17.44, lng: 78.35, eta_minutes: 12, at: "2026-10-04T09:10:00Z" }, at: "2026-10-04T09:10:00Z" }))?.fix?.etaMinutes).toBe(12)
    expect(parseFrame(JSON.stringify({ event_type: "doorstep.booking.arrived", data: {}, at: "x" }))).toEqual({ eventType: "doorstep.booking.arrived", fix: null })
    expect(parseFrame("not json")).toBeNull()
  })

  it("an older fix never replaces a newer one", () => {
    const a = { lat: 1, lng: 1, etaMinutes: 10, at: "2026-10-04T09:10:00Z" }
    const b = { lat: 2, lng: 2, etaMinutes: 8, at: "2026-10-04T09:11:00Z" }
    expect(newerFix(a, b)).toBe(b)
    expect(newerFix(b, a)).toBe(b)
    expect(newerFix(b, { ...a, lat: 91 })).toBe(b)
  })
})

/* ── addresses and refusals ───────────────────────────────────────── */

describe("addresses", () => {
  it("parses a pasted pin and refuses nonsense", () => {
    expect(parsePin("17.4401, 78.3489")).toEqual({ lat: 17.4401, lng: 78.3489 })
    expect(parsePin("17.4401 78.3489")).toEqual({ lat: 17.4401, lng: 78.3489 })
    expect(parsePin("91, 78")).toBeNull()
    expect(parsePin("Gachibowli")).toBeNull()
  })

  it("needs a pin, a locality and a 6-digit pincode before it is sent", () => {
    expect(Object.keys(validateForm(EMPTY_FORM)).sort()).toEqual(["line1", "locality", "pin", "pincode"])
    const body = formBody({ ...EMPTY_FORM, line1: "Flat 402", locality: "Gachibowli", pincode: "500032", pin: "17.44, 78.35" })
    expect(body).toEqual({ label: "Home", line1: "Flat 402", locality: "Gachibowli", pincode: "500032", lat: 17.44, lng: 78.35, is_default: false })
  })

  it("the chosen address falls back to the default, then the first", () => {
    const [home] = decodeAddressList(fixtureData("addresses_get_200"), STRICT)
    const list = [{ ...home, id: "a", isDefault: false }, { ...home, id: "b", isDefault: true }]
    expect((resolveChosen(list, "a") as { id: string }).id).toBe("a")
    expect((resolveChosen(list, "gone") as { id: string }).id).toBe("b")
    expect(resolveChosen([], null)).toBeNull()
  })
})

describe("refusals", () => {
  it("the pilot gate's bare 404 reads as 'not open', a Doorstep 404 does not", () => {
    expect(isNotOpen({ status: 404, code: "HTTP_404" })).toBe(true)
    expect(isNotOpen({ status: 404, code: "DOORSTEP_BOOKING_NOT_FOUND" })).toBe(false)
    expect(refusalLine({ status: 409, code: "DOORSTEP_OUTSTANDING_DUE", message: "x", fromServer: true })).toMatch(/unpaid extras/)
    expect(refusalLine({ status: 422, code: "DOORSTEP_ADDON_INVALID", message: "\"Choose a mask\" needs more choices", fromServer: true })).toBe("\"Choose a mask\" needs more choices")
  })
})
