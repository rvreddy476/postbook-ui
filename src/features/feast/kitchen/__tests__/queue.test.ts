import { describe, expect, test } from "bun:test"

import { createActionKeys } from "../model/actionKeys"
import { kitchenMessage, toFailure } from "../model/errors"
import { normalisePickupCode, REJECT_REASONS } from "../model/orders"
import { shouldRing } from "../hooks/useOrderAlert"
import { axiosError } from "./fixtures"

describe("idempotency keys per (order, action)", () => {
  const counter = () => {
    let n = 0
    return () => `k${++n}`
  }
  test("a retry after an unknown outcome reuses the key", () => {
    const keys = createActionKeys(counter())
    const first = keys.keyFor("o1", "accept")
    keys.settle("o1", "accept", true)
    expect(keys.keyFor("o1", "accept")).toBe(first)
  })
  test("a definite answer retires the key", () => {
    const keys = createActionKeys(counter())
    const first = keys.keyFor("o1", "accept")
    keys.settle("o1", "accept", false)
    expect(keys.keyFor("o1", "accept")).not.toBe(first)
  })
  test("different actions and orders never share a key", () => {
    const keys = createActionKeys(counter())
    const a = keys.keyFor("o1", "accept")
    expect(keys.keyFor("o1", "reject")).not.toBe(a)
    expect(keys.keyFor("o2", "accept")).not.toBe(a)
  })
})

describe("new-order sound", () => {
  test("never before the user's gesture", () => {
    expect(shouldRing({ unlocked: false, muted: false, unacknowledged: 3 })).toBe(false)
  })
  test("loops while an order is unacknowledged, silent when muted or none", () => {
    expect(shouldRing({ unlocked: true, muted: false, unacknowledged: 1 })).toBe(true)
    expect(shouldRing({ unlocked: true, muted: true, unacknowledged: 1 })).toBe(false)
    expect(shouldRing({ unlocked: true, muted: false, unacknowledged: 0 })).toBe(false)
  })
})

describe("transition and pickup refusals", () => {
  test("FSSAI and not-live 422s read as plain reasons", () => {
    expect(kitchenMessage(toFailure(axiosError(422, "accepting_patch_422_fssai_required")))).toContain("FSSAI")
    expect(kitchenMessage(toFailure(axiosError(422, "accepting_patch_422_not_live")))).toContain("approves")
  })
  test("pickup before a rider has the order, and lockout", () => {
    expect(kitchenMessage(toFailure(axiosError(409, "partner_verify_pickup_post_409_not_accepted")))).toContain("No rider")
    expect(kitchenMessage(toFailure(axiosError(429, "partner_verify_pickup_post_429_attempts_exceeded")))).toContain("Too many")
  })
  test("pickup code input keeps letters and digits only", () => {
    expect(normalisePickupCode(" 12-34 ab ")).toBe("1234AB")
    expect(normalisePickupCode("123456789")).toBe("12345678")
  })
  test("reject reasons are alphabetical", () => {
    expect([...REJECT_REASONS]).toEqual([...REJECT_REASONS].sort((a, b) => a.localeCompare(b)))
  })
})
