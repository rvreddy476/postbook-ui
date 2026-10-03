/*
  The onboarding checklist, built ONLY from the server's `missing[]`
  (GET …/readiness, or the 422 FOOD_RESTAURANT_NOT_READY details). Saving a
  step never ticks it: the server is the only judge of readiness.

  Order is food-service's presentation order (onboarding.Step* constants):
  location, state, operating_hours, compliance, fssai_document,
  payout_account, menu_item. Fails closed: a code this build does not know
  keeps the checklist not-ready and is listed as "something else is needed".
*/

export const ONBOARDING_STEPS = [
  "location",
  "state",
  "operating_hours",
  "compliance",
  "fssai_document",
  "payout_account",
  "menu_item",
] as const

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

/** The panel that completes a step. `state` is set on the location panel. */
export type StepPanel = "location" | "hours" | "compliance" | "fssai" | "payout" | "menu"

export const STEP_COPY: Readonly<Record<OnboardingStep, { title: string; detail: string; panel: StepPanel }>> = {
  location: { title: "Restaurant location", detail: "Pin, address and how far you deliver", panel: "location" },
  state: { title: "State", detail: "The state your kitchen is registered in, for GST", panel: "location" },
  operating_hours: { title: "Opening hours", detail: "When you take orders, in India time", panel: "hours" },
  compliance: { title: "Tax details", detail: "Tax category, PAN and GSTIN", panel: "compliance" },
  fssai_document: { title: "FSSAI licence", detail: "Licence number, expiry and a photo", panel: "fssai" },
  payout_account: { title: "Bank account", detail: "Where your earnings are paid", panel: "payout" },
  menu_item: { title: "Menu", detail: "At least one dish customers can order", panel: "menu" },
}

export interface ChecklistRow {
  step: OnboardingStep
  done: boolean
}

export interface Checklist {
  rows: ChecklistRow[]
  /** Codes the server named that this build has no row for. */
  unrecognised: string[]
  ready: boolean
  /** The first step still to do, in presentation order. */
  next: OnboardingStep | null
  remaining: number
}

function isStep(code: string): code is OnboardingStep {
  return (ONBOARDING_STEPS as readonly string[]).includes(code)
}

export function checklistFromMissing(missing: readonly string[]): Checklist {
  const known = new Set(missing.filter(isStep))
  const rows = ONBOARDING_STEPS.map((step) => ({ step, done: !known.has(step) }))
  const unrecognised = [...new Set(missing.filter((c) => !isStep(c)))]
  const todo = rows.filter((r) => !r.done)
  return {
    rows,
    unrecognised,
    ready: todo.length === 0 && unrecognised.length === 0,
    next: todo[0]?.step ?? null,
    remaining: todo.length + unrecognised.length,
  }
}

/** Restaurant statuses as a partner reads them. */
export function restaurantStatusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Setting up"
    case "PENDING_REVIEW":
      return "In review"
    case "ACTIVE":
      return "Live"
    case "REJECTED":
      return "Changes needed"
    case "SUSPENDED":
      return "Paused by Feast"
    default:
      return humanise(status)
  }
}

export type Tone = "neutral" | "positive" | "warning" | "danger"

export function restaurantStatusTone(status: string): Tone {
  if (status === "ACTIVE") return "positive"
  if (status === "PENDING_REVIEW") return "warning"
  if (status === "REJECTED" || status === "SUSPENDED") return "danger"
  return "neutral"
}

/** Submit is offered from DRAFT and REJECTED only (FOOD_RESTAURANT_NOT_DRAFT otherwise). */
export function canSubmitFrom(status: string): boolean {
  return status === "DRAFT" || status === "REJECTED"
}

export function humanise(code: string): string {
  const s = code.replace(/_/g, " ").toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}
