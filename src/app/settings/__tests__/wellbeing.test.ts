import { describe, expect, test } from "bun:test"

import { buildWellbeingRequest, parseScreenTime, parseWellbeing, type Wellbeing } from "../_lib/wellbeing"

const NOW = new Date("2026-10-14T10:00:00Z")

// GET /v1/users/me/wellbeing as user-service writes it (wellbeingView).
const storedBody = {
    data: {
        daily_limit_mins: 90,
        bedtime_start: "23:00",
        bedtime_end: "07:00",
        focus_mode_enabled: false,
        focus_mode_until: null,
        nudge_interval_mins: 45,
        hide_like_counts: true,
        detox_mode_until: null,
        updated_at: "2026-10-01T00:00:00Z",
    },
}

function stored(): Wellbeing {
    const w = parseWellbeing(storedBody)
    if (!w) throw new Error("fixture did not parse")
    return w
}

function body(w: Wellbeing) {
    const built = buildWellbeingRequest(w, NOW)
    if ("error" in built) throw new Error(built.error)
    return built.body
}

describe("wellbeing request (T-10)", () => {
    test("uses the validator's field names", () => {
        expect(Object.keys(body(stored())).sort()).toEqual([
            "bedtime_end",
            "bedtime_start",
            "daily_limit_mins",
            "focus_mode_enabled",
            "hide_like_counts",
            "nudge_interval_mins",
        ])
    })

    test("a daily-limit save keeps every other stored value (PUT is a full replace)", () => {
        expect(body({ ...stored(), daily_limit_mins: 30 })).toEqual({
            daily_limit_mins: 30,
            bedtime_start: "23:00",
            bedtime_end: "07:00",
            focus_mode_enabled: false,
            nudge_interval_mins: 45,
            hide_like_counts: true,
        })
    })

    test("limit off is sent as 0; sleep hours off as null/null", () => {
        const b = body({ ...stored(), daily_limit_mins: null, bedtime_start: null, bedtime_end: null })
        expect(b.daily_limit_mins).toBe(0)
        expect(b.bedtime_start).toBeNull()
        expect(b.bedtime_end).toBeNull()
    })

    test("times are normalised to HH:MM", () => {
        const b = body({ ...stored(), bedtime_start: "9:05", bedtime_end: "06:30:00" })
        expect(b.bedtime_start).toBe("09:05")
        expect(b.bedtime_end).toBe("06:30")
    })

    test("values the validator rejects are refused before sending", () => {
        expect("error" in buildWellbeingRequest({ ...stored(), daily_limit_mins: 5 }, NOW)).toBe(true)
        expect("error" in buildWellbeingRequest({ ...stored(), daily_limit_mins: 1441 }, NOW)).toBe(true)
        expect("error" in buildWellbeingRequest({ ...stored(), bedtime_start: "22:00", bedtime_end: "22:00" }, NOW)).toBe(true)
        expect("error" in buildWellbeingRequest({ ...stored(), bedtime_start: "25:00" }, NOW)).toBe(true)
        expect("error" in buildWellbeingRequest({ ...stored(), bedtime_end: null }, NOW)).toBe(true)
        expect("error" in buildWellbeingRequest({ ...stored(), nudge_interval_mins: 300 }, NOW)).toBe(true)
    })

    test("a focus/detox end time is echoed only while it is in the future", () => {
        const future = body({ ...stored(), focus_mode_until: "2026-10-14T12:00:00Z", detox_mode_until: "2026-10-20T00:00:00Z" })
        expect(future.focus_mode_until).toBe("2026-10-14T12:00:00Z")
        expect(future.detox_mode_until).toBe("2026-10-20T00:00:00Z")
        const past = body({ ...stored(), focus_mode_until: "2026-10-14T09:00:00Z" })
        expect("focus_mode_until" in past).toBe(false)
    })

    test("GET round-trip: the saved limit reads back", () => {
        const echoed = parseWellbeing({ data: { ...storedBody.data, daily_limit_mins: 30 } })
        expect(echoed?.daily_limit_mins).toBe(30)
        expect(parseWellbeing({ data: { ...storedBody.data, daily_limit_mins: null } })?.daily_limit_mins).toBeNull()
    })
})

describe("screen time", () => {
    test("sums the week the server returns (it sends no total)", () => {
        const s = parseScreenTime({
            data: {
                range: "week",
                days: [
                    { date: "2026-10-13", minutes: 20, sessions: 2 },
                    { date: "2026-10-14", minutes: 15, sessions: 1 },
                ],
                today_minutes: 15,
                daily_limit_mins: 90,
            },
        })
        expect(s?.total_minutes).toBe(35)
        expect(s?.today_minutes).toBe(15)
        expect(s?.days).toHaveLength(2)
    })
})
