/**
 * `GET` / `PUT /v1/users/me/wellbeing` on (Architecture) user-service.
 *
 * Contract: Architecture/services/user-service/internal/http/
 * wellbeing_validate.go. The PUT is a FULL REPLACE of the row: an omitted
 * field falls back to its "off" value. So every save sends the whole document
 * (the stored values plus the one card's edit); a card that sent only its own
 * fields would switch every other card off.
 *
 *   daily_limit_mins     null = off; 0 is accepted as off; else 10..1440
 *   bedtime_start/_end   both null (off) or both "HH:MM", and different
 *   focus_mode_enabled   boolean
 *   focus_mode_until     RFC3339, must be in the future (else 400)
 *   nudge_interval_mins  5..240, default 30
 *   hide_like_counts     boolean
 *   detox_mode_until     RFC3339, must be in the future (else 400)
 *
 * The page used to send daily_limit_minutes, daily_limit_enabled,
 * bedtime_mode_*, focus_mode_start/_end, break_* and hide_view_counts. None
 * of those exist, so the server stored "off" for everything.
 */

export const DAILY_LIMIT_MIN = 10
export const DAILY_LIMIT_MAX = 1440
export const NUDGE_MIN = 5
export const NUDGE_MAX = 240
export const NUDGE_DEFAULT = 30

export interface Wellbeing {
    daily_limit_mins: number | null
    bedtime_start: string | null
    bedtime_end: string | null
    focus_mode_enabled: boolean
    focus_mode_until: string | null
    nudge_interval_mins: number
    hide_like_counts: boolean
    detox_mode_until: string | null
}

export interface WellbeingRequest {
    daily_limit_mins: number
    bedtime_start: string | null
    bedtime_end: string | null
    focus_mode_enabled: boolean
    focus_mode_until?: string
    nudge_interval_mins: number
    hide_like_counts: boolean
    detox_mode_until?: string
}

const CLOCK = /^([01]?\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/

/** "HH:MM" for a valid clock (the server also accepts "HH:MM:SS"), else null. */
export function normalizeClock(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null
    const m = CLOCK.exec(value.trim())
    if (!m) return null
    return `${m[1].padStart(2, "0")}:${m[2]}`
}

function num(v: unknown): number | null {
    return typeof v === "number" && Number.isFinite(v) ? v : null
}

function strOrNull(v: unknown): string | null {
    return typeof v === "string" && v.trim() ? v : null
}

/** Decode the GET/PUT body (`{ data: wellbeingView }`). */
export function parseWellbeing(body: unknown): Wellbeing | null {
    const raw =
        body && typeof body === "object" && "data" in body
            ? (body as { data?: unknown }).data
            : body
    if (!raw || typeof raw !== "object") return null
    const w = raw as Record<string, unknown>
    const limit = num(w.daily_limit_mins)
    const nudge = num(w.nudge_interval_mins)
    return {
        daily_limit_mins: limit && limit > 0 ? limit : null,
        bedtime_start: normalizeClock(strOrNull(w.bedtime_start)),
        bedtime_end: normalizeClock(strOrNull(w.bedtime_end)),
        focus_mode_enabled: w.focus_mode_enabled === true,
        focus_mode_until: strOrNull(w.focus_mode_until),
        nudge_interval_mins: nudge ?? NUDGE_DEFAULT,
        hide_like_counts: w.hide_like_counts === true,
        detox_mode_until: strOrNull(w.detox_mode_until),
    }
}

function futureOrUndefined(iso: string | null, now: Date): string | undefined {
    if (!iso) return undefined
    const t = Date.parse(iso)
    return Number.isFinite(t) && t > now.getTime() ? iso : undefined
}

/**
 * The full-replace body for a wellbeing save, or a validation message.
 *
 * focus_mode_until and detox_mode_until are carried over only while they are
 * still in the future: echoing a timestamp that has already passed is a 400
 * (INVALID_FOCUS_MODE_UNTIL / INVALID_DETOX_MODE_UNTIL), and a passed window is
 * over anyway.
 */
export function buildWellbeingRequest(
    w: Wellbeing,
    now: Date = new Date(),
): { body: WellbeingRequest } | { error: string } {
    const limit = w.daily_limit_mins
    if (limit !== null && (limit < DAILY_LIMIT_MIN || limit > DAILY_LIMIT_MAX || !Number.isInteger(limit))) {
        return { error: `Daily limit must be between ${DAILY_LIMIT_MIN} and ${DAILY_LIMIT_MAX} minutes.` }
    }

    const start = w.bedtime_start === null ? null : normalizeClock(w.bedtime_start)
    const end = w.bedtime_end === null ? null : normalizeClock(w.bedtime_end)
    if ((w.bedtime_start === null) !== (w.bedtime_end === null)) {
        return { error: "Set both a bedtime and a wake time, or turn sleep hours off." }
    }
    if (w.bedtime_start !== null && (!start || !end)) {
        return { error: "Times must be in HH:MM format, for example 22:30." }
    }
    if (start && end && start === end) {
        return { error: "Bedtime and wake time must differ." }
    }

    const nudge = w.nudge_interval_mins
    if (!Number.isInteger(nudge) || nudge < NUDGE_MIN || nudge > NUDGE_MAX) {
        return { error: `Break reminders must be every ${NUDGE_MIN} to ${NUDGE_MAX} minutes.` }
    }

    const body: WellbeingRequest = {
        daily_limit_mins: limit ?? 0,
        bedtime_start: start,
        bedtime_end: end,
        focus_mode_enabled: w.focus_mode_enabled,
        nudge_interval_mins: nudge,
        hide_like_counts: w.hide_like_counts,
    }
    const focusUntil = futureOrUndefined(w.focus_mode_until, now)
    if (focusUntil) body.focus_mode_until = focusUntil
    const detoxUntil = futureOrUndefined(w.detox_mode_until, now)
    if (detoxUntil) body.detox_mode_until = detoxUntil
    return { body }
}

/* ------------------------------------------------------------------ */
/*  Screen time                                                         */
/* ------------------------------------------------------------------ */

export interface ScreenTimeDay {
    date: string
    minutes: number
    sessions: number
}

export interface ScreenTimeWeek {
    days: ScreenTimeDay[]
    today_minutes: number
    daily_limit_mins: number | null
    total_minutes: number
}

/** `GET /v1/users/me/screen-time?range=week`. The server sends no weekly total; it is summed here. */
export function parseScreenTime(body: unknown): ScreenTimeWeek | null {
    const raw =
        body && typeof body === "object" && "data" in body
            ? (body as { data?: unknown }).data
            : body
    if (!raw || typeof raw !== "object") return null
    const r = raw as Record<string, unknown>
    const days: ScreenTimeDay[] = Array.isArray(r.days)
        ? r.days
              .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
              .map((d) => ({
                  date: typeof d.date === "string" ? d.date : "",
                  minutes: num(d.minutes) ?? 0,
                  sessions: num(d.sessions) ?? 0,
              }))
        : []
    return {
        days,
        today_minutes: num(r.today_minutes) ?? 0,
        daily_limit_mins: num(r.daily_limit_mins),
        total_minutes: days.reduce((sum, d) => sum + d.minutes, 0),
    }
}
