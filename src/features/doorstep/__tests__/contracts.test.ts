import { describe, expect, it } from "bun:test"

import { LENIENT, STRICT, WireError, type Ctx } from "../model/decode"
import {
  decodeTicket,
  decodeTicketList,
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
  decodeProfessionalList,
  decodeProChangeResult,
} from "../model/wire"
import { backendFixtureNames, backendText, fixtureData, fixtureError, localFixtureNames, localText } from "./fixtures"
import * as S from "./samples"

type Decoder = (raw: unknown, ctx: Ctx) => unknown

/** A fresh copy of booking_get_200's data, safe to mutate. */
const bookingRaw = (): Record<string, unknown> => ({ ...(fixtureData("booking_get_200") as Record<string, unknown>) })

/* ── golden fixtures wired today ──────────────────────────────────── */

const SUCCESS: Record<string, Decoder> = {
  ticket_get_200: decodeTicket,
  ticket_post_201: decodeTicket,
  tickets_get_200: decodeTicketList,
  trusted_contact_get_200_empty: decodeTrustedContact,
  extra_approve_post_200: decodeExtra,
  extra_decline_post_200: decodeExtra,
  extras_bill_get_200: decodeExtrasBill,
  extras_get_200: decodeExtraList,
  extras_payment_intent_post_200: decodePaymentIntent,
  message_post_201: decodeMessage,
  messages_get_200: decodeMessagePage,
  outstanding_get_200: decodeOutstanding,
  quote_get_200: decodeQuote,
  rating_post_201: decodeRating,
  rework_get_200: decodeReworkList,
  rework_post_201: decodeReworkRequest,
  share_post_201: decodeShareToken,
  sos_post_201: decodeIncident,
  trusted_contact_get_200: decodeTrustedContact,
  trusted_contact_put_200: decodeTrustedContact,
  address_post_201: decodeAddress,
  addresses_get_200: decodeAddressList,
  booking_cancel_post_200: decodeBooking,
  booking_get_200: decodeBooking,
  booking_get_200_pending_payment: decodeBooking,
  booking_payment_get_200: decodeBookingPayments,
  booking_payment_get_200_pending: decodeBookingPayments,
  booking_payment_get_200_refund: decodeBookingPayments,
  booking_payment_intent_post_200: decodePaymentIntent,
  booking_post_201: decodeBookingCreated,
  booking_reschedule_post_200: decodeBooking,
  bookings_get_200: decodeBookingPage,
  cancel_preview_get_200: decodeCancelPreview,
  catalogue_get_200: decodeCatalogue,
  category_get_200: decodeCategoryPage,
  quote_post_201: decodeQuote,
  quote_post_201_salon: decodeQuote,
  service_get_200: decodeServicePage,
  serviceability_in_200: decodeServiceability,
  serviceability_out_200: decodeServiceability,
  slots_get_200: decodeSlotDays,
  realtime_token_post_200: decodeRealtimeToken,
  booking_get_200_pending_change: decodeBooking,
  booking_get_200_pro_unavailable: decodeBooking,
  booking_post_201_asap: decodeBookingCreated,
  booking_professionals_get_200: decodeProfessionalList,
  booking_professionals_get_200_asap: decodeProfessionalList,
  service_professionals_get_200: decodeProfessionalList,
  service_professionals_get_200_asap: decodeProfessionalList,
  service_professionals_get_200_asap_none: decodeProfessionalList,
  booking_change_professional_post_200_charge: decodeProChangeResult,
  booking_change_professional_post_200_refund: decodeProChangeResult,
  cancel_preview_get_200_pro_unavailable: decodeCancelPreview,
}

const ERRORS: Record<string, string> = {
  address_post_422_outside_area: "DOORSTEP_OUTSIDE_SERVICE_AREA",
  booking_get_404: "DOORSTEP_BOOKING_NOT_FOUND",
  booking_payment_intent_410_hold_expired: "DOORSTEP_HOLD_EXPIRED",
  booking_payment_stub_confirm_404: "DOORSTEP_NOT_FOUND",
  booking_post_400_idempotency_key: "DOORSTEP_INVALID_REQUEST",
  booking_post_409_outstanding: "DOORSTEP_OUTSTANDING_DUE",
  booking_post_409_slot_taken: "DOORSTEP_SLOT_TAKEN",
  booking_post_410_quote_expired: "DOORSTEP_QUOTE_EXPIRED",
  booking_post_422_slot_unavailable: "DOORSTEP_SLOT_UNAVAILABLE",
  booking_reschedule_post_409: "DOORSTEP_RESCHEDULE_NOT_ALLOWED",
  catalogue_get_404_city: "DOORSTEP_CITY_NOT_FOUND",
  quote_post_422_addon_max: "DOORSTEP_ADDON_INVALID",
  quote_post_422_addon_min: "DOORSTEP_ADDON_INVALID",
  quote_post_422_option_invalid: "DOORSTEP_OPTION_INVALID",
  quote_post_422_outside_area: "DOORSTEP_OUTSIDE_SERVICE_AREA",
  quote_post_422_quantity: "DOORSTEP_QUANTITY_INVALID",
  slots_get_409_outstanding: "DOORSTEP_OUTSTANDING_DUE",
  realtime_token_post_404: "DOORSTEP_BOOKING_NOT_FOUND",
  booking_professionals_get_409: "DOORSTEP_INVALID_TRANSITION",
  booking_change_professional_409_window: "DOORSTEP_CHOICE_WINDOW_CLOSED",
  booking_change_professional_422_excluded: "DOORSTEP_SLOT_UNAVAILABLE",
  service_professionals_get_400_address: "DOORSTEP_INVALID_REQUEST",
  quote_post_400_pro_required: "DOORSTEP_INVALID_REQUEST",
  quote_post_422_price_unavailable: "DOORSTEP_PRICE_UNAVAILABLE",
}

