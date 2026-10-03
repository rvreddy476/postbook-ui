import { describe, expect, it } from "bun:test"

import { attemptFor, ATTEMPT_STORAGE_KEY, attemptSignature, placeWithSavedKey, readAttempt, type AttemptStore } from "../model/checkoutAttempt"
import { STRICT } from "../model/decode"
import { cartBody, initialSheet, sheetProblems, sheetTotalPaise, setQuantity, toggleAddon } from "../model/itemSheet"
import { addPaise, formatPaise, rupeesToPaise, timesPaise } from "../model/money"
import { forgetIntentKey, intentKeyFor, nextPaymentPollDelay, paymentRoute, readPayment } from "../model/payment"
import { CARD_TITLES, fromRefusal, serviceCard } from "../model/serviceability"
import { deliveryCodeVisible, newerRiderFix, parseServerTime } from "../model/tracking"
import { decodeMenu, decodeOrder, decodeOrderPayment, decodePaymentIntent, decodeRestaurant, decodeRestaurantList, decodeTracking, type MenuItem, type Restaurant } from "../model/wire"
import { fixtureData, fixtureError } from "./fixtures"

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

/* ── money ────────────────────────────────────────────────────────── */

describe("money is integer paise", () => {
  it("converts rupee decimals through their string, never by multiplying a float", () => {
    expect(rupeesToPaise(649.12)).toBe(64912)
    expect(rupeesToPaise(12.34)).toBe(1234) // 12.34 * 100 === 1233.9999999999998
    expect(rupeesToPaise(1.005)).toBeNull() // three decimals: refused, not rounded
    expect(rupeesToPaise(225.5)).toBe(22550)
    expect(rupeesToPaise("99")).toBe(9900)
    expect(rupeesToPaise(Number.NaN)).toBeNull()
    expect(rupeesToPaise(1e21)).toBeNull()
  })

  it("adds and multiplies integers only", () => {
    expect(addPaise(25000, 3000)).toBe(28000)
    expect(() => addPaise(0.1, 0.2)).toThrow()
    expect(timesPaise(28000, 2)).toBe(56000)
    expect(() => timesPaise(100, 1.5)).toThrow()
  })

  it("formats with Indian grouping and exact paise", () => {
    expect(formatPaise(64912)).toBe("₹649.12")
    expect(formatPaise(9900)).toBe("₹99")
    expect(formatPaise(12345678)).toBe("₹1,23,456.78")
    expect(formatPaise(5)).toBe("₹0.05")
    expect(formatPaise(0.5)).toBe("₹—")
  })
})

describe("no float money anywhere in the customer lane", () => {
  const { readdirSync, readFileSync, statSync } = require("node:fs") as typeof import("node:fs")
  const { join, resolve } = require("node:path") as typeof import("node:path")
  const root = resolve(import.meta.dir, "..")
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== "__tests__") walk(p)
      } else if (/\.(ts|tsx)$/.test(name)) files.push(p)
    }
  }
  walk(root)

  it("never multiplies or divides rupees by 100 outside the formatter, and never parseFloats", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8")
      expect({ f, hit: /parseFloat|toFixed\(2\)/.test(src) }).toEqual({ f, hit: false })
      if (!f.endsWith("money.ts")) expect({ f, hit: /[*/]\s*100\b/.test(src) }).toEqual({ f, hit: false })
    }
  })

  it("the payment model reads no build environment (keys come from the server's session)", () => {
    const src = readFileSync(join(root, "model", "payment.ts"), "utf8")
    expect(src.includes("process.env")).toBe(false)
  })
})

/* ── the item sheet ───────────────────────────────────────────────── */

function tikka(): MenuItem {
  return decodeMenu(fixtureData("restaurant_menu_get_200"), STRICT).categories[0].items[0]
}

function withGroups(item: MenuItem, patch: Partial<MenuItem["addonGroups"][number]>): MenuItem {
  return { ...item, addonGroups: item.addonGroups.map((g) => ({ ...g, ...patch })) }
}

