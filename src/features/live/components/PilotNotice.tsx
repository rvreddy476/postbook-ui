import Link from "next/link"
import { Radio } from "lucide-react"

import { PILOT_REFUSAL_COPY, PILOT_REFUSAL_DETAIL } from "../errors"

/** Shown instead of the go-live flow when the server answers LIVE_NOT_ENABLED. */
export function PilotNotice() {
  return (
    <div className="live-pilot" role="status" data-testid="live-pilot">
      <Radio className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <div className="live-pilot__title">{PILOT_REFUSAL_COPY}</div>
      <div className="live-pilot__body">{PILOT_REFUSAL_DETAIL}</div>
      <Link href="/live" className="live-btn live-btn--ghost">Watch live streams</Link>
    </div>
  )
}
