/*
  Server refusals, read once. food-service answers
  `{error: {code, message, details?}}`; the console shows the server's own
  message for a 422 (field validation is the server's job) and maps the
  handful of codes whose generic text would mislead a kitchen.
*/

import { ContractError } from "./decode"

export interface ApiFailure {
  /** 0 when nothing came back (network, CORS, abort). */
  status: number
  code: string
  message: string
  field: string | null
  missing: string[] | null
  /** True when the request may have committed: retry with the SAME idempotency key. */
  outcomeUnknown: boolean
}

interface AxiosLike {
  response?: { status?: number; data?: unknown }
  message?: string
  code?: string
}

export function toFailure(err: unknown): ApiFailure {
  if (err instanceof ContractError) {
    return { status: 200, code: "CONTRACT", message: "The server sent an answer this page can't read.", field: null, missing: null, outcomeUnknown: false }
  }
  const e = (err ?? {}) as AxiosLike
  const status = e.response?.status ?? 0
  if (!status) {
    return { status: 0, code: "NETWORK", message: "No answer from the server. Check the connection and try again.", field: null, missing: null, outcomeUnknown: true }
  }
  const body = e.response?.data
  const errObj = typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined
  let code = `HTTP_${status}`
  let message = status >= 500 ? "Something went wrong on our side. Try again." : "The request was refused."
  let field: string | null = null
  let missing: string[] | null = null
  if (typeof errObj === "object" && errObj !== null) {
    const x = errObj as { code?: unknown; message?: unknown; details?: unknown }
    if (typeof x.code === "string" && x.code) code = x.code
    if (typeof x.message === "string" && x.message) message = x.message
    if (typeof x.details === "object" && x.details !== null) {
      const d = x.details as { field?: unknown; missing?: unknown }
      if (typeof d.field === "string") field = d.field
      if (Array.isArray(d.missing) && d.missing.every((m) => typeof m === "string")) missing = d.missing as string[]
    }
  }
  return { status, code, message, field, missing, outcomeUnknown: status >= 500 && status !== 503 }
}


/** Messages for codes where the server's text is not what a kitchen needs to read. */
const KITCHEN_COPY: Readonly<Record<string, string>> = {
  FOOD_ORDER_TRANSITION_NOT_ALLOWED: "This order has already moved on. Refreshing.",
  FOOD_ORDER_STATUS_CONFLICT: "This order has already moved on. Refreshing.",
  IDEMPOTENCY_KEY_REQUIRED: "The request was missing its safety key. Reload the page and try again.",
  FOOD_DELIVERY_ASSIGNMENT_NOT_READY: "No rider has this order yet. Wait for the rider to arrive.",
  FOOD_PICKUP_CODE_ATTEMPTS_EXCEEDED: "Too many wrong codes for this order. Contact Feast support to hand it over.",
  PICKUP_VERIFY_FAILED: "That code doesn't match. Ask the rider to read it again.",
  FOOD_FSSAI_REQUIRED: "You can take orders once your FSSAI licence is approved and in date.",
  FOOD_RESTAURANT_NOT_LIVE: "You can take orders once Feast approves your restaurant.",
  FOOD_RESTAURANT_NOT_DRAFT: "This restaurant is already submitted. Wait for the review.",
  FOOD_RESTAURANT_NOT_READY: "Finish every step below before submitting.",
  PII_NOT_CONFIGURED: "Identity and bank details can't be accepted right now. Try again later.",
  FOOD_REALTIME_NOT_CONFIGURED: "Live updates are off; the queue refreshes every 15 seconds.",
  FOOD_NOT_FOUND: "That isn't available to this account.",
}

export function kitchenMessage(f: ApiFailure): string {
  return KITCHEN_COPY[f.code] ?? f.message
}

/** A transition refusal that means "refetch, the order moved". */
export function isStaleTransition(f: ApiFailure): boolean {
  return f.code === "FOOD_ORDER_TRANSITION_NOT_ALLOWED" || f.code === "FOOD_ORDER_STATUS_CONFLICT"
}
