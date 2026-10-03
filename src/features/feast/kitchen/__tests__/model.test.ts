import { describe, expect, test } from "bun:test"

import { checklistFromMissing, ONBOARDING_STEPS } from "../model/checklist"
import { acceptWindow, canRespond, deadlineOf, formatRemaining, parseServerInstant } from "../model/countdown"
import { decideGate, pickRestaurant } from "../model/gate"
import { isFutureDateIST, toEditDays, toWindowsBody, todayIST } from "../model/hours"
import { formatPaise, MoneyError, paiseToInput, paiseToWireRupees, parseRupeesInput, wireRupeesToPaise } from "../model/money"
import { dishBody } from "../api/client"
import { decodeKitchenQueue, decodeOperatingHours } from "../model/wire"
import { envelopeData } from "../model/decode"
import { readFixture } from "./fixtures"

const ok = (name: string) => ({ ok: true as const, body: readFixture(name) })
const restaurants = { ok: true as const, body: { data: { items: [envelopeData(readFixture("partner_restaurant_get_200"))] } } }

describe("role gate fails closed", () => {
  test("owner with restaurants opens the console", () => {
    const d = decideGate({ capabilities: ok("me_capabilities_get_200_all_roles"), restaurants })
    expect(d.kind).toBe("owner")
  })
  test("a customer is offered partnership, never the console", () => {
    expect(decideGate({ capabilities: ok("me_capabilities_get_200_customer"), restaurants }).kind).toBe("not-partner")
  })
  test("network failure is an error, not access", () => {
    expect(decideGate({ capabilities: { ok: false, error: new Error("x") }, restaurants }).kind).toBe("error")
  })
  test("a missing or non-boolean is_restaurant_owner is an error", () => {
    const missing = { data: { user_id: "u", is_customer: true, is_delivery_partner: false, is_admin: false, is_moderator: false } }
    expect(decideGate({ capabilities: { ok: true, body: missing }, restaurants }).kind).toBe("error")
    const truthy = { data: { ...missing.data, is_restaurant_owner: "true" } }
    expect(decideGate({ capabilities: { ok: true, body: truthy }, restaurants }).kind).toBe("error")
    expect(decideGate({ capabilities: { ok: true, body: null }, restaurants }).kind).toBe("error")
    expect(decideGate({ capabilities: { ok: true, body: { error: { code: "X" } } }, restaurants }).kind).toBe("error")
  })
  test("owner but the restaurant list failed, is malformed or empty: closed", () => {
    const caps = ok("me_capabilities_get_200_all_roles")
    expect(decideGate({ capabilities: caps }).kind).toBe("error")
    expect(decideGate({ capabilities: caps, restaurants: { ok: false, error: new Error() } }).kind).toBe("error")
    expect(decideGate({ capabilities: caps, restaurants: { ok: true, body: { data: { items: [{ id: 1 }] } } } }).kind).toBe("error")
    expect(decideGate({ capabilities: caps, restaurants: { ok: true, body: { data: { items: [] } } } }).kind).toBe("not-partner")
  })
  test("restaurant picker: remembered if still owned, the only one, else ask", () => {
    const one = decideGate({ capabilities: ok("me_capabilities_get_200_all_roles"), restaurants })
    if (one.kind !== "owner") throw new Error("expected owner")
    expect(pickRestaurant(one.restaurants, null)).toBe(one.restaurants[0].id)
    expect(pickRestaurant(one.restaurants, "gone")).toBe(one.restaurants[0].id)
    const two = [...one.restaurants, { ...one.restaurants[0], id: "second" }]
    expect(pickRestaurant(two, null)).toBeNull()
    expect(pickRestaurant(two, "second")).toBe("second")
  })
})

describe("accept countdown", () => {
  const [order] = decodeKitchenQueue(envelopeData(readFixture("kitchen_queue_get_200")))
  const fetchedAt = 1_000_000

  test("anchored to the response's arrival, not the device's idea of the deadline", () => {
    expect(deadlineOf(order, fetchedAt)).toBe(fetchedAt + 300_000)
  })
  test("open, urgent at 30 s, rounded up, expired at the deadline", () => {
    const d = deadlineOf(order, fetchedAt)
    expect(acceptWindow(d, fetchedAt)).toEqual({ kind: "open", remainingSeconds: 300, urgent: false })
    expect(acceptWindow(d, fetchedAt + 270_000)).toEqual({ kind: "open", remainingSeconds: 30, urgent: true })
    expect(acceptWindow(d, fetchedAt + 299_001)).toEqual({ kind: "open", remainingSeconds: 1, urgent: true })
    expect(acceptWindow(d, fetchedAt + 300_000)).toEqual({ kind: "expired" })
    expect(canRespond(acceptWindow(d, fetchedAt + 300_000))).toBe(false)
    expect(canRespond(acceptWindow(d, fetchedAt + 299_999))).toBe(true)
  })
  test("falls back to the deadline text when seconds_to_breach is absent", () => {
    expect(deadlineOf({ secondsToBreach: null, acceptDeadlineAt: "2026-09-13 06:35:00+00" }, 0)).toBe(Date.parse("2026-09-13T06:35:00Z"))
    expect(parseServerInstant("2026-09-13T06:35:00Z")).toBe(Date.parse("2026-09-13T06:35:00Z"))
    expect(parseServerInstant("nonsense")).toBeNull()
    expect(acceptWindow(null, 0)).toEqual({ kind: "no-deadline" })
    expect(canRespond({ kind: "no-deadline" })).toBe(true)
  })
  test("format", () => {
    expect(formatRemaining(125)).toBe("2:05")
    expect(formatRemaining(0)).toBe("0:00")
  })
})

