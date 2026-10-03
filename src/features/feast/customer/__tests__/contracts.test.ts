import { describe, expect, it } from "bun:test"

import { STRICT, WireError } from "../model/decode"
import {
  decodeAddress,
  decodeAddressList,
  decodeCart,
  decodeInvoice,
  decodeMenu,
  decodeOrder,
  decodeOrderList,
  decodeOrderPayment,
  decodePaymentIntent,
  decodeRealtimeToken,
  decodeRestaurant,
  decodeRestaurantList,
  decodeTracking,
} from "../model/wire"
import { backendText, fixtureData, fixtureError, localFixtureNames, localText } from "./fixtures"

const SUCCESS: Record<string, (raw: unknown, ctx: typeof STRICT) => unknown> = {
  restaurants_get_200: decodeRestaurantList,
  restaurants_get_200_near: decodeRestaurantList,
  restaurant_get_200: decodeRestaurant,
  restaurant_get_200_near: decodeRestaurant,
  restaurant_menu_get_200: decodeMenu,
  cart_item_post_201: decodeCart,
  cart_get_200_section_9_5: decodeCart,
  cart_get_200_supplier_liable: decodeCart,
  cart_get_200_pricing_blocked: decodeCart,
  address_post_201: decodeAddress,
  addresses_get_200: decodeAddressList,
  order_place_201: decodeOrder,
  order_get_200: decodeOrder,
  order_get_200_out_for_delivery: decodeOrder,
  orders_get_200: decodeOrderList,
  order_cancel_post_200: decodeOrder,
  order_tracking_get_200: decodeTracking,
  invoice_get_200: decodeInvoice,
  order_payment_get_200_confirming: decodeOrderPayment,
  order_payment_get_200_failed: decodeOrderPayment,
  order_payment_get_200_paid: decodeOrderPayment,
  order_payment_get_200_paid_refund_pending: decodeOrderPayment,
  payment_intent_post_201_client_session: decodePaymentIntent,
  payment_intent_post_201_client_session_no_merchant_name: decodePaymentIntent,
  payment_intent_post_201_no_client_session: decodePaymentIntent,
  realtime_token_post_200_order: decodeRealtimeToken,
}

const ERRORS: Record<string, string> = {
  restaurants_get_422_location_required: "FOOD_LOCATION_REQUIRED",
  cart_item_post_422_out_of_range: "FOOD_ADDRESS_OUT_OF_RANGE",
  order_place_422_tax_category_missing: "FOOD_RESTAURANT_TAX_CATEGORY_MISSING",
  order_place_503_platform_gstin_missing: "FOOD_PLATFORM_GSTIN_NOT_CONFIGURED",
  order_payment_get_404: "FOOD_NOT_FOUND",
  order_payment_get_409_not_online: "FOOD_PAYMENT_NOT_ONLINE",
  payment_intent_post_422_cod: "PAYMENT_METHOD_UNAVAILABLE",
  realtime_token_post_404_foreign_order: "FOOD_NOT_FOUND",
  realtime_token_post_503_not_configured: "FOOD_REALTIME_NOT_CONFIGURED",
}

describe("golden fixtures", () => {
  it("every local copy is byte-identical to food-service's", () => {
    const names = localFixtureNames()
    expect(names.length).toBe(35)
    let compared = 0
    for (const name of names) {
      const backend = backendText(name)
      if (backend === null) continue
      expect(localText(name)).toBe(backend)
      compared++
    }
    // The backend checkout is expected on the dev machine; say so if it is not.
    if (compared === 0) console.warn("food-service checkout not found: byte comparison skipped")
  })

  it("every local copy has a decoder or an error expectation", () => {
    for (const name of localFixtureNames()) {
      expect(name in SUCCESS || name in ERRORS).toBe(true)
    }
  })

  for (const [name, decode] of Object.entries(SUCCESS)) {
    it(`${name} decodes strictly (no unknown field, integer paise)`, () => {
      expect(() => decode(fixtureData(name), STRICT)).not.toThrow()
    })
  }

  for (const [name, code] of Object.entries(ERRORS)) {
    it(`${name} is the ${code} refusal with the server's message`, () => {
      const e = fixtureError(name)
      expect(e.code).toBe(code)
      expect(e.message.length).toBeGreaterThan(0)
    })
  }

  it("strict mode refuses a field it does not know", () => {
    const raw = { ...(fixtureData("order_payment_get_200_paid") as object), surprise: 1 }
    expect(() => decodeOrderPayment(raw, STRICT)).toThrow(WireError)
  })

  it("strict and lenient alike refuse a fractional paise amount", () => {
    const raw = { ...(fixtureData("order_payment_get_200_paid") as object), amount_minor: 250.5 }
    expect(() => decodeOrderPayment(raw, STRICT)).toThrow(WireError)
    expect(() => decodeOrderPayment(raw, { strict: false, path: "$" })).toThrow(WireError)
  })
})

