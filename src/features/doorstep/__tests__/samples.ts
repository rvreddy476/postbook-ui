/*
  HAND-WRITTEN samples for the routes that still have no golden fixture (the
  visit, extras, rating, rework, safety, chat and realtime lanes), built from
  contracts/doorstep/openapi.yaml (components.schemas), every key present,
  nulls explicit. They are NOT golden bytes: each one is replaced by the
  backend's fixture when its lane lands it (see PENDING in
  contracts.test.ts). Ids reuse the A3 fixtures' (the dev seed's) where they
  exist; everything the A3 fixtures cover is read from ./contracts instead.
*/

import { fixtureData } from "./fixtures"

/** booking_get_200's booking (the dev seed's id). */
export const BOOKING_ID = "b5dbe726-3083-5696-8af3-e63f4620137e"
/** The extras bill booking_post_409_outstanding names. */
export const BILL_ID = "0f262b76-512b-54cf-996c-ccdc2c15f897"

/** The booking payment intent's golden bytes, re-pointed at an extras bill (no extras-intent fixture yet). */
export const extrasPaymentIntent = {
  ...(fixtureData("booking_payment_intent_post_200") as Record<string, unknown>),
  reference_type: "doorstep_extras",
  reference_id: BILL_ID,
}

export const extra = {
  id: "9b3f0c55-0000-4000-8000-0000000000e1",
  booking_id: BOOKING_ID,
  kind: "rate_card",
  rate_card_id: "9b3f0c55-0000-4000-8000-0000000000f1",
  addon_id: null,
  name: "Sink trap replacement",
  quantity: 1,
  unit_price_paise: 34900,
  total_paise: 34900,
  status: "proposed",
  evidence_media_id: null,
  created_at: "2026-10-04T10:10:00Z",
}

export const extraList = { items: [extra] }

export const extrasBill = {
  id: BILL_ID,
  booking_id: BOOKING_ID,
  amount_paise: 34900,
  taxable_paise: 29576,
  tax_paise: 5324,
  status: "open",
  due_at: null,
  paid_at: null,
}

export const outstanding = { total_paise: 34900, bills: [{ ...extrasBill, status: "outstanding", due_at: "2026-10-04T13:15:00Z" }] }

export const rating = {
  id: "9b3f0c55-0000-4000-8000-0000000000d1",
  booking_id: BOOKING_ID,
  rater_kind: "customer",
  stars: 5,
  tags: ["On time"],
  comment: null,
  hidden: false,
  created_at: "2026-10-04T14:00:00Z",
}

export const rework = {
  id: "9b3f0c55-0000-4000-8000-0000000000d2",
  booking_id: BOOKING_ID,
  child_booking_id: null,
  status: "requested",
  reason: "Grease left behind the hob",
  created_at: "2026-10-05T08:00:00Z",
}

export const reworkList = { items: [rework] }

export const incident = {
  id: "9b3f0c55-0000-4000-8000-0000000000d3",
  booking_id: BOOKING_ID,
  raised_by_kind: "customer",
  kind: "sos",
  severity: "critical",
  status: "open",
  description: null,
  pro_auto_suspended: false,
  created_at: "2026-10-04T10:00:00Z",
}

export const shareToken = { token: "shr_sample", url: "https://atpost.app/doorstep/share/shr_sample", expires_at: "2026-10-04T15:00:00Z" }

export const trustedContact = { name: "Ravi", phone_masked: "******4321", updated_at: "2026-10-01T10:00:00Z" }

export const message = {
  id: "9b3f0c55-0000-4000-8000-0000000000d4",
  booking_id: BOOKING_ID,
  sender_kind: "pro",
  body: "I'm at the gate.",
  created_at: "2026-10-04T09:25:00Z",
  read_at: null,
}

export const messagePage = { items: [message], next_cursor: null, open: true }

export const realtimeToken = { token: "rt_sample", topics: [`doorstep.booking.${BOOKING_ID}`], expires_at: "2026-10-04T06:35:00Z" }
