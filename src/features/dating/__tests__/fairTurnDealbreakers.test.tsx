import { describe, expect, test } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { FairTurnNotice } from "../components/FairTurn"
import { DealbreakersOnlyPanel, DealbreakerSwitch, FiltersPanel } from "../components/Filters"
import { SwipeDeck } from "../components/SwipeDeck"
import { NO_ALLOWANCES, toAllowances } from "../model/allowances"
import {
  DEALBREAKER_HELP,
  DEALBREAKER_ORDER,
  dealbreakerRefusal,
  dealbreakersEnabled,
  dealbreakerSetInForm,
  dealbreakerSetInPreferences,
  DEALBREAKERS_PASS_COPY,
  dealbreakersToSend,
  freeDealbreakerRows,
  isPassDealbreaker,
  sameDealbreakers,
  toggleDealbreaker,
  withDealbreakers,
  type DealbreakerCode,
} from "../model/dealbreakers"
import { copyFor, datingErrorCopy, KNOWN_ERROR_CODES } from "../model/errors"
import { currentFairTurn, FAIR_TURN_MATCHES_HREF, FAIR_TURN_PAUSED_REASON, fairTurnCopy, fairTurnFromRefusal, fairTurnHeadline, toFairTurn } from "../model/fairTurn"
import { toProfileOptions } from "../model/options"
import { filtersBody, filtersForm, toPreferences, type FiltersForm } from "../model/profile"
import { toDeck } from "../model/pulse"
import { verdictFor } from "../model/sparks"
import { errorFromEnvelope, toDatingError } from "../model/wire"
import { DeckTitle } from "../screens/HomeScreen"

import { readFixture } from "./contractFixtures"

const html = (node: React.ReactElement) => renderToStaticMarkup(node)
const noop = () => {}
const axiosError = (status: number, code: string, details?: Record<string, unknown>) => ({ response: { status, data: { error: { code, message: "developer words", details } } } })
const count = (text: string, re: RegExp) => (text.match(re) ?? []).length

/* ── M11 fair turn ───────────────────────────────────────────────── */

describe("fair turn: the allowances member", () => {
  test("absent, null or not an object is off; present is read with Go's zeros", () => {
    expect(toFairTurn(undefined)).toBeNull()
    expect(toFairTurn(null)).toBeNull()
    expect(toFairTurn([1])).toBeNull()
    expect(toFairTurn("paused")).toBeNull()
    expect(toFairTurn({})).toEqual({ owed: 0, limit: 0, paused: false })
    expect(toFairTurn({ owed: 2, limit: 6 })).toEqual({ owed: 2, limit: 6, paused: false })
    expect(NO_ALLOWANCES.fairTurn).toBeNull()
    expect(toAllowances({ sparks: {}, fair_turn: { owed: 7, limit: 6, paused: true } }).fairTurn).toEqual({ owed: 7, limit: 6, paused: true })
  })

  test("what the deck shows: a paused read, a newer refusal, or nothing", () => {
    const paused = { owed: 6, limit: 6, paused: true }
    const going = { owed: 2, limit: 6, paused: false }
    // The read alone.
    expect(currentFairTurn(null, 100, null)).toBeNull()
    expect(currentFairTurn(going, 100, null)).toBeNull()
    expect(currentFairTurn(paused, 100, null)).toEqual(paused)
    // A refusal after the read stands until a newer read.
    expect(currentFairTurn(going, 100, { turn: paused, at: 150 })).toEqual(paused)
    expect(currentFairTurn(null, 100, { turn: paused, at: 150 })).toEqual(paused)
    // A newer read decides: they replied, or the mechanic went off.
    expect(currentFairTurn(going, 200, { turn: paused, at: 150 })).toBeNull()
    expect(currentFairTurn(null, 200, { turn: paused, at: 150 })).toBeNull()
  })

  test("the headline counts matches, and reads without a number when Go omitted it", () => {
    expect(fairTurnHeadline({ owed: 6 })).toBe("6 matches are waiting for your reply")
    expect(fairTurnHeadline({ owed: 1 })).toBe("1 match is waiting for your reply")
    expect(fairTurnHeadline({ owed: 0 })).toBe("Some of your matches are waiting for your reply")
  })

  test("409 FAIR_TURN_LIMIT is its own verdict and its own words; other refusals are not", () => {
    const e = toDatingError(axiosError(409, "FAIR_TURN_LIMIT", { owed: 7, limit: 6 }))
    expect(verdictFor(e)).toBe("fair_turn")
    expect(fairTurnFromRefusal(e)).toEqual({ owed: 7, limit: 6, paused: true })
    expect(datingErrorCopy(axiosError(409, "FAIR_TURN_LIMIT", { owed: 7, limit: 6 }))).toBe(fairTurnCopy(e))
    expect(datingErrorCopy(axiosError(409, "FAIR_TURN_LIMIT"))).toBe("Some of your matches are waiting for your reply. Reply to a few, then send new sparks.")
    expect(fairTurnFromRefusal(toDatingError(axiosError(429, "SPARK_RATE_LIMITED")))).toBeNull()
    expect(KNOWN_ERROR_CODES).toContain("FAIR_TURN_LIMIT")
  })
})

