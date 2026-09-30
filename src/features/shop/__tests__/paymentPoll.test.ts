import { describe, expect, it } from "bun:test"

import { readingFromLegacyStatus, readingFromPayment, type PaymentReading } from "@/features/shop/model/payments"
import {
  afterWait,
  applyReadError,
  applyReading,
  delayForRead,
  fullSchedule,
  initialPollState,
  isPermanentStatus,
  isTerminal,
  nextStep,
  POLL_TIMEOUT_MS,
  type PollState,
} from "@/features/shop/orders/paymentPoll"

const confirming: PaymentReading = { state: "confirming", refundStatus: "" }
const paid: PaymentReading = { state: "paid", refundStatus: "" }
const failed: PaymentReading = { state: "failed", refundStatus: "" }

/** Take the next step and read `reading`. */
function tick(state: PollState, reading: PaymentReading): PollState {
  const step = nextStep(state, true)
  if (!step) throw new Error("no step scheduled")
  return applyReading(afterWait(state, step.delayMs), reading)
}

describe("the schedule", () => {
  it("is 1, 2, 3, 4 s then every 5 s", () => {
    expect([0, 1, 2, 3, 4, 5, 40].map(delayForRead)).toEqual([1000, 2000, 3000, 4000, 5000, 5000, 5000])
    const delays = fullSchedule()
    expect(delays.slice(0, 6)).toEqual([1000, 2000, 3000, 4000, 5000, 5000])
    expect(new Set(delays.slice(4))).toEqual(new Set([5000]))
  })
  it("adds up to exactly 180 s and then gives up as timed_out, never overshooting", () => {
    const delays = fullSchedule()
    expect(delays.reduce((a, b) => a + b, 0)).toBe(POLL_TIMEOUT_MS)
    expect(delays.length).toBe(38)
    let state = initialPollState
    for (let i = 0; i < 38; i++) state = tick(state, confirming)
    expect(state.phase).toBe("timed_out")
    expect(state.elapsedMs).toBe(POLL_TIMEOUT_MS)
    expect(nextStep(state, true)).toBeNull()
  })
  it("keeps confirming when a read says so", () => {
    const state = tick(initialPollState, confirming)
    expect(state.phase).toBe("confirming")
    expect(state.reads).toBe(1)
    expect(nextStep(state, true)).toEqual({ delayMs: 2000 })
  })
})

describe("stop conditions", () => {
  it("paid stops", () => {
    const state = tick(tick(initialPollState, confirming), paid)
    expect(state.phase).toBe("paid")
    expect(isTerminal(state)).toBe(true)
    expect(nextStep(state, true)).toBeNull()
  })
  it("failed stops", () => {
    const state = tick(initialPollState, failed)
    expect(state.phase).toBe("failed")
    expect(nextStep(state, true)).toBeNull()
  })
  it("carries the refund status with a paid reading", () => {
    const state = tick(initialPollState, { state: "paid", refundStatus: "pending" })
    expect(state.phase).toBe("paid")
    expect(state.refundStatus).toBe("pending")
  })
  it("a permanent 4xx stops (ORDER_NOT_FOUND 404, 403), remembering which", () => {
    for (const status of [400, 403, 404, 410]) {
      const state = applyReadError(afterWait(initialPollState, 1000), status)
      expect(state.phase).toBe("stopped")
      expect(state.stoppedByStatus).toBe(status)
      expect(nextStep(state, true)).toBeNull()
    }
  })
  it("a 5xx, a network error or a 429 does not: the poll continues on schedule", () => {
    for (const status of [500, 502, 503, 0, 429, 408]) {
      const state = applyReadError(afterWait(initialPollState, 1000), status)
      expect(state.phase).toBe("confirming")
      expect(nextStep(state, true)).toEqual({ delayMs: 2000 })
    }
    expect(isPermanentStatus(429)).toBe(false)
    expect(isPermanentStatus(404)).toBe(true)
  })
  it("a hidden tab schedules nothing, and the same state resumes when shown", () => {
    const state = tick(initialPollState, confirming)
    expect(nextStep(state, false)).toBeNull()
    expect(nextStep(state, true)).toEqual({ delayMs: 2000 })
  })
  it("the timeout is decided before another wait is taken", () => {
    const nearly: PollState = { ...initialPollState, elapsedMs: POLL_TIMEOUT_MS - 1, reads: 30 }
    expect(nextStep(nearly, true)).toEqual({ delayMs: 5000 })
    const done = applyReading(afterWait(nearly, 5000), confirming)
    expect(done.phase).toBe("timed_out")
    const at: PollState = { ...initialPollState, elapsedMs: POLL_TIMEOUT_MS, reads: 38 }
    expect(nextStep(at, true)).toBeNull()
  })
})

describe("the readings", () => {
  const base = { order_id: "o", amount_minor: 25000, currency: "INR", refund_status: null, updated_at: "2026-09-13T06:31:05Z" }
  it("three-state route: confirming | paid | failed, refund_status carried", () => {
    expect(readingFromPayment({ ...base, status: "confirming" })).toEqual(confirming)
    expect(readingFromPayment({ ...base, status: "paid" })).toEqual(paid)
    expect(readingFromPayment({ ...base, status: "failed" })).toEqual(failed)
    expect(readingFromPayment({ ...base, status: "paid", refund_status: "pending" })).toEqual({ state: "paid", refundStatus: "pending" })
    expect(readingFromPayment({ ...base, status: "weird" })).toEqual(confirming)
  })
  it("legacy route: paid from payment_status only; failed from payment_status failed or a dead order", () => {
    expect(readingFromLegacyStatus({ order_id: "o", order_status: "confirmed", payment_status: "paid" })).toEqual(paid)
    expect(readingFromLegacyStatus({ order_id: "o", order_status: "payment_failed", payment_status: "failed" })).toEqual(failed)
    expect(readingFromLegacyStatus({ order_id: "o", order_status: "cancelled", payment_status: "pending" })).toEqual(failed)
    expect(readingFromLegacyStatus({ order_id: "o", order_status: "expired", payment_status: "pending" })).toEqual(failed)
    expect(readingFromLegacyStatus({ order_id: "o", order_status: "payment_pending", payment_status: "pending" })).toEqual(confirming)
    // A provider "captured" is not paid until the order says so.
    expect(readingFromLegacyStatus({ order_id: "o", order_status: "payment_pending", payment_status: "pending", provider_status: "captured" })).toEqual(confirming)
  })
})