describe("size + add-on sheet", () => {
  it("a required group blocks Add until satisfied", () => {
    const item = withGroups(tikka(), { isRequired: true, minSelect: 1, maxSelect: 1 })
    const groupId = item.addonGroups[0].id
    const s0 = initialSheet(item)
    expect(sheetProblems(item, s0).map((p) => p.groupId)).toEqual([groupId])
    const s1 = toggleAddon(s0, item.addonGroups[0], item.addonGroups[0].addons[0].id)
    expect(sheetProblems(item, s1)).toEqual([])
  })

  it("is_required needs one pick even when min_select is 0", () => {
    const item = withGroups(tikka(), { isRequired: true, minSelect: 0, maxSelect: 2 })
    expect(sheetProblems(item, initialSheet(item))).toHaveLength(1)
  })

  it("min_select > 0 makes a group required even without is_required", () => {
    const item = withGroups(tikka(), { isRequired: false, minSelect: 1 })
    expect(sheetProblems(item, initialSheet(item))).toHaveLength(1)
  })

  it("an optional group does not block", () => {
    const item = tikka()
    expect(sheetProblems(item, initialSheet(item))).toEqual([])
  })

  it("max_select caps picks; a one-pick group replaces", () => {
    const base = tikka()
    const g = base.addonGroups[0]
    const three = { ...g, maxSelect: 2, addons: [g.addons[0], { ...g.addons[0], id: "a2" }, { ...g.addons[0], id: "a3" }] }
    const item = { ...base, addonGroups: [three] }
    let s = initialSheet(item)
    s = toggleAddon(s, three, g.addons[0].id)
    s = toggleAddon(s, three, "a2")
    s = toggleAddon(s, three, "a3")
    expect(s.picks[three.id]).toEqual([g.addons[0].id, "a2"])
    const one = { ...three, maxSelect: 1 }
    let r = toggleAddon(initialSheet(item), one, "a2")
    r = toggleAddon(r, one, "a3")
    expect(r.picks[one.id]).toEqual(["a3"])
  })

  it("the total is (size + add-ons) × quantity in paise", () => {
    const item = tikka()
    let s = initialSheet(item) // the Half size, 14999
    s = toggleAddon(s, item.addonGroups[0], item.addonGroups[0].addons[0].id) // +3000
    s = setQuantity(s, 2)
    expect(sheetTotalPaise(item, s)).toBe(35998)
    expect(Number.isSafeInteger(sheetTotalPaise(item, s))).toBe(true)
  })

  it("the cart body carries variant_id, addons and address_id", () => {
    const item = tikka()
    let s = initialSheet(item)
    s = toggleAddon(s, item.addonGroups[0], item.addonGroups[0].addons[0].id)
    expect(cartBody(item, s, "addr-1")).toEqual({
      menu_item_id: item.id,
      quantity: 1,
      variant_id: item.variants[0].id,
      addons: [{ addon_id: item.addonGroups[0].addons[0].id, quantity: 1 }],
      address_id: "addr-1",
    })
  })

  it("an unavailable dish cannot be added", () => {
    const thali = decodeMenu(fixtureData("restaurant_menu_get_200"), STRICT).categories[0].items[1]
    expect(sheetProblems(thali, initialSheet(thali)).length).toBeGreaterThan(0)
  })
})

/* ── serviceability cards ─────────────────────────────────────────── */

describe("serviceability card choice", () => {
  const near = () => decodeRestaurantList(fixtureData("restaurants_get_200_near"), STRICT)
  const plain = () => decodeRestaurantList(fixtureData("restaurants_get_200"), STRICT)

  it("with a point, the server's answer and words decide", () => {
    const [open, closed, far] = near().map((r) => serviceCard(r))
    expect(open.kind).toBe("open")
    expect(closed.kind).toBe("closed")
    expect(closed.title).toBe("Closed")
    expect(closed.message).toBe("restaurant is closed at this time")
    expect(closed.fromServer).toBe(true)
    expect(closed.nextOpensAt).toBe("2026-09-13T18:00:00+05:30")
    expect(far.kind).toBe("out_of_range")
    expect(far.title).toBe("Doesn't deliver here")
    expect(far.message).toBe("delivery address is outside the restaurant's delivery range")
  })

  it("the server's answer wins over the flags", () => {
    const r: Restaurant = { ...near()[0], isAcceptingOrders: false }
    expect(serviceCard(r).kind).toBe("open")
  })

  it("without a point, the flags decide", () => {
    const list = plain()
    expect(serviceCard(list[0]).kind).toBe("open")
    expect(serviceCard(list[2]).kind).toBe("closed") // is_open_now false
    const paused: Restaurant = { ...list[0], isAcceptingOrders: false }
    expect(serviceCard(paused).kind).toBe("not_accepting")
    expect(serviceCard(paused).title).toBe(CARD_TITLES.not_accepting)
  })

  it("a remembered refusal blocks with the server's words until a route answer supersedes it", () => {
    const e = fixtureError("cart_item_post_422_out_of_range")
    const refusal = fromRefusal(e.code, e.message)
    expect(refusal?.kind).toBe("out_of_range")
    const unjudged = decodeRestaurant(fixtureData("restaurant_get_200"), STRICT)
    expect(serviceCard(unjudged, refusal).message).toBe(e.message)
    const judged = decodeRestaurant(fixtureData("restaurant_get_200_near"), STRICT)
    expect(serviceCard(judged, refusal).kind).toBe("open")
    const tax = fixtureError("order_place_422_tax_category_missing")
    const taxRefusal = fromRefusal(tax.code, tax.message)
    expect(serviceCard(judged, taxRefusal).kind).toBe("unavailable") // not judged by the routes: it stands
  })

  it("a refusal that is not about serviceability is not a card", () => {
    expect(fromRefusal("FOOD_CART_RESTAURANT_CONFLICT", "x")).toBeNull()
  })
})

