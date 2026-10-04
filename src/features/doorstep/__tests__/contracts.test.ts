import { describe, expect, it } from "bun:test"

import { LENIENT, STRICT, WireError, type Ctx } from "../model/decode"
import {
  decodeAddress,
  decodeAddressList,
  decodeBooking,
  decodeBookingCreated,
  decodeBookingPage,
  decodeBookingPayments,
  decodeCancelPreview,
  decodeCatalogue,
  decodeCategoryPage,
  decodeExtra,
  decodeExtraList,
  decodeExtrasBill,
  decodeIncident,
  decodeMessage,
  decodeMessagePage,
  decodeOutstanding,
  decodePaymentIntent,
  decodeQuote,
  decodeRating,
  decodeRealtimeToken,
  decodeReworkList,
  decodeReworkRequest,
  decodeServiceability,
  decodeServicePage,
  decodeShareToken,
  decodeSlotDays,
  decodeTrustedContact,
} from "../model/wire"
import { backendFixtureNames, backendText, fixtureData, fixtureError, localFixtureNames, localText } from "./fixtures"
import * as S from "./samples"

type Decoder = (raw: unknown, ctx: Ctx) => unknown

/* ── golden fixtures wired today ──────────────────────────────────── */

const SUCCESS: Record<string, Decoder> = {
  catalogue_get_200: decodeCatalogue,
  category_get_200: decodeCategoryPage,
  quote_post_201: decodeQuote,
  quote_post_201_salon: decodeQuote,
  service_get_200: decodeServicePage,
  serviceability_in_200: decodeServiceability,
  serviceability_out_200: decodeServiceability,
}

const ERRORS: Record<string, string> = {
  catalogue_get_404_city: "DOORSTEP_CITY_NOT_FOUND",
  quote_post_422_addon_max: "DOORSTEP_ADDON_INVALID",
  quote_post_422_addon_min: "DOORSTEP_ADDON_INVALID",
  quote_post_422_option_invalid: "DOORSTEP_OPTION_INVALID",
  quote_post_422_outside_area: "DOORSTEP_OUTSIDE_SERVICE_AREA",
  quote_post_422_quantity: "DOORSTEP_QUANTITY_INVALID",
}

