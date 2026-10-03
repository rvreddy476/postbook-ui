/*
  One Idempotency-Key per customer decision, SAVED BEFORE the request.

  POST /v1/food/orders requires an Idempotency-Key. If the tab dies or the
  response is lost after the server made the order, a resend under the SAME
  key returns that order instead of making a second one. So the key is read
  or minted and written to storage first, and only then is the call made.

    * a network failure (no answer) keeps the key — the order may exist;
    * a refusal (4xx/5xx with an answer) clears it — the next try is a new
      decision with a new key;
    * success records the order id, so "Pay" again reuses that order and
      never places another.

  A different cart, address or method is a different decision: new key.
*/

export interface AttemptStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const ATTEMPT_STORAGE_KEY = "feast.checkout.attempt"

export interface CheckoutAttempt {
  key: string
  /** What the decision was: cart, address and method. */
  signature: string
  orderId: string | null
  orderNumber: string | null
  createdAt: number
}

export interface SignatureInput {
  cartId: string
  items: { id: string; quantity: number }[]
  finalAmountPaise: number | null
  addressId: string
  method: string
}

export function attemptSignature(input: SignatureInput): string {
  const lines = input.items.map((i) => `${i.id}x${i.quantity}`).sort().join(",")
  return [input.cartId, lines, input.finalAmountPaise ?? "", input.addressId, input.method].join("|")
}

export function readAttempt(store: AttemptStore | null): CheckoutAttempt | null {
  if (!store) return null
  try {
    const raw = store.getItem(ATTEMPT_STORAGE_KEY)
    if (!raw) return null
    const a = JSON.parse(raw) as CheckoutAttempt
    return a && typeof a.key === "string" && a.key && typeof a.signature === "string" ? a : null
  } catch {
    return null
  }
}

function writeAttempt(store: AttemptStore | null, attempt: CheckoutAttempt): boolean {
  if (!store) return false
  try {
    store.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(attempt))
    return true
  } catch {
    return false
  }
}

export function clearAttempt(store: AttemptStore | null): void {
  if (!store) return
  try {
    store.removeItem(ATTEMPT_STORAGE_KEY)
  } catch {
    /* nothing to clear */
  }
}

export function newKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return `feast-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** The saved attempt for this decision, or a fresh one — written to storage before it is returned. */
export function attemptFor(store: AttemptStore | null, signature: string, mint: () => string = newKey, now: () => number = Date.now): CheckoutAttempt {
  const saved = readAttempt(store)
  if (saved && saved.signature === signature) return saved
  const fresh: CheckoutAttempt = { key: mint(), signature, orderId: null, orderNumber: null, createdAt: now() }
  writeAttempt(store, fresh)
  return fresh
}

export type PlaceOutcome<T> =
  | { kind: "placed"; order: T; attempt: CheckoutAttempt }
  | { kind: "reused"; attempt: CheckoutAttempt }
  | { kind: "refused"; error: unknown }
  | { kind: "lost"; error: unknown }

/**
  Places the order under the saved key. `statusOf` answers the HTTP status of
  a thrown error (0 = no answer). When the attempt already has an order this
  does NOT call `place`: the caller pays for that order.
*/
export async function placeWithSavedKey<T extends { id: string; orderNumber: string }>(
  store: AttemptStore | null,
  signature: string,
  place: (key: string) => Promise<T>,
  statusOf: (error: unknown) => number,
  mint: () => string = newKey,
): Promise<PlaceOutcome<T>> {
  const attempt = attemptFor(store, signature, mint)
  if (attempt.orderId) return { kind: "reused", attempt }
  try {
    const order = await place(attempt.key)
    const done: CheckoutAttempt = { ...attempt, orderId: order.id, orderNumber: order.orderNumber }
    writeAttempt(store, done)
    return { kind: "placed", order, attempt: done }
  } catch (error) {
    if (statusOf(error) === 0) return { kind: "lost", error }
    clearAttempt(store)
    return { kind: "refused", error }
  }
}
