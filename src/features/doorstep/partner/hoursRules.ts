import { validateHours, type HoursWindow } from "./model"

export const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
export const DAY_PRESETS = { "Every day": [0, 1, 2, 3, 4, 5, 6], Weekdays: [1, 2, 3, 4, 5], Weekends: [0, 6] } as const

/** Replace only selected days; never discard another day's custom hours. */
export function applyHoursToDays(saved: HoursWindow[], days: number[], start: string, end: string): HoursWindow[] {
  const unique = [...new Set(days)]
  if (!unique.length || unique.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw Error("Choose at least one working day.")
  const next = [...saved.filter(w => !unique.includes(w.weekday)), ...unique.map(weekday => ({ weekday, start, end }))]
  const error = validateHours(next)
  if (error) throw Error(error)
  return next.sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start))
}