/*
  PENDING: customer routes the web calls whose golden fixture doorstep-service
  has not produced yet (lanes A1 quote read, A3, A4, A5). Their decoders are
  written from the OpenAPI schemas and exercised on hand-written samples
  (./samples.ts). The moment the backend lands one of these fixtures, the
  "pending fixture appeared" test fails until it is copied into ./contracts
  and moved into SUCCESS above.
*/
const PENDING: Record<string, { route: string; decode: Decoder; sample: unknown }> = {
  address_post_201: { route: "POST /addresses", decode: decodeAddress, sample: S.address },
  addresses_get_200: { route: "GET /addresses", decode: decodeAddressList, sample: S.addressList },
  booking_cancel_post_200: { route: "POST /bookings/{id}/cancel", decode: decodeBooking, sample: { ...S.booking, status: "cancelled", start_otp: null, can_cancel: false, can_reschedule: false } },
  booking_get_200: { route: "GET /bookings/{id}", decode: decodeBooking, sample: S.booking },
  booking_payment_get_200: { route: "GET /bookings/{id}/payment", decode: decodeBookingPayments, sample: S.bookingPayments },
  booking_payment_intent_post_200: { route: "POST /bookings/{id}/payment/intent", decode: decodePaymentIntent, sample: S.paymentIntent },
  booking_post_201: { route: "POST /bookings", decode: decodeBookingCreated, sample: S.bookingCreated },
  booking_reschedule_post_200: { route: "POST /bookings/{id}/reschedule", decode: decodeBooking, sample: S.booking },
  bookings_get_200: { route: "GET /bookings", decode: decodeBookingPage, sample: S.bookingPage },
  cancel_preview_get_200: { route: "GET /bookings/{id}/cancel-preview", decode: decodeCancelPreview, sample: S.cancelPreview },
  extra_approve_post_200: { route: "POST /bookings/{id}/extras/{extraId}/approve", decode: decodeExtra, sample: { ...S.extra, status: "approved" } },
  extra_decline_post_200: { route: "POST /bookings/{id}/extras/{extraId}/decline", decode: decodeExtra, sample: { ...S.extra, status: "declined" } },
  extras_bill_get_200: { route: "GET /bookings/{id}/extras-bill", decode: decodeExtrasBill, sample: S.extrasBill },
  extras_get_200: { route: "GET /bookings/{id}/extras", decode: decodeExtraList, sample: S.extraList },
  extras_payment_intent_post_200: { route: "POST /extras-bills/{id}/payment/intent", decode: decodePaymentIntent, sample: { ...S.paymentIntent, reference_type: "doorstep_extras", reference_id: S.BILL_ID } },
  message_post_201: { route: "POST /bookings/{id}/messages", decode: decodeMessage, sample: S.message },
  messages_get_200: { route: "GET /bookings/{id}/messages", decode: decodeMessagePage, sample: S.messagePage },
  outstanding_get_200: { route: "GET /me/outstanding", decode: decodeOutstanding, sample: S.outstanding },
  quote_get_200: { route: "GET /quotes/{id}", decode: decodeQuote, sample: null },
  rating_post_201: { route: "POST /bookings/{id}/rating", decode: decodeRating, sample: S.rating },
  realtime_token_post_200: { route: "POST /realtime/token", decode: decodeRealtimeToken, sample: S.realtimeToken },
  rework_get_200: { route: "GET /bookings/{id}/rework", decode: decodeReworkList, sample: S.reworkList },
  rework_post_201: { route: "POST /bookings/{id}/rework", decode: decodeReworkRequest, sample: S.rework },
  share_post_201: { route: "POST /bookings/{id}/share", decode: decodeShareToken, sample: S.shareToken },
  slots_get_200: { route: "GET /slots", decode: decodeSlotDays, sample: S.slotDays },
  sos_post_201: { route: "POST /bookings/{id}/sos", decode: decodeIncident, sample: S.incident },
  trusted_contact_get_200: { route: "GET /trusted-contact", decode: decodeTrustedContact, sample: S.trustedContact },
}

/** Backend fixtures that belong to other lanes (admin console, the pro app, the public share view). */
const OTHER_LANES = /^(admin_|pro_|webhook_|share_get_)/

