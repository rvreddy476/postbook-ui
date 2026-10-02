"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { CheckCircle2, ChevronDown, Circle, HelpCircle } from "lucide-react"

import {
  COULD_NOT_CHECK,
  LEARN_MORE_LABEL,
  NEARLY_EMPTY,
  NEARLY_LEAD,
  NEARLY_TITLE,
  STATE_LABEL,
  learnMoreLines,
  primaryAction,
  requirementView,
  type LiveRequirement,
  type RequirementState,
} from "../eligibility"
import "../live.css"

const ICONS: Record<RequirementState, typeof Circle> = {
  met: CheckCircle2,
  todo: Circle,
  unknown: HelpCircle,
}

/**
 * "You're nearly ready to go live": shown instead of the go-live form when
 * the account does not meet the requirements yet (GET /eligibility in open
 * mode, or a 403 LIVE_NOT_ELIGIBLE from create / start / ingress). Each row
 * is ticked, open, or marked "Couldn't check"; one primary button helps
 * with the first row that has an action, and "Learn more" opens in place.
 */
export function NearlyReady({
  requirements,
  onRecheck,
  rechecking = false,
  viewerCap,
}: {
  requirements: readonly LiveRequirement[]
  /** "Check again": ask the server once more. */
  onRecheck: () => void
  rechecking?: boolean
  viewerCap?: number | null
}) {
  const [more, setMore] = useState(false)
  const moreId = useId()
  const action = primaryAction(requirements)
  const rows = requirements.map(requirementView)

  return (
    <section className="live-ready" data-testid="live-nearly-ready" aria-label={NEARLY_TITLE}>
      <h2 className="live-ready__title">{NEARLY_TITLE}</h2>
      <p className="live-ready__lead">{rows.length > 0 ? NEARLY_LEAD : NEARLY_EMPTY}</p>

      {rows.length > 0 && (
        <ul className="live-ready__list">
          {rows.map((row) => {
            const Icon = ICONS[row.state]
            return (
              <li key={row.key} className="live-ready__row" data-key={row.key} data-state={row.state}>
                <Icon className="live-ready__icon" aria-hidden="true" />
                <span className="live-ready__text">
                  <span className="sr-only">{STATE_LABEL[row.state]}: </span>
                  {row.text}
                </span>
                {row.state === "unknown" && <span className="live-ready__tag" aria-hidden="true">{COULD_NOT_CHECK}</span>}
              </li>
            )
          })}
        </ul>
      )}

      <div className="live-ready__actions">
        <button
          type="button"
          className="live-btn live-btn--ghost"
          aria-expanded={more}
          aria-controls={moreId}
          onClick={() => setMore((open) => !open)}
        >
          {LEARN_MORE_LABEL}
          <ChevronDown className="live-ready__chevron" data-open={more} aria-hidden="true" />
        </button>
        {action.kind === "link" ? (
          <Link href={action.href} className="live-btn live-btn--primary" data-action={action.key}>
            {action.label}
          </Link>
        ) : (
          <button type="button" className="live-btn live-btn--primary" data-action="recheck" disabled={rechecking} onClick={onRecheck}>
            {rechecking ? "Checking…" : action.label}
          </button>
        )}
      </div>

      <div id={moreId} className="live-ready__more" hidden={!more}>
        {learnMoreLines(requirements, viewerCap).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </section>
  )
}
