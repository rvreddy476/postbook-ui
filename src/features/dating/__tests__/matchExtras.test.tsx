import { describe, expect, test } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { MatchCalls, ReadReceiptsSetting } from "../components/MatchExtras"
import { PickOpen } from "../components/PicksGrid"
import { copyFor, datingErrorCopy, isReadReceiptsRequirePass, KNOWN_ERROR_CODES, READ_RECEIPTS_PASS_COPY } from "../model/errors"
import { CALLS_LOCKED_COPY, callView, toMatch } from "../model/matches"
import { personHref } from "../model/people"
import { featureLabels, toMyPremium } from "../model/premium"
import { toDeck } from "../model/pulse"
import { readReceiptsBody, readReceiptsHelp, readReceiptsSwitch, readReceiptsView, toReadReceipts, type ReadReceiptsView } from "../model/readReceipts"
import { toDatingError } from "../model/wire"
import { callContact } from "../screens/MatchScreen"
import { Holding, PassIncludes } from "../screens/PremiumScreen"

import { readFixture } from "./contractFixtures"

const html = (node: React.ReactElement) => renderToStaticMarkup(node)
const noop = () => {}
const axiosError = (status: number, code: string) => ({ response: { status, data: { error: { code, message: "developer words" } } } })
const count = (text: string, re: RegExp) => (text.match(re) ?? []).length

const matchWith = (extra: Record<string, unknown>) => toMatch({ id: "m1", status: "matched", person: { user_id: "u1", first_name: "Asha", age: 30 }, ...extra })!

/* ── calls after an exchange ─────────────────────────────────────── */

describe("calls: can_call on the match", () => {
  test("absent or null is no answer; false and true are read as sent", () => {
    expect(matchWith({}).canCall).toBeNull()
    expect(matchWith({ can_call: null }).canCall).toBeNull()
    expect(matchWith({ can_call: false }).canCall).toBe(false)
    expect(matchWith({ can_call: true }).canCall).toBe(true)
    // Anything that isn't a boolean is no answer, never a yes.
    expect(matchWith({ can_call: "true" }).canCall).toBeNull()
    expect(matchWith({ can_call: 1 }).canCall).toBeNull()
  })

  test("which controls: none when absent or the match isn't live, a line when false, buttons when true", () => {
    expect(callView(null, true)).toBe("none")
    expect(callView(false, true)).toBe("locked")
    expect(callView(true, true)).toBe("open")
    expect(callView(true, false)).toBe("none")
    expect(callView(false, false)).toBe("none")
  })

  test("the person called is the match: their id and first name, no photo route", () => {
    const m = toMatch(readFixture("match_get_200_can_call").data)!
    expect(callContact(m.person!)).toEqual({ id: "<other>", name: "Asha", avatar: "" })
    expect(callContact({ userId: "u2", firstName: "" }).name).toBe("Your match")
  })
})

describe("calls: the match page", () => {
  test("can_call true: Video call and Voice call, alphabetical, each naming the person", () => {
    const out = html(<MatchCalls view="open" name="Asha" onCall={noop} />)
    expect(out.indexOf(">Video call<")).toBeGreaterThan(-1)
    expect(out.indexOf(">Voice call<")).toBeGreaterThan(out.indexOf(">Video call<"))
    expect(out).toContain('aria-label="Video call Asha"')
    expect(out).toContain('aria-label="Voice call Asha"')
    expect(out).not.toContain(CALLS_LOCKED_COPY.slice(0, 20))
    expect(count(out, /disabled=""/g)).toBe(0)
  })

  test("while a call is already ringing or on, both wait", () => {
    expect(count(html(<MatchCalls view="open" name="Asha" busy onCall={noop} />), /disabled=""/g)).toBe(2)
  })

  test("can_call false: one line in our words, no buttons", () => {
    const out = html(<MatchCalls view="locked" name="Asha" onCall={noop} />)
    expect(out).toContain("Voice and video calls open once you&#x27;ve both sent a message.")
    expect(out).not.toContain("<button")
  })

  test("can_call absent: nothing at all, as before", () => {
    expect(html(<MatchCalls view="none" name="Asha" onCall={noop} />)).toBe("")
  })
})

/* ── read receipts ───────────────────────────────────────────────── */

