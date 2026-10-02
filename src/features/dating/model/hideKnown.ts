/*
  Hide from people I know (mechanic M16).

    GET /hide-known            → {enabled, hidden_count, refreshed_at?}
    PUT /hide-known {enabled}  → the same

  "People I know" are the viewer's accepted Momentum connections. While it is
  on, they and the viewer never see each other on Pulse, either way. The
  server takes the snapshot and refreshes it daily; turning it on fails
  rather than pretend when the connections can't be read (503
  HIDE_KNOWN_UNAVAILABLE). A 404 MECHANIC_NOT_ENABLED hides the setting.
*/

import { bool, num, obj, time, toDatingError } from "./wire"

export interface HideKnown {
  enabled: boolean
  /** How many connections the snapshot holds; 0 when Go omitted it. */
  hiddenCount: number
  /** When the snapshot was last taken; "" when absent or unparseable. */
  refreshedAt: string
}

export function toHideKnown(wire: unknown): HideKnown {
  const w = obj(wire)
  return { enabled: bool(w.enabled), hiddenCount: Math.max(0, Math.floor(num(w.hidden_count))), refreshedAt: time(w.refreshed_at) }
}

export function hideKnownBody(enabled: boolean): { enabled: boolean } {
  return { enabled }
}

export const HIDE_KNOWN_TITLE = "People you know"
export const HIDE_KNOWN_LABEL = "Hide me from people I know"
export const HIDE_KNOWN_HELP = "Momentum connections won't see you on Pulse and you won't see them."
export const HIDE_KNOWN_UNAVAILABLE_COPY = "We couldn't read your connections just now — try again."

/** The line under the switch while it is on; "" while off. */
export function hideKnownLine(state: HideKnown): string {
  if (!state.enabled) return ""
  if (state.hiddenCount <= 0) return "None of your connections are on Pulse right now."
  return state.hiddenCount === 1 ? "Hidden from 1 connection" : `Hidden from ${state.hiddenCount} connections`
}

/**
    503 HIDE_KNOWN_UNAVAILABLE → unavailable: an inline "try again";
    any 404                    → off:         the setting goes;
    anything else              → other.
*/
export function hideKnownRefusal(error: unknown): "unavailable" | "off" | "other" {
  const e = toDatingError(error)
  if (e.code === "HIDE_KNOWN_UNAVAILABLE") return "unavailable"
  if (e.status === 404 || e.code === "MECHANIC_NOT_ENABLED") return "off"
  return "other"
}