/*
  PENDING: customer routes the web calls whose golden fixture doorstep-service
  has not produced yet (the visit, extras, rating, rework, safety, chat and
  realtime lanes, and GET /quotes/{id}). Their decoders are written from the
  OpenAPI schemas and exercised on hand-written samples (./samples.ts). The
  moment the backend lands one of these fixtures, the "pending fixture
  appeared" test fails until it is copied into ./contracts and moved into
  SUCCESS above.
*/
const PENDING: Record<string, { route: string; decode: Decoder; sample: unknown }> = {}

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
    const raw = { ...bookingRaw(), status: "teleported" }
    expect(() => decodeBooking(raw, STRICT)).toThrow(WireError)
    const history = { ...bookingRaw(), status_history: [{ from_status: "teleported", to_status: "confirmed", created_at: "2026-10-04T06:30:00Z" }] }
    expect(() => decodeBooking(history, STRICT)).toThrow(WireError)
  })

  it("the A3 keys (end_otp, photos, status_history, evidence_media_id) are required now", () => {
    for (const key of ["end_otp", "photos", "status_history"]) {
      const raw = bookingRaw()
      delete raw[key]
      expect(() => decodeBooking(raw, STRICT)).toThrow(WireError)
    }
    const extra: Record<string, unknown> = { ...S.extra }
    delete extra.evidence_media_id
    expect(() => decodeExtra(extra, STRICT)).toThrow(WireError)
    expect(decodeExtra({ ...S.extra, evidence_media_id: "9b3f0c55-0000-4000-8000-0000000000aa" }, STRICT).evidenceMediaId).toBe("9b3f0c55-0000-4000-8000-0000000000aa")
  })

  it("the checkout session tolerates a key it does not read, never a non-string or a missing provider/order/key", () => {
    const base = fixtureData("booking_payment_intent_post_200") as Record<string, unknown>
    const checkout = base.checkout as Record<string, string>
    const i = decodePaymentIntent({ ...base, checkout: { ...checkout, anything: "else" } }, STRICT)
    expect(i.checkout?.keyId).toBe("rzp_test_fixture")
    expect(() => decodePaymentIntent({ ...base, checkout: { ...checkout, amount: 224800 } }, STRICT)).toThrow(WireError)
    const { order_id: _dropped, ...noOrder } = checkout
    expect(() => decodePaymentIntent({ ...base, checkout: noOrder }, STRICT)).toThrow(WireError)
    expect(decodePaymentIntent({ ...base, checkout: {} }, STRICT).checkout).toBeNull()
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
    expect(s.options.find((o) => o.isDefault)?.suggestedPricePaise).toBe(129900)
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

  it("a booking's timeline is the server's status_history, oldest first", () => {
    const b = decodeBooking(fixtureData("booking_get_200"), STRICT)
    expect(b.statusHistory.map((h) => [h.fromStatus, h.toStatus])).toEqual([
      [null, "pending_payment"],
      ["pending_payment", "confirmed"],
    ])
    expect([b.endOtp, b.photos, b.startOtp]).toEqual([null, [], null])
    const cancelled = decodeBooking(fixtureData("booking_cancel_post_200"), STRICT)
    expect(cancelled.statusHistory.at(-1)?.toStatus).toBe("cancelled")
  })

  it("the booking answer carries the hold and a razorpay session (provider, order, key, merchant)", () => {
    const c = decodeBookingCreated(fixtureData("booking_post_201"), STRICT)
    expect(c.booking.status).toBe("pending_payment")
    expect(c.booking.holdExpiresAt).toBe("2026-10-04T06:40:00Z")
    expect(c.paymentIntent.checkout).toEqual({ provider: "razorpay", orderId: "order_FixtureDoorstep01", keyId: "rzp_test_fixture", merchantDisplayName: "Doorstep" })
    expect(c.paymentIntent.amountPaise).toBe(c.booking.totalPaise)
  })

  it("the outstanding refusal names the bills and the amount", () => {
    for (const name of ["booking_post_409_outstanding", "slots_get_409_outstanding"]) {
      expect(fixtureError(name).details).toEqual({ extras_bill_ids: ["0f262b76-512b-54cf-996c-ccdc2c15f897"], outstanding_paise: 45000 })
    }
  })
})