describe("fair turn: the deck", () => {
  const cards = toDeck(readFixture("pulse_today_get_200")).cards
  const deck = (over: Partial<React.ComponentProps<typeof SwipeDeck>> = {}) => html(<SwipeDeck cards={cards} onAction={noop} superSparkEnabled superSparkNote="Super Sparks: 1 left today" {...over} />)
  const button = (out: string, label: RegExp) => out.match(new RegExp(`<button[^>]*aria-label="${label.source}"[^>]*>`))?.[0] ?? ""

  test("not paused: Spark and Super Spark work exactly as before", () => {
    const out = deck()
    expect(button(out, /Spark/)).not.toContain("disabled")
    expect(button(out, /Super Spark/)).not.toContain("disabled")
    expect(out).toContain("Super Sparks: 1 left today")
    expect(out).toContain("Arrow right to spark")
  })

  test("paused: Spark and Super Spark are off and say why; pass and save still work", () => {
    const out = deck({ sparkPausedReason: FAIR_TURN_PAUSED_REASON })
    const spark = button(out, /Spark, on hold until you reply to your matches/)
    const superSpark = button(out, /Super Spark, on hold until you reply to your matches/)
    expect(spark).toContain('disabled=""')
    expect(spark).toContain(`title="${FAIR_TURN_PAUSED_REASON}"`)
    expect(superSpark).toContain('disabled=""')
    expect(button(out, /Pass/)).not.toContain("disabled")
    expect(button(out, /Save for later/)).not.toContain("disabled")
    expect(out).not.toContain("Arrow right to spark")
    expect(out).toContain("Sparks are on hold for now.")
    expect(out).not.toContain("Super Sparks: 1 left today")
  })

  test("the note: our words, a way to the matches, no hex and no server message", () => {
    const out = html(<FairTurnNotice turn={{ owed: 6, limit: 6, paused: true }} />)
    expect(out).toContain("6 matches are waiting for your reply")
    expect(out).toContain(`href="${FAIR_TURN_MATCHES_HREF}"`)
    expect(out).toContain(">Go to matches<")
    expect(out).toContain('role="status"')
    expect(out).not.toContain("reply to the matches waiting on you before sending new sparks")
  })
})

/* ── M12 dealbreakers ────────────────────────────────────────────── */

const options = toProfileOptions(readFixture("profile_options_get_200").data)
const withFilters = toPreferences(readFixture("preferences_get_200_filters").data)
const breakersOnly = toPreferences(readFixture("preferences_get_200_dealbreakers").data)
const bothOn = toPreferences({ ...(readFixture("preferences_get_200_filters").data as object), dealbreakers: ["age", "diet"] })

describe("dealbreakers: on or off", () => {
  test("the member decides: a list (even empty) is on; absent, null or anything else is off", () => {
    expect(dealbreakersEnabled(withFilters)).toBe(false)
    expect(withFilters.dealbreakers).toBeNull()
    expect(dealbreakersEnabled(breakersOnly)).toBe(true)
    expect(dealbreakersEnabled(toPreferences({ dealbreakers: [] }))).toBe(true)
    expect(toPreferences({ dealbreakers: [] }).dealbreakers).toEqual([])
    expect(dealbreakersEnabled(toPreferences({ dealbreakers: null }))).toBe(false)
    expect(dealbreakersEnabled(toPreferences({ dealbreakers: "age" }))).toBe(false)
    expect(dealbreakersEnabled(null)).toBe(false)
  })

  test("the deck header offers Filters for either flag", () => {
    expect(html(<DeckTitle showFilters={false} />)).not.toContain("Filters")
    expect(html(<DeckTitle showFilters />)).toContain('href="/dating/filters"')
  })

  test("free codes and pass codes", () => {
    expect(DEALBREAKER_ORDER.filter((c) => !isPassDealbreaker(c))).toEqual(["age", "distance", "intent"])
    expect(DEALBREAKER_ORDER.filter(isPassDealbreaker)).toEqual(["verified", "height", "languages", "drinking", "smoking", "exercise", "diet"])
  })
})