describe("golden fixtures", () => {
  it("every local copy is byte-identical to doorstep-service's", () => {
    const names = localFixtureNames()
    expect(names.length).toBe(Object.keys(SUCCESS).length + Object.keys(ERRORS).length)
    let compared = 0
    for (const name of names) {
      const backend = backendText(name)
      if (backend === null) continue
      expect(localText(name)).toBe(backend)
      compared++
    }
    if (compared === 0) console.warn("doorstep-service checkout not found: byte comparison skipped")
  })

  it("every local copy has a decoder or an error expectation", () => {
    for (const name of localFixtureNames()) expect(name in SUCCESS || name in ERRORS).toBe(true)
  })

  it("every customer fixture the backend has is copied and wired (no pending fixture left behind)", () => {
    const backend = backendFixtureNames()
    if (backend === null) return
    const local = new Set(localFixtureNames())
    const unwired = backend.filter((n) => !OTHER_LANES.test(n) && !local.has(n))
    expect(unwired).toEqual([])
  })

  it("no PENDING route's fixture has landed in the backend yet (else: copy it, move it to SUCCESS)", () => {
    const landed = Object.keys(PENDING).filter((n) => backendText(n) !== null)
    expect(landed).toEqual([])
  })

  it("a name is never both wired and pending", () => {
    for (const n of Object.keys(PENDING)) expect(n in SUCCESS || n in ERRORS).toBe(false)
  })

  for (const [name, decode] of Object.entries(SUCCESS)) {
    it(`${name} decodes strictly (every key known and present, integer paise)`, () => {
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
})

describe("pending decoders on hand-written samples (from openapi.yaml)", () => {
  for (const [name, p] of Object.entries(PENDING)) {
    if (p.sample === null) continue
    it(`${p.route} sample decodes strictly`, () => {
      expect(() => p.decode(p.sample, STRICT)).not.toThrow()
    })
  }

  it("GET /quotes/{id} shares the POST shape (decodes the POST fixture)", () => {
    expect(() => decodeQuote(fixtureData("quote_post_201"), STRICT)).not.toThrow()
  })

  it("trusted contact may be null", () => {
    expect(decodeTrustedContact(null, STRICT)).toBeNull()
  })
})

describe("strictness", () => {
  it("strict refuses a field it does not know", () => {
    const raw = { ...(fixtureData("serviceability_in_200") as object), surprise: 1 }
    expect(() => decodeServiceability(raw, STRICT)).toThrow(WireError)
    expect(() => decodeServiceability(raw, LENIENT)).not.toThrow()
  })

  it("strict refuses a missing key even when it is nullable (nulls are explicit)", () => {
    const raw = { ...(fixtureData("serviceability_out_200") as Record<string, unknown>) }
    delete raw.reason
    expect(() => decodeServiceability(raw, STRICT)).toThrow(WireError)
    expect(() => decodeServiceability(raw, LENIENT)).not.toThrow()
  })

  it("strict and lenient alike refuse a fractional paise amount", () => {
    const raw = { ...(fixtureData("quote_post_201") as object), total_paise: 224800.5 }
    expect(() => decodeQuote(raw, STRICT)).toThrow(WireError)
    expect(() => decodeQuote(raw, LENIENT)).toThrow(WireError)
  })

  it("strict refuses an enum value the contract does not list", () => {
    const raw = { ...S.booking, status: "teleported" }
    expect(() => decodeBooking(raw, STRICT)).toThrow(WireError)
  })

  it("the contract-gap keys are accepted when present, never required", () => {
    expect(() => decodeBooking({ ...S.booking, status: "in_progress", start_otp: null, end_otp: "7310", photos: [] }, STRICT)).not.toThrow()
    expect(() => decodeExtra({ ...S.extra, evidence_media_id: "9b3f0c55-0000-4000-8000-0000000000aa" }, STRICT)).not.toThrow()
  })

  it("the payment intent's checkout is passed through, never strict", () => {
    const i = decodePaymentIntent({ ...S.paymentIntent, checkout: { ...S.paymentIntent.checkout, anything: "else" } }, STRICT) as { checkout: { keyId: string } }
    expect(i.checkout.keyId).toBe("rzp_test_Sample01")
  })
})

describe("decoded values", () => {
  it("the catalogue keeps paise and the gender rules", () => {
    const c = decodeCatalogue(fixtureData("catalogue_get_200"), STRICT)
    expect(c.city).toEqual({ code: "HYD", name: "Hyderabad" })
    expect(c.categories.map((x) => x.genderRule)).toEqual(["any", "female_pros_only", "male_pros_only"])
    expect(c.categories[0].startingPricePaise).toBe(24900)
  })

  it("the service page carries the required pick-one group and the optional one", () => {
    const s = decodeServicePage(fixtureData("service_get_200"), STRICT).service
    expect(s.category.genderRule).toBe("female_pros_only")
    expect(s.addonGroups.map((g) => [g.minSelect, g.maxSelect, g.isRequired])).toEqual([
      [1, 1, true],
      [0, 2, false],
    ])
    expect(s.options.find((o) => o.isDefault)?.pricePaise).toBe(129900)
  })

  it("the quote's lines add up to its totals (as the server sent them)", () => {
    for (const name of ["quote_post_201", "quote_post_201_salon"]) {
      const q = decodeQuote(fixtureData(name), STRICT)
      expect(q.lines.reduce((n, l) => n + l.lineTotalPaise, 0)).toBe(q.totalPaise)
      expect(q.taxablePaise + q.taxPaise).toBe(q.totalPaise)
    }
  })

  it("the addon refusals carry the group and its limits", () => {
    const e = fixtureError("quote_post_422_addon_max")
    expect(e.details).toEqual({ group_id: "1bf67262-b425-5be4-a26f-388795d86a43", max_select: 1, min_select: 1, selected: 2 })
  })
})
