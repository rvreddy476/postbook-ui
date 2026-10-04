/*
  Slots and the hold.

  GET /slots answers days (the city's horizon) of slots; a slot is offered
  only when a qualified professional is free for it. A slot the server marks
  `available: false` is taken: it is not drawn at all, and a picked slot that
  became taken is dropped from the selection (the list is refetched every
  30 s and after any SLOT_TAKEN refusal).

  The hold: POST /bookings holds the professional for 10 minutes
  (`hold_expires_at`); payment must start before it lapses. The countdown is
  driven by the server's timestamp, never a local 10-minute guess, and an
  unreadable timestamp counts as lapsed rather than as forever.

  Times are shown in the city's zone (Asia/Kolkata), whatever the browser's.
*/

import type { Slot, SlotDay, SlotDays } from "./wire"

export const DEFAULT_ZONE = "Asia/Kolkata"
export const SLOTS_REFRESH_MS = 30_000

/** The slots to draw for a day: only the open ones, earliest first. */
export function openSlots(day: SlotDay | undefined): Slot[] {
  if (!day) return []
  return day.slots.filter((s) => s.available).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
}

/** The days to draw in the strip, with how many open slots each has. */
export function dateStrip(days: SlotDays | undefined): { date: string; open: number }[] {
  return (days?.days ?? []).map((d) => ({ date: d.date, open: openSlots(d).length }))
}

/** The first day with an open slot (the strip starts there), else the first day. */
export function firstOpenDate(days: SlotDays | undefined): string | null {
  const list = days?.days ?? []
  return list.find((d) => openSlots(d).length > 0)?.date ?? list[0]?.date ?? null
}

/** True while `start` is still an open slot in `days`. */
export function slotStillOpen(days: SlotDays | undefined, start: string | null): boolean {
  if (!start || !days) return false
  const t = Date.parse(start)
  return days.days.some((d) => d.slots.some((s) => s.available && Date.parse(s.start) === t))
}

/* ── the hold ─────────────────────────────────────────────────────── */

/** Milliseconds left on the hold; 0 when lapsed or unreadable. */
export function holdRemainingMs(holdExpiresAt: string | null | undefined, now: number): number {
  if (!holdExpiresAt) return 0
  const end = Date.parse(holdExpiresAt)
  if (Number.isNaN(end)) return 0
  return Math.max(0, end - now)
}

export function holdExpired(holdExpiresAt: string | null | undefined, now: number): boolean {
  return holdRemainingMs(holdExpiresAt, now) === 0
}

/** "9:41" — minutes and seconds left. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

/* ── formatting in the city's zone ────────────────────────────────── */

function fmt(raw: string, zone: string, opts: Intl.DateTimeFormatOptions): string {
  const ms = Date.parse(raw)
  if (Number.isNaN(ms)) return ""
  try {
    return new Intl.DateTimeFormat("en-IN", { timeZone: zone, ...opts }).format(new Date(ms))
  } catch {
    return new Intl.DateTimeFormat("en-IN", { timeZone: DEFAULT_ZONE, ...opts }).format(new Date(ms))
  }
}

/** "10:30 am" */
export function formatTime(raw: string, zone = DEFAULT_ZONE): string {
  return fmt(raw, zone, { hour: "numeric", minute: "2-digit" })
}

/** "Sun, 4 Oct, 10:30 am" */
export function formatSlot(raw: string, zone = DEFAULT_ZONE): string {
  return fmt(raw, zone, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
}

/** "4 Oct, 10:30 am" for any server time. */
export function formatWhen(raw: string | null, zone = DEFAULT_ZONE): string {
  return raw ? fmt(raw, zone, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : ""
}

/** A `YYYY-MM-DD` day as {weekday: "Sun", day: "4", month: "Oct"} — the date is the city's, read as noon UTC. */
export function dayParts(date: string): { weekday: string; day: string; month: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return { weekday: "", day: date, month: "" }
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12))
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", ...o }).format(d)
  return { weekday: part({ weekday: "short" }), day: part({ day: "numeric" }), month: part({ month: "short" }) }
}
