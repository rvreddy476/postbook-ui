/*
  Past matches (mechanic M19): GET /past-matches lists the viewer's matches
  that ended in the last few weeks, so the other person can still be reported
  through the usual POST /safety/report {target_id: person.user_id}.

    {data: [{match_id, person: {user_id, first_name?}, matched_at, ended_at,
             ended: unmatched|blocked|expired|closed, reported}],
     meta: {window_days}}

  Which side ended the match is never said. 404 MECHANIC_NOT_ENABLED hides
  the section.
*/

import { arr, bool, num, obj, str, time } from "./wire"

export interface PastMatch {
  matchId: string
  person: { userId: string; firstName: string }
  matchedAt: string
  endedAt: string
  ended: string
  /** The viewer already reported this person. */
  reported: boolean
}

export interface PastMatches {
  items: PastMatch[]
  /** 0 when the server sent none. */
  windowDays: number
}

/** The whole body: the list is `data`, the window is in `meta`. A row with no one to report is dropped. */
export function toPastMatches(body: unknown): PastMatches {
  const b = obj(body)
  const items = arr(b.data)
    .map((raw) => {
      const w = obj(raw)
      const p = obj(w.person)
      return {
        matchId: str(w.match_id),
        person: { userId: str(p.user_id), firstName: str(p.first_name) },
        matchedAt: time(w.matched_at),
        endedAt: time(w.ended_at),
        ended: str(w.ended),
        reported: bool(w.reported),
      }
    })
    .filter((m) => m.matchId && m.person.userId)
  return { items, windowDays: num(obj(b.meta).window_days) }
}

export function pastMatchName(m: Pick<PastMatch, "person">): string {
  return m.person.firstName || "Someone"
}

const ENDED: Record<string, string> = {
  blocked: "Blocked",
  closed: "Closed",
  expired: "Ran out of time",
  unmatched: "Unmatched",
}

export function endedLabel(ended: string): string {
  return ENDED[ended] || "Ended"
}

/** "Unmatched · 2 Oct" — the date only when the server's timestamp parses. */
export function endedLine(m: Pick<PastMatch, "ended" | "endedAt">, locale?: string): string {
  const label = endedLabel(m.ended)
  if (!m.endedAt) return label
  const when = new Date(m.endedAt).toLocaleDateString(locale, { day: "numeric", month: "short" })
  return `${label} · ${when}`
}

export function pastMatchesSub(windowDays: number): string {
  return windowDays > 0 ? `Matches that ended in the last ${windowDays} days.` : "Matches that ended recently."
}

export const NO_PAST_MATCHES = "No matches have ended recently."

/** After a report, the row reads "Reported" at once; the next read agrees. */
export function markReported(data: PastMatches, userId: string): PastMatches {
  return { ...data, items: data.items.map((m) => (m.person.userId === userId ? { ...m, reported: true } : m)) }
}
