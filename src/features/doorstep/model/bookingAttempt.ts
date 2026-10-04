/*
  One Idempotency-Key per booking decision, SAVED BEFORE the request.

  POST /v1/doorstep/bookings requires an Idempotency-Key (idempotent per
  customer). If the tab dies or the response is lost after the server held
  a professional and made the booking, a resend under the SAME key returns
  that booking instead of holding a second professional. So the key is read
  or minted and written to storage first, and only then is the call made.

    * no answer (network) keeps the key — the booking may exist;
    * a refusal (an answer with 4xx/5xx) clears it — the next try is a new
      decision with a new key;
    * success records the booking id, so "Book" again reuses that booking
      (and pays for it) and never makes another.

  A different quote, address, slot or woman-professional choice is a
  different decision: a new key.
*/

export interface AttemptStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const ATTEMPT_STORAGE_KEY = "doorstep.booking.attempt"

export interface BookingAttempt {
  key: string
  /** What the decision was: quote, address, slot, preference. */
  signature: string
  bookingId: string | null
  createdAt: number
}

export interface SignatureInput {
  quoteId: string
  addressId: string
  slotStart: string
  requireFemalePro: boolean
}

export function attemptSignature(input: SignatureInput): string {
  return [input.quoteId, input.addressId, input.slotStart, input.requireFemalePro ? "f" : "-"].join("|")
}

export function readAttempt(store: AttemptStore | null): BookingAttempt | null {
  if (!store) return null
  try {
    const raw = store.getItem(ATTEMPT_STORAGE_KEY)
    if (!raw) return null
    const a = JSON.parse(raw) as BookingAttempt
    return a && typeof a.key === "string" && a.key && typeof a.signature === "string" ? a : null
  } catch {
    return null
  }
}

function writeAttempt(store: AttemptStore | null, attempt: BookingAttempt): boolean {
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
  return `doorstep-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** The saved attempt for this decision, or a fresh one — written to storage before it is returned. */
export function attemptFor(store: AttemptStore | null, signature: string, mint: () => string = newKey, now: () => number = Date.now): BookingAttempt {
  const saved = readAttempt(store)
  if (saved && saved.signature === signature) return saved
  const fresh: BookingAttempt = { key: mint(), signature, bookingId: null, createdAt: now() }
  writeAttempt(store, fresh)
  return fresh
}

export type BookOutcome<T> =
  | { kind: "booked"; created: T; attempt: BookingAttempt }
  | { kind: "reused"; attempt: BookingAttempt }
  | { kind: "refused"; error: unknown }
  | { kind: "lost"; error: unknown }

/**
  Books under the saved key. `statusOf` answers the HTTP status of a thrown
  error (0 = no answer). When the attempt already has a booking this does NOT
  call `book`: the caller pays for that booking.
*/
export async function bookWithSavedKey<T extends { booking: { id: string } }>(
  store: AttemptStore | null,
  signature: string,
  book: (key: string) => Promise<T>,
  statusOf: (error: unknown) => number,
  mint: () => string = newKey,
): Promise<BookOutcome<T>> {
  const attempt = attemptFor(store, signature, mint)
  if (attempt.bookingId) return { kind: "reused", attempt }
  try {
    const created = await book(attempt.key)
    const done: BookingAttempt = { ...attempt, bookingId: created.booking.id }
    writeAttempt(store, done)
    return { kind: "booked", created, attempt: done }
  } catch (error) {
    if (statusOf(error) === 0) return { kind: "lost", error }
    clearAttempt(store)
    return { kind: "refused", error }
  }
}
