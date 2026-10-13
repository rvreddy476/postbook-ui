"use client"
import { AlertCircle } from "lucide-react"
import { PARTNER_STEPS, type Readiness, type StepCode } from "./model"

export type SetupState = "complete" | "saved" | "review" | "needed"
export function PartnerSetupNotice({ readiness, states, onReview }: { readiness: Readiness; states: Record<StepCode, SetupState>; onReview: () => void }) {
  if (readiness.can_go_on_duty) return null
  const missing = PARTNER_STEPS.filter(s => states[s.code] === "needed")
  const review = PARTNER_STEPS.filter(s => states[s.code] === "review")
  if (missing.length) return <section className="ds-setup-warning" role="status"><AlertCircle size={22} aria-hidden="true"/><div><h2 className="ds-h2">Complete your setup to receive service assignments</h2><p>{missing.map(s => s.label).join(", ")}</p><button className="ds-btn ds-btn--outline" onClick={onReview}>Review work settings</button></div></section>
  if (review.length) return <section className="ds-info" role="status"><h2 className="ds-h2">Your details are awaiting review</h2><p>{review.map(s => s.label).join(", ")}. No need to submit these details again.</p></section>
  if (states.service_area === "saved") return <section className="ds-info" role="status"><h2 className="ds-h2">Service coverage is not available in your working area yet</h2><p>Your working location is saved. You do not need to repeat your setup.</p></section>
  return <section className="ds-info" role="status"><h2 className="ds-h2">{readiness.status === "approved" ? "Assignments are temporarily unavailable" : "Your account is awaiting approval"}</h2><p>Your submitted setup is complete. No need to submit it again.</p></section>
}