/* ── idempotency ──────────────────────────────────────────────────── */

describe("the order idempotency key", () => {
  const sig = attemptSignature({ cartId: "c", items: [{ id: "i", quantity: 2 }], finalAmountPaise: 64912, addressId: "a", method: "upi" })
  const order = () => decodeOrder(fixtureData("order_place_201"), STRICT)

  it("is persisted BEFORE the place call is made", async () => {
    const store = new MemoryStore()
    let keyAtCall: string | null = null
    let storedAtCall: string | null = null
    const outcome = await placeWithSavedKey(
      store,
      sig,
      async (key) => {
        keyAtCall = key
        storedAtCall = readAttempt(store)?.key ?? null
        return order()
      },
      () => 500,
      () => "key-1",
    )
    expect(keyAtCall as unknown as string).toBe("key-1")
    expect(storedAtCall as unknown as string).toBe("key-1")
    expect(outcome.kind).toBe("placed")
    expect(readAttempt(store)?.orderId).toBe(order().id)
  })

  it("a lost response keeps the key, and the resend uses it", async () => {
    const store = new MemoryStore()
    const lost = await placeWithSavedKey(store, sig, async () => { throw new Error("offline") }, () => 0, () => "key-A")
    expect(lost.kind).toBe("lost")
    const keys: string[] = []
    await placeWithSavedKey(store, sig, async (k) => { keys.push(k); return order() }, () => 0, () => "key-B")
    expect(keys).toEqual(["key-A"])
  })

  it("a refusal clears the key: the next try is a new decision", async () => {
    const store = new MemoryStore()
    const refused = await placeWithSavedKey(store, sig, async () => { throw new Error("422") }, () => 422, () => "key-A")
    expect(refused.kind).toBe("refused")
    expect(store.getItem(ATTEMPT_STORAGE_KEY)).toBeNull()
  })

  it("an attempt that already has an order reuses it and never places again", async () => {
    const store = new MemoryStore()
    await placeWithSavedKey(store, sig, async () => order(), () => 0, () => "key-A")
    let called = false
    const again = await placeWithSavedKey(store, sig, async () => { called = true; return order() }, () => 0, () => "key-B")
    expect(called).toBe(false)
    expect(again.kind).toBe("reused")
  })

  it("a different decision gets a different key", () => {
    const store = new MemoryStore()
    const a = attemptFor(store, sig, () => "k1")
    const b = attemptFor(store, sig + "|other", () => "k2")
    expect(a.key).toBe("k1")
    expect(b.key).toBe("k2")
  })
})

/* ── payment ──────────────────────────────────────────────────────── */

