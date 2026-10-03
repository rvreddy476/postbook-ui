/*
  The accept countdown for a CONFIRMED order.

  The deadline is `fetchedAt + seconds_to_breach`: the server computed the
  seconds at response time, so anchoring them to the moment the response
  ARRIVED is immune to a wrong device clock. `accept_deadline_at` is only a
  fallback (RFC 3339, or Postgres `timestamptz::text`).

  Past the deadline the order is Expired: accept is refused and the server
  auto-rejects it within its sweep. A newer server answer may reopen it.
*/

export const URGENT_SECONDS = 30

export type AcceptWindow =
  | { kind: "open"; remainingSeconds: number; urgent: boolean }
  | { kind: "no-deadline" }
  | { kind: "expired" }

/** RFC 3339 or Postgres text (`2026-09-13 06:35:00.5+00`) → epoch ms, or null. */
export function parseServerInstant(raw: string | null | undefined): number | null {
  if (!raw) return null
  let text = raw.trim()
  if (!text) return null
  text = text.replace(" ", "T")
  if (/T.*[+-]\d{2}$/.test(text)) text += ":00"
  const ms = Date.parse(text)
  return Number.isFinite(ms) ? ms : null
}

export function deadlineOf(
  order: { secondsToBreach: number | null; acceptDeadlineAt: string | null },
  fetchedAtMs: number,
): number | null {
  if (order.secondsToBreach !== null && Number.isFinite(order.secondsToBreach)) {
    return fetchedAtMs + order.secondsToBreach * 1000
  }
  return parseServerInstant(order.acceptDeadlineAt)
}

export function acceptWindow(deadlineMs: number | null, nowMs: number, urgentSeconds = URGENT_SECONDS): AcceptWindow {
  if (deadlineMs === null) return { kind: "no-deadline" }
  const remainingMs = deadlineMs - nowMs
  if (remainingMs <= 0) return { kind: "expired" }
  // Rounded UP, so "1 s" shows until the deadline itself.
  const remainingSeconds = Math.ceil(remainingMs / 1000)
  return { kind: "open", remainingSeconds, urgent: remainingSeconds <= urgentSeconds }
}

export function canRespond(w: AcceptWindow): boolean {
  return w.kind === "open" || w.kind === "no-deadline"
}

/** 125 → "2:05". */
export function formatRemaining(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}
