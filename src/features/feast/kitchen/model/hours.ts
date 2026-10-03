/*
  Weekly opening hours, edited per day in Asia/Kolkata (the server stores and
  judges them in IST; operating_hours.go). A day is either closed or has up
  to MAX_WINDOWS_PER_DAY windows; a window whose close is earlier than its
  open runs past midnight (the server marks it overnight).
*/

import type { HoursWindow } from "./wire"

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const
export const MAX_WINDOWS_PER_DAY = 7

export interface EditWindow {
  opensAt: string
  closesAt: string
}

export interface EditDay {
  closed: boolean
  windows: EditWindow[]
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export function isHHMM(s: string): boolean {
  return HHMM.test(s)
}

/** Server windows → seven editable days (Sunday first). */
export function toEditDays(windows: readonly HoursWindow[]): EditDay[] {
  return DAY_NAMES.map((_, day) => {
    const mine = windows.filter((w) => w.dayOfWeek === day)
    const open = mine.filter((w) => !w.isClosed)
    if (open.length === 0) return { closed: true, windows: [] }
    return { closed: false, windows: open.map((w) => ({ opensAt: w.opensAt, closesAt: w.closesAt })) }
  })
}

export interface WindowBody {
  day_of_week: number
  opens_at: string
  closes_at: string
  is_closed: boolean
}

/** Seven days → the PUT body. Null with a message when a day is not valid yet. */
export function toWindowsBody(days: readonly EditDay[]): { ok: true; windows: WindowBody[] } | { ok: false; message: string } {
  const out: WindowBody[] = []
  for (let day = 0; day < days.length; day++) {
    const d = days[day]
    if (d.closed || d.windows.length === 0) {
      out.push({ day_of_week: day, opens_at: "", closes_at: "", is_closed: true })
      continue
    }
    if (d.windows.length > MAX_WINDOWS_PER_DAY) return { ok: false, message: `${DAY_NAMES[day]} has more than ${MAX_WINDOWS_PER_DAY} windows.` }
    for (const w of d.windows) {
      if (!isHHMM(w.opensAt) || !isHHMM(w.closesAt)) return { ok: false, message: `${DAY_NAMES[day]}: times are HH:MM, 24-hour.` }
      if (w.opensAt === w.closesAt) return { ok: false, message: `${DAY_NAMES[day]}: a window can't open and close at the same time.` }
      out.push({ day_of_week: day, opens_at: w.opensAt, closes_at: w.closesAt, is_closed: false })
    }
  }
  if (out.every((w) => w.is_closed)) return { ok: false, message: "Open on at least one day." }
  return { ok: true, windows: out }
}

export function isOvernight(w: EditWindow): boolean {
  return isHHMM(w.opensAt) && isHHMM(w.closesAt) && w.closesAt < w.opensAt
}

/** Today's calendar date in India, YYYY-MM-DD. */
export function todayIST(nowMs: number = Date.now()): string {
  const d = new Date(nowMs + (5 * 60 + 30) * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

/** FSSAI expiry must be AFTER today in IST (onboarding.ValidateFSSAI). */
export function isFutureDateIST(date: string, nowMs: number = Date.now()): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date > todayIST(nowMs)
}