describe("money is paise only", () => {
  test("rupee text → paise without floats", () => {
    expect(parseRupeesInput("225.50")).toBe(22550)
    expect(parseRupeesInput("225.5")).toBe(22550)
    expect(parseRupeesInput("₹ 1,225")).toBe(122500)
    expect(parseRupeesInput("0.29")).toBe(29)
    expect(parseRupeesInput("1.005")).toBeNull()
    expect(parseRupeesInput("-5")).toBeNull()
    expect(parseRupeesInput("")).toBeNull()
    expect(parseRupeesInput("abc")).toBeNull()
  })
  test("formatting and inputs from integers", () => {
    expect(formatPaise(64912)).toBe("₹649.12")
    expect(formatPaise(10000000)).toBe("₹1,00,000.00")
    expect(formatPaise(5)).toBe("₹0.05")
    expect(paiseToInput(22550)).toBe("225.50")
    expect(() => formatPaise(649.12)).toThrow(MoneyError)
    expect(() => formatPaise(-1)).toThrow(MoneyError)
  })
  test("the legacy rupee wire value is derived from paise exactly", () => {
    for (const p of [1, 29, 1099, 22550, 64912, 999999]) {
      expect(JSON.stringify(paiseToWireRupees(p))).toBe((p / 100).toString())
      expect(wireRupeesToPaise(paiseToWireRupees(p))).toBe(p)
    }
    expect(wireRupeesToPaise(0.1 + 0.2)).toBeNull()
  })
  test("dish body carries the paise-derived rupees and an explicit null discount", () => {
    const b = dishBody(
      { categoryId: "c", name: " Dosa ", description: "", foodType: "VEG", basePricePaise: 22550, discountPricePaise: null, preparationMinutes: 15, isRecommended: false, taxPercentage: 5, imageMediaId: null, imageUrl: null },
      true,
    )
    expect(b.base_price).toBe(225.5)
    expect(b.discount_price).toBeNull()
    expect(b.category_id).toBe("c")
    expect(b.name).toBe("Dosa")
  })
})

describe("checklist from missing[]", () => {
  test("presentation order is the server's, whatever order missing[] arrives in", () => {
    const c = checklistFromMissing(["payout_account", "fssai_document"])
    expect(c.rows.map((r) => r.step)).toEqual([...ONBOARDING_STEPS])
    expect(c.rows.filter((r) => !r.done).map((r) => r.step)).toEqual(["fssai_document", "payout_account"])
    expect(c.next).toBe("fssai_document")
    expect(c.ready).toBe(false)
    expect(c.remaining).toBe(2)
  })
  test("the readiness fixture", () => {
    const missing = (envelopeData(readFixture("readiness_get_200")) as { missing: string[] }).missing
    expect(checklistFromMissing(missing).next).toBe("fssai_document")
  })
  test("empty missing[] is ready", () => {
    expect(checklistFromMissing([]).ready).toBe(true)
  })
  test("an unknown step fails closed", () => {
    const c = checklistFromMissing(["bank_kyc_v2"])
    expect(c.ready).toBe(false)
    expect(c.unrecognised).toEqual(["bank_kyc_v2"])
    expect(c.remaining).toBe(1)
  })
})

describe("hours", () => {
  test("fixture windows round-trip through the editor", () => {
    const h = decodeOperatingHours(envelopeData(readFixture("operating_hours_get_200")))
    const days = toEditDays(h.windows)
    expect(days[0].closed).toBe(true)
    expect(days[1].windows).toHaveLength(2)
    const body = toWindowsBody(days)
    expect(body.ok).toBe(true)
    if (body.ok) expect(body.windows.find((w) => w.day_of_week === 5)).toEqual({ day_of_week: 5, opens_at: "18:00", closes_at: "02:00", is_closed: false })
  })
  test("bad times and all-closed are refused before the round trip", () => {
    const closed = Array.from({ length: 7 }, () => ({ closed: true, windows: [] }))
    expect(toWindowsBody(closed).ok).toBe(false)
    const bad = closed.map((d, i) => (i === 1 ? { closed: false, windows: [{ opensAt: "9:00", closesAt: "17:00" }] } : d))
    expect(toWindowsBody(bad).ok).toBe(false)
  })
  test("IST date for FSSAI expiry", () => {
    const lateUtc = Date.parse("2026-10-02T20:00:00Z") // 01:30 IST on 3 Oct
    expect(todayIST(lateUtc)).toBe("2026-10-03")
    expect(isFutureDateIST("2026-10-03", lateUtc)).toBe(false)
    expect(isFutureDateIST("2026-10-04", lateUtc)).toBe(true)
  })
})
