"use client"

/*
  In-match extras (mechanic M9). Presentational only, so the tests can
  render them; the screens read the server and wire the actions.

    MatchCalls:          the match page's Video call / Voice call, or the line
                         saying when calls open, from the match's `can_call`;
    ReadReceiptsSetting: the settings switch, with the way to a pass while
                         there is none.
*/

import { Crown, Phone, Video } from "lucide-react"

import { CALLS_LOCKED_COPY, type CallView } from "../model/matches"
import { readReceiptsHelp, readReceiptsSwitch, type ReadReceiptsView } from "../model/readReceipts"
import { Button, LinkButton, Notice, Toggle } from "./kit"
import { PREMIUM_HREF } from "./LikedYouGrid"

export type CallKind = "audio" | "video"

/** Nothing for "none"; for "locked" one line; for "open" the two buttons, alphabetical. */
export function MatchCalls({ view, name, busy = false, onCall }: { view: CallView; name: string; busy?: boolean; onCall: (kind: CallKind) => void }) {
  if (view === "none") return null
  if (view === "locked") {
    return (
      <Notice tone="muted">
        <Phone size={14} aria-hidden="true" /> {CALLS_LOCKED_COPY}
      </Notice>
    )
  }
  return (
    <div className="pulse-row" role="group" aria-label={`Call ${name}`}>
      <Button icon={Video} disabled={busy} onClick={() => onCall("video")} aria-label={`Video call ${name}`}>
        Video call
      </Button>
      <Button icon={Phone} disabled={busy} onClick={() => onCall("audio")} aria-label={`Voice call ${name}`}>
        Voice call
      </Button>
    </div>
  )
}

export const READ_RECEIPTS_SWITCH_ID = "pulse-read-receipts"

export function ReadReceiptsSetting({ view, busy = false, onChange }: { view: ReadReceiptsView; busy?: boolean; onChange: (enabled: boolean) => void }) {
  const { checked, disabled } = readReceiptsSwitch(view)
  return (
    <div className="pulse-stack">
      <Toggle id={READ_RECEIPTS_SWITCH_ID} label="Show me when they've read my messages" help={readReceiptsHelp(view)} checked={checked} disabled={disabled || busy} onChange={onChange} />
      {view === "locked" || view === "held" ? (
        <div className="pulse-row">
          <LinkButton href={PREMIUM_HREF} icon={Crown}>
            See passes
          </LinkButton>
        </div>
      ) : null}
    </div>
  )
}
