"use client"

/*
  The Setup tab: the onboarding checklist and the panel for the chosen step.

  The checklist is ONLY the server's `missing[]` (GET …/readiness, refreshed
  after every save and from a 422 FOOD_RESTAURANT_NOT_READY). A save never
  ticks a row on its own. Basics is always editable and is not a server step.
*/

import { CheckCircle2, Circle, CircleAlert, Send, Store } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { fetchReadiness, submitForReview } from "../../api/client"
import { canSubmitFrom, checklistFromMissing, restaurantStatusLabel, restaurantStatusTone, STEP_COPY, type StepPanel } from "../../model/checklist"
import { toFailure, type ApiFailure } from "../../model/errors"
import type { PartnerRestaurant, Readiness } from "../../model/wire"
import { FailureNotice, Notice, Pill, useAction } from "../ui"
import { BasicsPanel } from "./BasicsPanel"
import { CompliancePanel } from "./CompliancePanel"
import { FssaiPanel } from "./FssaiPanel"
import { HoursPanel } from "./HoursPanel"
import { LocationPanel } from "./LocationPanel"
import { PayoutPanel } from "./PayoutPanel"

type Panel = "basics" | StepPanel | "submit"

export function Onboarding({
  restaurant,
  onRestaurantChanged,
  onOpenMenu,
}: {
  restaurant: PartnerRestaurant
  onRestaurantChanged: (r?: PartnerRestaurant) => void
  onOpenMenu: () => void
}) {
  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [readFailure, setReadFailure] = useState<ApiFailure | null>(null)
  const [panel, setPanel] = useState<Panel | null>(null)
  const submit = useAction()
  const [submitted, setSubmitted] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const r = await fetchReadiness(restaurant.id)
      setReadiness(r)
      setReadFailure(null)
    } catch (e) {
      setReadFailure(toFailure(e))
    }
  }, [restaurant.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const checklist = readiness ? checklistFromMissing(readiness.missing) : null
  const status = readiness?.status ?? restaurant.status

  // First visit: open the first step still to do (or Submit when all are done).
  useEffect(() => {
    if (panel || !checklist) return
    setPanel(checklist.next ? STEP_COPY[checklist.next].panel : "submit")
  }, [checklist, panel])

  const saved = () => {
    void refresh()
    onRestaurantChanged()
  }

  const doSubmit = async () => {
    setSubmitted(false)
    const r = await submit.run(() => submitForReview(restaurant.id))
    if (r) {
      setSubmitted(true)
      saved()
    }
  }

  // A 422 not-ready carries the server's own missing[]: adopt it.
  useEffect(() => {
    if (submit.failure?.missing && readiness) setReadiness({ ...readiness, missing: submit.failure.missing, ready: false, canSubmit: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submit.failure])

  const rows: { key: Panel; title: string; detail: string; done: boolean | null; stepKey: string }[] = [
    { key: "basics", title: "Basics", detail: "Name, contact, minimum order, packaging", done: null, stepKey: "basics" },
    ...(checklist
      ? checklist.rows.map((r) => ({ key: STEP_COPY[r.step].panel as Panel, title: STEP_COPY[r.step].title, detail: STEP_COPY[r.step].detail, done: r.done, stepKey: r.step }))
      : []),
  ]

  return (
    <div className="kit-grid kit-grid--side">
      <nav className="kit-card" aria-label="Setup steps">
        <div className="kit-row kit-row--between" style={{ marginBottom: 8 }}>
          <strong>Setup</strong>
          <Pill tone={restaurantStatusTone(status)}>{restaurantStatusLabel(status)}</Pill>
        </div>
        {readFailure ? <FailureNotice failure={readFailure} /> : null}
        {!checklist && !readFailure ? <p className="kit-meta">Checking what&apos;s left…</p> : null}
        <ol className="kit-steps">
          {rows.map((r) => (
            <li key={r.stepKey}>
              <button type="button" className={`kit-step${r.done ? " kit-step--done" : ""}`} aria-current={panel === r.key ? "step" : undefined} onClick={() => setPanel(r.key)}>
                <span className="kit-step__icon">{r.done === null ? <Store size={16} aria-hidden /> : r.done ? <CheckCircle2 size={16} aria-label="Done" /> : <Circle size={16} aria-label="To do" />}</span>
                <span className="kit-step__body">
                  <span className="kit-step__title">{r.title}</span>
                  <span className="kit-small">{r.detail}</span>
                </span>
              </button>
            </li>
          ))}
          {checklist?.unrecognised.map((code) => (
            <li key={code}>
              <div className="kit-step" aria-disabled>
                <span className="kit-step__icon">
                  <CircleAlert size={16} aria-hidden />
                </span>
                <span className="kit-step__body">
                  <span className="kit-step__title">Something else is needed</span>
                  <span className="kit-small">Feast asks for a step this page doesn&apos;t know yet ({code}). Update the app or contact support.</span>
                </span>
              </div>
            </li>
          ))}
          <li>
            <button type="button" className="kit-step" aria-current={panel === "submit" ? "step" : undefined} onClick={() => setPanel("submit")}>
              <span className="kit-step__icon">
                <Send size={16} aria-hidden />
              </span>
              <span className="kit-step__body">
                <span className="kit-step__title">Submit for review</span>
                <span className="kit-small">{checklist ? (checklist.ready ? "Everything is in" : `${checklist.remaining} step${checklist.remaining === 1 ? "" : "s"} left`) : "—"}</span>
              </span>
            </button>
          </li>
        </ol>
      </nav>

      <section className="kit-card" aria-live="polite">
        {panel === "basics" ? (
          <>
            <h2 className="kit-card__title">Basics</h2>
            <BasicsPanel restaurant={restaurant} onSaved={(r) => onRestaurantChanged(r)} />
          </>
        ) : panel === "location" ? (
          <>
            <h2 className="kit-card__title">Location and state</h2>
            <LocationPanel restaurantId={restaurant.id} onSaved={saved} />
          </>
        ) : panel === "hours" ? (
          <>
            <h2 className="kit-card__title">Opening hours</h2>
            <HoursPanel restaurantId={restaurant.id} onSaved={saved} />
          </>
        ) : panel === "compliance" ? (
          <>
            <h2 className="kit-card__title">Tax details</h2>
            <CompliancePanel restaurantId={restaurant.id} legalName={restaurant.legalName} onSaved={saved} />
          </>
        ) : panel === "fssai" ? (
          <>
            <h2 className="kit-card__title">FSSAI licence</h2>
            <FssaiPanel restaurantId={restaurant.id} onSaved={saved} />
          </>
        ) : panel === "payout" ? (
          <>
            <h2 className="kit-card__title">Bank account</h2>
            <PayoutPanel restaurantId={restaurant.id} onSaved={saved} />
          </>
        ) : panel === "menu" ? (
          <>
            <h2 className="kit-card__title">Menu</h2>
            <p className="kit-meta">Add at least one category and one dish customers can order.</p>
            <button type="button" className="kit-btn kit-btn--primary" onClick={onOpenMenu}>
              Open the menu editor
            </button>
          </>
        ) : panel === "submit" ? (
          <>
            <h2 className="kit-card__title">Review</h2>
            <ReviewStatus status={status} />
            {submitted ? <Notice tone="success">Submitted. Feast reviews new restaurants and will tell you here.</Notice> : null}
            <FailureNotice failure={submit.failure} />
            {canSubmitFrom(status) ? (
              <div className="kit-row" style={{ marginTop: 10 }}>
                <button type="button" className="kit-btn kit-btn--primary" disabled={submit.busy || !checklist?.ready} onClick={doSubmit}>
                  <Send size={14} aria-hidden /> {submit.busy ? "Submitting…" : "Submit for review"}
                </button>
                {!checklist?.ready ? <span className="kit-meta">Finish the steps on the left first.</span> : null}
              </div>
            ) : null}
          </>
        ) : (
          <p className="kit-meta">Loading…</p>
        )}
      </section>
    </div>
  )
}

function ReviewStatus({ status }: { status: string }) {
  switch (status) {
    case "PENDING_REVIEW":
      return <Notice tone="warning">Your restaurant is in review. You can keep editing your menu meanwhile.</Notice>
    case "ACTIVE":
      return <Notice tone="success">Your restaurant is live. Turn on &ldquo;Accepting orders&rdquo; at the top when the kitchen is ready.</Notice>
    case "REJECTED":
      return <Notice tone="danger">Feast asked for changes. Fix the flagged steps and submit again.</Notice>
    case "SUSPENDED":
      return <Notice tone="danger">Feast has paused this restaurant. Contact support.</Notice>
    default:
      return <Notice>When every step is done, submit your restaurant for review.</Notice>
  }
}