describe("read receipts: the model", () => {
  test("Go zero values: an empty answer is off, no pass", () => {
    for (const wire of [null, undefined, {}, { enabled: null, active: null, available: null }]) {
      expect(toReadReceipts(wire)).toEqual({ enabled: false, active: false, available: false })
    }
  })

  test("the body is the choice alone", () => {
    expect(readReceiptsBody(true)).toEqual({ enabled: true })
    expect(readReceiptsBody(false)).toEqual({ enabled: false })
  })

  test("off, on, locked and held, from the server's answer", () => {
    expect(readReceiptsView({ enabled: false, active: false, available: true })).toBe("off")
    expect(readReceiptsView({ enabled: true, active: true, available: true })).toBe("on")
    expect(readReceiptsView({ enabled: false, active: false, available: false })).toBe("locked")
    expect(readReceiptsView({ enabled: true, active: false, available: false })).toBe("held")
  })

  test("a 403 since the page loaded locks it whatever the stale read said", () => {
    expect(readReceiptsView({ enabled: false, active: false, available: true }, true)).toBe("locked")
    expect(readReceiptsView({ enabled: true, active: true, available: true }, true)).toBe("held")
  })

  test("the switch: on shows the choice, it can't turn on without a pass, and held can still turn off", () => {
    expect(readReceiptsSwitch("off")).toEqual({ checked: false, disabled: false })
    expect(readReceiptsSwitch("on")).toEqual({ checked: true, disabled: false })
    expect(readReceiptsSwitch("locked")).toEqual({ checked: false, disabled: true })
    expect(readReceiptsSwitch("held")).toEqual({ checked: true, disabled: false })
  })

  test("the refusal has our words and is recognised", () => {
    const e = axiosError(403, "READ_RECEIPTS_REQUIRE_PASS")
    expect(isReadReceiptsRequirePass(e)).toBe(true)
    expect(datingErrorCopy(e)).toBe(READ_RECEIPTS_PASS_COPY)
    expect(copyFor(toDatingError(e))).not.toContain("developer words")
    expect(KNOWN_ERROR_CODES).toContain("READ_RECEIPTS_REQUIRE_PASS")
    expect(isReadReceiptsRequirePass(axiosError(403, "TRAVEL_REQUIRES_PASS"))).toBe(false)
  })
})

describe("read receipts: the settings switch", () => {
  const render = (view: ReadReceiptsView, busy = false) => html(<ReadReceiptsSetting view={view} busy={busy} onChange={noop} />)

  test("off: a switch that can turn on, and no upsell", () => {
    const out = render("off")
    expect(out).toContain('role="switch"')
    expect(out).not.toContain('checked=""')
    expect(out).not.toContain('disabled=""')
    expect(out).not.toContain("See passes")
    expect(out).toContain(readReceiptsHelp("off").replace("'", "&#x27;"))
  })

  test("on: the switch is on", () => {
    const out = render("on")
    expect(out).toContain('checked=""')
    expect(out).not.toContain("See passes")
  })

  test("locked: the switch can't turn on, and the way to a pass", () => {
    const out = render("locked")
    expect(out).toContain('disabled=""')
    expect(out).not.toContain('checked=""')
    expect(out).toContain('href="/dating/premium"')
    expect(out).toContain("This comes with a pass.")
  })

  test("held: still on and can be turned off, with why it isn't applying", () => {
    const out = render("held")
    expect(out).toContain('checked=""')
    expect(out).not.toContain('disabled=""')
    expect(out).toContain("On hold while you don&#x27;t have a pass.")
    expect(out).toContain('href="/dating/premium"')
  })

  test("while saving, the switch waits", () => {
    expect(render("off", true)).toContain('disabled=""')
  })
})

/* ── what a pass includes (M10) ──────────────────────────────────── */

describe("pass features", () => {
  test("every code has our own label, alphabetical; unknown codes are left out; repeats are drawn once", () => {
    const codes = ["travel_mode", "read_receipts", "advanced_filters", "unlimited_rewinds", "see_who_sparked", "more_super_sparks", "more_daily_cards", "daily_boost", "match_extend"]
    expect(featureLabels([...codes, "something_new", "read_receipts"])).toEqual([
      "Browse another city before you go",
      "Extra time on a match",
      "Height, language and lifestyle filters",
      "More people in your deck each day",
      "More Super Sparks each day",
      "One Boost every day",
      "See when your messages are read",
      "See who sparked you",
      "Undo a pass as often as you like",
    ])
    expect(featureLabels([])).toEqual([])
    expect(featureLabels(["something_new"])).toEqual([])
  })

  test("what you have: an active pass lists what it unlocks; no pass lists nothing", () => {
    const me = toMyPremium(readFixture("premium_me_get_200_all_mechanics").data)
    const out = html(<Holding me={me} />)
    expect(out).toContain("Your pass includes")
    expect(count(out, /<li>/g)).toBe(9)
    expect(out).toContain("See when your messages are read")
    expect(html(<PassIncludes me={{ hasPass: false, features: me.features }} />)).toBe("")
    expect(html(<PassIncludes me={{ hasPass: true, features: ["something_new"] }} />)).toBe("")
  })
})

/* ── picks: the full profile ─────────────────────────────────────── */

describe("picks: the full profile link", () => {
  test("an opened pick links to the person page", () => {
    const card = toDeck({ data: [{ candidate_id: "c1", profile: { user_id: "u-7", first_name: "Ravi", age: 29 } }] }).cards[0]
    const out = html(<PickOpen card={card} details={null} onBack={noop} onSpark={noop} onPass={noop} />)
    expect(out).toContain(`href="${personHref("u-7")}"`)
    expect(out).toContain(">Full profile<")
    expect(out).toContain("Back to picks")
  })
})