describe("paid only from the payment status", () => {
  const read = (name: string) => readPayment(decodeOrderPayment(fixtureData(name), STRICT))

  it("reads the server's three states and refunds", () => {
    expect(read("order_payment_get_200_confirming")).toBe("confirming")
    expect(read("order_payment_get_200_paid")).toBe("paid")
    expect(read("order_payment_get_200_failed")).toBe("failed")
    expect(read("order_payment_get_200_paid_refund_pending")).toBe("refund_pending")
  })

  it("an unknown status keeps confirming; nothing else says paid", () => {
    expect(readPayment({ status: "captured", refundStatus: null })).toBe("confirming")
    expect(readPayment({ status: "PAID", refundStatus: null })).toBe("confirming")
    expect(readPayment({ status: "", refundStatus: null })).toBe("confirming")
  })

  it("the poll keeps a schedule and ends", () => {
    expect(nextPaymentPollDelay(0)).toBe(2000)
    expect(nextPaymentPollDelay(40_000)).toBe(5000)
    expect(nextPaymentPollDelay(180_000)).toBeNull()
  })

  it("razorpay opens from the client session only, with the intent's own amount", () => {
    const intent = decodePaymentIntent(fixtureData("payment_intent_post_201_client_session"), STRICT)
    const route = paymentRoute(intent, { orderNumber: "FG1", stubAllowed: false })
    expect(route.kind).toBe("razorpay")
    if (route.kind !== "razorpay") return
    expect(route.options).toEqual({
      key: "rzp_test_ContractKey01",
      order_id: "order_ContractRzp01",
      amount: 25000,
      currency: "INR",
      name: "Momentum Merchant",
      description: "Feast order FG1",
    })
    const noName = decodePaymentIntent(fixtureData("payment_intent_post_201_client_session_no_merchant_name"), STRICT)
    const r2 = paymentRoute(noName, { orderNumber: "FG1", stubAllowed: false })
    expect(r2.kind === "razorpay" && r2.options.name).toBe("Feast")
  })

  it("no session is unavailable, and the stub needs both the flag and a stub order", () => {
    const bare = decodePaymentIntent(fixtureData("payment_intent_post_201_no_client_session"), STRICT)
    expect(paymentRoute(bare, { orderNumber: "x", stubAllowed: true }).kind).toBe("unavailable")
    const stub = { ...bare, providerOrderId: "order_stub_123" }
    expect(paymentRoute(stub, { orderNumber: "x", stubAllowed: false }).kind).toBe("unavailable")
    expect(paymentRoute(stub, { orderNumber: "x", stubAllowed: true }).kind).toBe("stub")
  })

  it("the intent key is reused for the attempt and renewed for a retry", () => {
    const store = new MemoryStore()
    let n = 0
    const mint = () => `k${++n}`
    expect(intentKeyFor(store, "o1", mint)).toBe("k1")
    expect(intentKeyFor(store, "o1", mint)).toBe("k1")
    forgetIntentKey(store, "o1")
    expect(intentKeyFor(store, "o1", mint)).toBe("k2")
  })
})

/* ── tracking ─────────────────────────────────────────────────────── */

describe("delivery code visibility", () => {
  it("shows only while PICKED_UP or OUT_FOR_DELIVERY", () => {
    const o = decodeOrder(fixtureData("order_get_200_out_for_delivery"), STRICT)
    expect(deliveryCodeVisible(o.status, o.deliveryCode)).toBe(true)
    expect(deliveryCodeVisible("PICKED_UP", "7390")).toBe(true)
    for (const s of ["CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "DELIVERY_ASSIGNED", "DELIVERED", "CANCELLED_BY_CUSTOMER"]) {
      expect(deliveryCodeVisible(s, "7390")).toBe(false)
    }
    expect(deliveryCodeVisible("OUT_FOR_DELIVERY", null)).toBe(false)
    expect(deliveryCodeVisible("OUT_FOR_DELIVERY", " ")).toBe(false)
  })
})

describe("rider location", () => {
  const fix = () => decodeTracking(fixtureData("order_tracking_get_200"), STRICT).deliveryLocation

  it("reads both timestamp spellings", () => {
    expect(parseServerTime("2026-09-13 06:55:00+00")).toBe(Date.parse("2026-09-13T06:55:00Z"))
    expect(parseServerTime("2026-09-13T06:55:00Z")).toBe(Date.parse("2026-09-13T06:55:00Z"))
    expect(parseServerTime("nonsense")).toBeNull()
  })

  it("moves only to a newer fix", () => {
    const current = fix()
    const older = current && { ...current, latitude: 1, recordedAt: "2026-09-13 06:50:00+00" }
    const newer = current && { ...current, latitude: 2, recordedAt: "2026-09-13T06:56:00Z" }
    const same = current && { ...current, latitude: 3 }
    expect(newerRiderFix(current, older)).toBe(current)
    expect(newerRiderFix(current, same)).toBe(current)
    expect(newerRiderFix(current, newer)).toBe(newer)
    expect(newerRiderFix(null, current)).toBe(current)
    expect(newerRiderFix(current, null)).toBe(current)
    expect(newerRiderFix(current, current && { ...current, recordedAt: null })).toBe(current)
  })
})
