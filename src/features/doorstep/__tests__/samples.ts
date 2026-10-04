/*
  HAND-WRITTEN samples for the routes that have no golden fixture yet, built
  from contracts/doorstep/openapi.yaml (components.schemas), every key
  present, nulls explicit. They are NOT golden bytes: each one is replaced by
  the backend's fixture when its lane lands it (see PENDING in
  contracts.test.ts). Ids reuse the dev seed's where they exist.
*/

const SERVICE_KITCHEN = "492b816e-df2d-5545-b150-b9b8889c7dde"
const ZONE = "ab4daa10-2d55-51d8-ac2a-f7ca4179e957"
export const BOOKING_ID = "9b3f0c55-0000-4000-8000-000000000001"
const ADDRESS_ID = "9b3f0c55-0000-4000-8000-0000000000a1"
const PAYMENT_ID = "9b3f0c55-0000-4000-8000-0000000000b1"
export const BILL_ID = "9b3f0c55-0000-4000-8000-0000000000c1"

export const address = {
  id: ADDRESS_ID,
  label: "Home",
  line1: "Flat 402, Lakeview Towers",
  line2: null,
  landmark: "Opposite the metro pillar 1210",
  locality: "Gachibowli",
  city_code: "HYD",
  pincode: "500032",
  lat: 17.4401,
  lng: 78.3489,
  zone_id: ZONE,
  is_default: true,
  created_at: "2026-10-04T06:00:00Z",
}

export const addressList = { items: [address] }

export const slotDays = {
  timezone: "Asia/Kolkata",
  days: [
    {
      date: "2026-10-04",
      slots: [
        { start: "2026-10-04T08:30:00Z", end: "2026-10-04T12:00:00Z", available: false },
        { start: "2026-10-04T09:30:00Z", end: "2026-10-04T13:00:00Z", available: true },
      ],
    },
    { date: "2026-10-05", slots: [{ start: "2026-10-05T03:30:00Z", end: "2026-10-05T07:00:00Z", available: true }] },
    { date: "2026-10-06", slots: [{ start: "2026-10-06T03:30:00Z", end: "2026-10-06T07:00:00Z", available: false }] },
  ],
}

const line = {
  kind: "option",
  ref_id: "f91f4284-19ac-5411-8a29-84dc6de87a3a",
  price_id: "4207afbe-8d3d-5dbf-8d92-208db40bfc18",
  name: "Kitchen deep cleaning - Occupied kitchen",
  quantity: 1,
  unit_price_paise: 179900,
  line_total_paise: 179900,
  taxable_paise: 152457,
  tax_paise: 27443,
  tax_rate_bps: 1800,
  gst_category: "HOME_CLEANING_VIA_ECO",
  sac: "998533",
}

export const booking = {
  id: BOOKING_ID,
  status: "assigned",
  service_id: SERVICE_KITCHEN,
  service_name: "Kitchen deep cleaning",
  category_slug: "home-cleaning",
  city_code: "HYD",
  zone_id: ZONE,
  slot_start: "2026-10-04T09:30:00Z",
  slot_end: "2026-10-04T13:00:00Z",
  duration_minutes: 210,
  require_female_pro: false,
  items: [line],
  total_paise: 179900,
  taxable_paise: 152457,
  tax_paise: 27443,
  paid_paise: 179900,
  refunded_paise: 0,
  cancellation_fee_paise: 0,
  extras_total_paise: 0,
  outstanding_paise: 0,
  hold_expires_at: null,
  address,
  professional: { first_name: "Lakshmi", photo_media_id: null, rating_avg: 4.8, jobs_completed: 132 },
  parent_booking_id: null,
  start_otp: "4821",
  can_cancel: true,
  can_reschedule: true,
  created_at: "2026-10-04T06:30:00Z",
  updated_at: "2026-10-04T06:40:00Z",
}

const intent = {
  payment_id: PAYMENT_ID,
  reference_type: "doorstep_booking",
  reference_id: BOOKING_ID,
  amount_paise: 179900,
  status: "created",
  checkout: { provider: "razorpay", order_id: "order_Doorstep01", key_id: "rzp_test_Sample01", merchant_display_name: "Doorstep" },
}

export const bookingCreated = {
  booking: { ...booking, status: "pending_payment", paid_paise: 0, professional: null, start_otp: null, hold_expires_at: "2026-10-04T06:40:00Z" },
  payment_intent: intent,
}

export const paymentIntent = intent

export const bookingPage = {
  items: [
    {
      id: BOOKING_ID,
      status: "assigned",
      service_name: "Kitchen deep cleaning",
      category_slug: "home-cleaning",
      slot_start: "2026-10-04T09:30:00Z",
      slot_end: "2026-10-04T13:00:00Z",
      total_paise: 179900,
      created_at: "2026-10-04T06:30:00Z",
    },
  ],
  next_cursor: null,
}

export const cancelPreview = { allowed: true, fee_paise: 7500, refund_paise: 172400, rule: "lt_3h" }

export const bookingPayments = {
  payments: [{ ...intent, status: "succeeded", checkout: {} }],
  refunds: [],
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
