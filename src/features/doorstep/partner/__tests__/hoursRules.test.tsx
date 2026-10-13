import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { applyHoursToDays, DAY_PRESETS } from "../hoursRules"
import { HoursForm } from "../HoursEditor"
import { stepState, canWork, type Readiness, type Partner } from "../model"

describe("smart working hours", () => {
  test("one time range fills all seven days without mutating the saved schedule", () => {
    const saved = [{ weekday: 1, start: "10:00", end: "11:00" }]
    const next = applyHoursToDays(saved, [...DAY_PRESETS["Every day"]], "09:00", "18:00")
    expect(next).toHaveLength(7)
    expect(next.every(w => w.start === "09:00" && w.end === "18:00")).toBe(true)
    expect(saved[0].start).toBe("10:00")
  })
  test("weekdays leave weekend split shifts unchanged", () => {
    const saved = [{ weekday: 6, start: "08:00", end: "12:00" }, { weekday: 6, start: "13:00", end: "17:00" }]
    expect(applyHoursToDays(saved, [...DAY_PRESETS.Weekdays], "10:00", "16:00").filter(w => w.weekday === 6)).toEqual(saved)
  })
  test("selected days replace old shifts, deduplicate and sort", () => {
    expect(applyHoursToDays([{ weekday: 2, start: "08:00", end: "12:00" }], [2,1,2], "09:00", "18:00")).toEqual([
      { weekday: 1, start: "09:00", end: "18:00" }, { weekday: 2, start: "09:00", end: "18:00" },
    ])
  })
  test("empty selection, invalid days and invalid ranges do not save", () => {
    for (const days of [[], [-1], [7], [1.5]]) expect(() => applyHoursToDays([], days, "09:00", "18:00")).toThrow()
    for (const [start,end] of [["18:00","09:00"],["09:00","09:15"],["bad","18:00"]]) expect(() => applyHoursToDays([], [1], start, end)).toThrow()
  })
  test("renders presets and summary without seven repeated entry rows", () => {
    const html = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><HoursForm saved={[]} /></QueryClientProvider>)
    expect(html).toContain("Every day"); expect(html).toContain("Weekdays"); expect(html).toContain("Weekends")
    expect(html.match(/type="time"/g)).toHaveLength(2)
    expect(html).toContain("Customize individual days")
  })
})

describe("saved working area", () => {
  const readiness: Readiness = { status: "approved", completed_steps: [], missing_steps: ["service_area"], recommended_steps: [], can_go_on_duty: false }
  const area = { zone_ids: [], home_lat: 17.4, home_lng: 78.6, radius_m: 8000 }
  test("saved coordinates show saved without granting work eligibility", () => {
    expect(stepState("service_area", readiness, [], [], area)).toBe("saved")
    expect(canWork({status:"approved"} as Partner, readiness)).toBe(false)
  })
  test("server completion wins over saved status", () => {
    expect(stepState("service_area", {...readiness,completed_steps:["service_area"]}, [], [], area)).toBe("complete")
  })
  test("unsaved or invalid locations never show saved", () => {
    expect(stepState("service_area", readiness, [], [])).toBe("needed")
    for (const value of [{...area,home_lat:null},{...area,home_lng:Infinity},{...area,radius_m:0}]) expect(stepState("service_area", readiness, [], [], value)).toBe("needed")
  })
})
