import { describe, expect, it } from "bun:test"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { join, resolve } from "node:path"
import { apiEnvelope, mapMissing, normaliseHistoryRow, normaliseShipment, productRow, sellerStatusBanner, stockRows, type ReadinessWire, type SellerOrderCardWire, type SellerProductWire, type SellerWire } from "../model/sell"
import { RETURN_POLICIES, priceAboveMrpFrom, returnPolicyInvalidFrom, skuLockedFrom } from "../model/sellListing"

/** A golden error body as the axios error the editor's decoders read; the status is the one the file name states. */
function asHttpError(name: string, body: unknown) {
  const status = Number(/_(\d{3})(?:_|\.json$)/.exec(name)?.[1] ?? 0)
  return { response: { status, data: body } }
}

// Golden fixtures land at commerce-service/internal/http/testdata/contracts/
// seller/<name>.json (lane C1) and are copied byte for byte to
// __tests__/contracts/seller/. When that folder is absent this file records
// the gap as a skipped test rather than inventing a fixture (house rule).
//
// Fixture names are matched by prefix to the mapper that reads them:
//   onboarding_status_*   → SellerWire → sellerStatusBanner
//   readiness_*           → ReadinessWire → mapMissing
//   seller_products_*     → {items: SellerProductWire[]} → productRow
//   product_variants_*    → {items: VariantWire[]} → stockRows
//   fulfillment_*         → {orders: SellerOrderCardWire[]} → normaliseShipment
//   order_history_*       → {history: []} → normaliseHistoryRow
//   variant_patch_200_*   → the repriced variant, live at once (no meta.revalidated)
//   variant_patch_4xx_*, product_patch_4xx_* → skuLockedFrom / priceAboveMrpFrom / returnPolicyInvalidFrom

const LOCAL = resolve(import.meta.dir, "contracts", "seller")
const BACKEND = resolve(import.meta.dir, "../../../../../modernsmapp/Architecture/services/commerce-service/internal/http/testdata/contracts/seller")

function fixtures(): { name: string; body: unknown; raw: Buffer }[] {
  if (!existsSync(LOCAL)) return []
  return readdirSync(LOCAL)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((name) => {
      const raw = readFileSync(join(LOCAL, name))
      // A 204 golden is an empty file: there is no body to parse.
      const text = raw.toString("utf8").trim()
      return { name, raw, body: text ? JSON.parse(text) : null }
    })
}

function unwrap<T>(body: unknown): T {
  const env = body as { data?: T }
  return (env && typeof env === "object" && "data" in env ? env.data : body) as T
}

const all = fixtures()

describe("seller contract fixtures", () => {
  if (all.length === 0) {
    it.skip("no fixtures under __tests__/contracts/seller yet (commerce-service testdata/contracts/seller is absent); nothing invented", () => {})
    return
  }

  it("every local fixture is byte-identical to the backend's copy when that checkout is present", () => {
    if (!existsSync(BACKEND)) return
    for (const f of all) {
      const theirs = join(BACKEND, f.name)
      expect(existsSync(theirs)).toBe(true)
      expect(createHash("sha1").update(f.raw).digest("hex")).toBe(createHash("sha1").update(readFileSync(theirs)).digest("hex"))
    }
  })

  for (const f of all) {
    if (f.name.startsWith("onboarding_status")) {
      it(`${f.name}: parses as a seller with a banner`, () => {
        const seller = unwrap<SellerWire>(f.body)
        expect(typeof seller.status).toBe("string")
        expect(typeof seller.store_name).toBe("string")
        expect(sellerStatusBanner(seller).label.length).toBeGreaterThan(0)
        expect("pan_number" in seller).toBe(false)
      })
    } else if (f.name.startsWith("readiness")) {
      it(`${f.name}: parses as readiness with a mappable missing[]`, () => {
        const r = unwrap<ReadinessWire>(f.body)
        expect(typeof r.ready).toBe("boolean")
        expect(Array.isArray(r.missing)).toBe(true)
        for (const m of mapMissing(r.missing)) expect(m.step).toBeDefined()
      })
    } else if (f.name.startsWith("seller_products")) {
      it(`${f.name}: every row maps to a product row`, () => {
        const d = unwrap<{ items: SellerProductWire[] }>(f.body)
        expect(Array.isArray(d.items)).toBe(true)
        for (const p of d.items) {
          const row = productRow(p)
          expect(row.id).toBe(p.id)
          expect(row.statusLabel.length).toBeGreaterThan(0)
        }
      })
    } else if (f.name.startsWith("product_variants")) {
      it(`${f.name}: every variant maps to a stock row with its own id`, () => {
        const d = unwrap<{ items: Parameters<typeof stockRows>[1] }>(f.body)
        const rows = stockRows({ id: "p", title: "t" }, d.items)
        for (const r of rows) expect(r.variantId).not.toBe("p")
      })
    } else if (f.name.startsWith("fulfillment")) {
      it(`${f.name}: every card has an order, items and paise`, () => {
        const d = unwrap<{ orders: SellerOrderCardWire[] }>(f.body)
        for (const card of d.orders) {
          expect(typeof card.order.status).toBe("string")
          expect(Array.isArray(card.items)).toBe(true)
          expect(typeof card.seller_subtotal_minor).toBe("number")
          if (card.shipment) expect(normaliseShipment(card.shipment)).not.toBeNull()
        }
      })
    } else if (f.name.startsWith("order_history")) {
      it(`${f.name}: every row normalises`, () => {
        const d = unwrap<{ history: unknown[] }>(f.body)
        for (const row of d.history) expect(normaliseHistoryRow(row)).not.toBeNull()
      })
    } else if (f.name.startsWith("variant_patch_200")) {
      it(`${f.name}: a price change is live at once — the repriced variant, no review bounce`, () => {
        const env = f.body as { data?: { id?: string; selling_price_minor?: number; mrp_minor?: number }; meta?: { revalidated?: boolean } }
        expect(typeof env.data?.id).toBe("string")
        expect(typeof env.data?.selling_price_minor).toBe("number")
        expect((env.data?.selling_price_minor ?? 0) <= (env.data?.mrp_minor ?? 0)).toBe(true)
        expect(env.meta?.revalidated).toBeUndefined()
      })
    } else if (f.name.startsWith("variant_patch_") || f.name.startsWith("product_patch_")) {
      it(`${f.name}: the editor's decoder claims this refusal`, () => {
        const err = asHttpError(f.name, f.body)
        if (f.name.includes("_sku_locked")) {
          expect(skuLockedFrom(err)).toBeTruthy()
          expect(apiEnvelope(err).details.field).toBe("sku")
        } else if (f.name.includes("_price_above_mrp")) {
          expect(priceAboveMrpFrom(err)).toBeTruthy()
          expect(apiEnvelope(err).details.field).toBe("selling_price_minor")
        } else if (f.name.includes("_return_policy_invalid")) {
          const refused = returnPolicyInvalidFrom(err)
          expect(refused).not.toBeNull()
          // Every window the editor offers is one the server accepts, and the one it used to offer is not.
          for (const r of RETURN_POLICIES) expect(refused?.allowed).toContain(r.value)
          expect(refused?.allowed).not.toContain("14_days")
        } else {
          throw new Error(`no decoder for ${f.name}`)
        }
      })
    } else {
      it.skip(`${f.name}: no mapper claims this fixture yet`, () => {})
    }
  }
})
