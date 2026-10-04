/*
  The server's refusals, in the customer's words. Screens branch on
  error.code (never on the message); the server's own message is shown when
  there is no better line here.
*/

export interface Refusal {
  status: number
  code: string
  message: string
  fromServer: boolean
}

const LINES: Record<string, string> = {
  DOORSTEP_OUTSTANDING_DUE: "You have unpaid extras from an earlier visit. Pay them to book again.",
  DOORSTEP_SLOT_TAKEN: "That slot was just taken. Pick another one.",
  DOORSTEP_SLOT_UNAVAILABLE: "That slot can't be booked any more. Pick another one.",
  DOORSTEP_HOLD_EXPIRED: "Your 10-minute hold on the slot lapsed. Pick a slot again.",
  DOORSTEP_QUOTE_EXPIRED: "The price has expired. Go back to the service to get a fresh one.",
  DOORSTEP_OUTSIDE_SERVICE_AREA: "That address is outside the area we serve.",
  DOORSTEP_PAYMENTS_UNAVAILABLE: "Payments are unavailable right now. Try again in a few minutes.",
  DOORSTEP_PAYMENT_ALREADY_SETTLED: "This payment is already settled.",
  DOORSTEP_CANCEL_NOT_ALLOWED: "The job has started, so it can't be cancelled now.",
  DOORSTEP_RESCHEDULE_NOT_ALLOWED: "This booking can't be moved: it was moved once already, or the visit is less than 3 hours away.",
  DOORSTEP_RATING_EXISTS: "You've already rated this visit.",
  DOORSTEP_RATING_WINDOW_CLOSED: "Rating closes 7 days after the visit.",
  DOORSTEP_REWORK_WINDOW_CLOSED: "The window to ask for a redo has closed.",
  DOORSTEP_REWORK_EXISTS: "A redo has already been asked for this visit.",
  DOORSTEP_CHAT_CLOSED: "Chat is closed for this booking.",
  DOORSTEP_CITY_NOT_FOUND: "Doorstep isn't available in this city yet.",
}

/** True when the gateway hid Doorstep (pilot allowlist) or the route is not live yet. */
export function isNotOpen(e: Pick<Refusal, "status" | "code">): boolean {
  return e.status === 404 && !e.code.startsWith("DOORSTEP_")
}

export function refusalLine(e: Refusal): string {
  if (isNotOpen(e)) return "Doorstep isn't open for your account yet."
  return LINES[e.code] ?? (e.fromServer ? capitalise(e.message) : e.message)
}

function capitalise(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}
