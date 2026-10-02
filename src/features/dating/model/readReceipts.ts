/*
  Read receipts (mechanic M9): GET / PUT /v1/dating/read-receipts, both
  answering {enabled, active, available}.

    enabled   the viewer's own choice;
    active    whether it applies now (it needs a pass);
    available whether they hold a pass.

  Turning it on without a pass is refused (403 READ_RECEIPTS_REQUIRE_PASS);
  turning it off always works. While the server's flag is off the read is
  404 MECHANIC_NOT_ENABLED and the setting is hidden. The "Seen" marks in the
  messenger come from chat-service, which withholds them unless this applies,
  so nothing in the messenger reads this.
*/

import { bool, obj } from "./wire"

export interface ReadReceipts {
  enabled: boolean
  active: boolean
  available: boolean
}

export function toReadReceipts(wire: unknown): ReadReceipts {
  const w = obj(wire)
  return { enabled: bool(w.enabled), active: bool(w.active), available: bool(w.available) }
}

/** PUT /read-receipts. */
export function readReceiptsBody(enabled: boolean): { enabled: boolean } {
  return { enabled }
}

/**
    off:    a pass, switched off — the switch turns it on;
    on:     a pass, switched on — it applies;
    locked: no pass, switched off — the switch can't turn on; the way to a pass;
    held:   no pass, but switched on from before — it doesn't apply until a
            pass is back; the switch can still turn it off.
  `lockedByServer`: a 403 since the page loaded, so `available` on screen was stale.
*/
export type ReadReceiptsView = "off" | "on" | "locked" | "held"

export function readReceiptsView(state: ReadReceipts, lockedByServer = false): ReadReceiptsView {
  if (lockedByServer || !state.available) return state.enabled ? "held" : "locked"
  return state.enabled ? "on" : "off"
}

export const READ_RECEIPTS_TITLE = "Read receipts"

const HELP: Record<ReadReceiptsView, string> = {
  off: "See when your matches have read your messages.",
  on: "You see when your matches have read your messages.",
  locked: "See when your matches have read your messages. This comes with a pass.",
  held: "On hold while you don't have a pass. It starts again when you get one.",
}

export function readReceiptsHelp(view: ReadReceiptsView): string {
  return HELP[view]
}

/** The switch shows the viewer's choice; it can't be turned on without a pass. */
export function readReceiptsSwitch(view: ReadReceiptsView): { checked: boolean; disabled: boolean } {
  return { checked: view === "on" || view === "held", disabled: view === "locked" }
}
