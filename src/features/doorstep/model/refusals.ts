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
  /** error.details when the server sent them (reason, field, item_ids…). */
  details?: Record<string, unknown> | null
}

const LINES: Record<string, string> = {
  DOORSTEP_OUTSTANDING_DUE: "You have unpaid extras from an earlier visit. Pay them to book again.",
  DOORSTEP_SLOT_TAKEN: "This professional was just booked for that time. Pick again.",
  DOORSTEP_SLOT_UNAVAILABLE: "That time can't be booked any more. Pick another one.",
  DOORSTEP_HOLD_EXPIRED: "The hold on your professional lapsed. Pick again.",
  DOORSTEP_PRICE_UNAVAILABLE: "This professional's price for part of your choice has changed or been withdrawn. Pick again from the list.",
  DOORSTEP_SKILL_REQUIRED: "This professional doesn't offer this service any more. Pick another one.",
  DOORSTEP_CHOICE_WINDOW_CLOSED: "The 30 minutes to pick another professional are over. This booking is being cancelled and everything you paid will be refunded.",
  DOORSTEP_INVALID_TRANSITION: "This booking has moved on. Here is where it stands now.",
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

/** DOORSTEP_SLOT_UNAVAILABLE's details.reason, in words (B1 adds the professional-specific ones). */
const SLOT_REASONS: Record<string, string> = {
  professional_excluded: "That professional can't take this booking. Pick someone else.",
  professional_unavailable: "That professional is no longer free then. Pick another time or professional.",
  not_available_now: "That professional isn't available right now. Pick a time instead.",
  no_professional: "Nobody is free then any more. Pick another time.",
  inside_lead_time: "That time is too soon to book. Pick a later one.",
  beyond_horizon: "That time is too far ahead to book yet.",
}

function detail(e: Refusal, key: string): string | null {
  const v = e.details?.[key]
  return typeof v === "string" ? v : null
}

export function refusalLine(e: Refusal): string {
  if (isNotOpen(e)) return "Doorstep isn't open for your account yet."
  if (e.code === "DOORSTEP_SLOT_UNAVAILABLE") {
    const reason = detail(e, "reason")
    if (reason && SLOT_REASONS[reason]) return SLOT_REASONS[reason]
  }
  if (e.code === "DOORSTEP_INVALID_REQUEST" && detail(e, "field") === "pro_id") return "Pick a professional first."
  if (e.code === "DOORSTEP_SERVICE_NOT_AVAILABLE") return "This service can't be booked here yet."
  return LINES[e.code] ?? (e.fromServer ? capitalise(e.message) : e.message)
}

function capitalise(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}