describe("dealbreakers: which switches, and what is sent", () => {
  const form = filtersForm(bothOn, options)
  const empty: FiltersForm = { ...form, intentFilter: [], verifiedOnly: false, minHeightCm: 0, maxHeightCm: 0, languages: [], drinking: [], smoking: [], exercise: [], diet: [] }

  test("a switch only beside a preference that is set; age and distance always hold a value", () => {
    const set = (f: FiltersForm) => DEALBREAKER_ORDER.filter((c) => dealbreakerSetInForm(f, c))
    expect(set(empty)).toEqual(["age", "distance"])
    expect(set(form)).toEqual(["age", "distance", "intent", "verified", "height", "languages", "drinking", "smoking", "diet"])
    expect(form.dealbreakers).toEqual(["age", "diet"])
  })

  test("toggling keeps the server's order and each code once", () => {
    expect(toggleDealbreaker(["diet"], "age", true)).toEqual(["age", "diet"])
    expect(toggleDealbreaker(["age", "diet"], "age", false)).toEqual(["diet"])
    expect(toggleDealbreaker(["age", "age", "bogus"], "intent", true)).toEqual(["age", "intent"])
  })

  test("the list sent: set preferences only, pass codes only with a pass", () => {
    const isSet = (c: DealbreakerCode) => dealbreakerSetInForm(form, c)
    expect(dealbreakersToSend(["diet", "age", "exercise"], isSet, true)).toEqual(["age", "diet"])
    expect(dealbreakersToSend(["diet", "age"], isSet, false)).toEqual(["age"])
  })

  test("the body: no member while off or untouched, the whole list when touched", () => {
    const body = filtersBody(form, true)
    const isSet = (c: DealbreakerCode) => dealbreakerSetInForm(form, c)
    expect(withDealbreakers(body, { enabled: false, saved: [], chosen: ["age"], isSet, withPass: true })).toEqual(body)
    expect("dealbreakers" in withDealbreakers(body, { enabled: true, saved: ["age", "diet"], chosen: ["diet", "age"], isSet, withPass: true })).toBe(false)
    expect(withDealbreakers(body, { enabled: true, saved: ["age", "diet"], chosen: ["age", "diet", "intent"], isSet, withPass: true }).dealbreakers).toEqual(["age", "intent", "diet"])
    // Switched everything off: [] is sent, which clears them.
    expect(withDealbreakers(body, { enabled: true, saved: ["age"], chosen: [], isSet, withPass: true }).dealbreakers).toEqual([])
    // Without a pass, a touched list leaves the pass codes out rather than be refused.
    expect(withDealbreakers(body, { enabled: true, saved: ["diet"], chosen: ["age", "diet"], isSet, withPass: false }).dealbreakers).toEqual(["age"])
    expect(sameDealbreakers(["a", "b"], ["b", "a", "a"])).toBe(true)
  })

  test("filters off: the free preferences that are set, in words", () => {
    expect(freeDealbreakerRows(breakersOnly)).toEqual([
      { code: "age", title: "Age", value: "25 to 35" },
      { code: "distance", title: "Distance", value: "Within 25 km" },
    ])
    const intent = toPreferences({ min_age: 21, distance_km: 10, intent_filter: ["serious", "casual"], dealbreakers: [] })
    expect(freeDealbreakerRows(intent).map((r) => r.value)).toEqual(["21 and over", "Within 10 km", "A serious relationship, Something casual"])
    expect(freeDealbreakerRows(toPreferences({ dealbreakers: [] }))).toEqual([])
    expect(dealbreakerSetInPreferences(toPreferences({}), "age")).toBe(false)
  })

  test("refusals: pass → upsell, invalid → inline, off → hidden, anything else → other", () => {
    expect(dealbreakerRefusal(axiosError(403, "DEALBREAKERS_REQUIRE_PASS"))).toBe("pass")
    expect(dealbreakerRefusal(axiosError(400, "INVALID_DEALBREAKER", { field: "dealbreakers" }))).toBe("invalid")
    expect(dealbreakerRefusal(axiosError(404, "MECHANIC_NOT_ENABLED"))).toBe("off")
    expect(dealbreakerRefusal(axiosError(403, "FILTERS_REQUIRE_PASS"))).toBe("other")
    expect(dealbreakerRefusal(new Error("network"))).toBe("other")
    expect(copyFor(errorFromEnvelope(readFixture("preferences_put_403_dealbreakers_require_pass")))).toBe(DEALBREAKERS_PASS_COPY)
    expect(datingErrorCopy(axiosError(400, "INVALID_DEALBREAKER"))).toContain("dealbreakers")
  })
})

