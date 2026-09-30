import { describe, expect, test } from "bun:test"

import {
  razorpayOptions,
  readingFromLegacyStatus,
  readingFromPayment,
  showsStubButton,
  stubConfirmBody,
  toPaymentIntent,
  type WireOrderPayment,
  type WirePaymentIntent,
  type WirePaymentStatus,
} from "@/features/shop/model/payments"
import { afterWait, applyReading, initialPollState, nextStep } from "@/features/shop/orders/paymentPoll"

import { hasFixture, readBackendFixture, readFixture, readLocalFixtureText } from "./contractFixtures"

/*
  payment/ fixtures (lane C1):
    payment_intent_post_201_razorpay, payment_intent_post_201_stub,
    order_payment_get_200_confirming, order_payment_get_200_paid,
    order_payment_get_200_paid_refund_pending, order_payment_get_200_failed,
    payment_status_get_200
*/
const AREA = "payment"

const only = (name: string) => (hasFixture(AREA, name) ? test : test.skip)

describe("payment fixtures parse through the mappers", () => {
  only("payment_intent_post_201_razorpay")("payment_intent_post_201_razorpay: Razorpay opens from client_session alone", () => {
    const { data } = readFixture<WirePaymentIntent>(AREA, "payment_intent_post_201_razorpay")
    expect(data.client_session?.provider).toBe("razorpay")
    const intent = toPaymentIntent(data)
    expect(intent.provider).toBe("razorpay")
    expect(showsStubButton(intent)).toBe(false)
    const options = razorpayOptions(intent, { orderNumber: "X" })
    expect(options.key).toBe(data.client_session!.key_id!)
    expect(options.order_id).toBe(data.client_session!.order_id!)
    expect(options.amount).toBe(data.amount_minor)
    expect(options.name).toBe(data.client_session!.merchant_display_name!)
  })

  only("payment_intent_post_201_stub")("payment_intent_post_201_stub: the stub button, and the confirm body", () => {
    const { data } = readFixture<WirePaymentIntent>(AREA, "payment_intent_post_201_stub")
    const intent = toPaymentIntent(data)
    expect(intent.provider).toBe("stub")
    expect(showsStubButton(intent)).toBe(true)
    const body = stubConfirmBody(intent, () => 1)
    expect(body.gateway).toBe("stub")
    expect(body.payment_intent_id).toBe(data.payment_intent_id)
    expect(body.amount_minor).toBe(data.amount_minor)
  })

  only("payment_status_get_200")("payment_status_get_200: the legacy shape derives a reading", () => {
    const { data } = readFixture<WirePaymentStatus>(AREA, "payment_status_get_200")
    expect(Object.keys(data)).toEqual(expect.arrayContaining(["order_id", "order_status", "payment_status"]))
    expect(["confirming", "paid", "failed"]).toContain(readingFromLegacyStatus(data).state)
  })
})

describe("the poll reducer, table-tested against order_payment_get_200_*", () => {
  const table: Array<{ name: string; phase: string; refund: string }> = [
    { name: "order_payment_get_200_confirming", phase: "confirming", refund: "" },
    { name: "order_payment_get_200_paid", phase: "paid", refund: "" },
    { name: "order_payment_get_200_paid_refund_pending", phase: "paid", refund: "pending" },
    { name: "order_payment_get_200_failed", phase: "failed", refund: "" },
  ]
  for (const row of table) {
    only(row.name)(`${row.name} → ${row.phase}${row.refund ? ` (${row.refund})` : ""}`, () => {
      const { data } = readFixture<WireOrderPayment>(AREA, row.name)
      expect(Object.keys(data).sort()).toEqual(["amount_minor", "currency", "order_id", "refund_status", "status", "updated_at"])
      const reading = readingFromPayment(data)
      const step = nextStep(initialPollState, true)!
      const state = applyReading(afterWait(initialPollState, step.delayMs), reading)
      expect(state.phase).toBe(row.phase as never)
      expect(state.refundStatus).toBe(row.refund as never)
      expect(nextStep(state, true) === null).toBe(row.phase !== "confirming")
    })
  }
})

describe("payment fixtures are byte-identical to the backend's", () => {
  for (const name of [
    "payment_intent_post_201_razorpay",
    "payment_intent_post_201_stub",
    "order_payment_get_200_confirming",
    "order_payment_get_200_paid",
    "order_payment_get_200_paid_refund_pending",
    "order_payment_get_200_failed",
    "payment_status_get_200",
  ]) {
    const backend = hasFixture(AREA, name) ? readBackendFixture(AREA, name) : null
    ;(backend === null ? test.skip : test)(name, () => {
      expect(readLocalFixtureText(AREA, name)).toBe(backend as string)
    })
  }
})
