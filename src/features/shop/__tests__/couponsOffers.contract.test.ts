import { describe, expect, test } from "bun:test"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { inrMinor } from "../money"
import { toQuote, type WireQuote } from "../model/checkout"
import { bestCoupon, couponErrorMessage, discountRow, isCouponError, toCartCoupons } from "../model/coupons"
import { toPaymentOffers } from "../model/offers"
import { toOrderDetail, type WireOrderDetail } from "../model/orders"
import { toSellerCoupon, toSellerCoupons, type WireSellerCoupon, couponSaveError } from "../model/sellerCoupons"

/*
  Golden fixtures for coupons and bank offers (coupons-offers contract §A/§B),
  copied byte for byte from commerce-service
  internal/http/testdata/contracts/<area>/ into __tests__/contracts/<area>/.

  The backend lane names the files, so this test finds them by name
  (anything with "coupon" or "offer" in it, plus a quote or order that
  carries one) instead of guessing, parses each through the mapper the
  screen uses, and — when the backend checkout is on this machine — checks
  every copy is byte-identical and that no backend fixture is missing here.
  With no fixtures on either side the suite says so and skips.
*/

const LOCAL = resolve(import.meta.dir, "contracts")
const BACKEND = "C:/workspace/modernsmapp/Architecture/services/commerce-service/internal/http/testdata/contracts"
const NAME = /coupon|offer/i

function list(root: string): Array<{ area: string; name: string; path: string }> {
  if (!existsSync(root)) return []
  const out: Array<{ area: string; name: string; path: string }> = []
  for (const area of readdirSync(root)) {
    const dir = resolve(root, area)
    let files: string[] = []
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".json"))
    } catch {
      continue
    }
    for (const f of files) out.push({ area, name: f.replace(/\.json$/, ""), path: resolve(dir, f) })
  }
  return out
}

/** A fixture is ours when its name says coupon/offer, or its body carries one of the new keys. */
function isOurs(f: { name: string; path: string }): boolean {
  if (NAME.test(f.name)) return true
  const raw = readFileSync(f.path, "utf8")
  return /"best_coupon"|"payment_offer"|"amount_paid_minor"|"COUPON_[A-Z_]+"/.test(raw)
}

const local = list(LOCAL).filter(isOurs)
const backend = list(BACKEND).filter(isOurs)

type Envelope = { data?: unknown; error?: { code?: string; details?: Record<string, unknown> } }
const read = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Envelope

describe("coupons and offers golden fixtures", () => {
  if (local.length === 0 && backend.length === 0) {
    test.skip("no coupon/offer fixtures exist yet on either side (commerce-service has not written them)", () => {})
    return
  }

  test("every backend coupon/offer fixture has a byte-identical copy here", () => {
    for (const b of backend) {
      const mine = resolve(LOCAL, b.area, `${b.name}.json`)
      expect(existsSync(mine), `missing local copy of ${b.area}/${b.name}.json`).toBe(true)
      expect(readFileSync(mine, "utf8"), `${b.area}/${b.name}.json differs from the backend`).toBe(readFileSync(b.path, "utf8"))
    }
  })

  for (const f of local) {
    test(`${f.area}/${f.name} parses through the screen's mapper`, () => {
      const env = read(f.path)
      const err = env.error
      if (err?.code) {
        if (f.area === "seller" || f.area === "admin") {
          // A refused create or edit: the seller screen's own wording, never the generic fallback.
          const status = Number(/_(d{3})(?:_|$)/.exec(f.name)?.[1] ?? 0)
          if (err.code.startsWith("COUPON_")) expect(couponSaveError(err.code, status)).not.toBe("The coupon couldn't be saved. Try again.")
          return
        }
        if (isCouponError(err.code)) {
          const min = Number(err.details?.min_order_minor) || 0
          expect(couponErrorMessage(err.code, min, inrMinor)).not.toBe("This coupon couldn't be applied.")
          if (err.code === "COUPON_MIN_ORDER") expect(min).toBeGreaterThan(0)
        }
        return
      }
      const data = env.data as Record<string, unknown> | unknown[] | null
      const n = f.name.toLowerCase()
      if (/payment[_-]?offers?/.test(n)) {
        const offers = toPaymentOffers(data)
        expect(offers.length).toBeGreaterThan(0)
        for (const o of offers) {
          expect(o.id).toBeTruthy()
          expect(o.title).toBeTruthy()
          expect(Number.isSafeInteger(o.saveUpToMinor)).toBe(true)
        }
      } else if (/cart[_-]?coupons?/.test(n)) {
        const coupons = toCartCoupons(data)
        expect(coupons.length).toBeGreaterThan(0)
        for (const c of coupons) expect(Number.isSafeInteger(c.discountMinor)).toBe(true)
      } else if (/seller[_-]?coupons?/.test(n)) {
        if (Array.isArray(data) || (data && typeof data === "object" && ("items" in data || "coupons" in data))) {
          const rows = toSellerCoupons(data)
          expect(rows.length).toBeGreaterThan(0)
          for (const r of rows) expect(r.code).toBeTruthy()
        } else {
          const row = toSellerCoupon(data as WireSellerCoupon)
          expect(row).not.toBeNull()
          expect(Number.isSafeInteger(row!.discountValue)).toBe(true)
        }
      } else if (/quote/.test(n)) {
        const q = toQuote(data as unknown as WireQuote)
        expect(q.discountMinor).toBeGreaterThan(0)
        expect(discountRow(q, "ANY1")?.minor).toBe((data as unknown as WireQuote).discount_minor)
      } else if (/order/.test(n) && data && typeof data === "object" && "payment_offer" in data) {
        const order = toOrderDetail(data as unknown as WireOrderDetail)
        // An order paid without a bank offer carries payment_offer: null.
        if ((data as { payment_offer?: unknown }).payment_offer === null) expect(order.paymentOffer).toBeNull()
        else expect(order.paymentOffer).not.toBeNull()
      } else if (/product/.test(n)) {
        const body = data as { product?: unknown; best_coupon?: unknown; items?: unknown[] }
        const sources = Array.isArray(body?.items) ? body.items : [body?.product, body]
        expect(sources.some((s) => bestCoupon(s) !== null)).toBe(true)
      }
    })
  }
})