describe("dealbreakers: the filters screen", () => {
  const form = filtersForm(bothOn, options)
  const panel = (over: Partial<React.ComponentProps<typeof FiltersPanel>>) =>
    html(<FiltersPanel options={options} form={form} locked={false} savedPass={false} busy={false} clearing={false} error="" fieldError={null} onChange={noop} onSave={noop} onClear={noop} {...over} />)
  const switchFor = (out: string, code: string) => out.match(new RegExp(`<input id="pulse-dealbreaker-${code}"[^>]*>`))?.[0] ?? ""

  test("off: no switch anywhere, the screen as before", () => {
    const out = panel({})
    expect(out).not.toContain("pulse-dealbreaker")
    expect(out.includes(DEALBREAKER_HELP.replaceAll("'", "&#x27;"))).toBe(false)
  })

  test("on, with a pass: a switch beside every set preference, saved ones checked, each named", () => {
    const out = panel({ dealbreakers: true })
    expect(count(out, /role="switch" class="pulse-switch"/g)).toBeGreaterThanOrEqual(9)
    for (const code of ["age", "distance", "intent", "verified", "height", "languages", "drinking", "smoking", "diet"]) expect(switchFor(out, code)).not.toBe("")
    // Exercise has nothing picked: no switch.
    expect(switchFor(out, "exercise")).toBe("")
    expect(switchFor(out, "age")).toContain('checked=""')
    expect(switchFor(out, "diet")).toContain('checked=""')
    expect(switchFor(out, "intent")).not.toContain("checked")
    expect(switchFor(out, "diet")).not.toContain("disabled")
    expect(out).toContain('Dealbreaker<span class="pulse-sr"> for age range</span>')
    expect(out.includes(DEALBREAKER_HELP.replaceAll("'", "&#x27;"))).toBe(true)
  })

  test("on, without a pass: the pass switches are off under the upsell, the free ones work", () => {
    const out = panel({ dealbreakers: true, locked: true })
    expect(out).toContain(">See passes<")
    expect(switchFor(out, "diet")).toContain('disabled=""')
    expect(switchFor(out, "height")).toContain('disabled=""')
    expect(switchFor(out, "age")).not.toContain("disabled")
    expect(switchFor(out, "intent")).not.toContain("disabled")
  })

  test("a refused list shows its error by the save button", () => {
    const out = panel({ dealbreakers: true, dealbreakerError: "One of those dealbreakers isn't available any more." })
    expect(out).toMatch(/<p class="pulse-field__error" role="alert">One of those dealbreakers/)
  })

  test("filters off, dealbreakers on: the free preferences with their switches", () => {
    const out = html(<DealbreakersOnlyPanel rows={freeDealbreakerRows(breakersOnly)} selected={breakersOnly.dealbreakers!} busy={false} error="" onChange={noop} onSave={noop} />)
    expect(out).toContain("25 to 35")
    expect(out).toContain("Within 25 km")
    expect(switchFor(out, "age")).toContain('checked=""')
    expect(switchFor(out, "distance")).not.toContain("checked")
    expect(out).toContain('href="/dating/onboarding/preferences"')
    expect(out).toContain(">Save dealbreakers<")
    const none = html(<DealbreakersOnlyPanel rows={[]} selected={[]} busy={false} error="" onChange={noop} onSave={noop} />)
    expect(none).toContain("Set your preferences first")
    expect(none).not.toContain("Save dealbreakers")
  })

  test("one switch alone", () => {
    const out = html(<DealbreakerSwitch code="languages" checked={false} onChange={noop} />)
    expect(out).toContain('id="pulse-dealbreaker-languages"')
    expect(out).toContain(">Dealbreaker<")
  })
})