describe("decoded values", () => {
  it("near list carries distance and the server's serviceability", () => {
    const list = decodeRestaurantList(fixtureData("restaurants_get_200_near"), STRICT)
    expect(list.map((r) => r.serviceable)).toEqual([true, false, false])
    expect(list[0].distanceMeters).toBe(1200)
    expect(list[1].unserviceableReasonCode).toBe("FOOD_RESTAURANT_OUTSIDE_HOURS")
    expect(list[1].nextOpensAt).toBe("2026-09-13T18:00:00+05:30")
    expect(list[2].unserviceableMessage).toBe("delivery address is outside the restaurant's delivery range")
    expect(list[0].minOrderPaise).toBe(9900)
  })

  it("menu prices are the paise fields", () => {
    const menu = decodeMenu(fixtureData("restaurant_menu_get_200"), STRICT)
    const tikka = menu.categories[0].items[0]
    expect(tikka.basePricePaise).toBe(25000)
    expect(tikka.discountPricePaise).toBe(22550)
    expect(tikka.variants[0].pricePaise).toBe(14999)
    expect(tikka.addonGroups[0].addons[0].pricePaise).toBe(3000)
    expect(tikka.addonGroups[0].maxSelect).toBe(2)
  })

  it("the cart keeps the server's tax breakdown and final amount", () => {
    const cart = decodeCart(fixtureData("cart_get_200_section_9_5"), STRICT)
    expect(cart.totalsPaise?.finalAmount).toBe(64912)
    expect(cart.taxesAndCharges?.taxes.map((t) => t.liability)).toEqual(["SUPPLIER", "ECO_SECTION_9_5"])
    expect(cart.taxesAndCharges?.totalTaxPaise).toBe(3512)
    const blocked = decodeCart(fixtureData("cart_get_200_pricing_blocked"), STRICT)
    expect(blocked.totalsPaise).toBeNull()
    expect(blocked.pricingError?.code).toBe("FOOD_RESTAURANT_TAX_CATEGORY_MISSING")
  })

  it("an order total comes from money.totals_paise, else the rupee total through its string", () => {
    expect(decodeOrder(fixtureData("order_get_200"), STRICT).finalAmountPaise).toBe(64912)
    expect(decodeOrder(fixtureData("order_get_200_out_for_delivery"), STRICT).finalAmountPaise).toBe(30162)
    expect(decodeOrderList(fixtureData("orders_get_200"), STRICT)[0].finalAmountPaise).toBe(64912)
  })

  it("the payment intent relays the server's amount and session", () => {
    const intent = decodePaymentIntent(fixtureData("payment_intent_post_201_client_session"), STRICT)
    expect(intent.amountPaise).toBe(25000)
    expect(intent.clientSession?.keyId).toBe("rzp_test_ContractKey01")
    const bare = decodePaymentIntent(fixtureData("payment_intent_post_201_no_client_session"), STRICT)
    expect(bare.clientSession).toBeNull()
  })

  it("tracking parses the rider fix and the timeline", () => {
    const t = decodeTracking(fixtureData("order_tracking_get_200"), STRICT)
    expect(t.deliveryLocation?.recordedAt).toBe("2026-09-13 06:55:00+00")
    expect(t.timeline).toHaveLength(4)
    expect(t.assignmentStatus).toBe("PICKED_UP")
  })

  it("the invoice sections keep their paise totals", () => {
    const inv = decodeInvoice(fixtureData("invoice_get_200"), STRICT)
    expect(inv.sections.map((s) => s.totalPaise)).toEqual([68440, 4012])
    expect(inv.grandTotalPaise).toBe(72452)
  })
})
