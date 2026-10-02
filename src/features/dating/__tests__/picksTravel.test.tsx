import { describe, expect, test } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { DatingNav, PICKS_HREF, primaryNav } from "../components/DatingFrame"
import { PICKS_SOURCE, PickOpen, PicksGrid } from "../components/PicksGrid"
import { SwipeDeck } from "../components/SwipeDeck"
import { TRAVEL_HREF, TRAVEL_UPSELL_TITLE, TravelActive, TravelFormPanel, TravelLocked, TravelOff, TripBanner } from "../components/Travel"
import { copyFor, KNOWN_ERROR_CODES } from "../model/errors"
import { toLikedYou, unlockedTileLabel } from "../model/likedYou"
import { metaLine, toPerson, travelMarker } from "../model/people"
import { loadPicksWithZone, MAX_DAILY_PICKS, pickTileLabel, picksLeft, picksResetLine, toPicks } from "../model/picks"
import { toDeck } from "../model/pulse"
import { ACTION_SOURCES, passBody, sparkBody } from "../model/sparks"
import { activeTrip, dayChoices, daysLabel, defaultDays, MAX_TRAVEL_DAYS, toTravelState, travelBody, travelProblem, travelView, tripBanner, tripUntil, type TravelState } from "../model/travel"
import { errorFromEnvelope } from "../model/wire"
import { DeckTitle } from "../screens/HomeScreen"
import { PersonDetails } from "../screens/PersonScreen"
import { PICKS_TITLE, PicksEmpty, PicksOff } from "../screens/PicksScreen"
import { editLinks } from "../screens/SettingsScreen"

import { readFixture } from "./contractFixtures"

const html = (node: React.ReactElement) => renderToStaticMarkup(node)
const noop = () => {}
const axiosError = (status: number, code: string, details?: Record<string, unknown>) => ({ response: { status, data: { error: { code, message: "developer words", details } } } })
const count = (text: string, re: RegExp) => (text.match(re) ?? []).length

const travellingDeck = toDeck(readFixture("pulse_today_get_200_travelling"))
const traveller = travellingDeck.cards[0]
const picks = toPicks(readFixture("picks_get_200"))
const locked = toTravelState(readFixture("travel_get_200").data)
const onTrip = toTravelState(readFixture("travel_put_200").data)

/** A card with its own id, so React keys stay unique. */
const pick = (id: string, firstName: string, extra: Record<string, unknown> = {}) =>
  toDeck({ data: [{ candidate_id: id, match_reasons: [], profile: { user_id: id, first_name: firstName, age: 29, primary_photo_url: `/v1/dating/photos/p-${id}/full`, ...extra } }] }).cards[0]

/* ── daily picks: the model ──────────────────────────────────────── */

describe("daily picks: reading the wire", () => {
  test("Go zero values: no data, no meta is an empty day, never undefined", () => {
    for (const body of [null, undefined, {}, { data: null, meta: null }]) {
      expect(toPicks(body)).toEqual({ cards: [], date: "", timezone: "", resetsAt: "", size: 0 })
    }
  })

  test("the meta is read as sent; size never says fewer than the cards", () => {
    const p = toPicks({ data: readFixture("picks_get_200").data, meta: { date: "2026-10-02", timezone: "Asia/Kolkata", resets_at: "2026-10-02T18:30:00Z" } })
    expect(p).toMatchObject({ date: "2026-10-02", timezone: "Asia/Kolkata", resetsAt: "2026-10-02T18:30:00Z", size: 1 })
  })

  test("a repeated candidate is drawn once, and never more than ten", () => {
    const wire = (id: string) => ({ candidate_id: id, profile: { user_id: id, first_name: "A" } })
    const many = Array.from({ length: 14 }, (_, i) => wire(`c${i}`))
    expect(toPicks({ data: [wire("c0"), ...many] }).cards.map((c) => c.candidateId)).toEqual(many.slice(0, MAX_DAILY_PICKS).map((w) => w.candidate_id))
  })

  test("the reset line is the reader's local time, or a plain line when unknown", () => {
    const at = "2026-10-02T18:30:00Z"
    const clock = new Date(at).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })
    expect(picksResetLine(at, "en-GB")).toBe(`New picks at ${clock}`)
    expect(picksResetLine("")).toBe("New picks arrive every day at midnight.")
    expect(picksResetLine("not a time")).toBe("New picks arrive every day at midnight.")
  })

  test("answered picks leave the grid; the tile label names the person and the trip", () => {
    const a = pick("a", "Asha")
    const b = pick("b", "Ravi", { travelling: true, city: "Pune" })
    expect(picksLeft({ cards: [a, b] }, new Set(["a"])).map((c) => c.candidateId)).toEqual(["b"])
    expect(pickTileLabel(a)).toBe("Asha, 29. Open profile.")
    expect(pickTileLabel(b)).toBe("Ravi, 29. Visiting Pune. Open profile.")
  })
})

describe("daily picks: the time zone", () => {
  test("the zone is sent; an unknown one is asked again once, without a zone", async () => {
    const asked: string[] = []
    const load = async (tz: string) => {
      asked.push(tz)
      if (tz) throw axiosError(400, "INVALID_TIMEZONE")
      return "picks"
    }
    expect(await loadPicksWithZone(load, "Mars/Olympus_Mons")).toBe("picks")
    expect(asked).toEqual(["Mars/Olympus_Mons", ""])
  })

  test("a known zone is asked once", async () => {
    const asked: string[] = []
    expect(await loadPicksWithZone(async (tz) => (asked.push(tz), "ok"), "Asia/Kolkata")).toBe("ok")
    expect(asked).toEqual(["Asia/Kolkata"])
  })

  test("any other refusal, or a second one, is thrown as it came", async () => {
    let calls = 0
    const off = async () => {
      calls++
      throw axiosError(404, "MECHANIC_NOT_ENABLED")
    }
    await expect(loadPicksWithZone(off, "Asia/Kolkata")).rejects.toMatchObject({ response: { status: 404 } })
    expect(calls).toBe(1)
    calls = 0
    const always = async () => {
      calls++
      throw axiosError(400, "INVALID_TIMEZONE")
    }
    await expect(loadPicksWithZone(always, "X/Y")).rejects.toMatchObject({ response: { status: 400 } })
    expect(calls).toBe(2)
    calls = 0
    // With no zone to drop, there is nothing to retry.
    await expect(loadPicksWithZone(always, "")).rejects.toBeDefined()
    expect(calls).toBe(1)
  })
})

describe("where an action comes from (M7)", () => {
  test("a deck spark and pass are exactly what they were before sources existed", () => {
    expect(sparkBody("u1")).toEqual({ to_user_id: "u1", target_kind: "photo", target_ref: "0" })
    expect(sparkBody("u1", "", false, "deck")).toEqual({ to_user_id: "u1", target_kind: "photo", target_ref: "0" })
    expect(passBody()).toEqual({})
    expect(passBody("deck")).toEqual({})
  })

  test("picks, liked you and a profile name themselves", () => {
    expect(sparkBody("u1", "hi", false, "picks")).toEqual({ to_user_id: "u1", target_kind: "photo", target_ref: "0", note: "hi", source: "picks" })
    expect(passBody("picks")).toEqual({ source: "picks" })
    expect(passBody("liked_you")).toEqual({ source: "liked_you" })
    expect(sparkBody("u1", undefined, false, "profile").source).toBe("profile")
    expect([...ACTION_SOURCES]).toEqual(["deck", "liked_you", "picks", "profile"])
  })

  test("the picks page sends picks", () => {
    expect(PICKS_SOURCE).toBe("picks")
    expect(sparkBody("u1", undefined, false, PICKS_SOURCE).source).toBe("picks")
    expect(passBody(PICKS_SOURCE)).toEqual({ source: "picks" })
  })

  test("an unknown source has its own words", () => {
    expect(KNOWN_ERROR_CODES).toContain("INVALID_SOURCE")
    expect(copyFor(errorFromEnvelope(axiosError(400, "INVALID_SOURCE").response.data, 400))).not.toContain("source must be")
  })
})

/* ── daily picks: the page ───────────────────────────────────────── */

describe("daily picks: the grid", () => {
  const cards = [pick("a", "Asha"), pick("b", "Ravi", { travelling: true, city: "Pune" })]
  const out = html(<PicksGrid cards={cards} onOpen={noop} onSpark={noop} onPass={noop} />)

  test("one tile per pick, each with Pass and Spark, every action marked as from picks", () => {
    expect(out).toContain('aria-label="Today&#x27;s picks"')
    expect(count(out, /class="pulse-like"/g)).toBe(2)
    expect(out).toContain('aria-label="Spark Asha"')
    expect(out).toContain('aria-label="Pass on Ravi"')
    expect(count(out, /data-source="picks"/g)).toBe(2)
  })

  test("a traveller's tile carries the marker; the other does not", () => {
    expect(count(out, />Visiting Pune</g)).toBe(1)
    expect(out).toContain('aria-label="Ravi, 29. Visiting Pune. Open profile."')
    expect(out).toContain('aria-label="Asha, 29. Open profile."')
  })

  test("while the server decides one pick, every action waits", () => {
    const busy = html(<PicksGrid cards={cards} acting="a" pending="spark" onOpen={noop} onSpark={noop} onPass={noop} />)
    expect(count(busy, /disabled=""/g)).toBe(4)
    expect(count(busy, /aria-busy="true"/g)).toBe(1)
  })

  test("an opened pick draws the full card with the same two actions and a way back", () => {
    const open = html(<PickOpen card={cards[1]} details={<PersonDetails person={cards[1].person} />} onBack={noop} onSpark={noop} onPass={noop} />)
    expect(open).toContain("Back to picks")
    expect(open).toContain("Visiting Pune")
    expect(open).toContain('data-source="picks"')
  })

  test("off, empty and answered states say so in our words", () => {
    expect(PICKS_TITLE).toBe("Today's picks")
    expect(html(<PicksOff />)).toContain("Picks aren&#x27;t on yet")
    const none = html(<PicksEmpty answered={false} resetsAt="" />)
    expect(none).toContain("No picks for today")
    expect(none).toContain("New picks arrive tomorrow.")
    expect(html(<PicksEmpty answered resetsAt="" />)).toContain("You&#x27;ve answered today&#x27;s picks")
  })

  test("the Picks tab leaves once picks are known to be off", () => {
    expect(primaryNav(false).map((e) => e.label)).toEqual(["Deck", "Liked you", "Matches", "Picks"])
    expect(primaryNav(true).map((e) => e.label)).toEqual(["Deck", "Liked you", "Matches"])
    expect(html(<DatingNav pathname="/dating" />)).toContain(`href="${PICKS_HREF}"`)
    expect(html(<DatingNav pathname="/dating" picksOff />)).not.toContain(`href="${PICKS_HREF}"`)
    expect(html(<DatingNav pathname="/dating/picks" />)).toContain(`aria-current="page" href="${PICKS_HREF}"`)
  })
})

/* ── travel: the model ───────────────────────────────────────────── */

describe("travel: reading the wire", () => {
  test("Go zero values: nothing sent is no trip, no pass, no cities and the documented week", () => {
    for (const wire of [null, undefined, {}, { active: null, cities: null, max_days: 0 }]) {
      expect(toTravelState(wire)).toEqual({ active: null, available: false, cities: [], maxDays: MAX_TRAVEL_DAYS })
    }
  })

  test("cities come out alphabetical by label, once each; a missing label falls back to the code", () => {
    const t = toTravelState({ cities: [{ code: "pune", label: "Pune" }, { code: "goa", label: "" }, { code: "delhi", label: "Delhi" }, { code: "pune", label: "Pune" }, { code: "" }] })
    expect(t.cities).toEqual([
      { code: "delhi", label: "Delhi" },
      { code: "goa", label: "goa" },
      { code: "pune", label: "Pune" },
    ])
  })

  test("an active trip without a city is no trip", () => {
    expect(toTravelState({ active: { starts_at: "2026-10-02T00:00:00Z" } }).active).toBeNull()
  })
})

describe("travel: what the page shows", () => {
  const ends = "2026-10-09T13:00:00Z"
  const state = (over: Partial<TravelState>): TravelState => ({ active: null, available: true, cities: onTrip.cities, maxDays: 7, ...over })
  const trip = { city: { code: "mumbai", label: "Mumbai" }, startsAt: "2026-10-02T13:00:00Z", endsAt: ends }

  test("the view is the server's: no pass is locked whatever else holds", () => {
    expect(travelView(state({}))).toBe("ready")
    expect(travelView(state({ active: trip }))).toBe("active")
    expect(travelView(state({ available: false, active: trip }))).toBe("locked")
    expect(travelView(state({}), true)).toBe("locked")
    expect(travelView(locked)).toBe("locked")
    expect(travelView(onTrip)).toBe("active")
  })

  test("the deck's banner shows only a trip in effect", () => {
    const before = Date.parse("2026-10-05T00:00:00Z")
    const after = Date.parse("2026-10-10T00:00:00Z")
    expect(activeTrip(state({ active: trip }), before)).toEqual(trip)
    expect(activeTrip(state({ active: trip }), after)).toBeNull()
    expect(activeTrip(state({ active: trip, available: false }), before)).toBeNull()
    expect(activeTrip(state({}), before)).toBeNull()
    expect(activeTrip(undefined)).toBeNull()
  })

  test("the banner says where and until when, in the reader's locale", () => {
    const until = tripUntil(ends, "en-GB")
    expect(until).toContain(new Date(ends).toLocaleDateString("en-GB", { day: "numeric", month: "short" }).split(" ")[0])
    expect(tripBanner(trip, "en-GB")).toBe(`Browsing Mumbai until ${until}`)
    expect(tripBanner({ ...trip, endsAt: "" })).toBe("Browsing Mumbai")
    expect(tripUntil("")).toBe("")
  })

  test("days are 1 to the server's longest trip", () => {
    expect(dayChoices(7)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(dayChoices(2)).toEqual([1, 2])
    expect(dayChoices(0)).toHaveLength(MAX_TRAVEL_DAYS)
    expect(defaultDays(7)).toBe(3)
    expect(defaultDays(2)).toBe(2)
    expect(daysLabel(1)).toBe("1 day")
    expect(daysLabel(5)).toBe("5 days")
  })

  test("the form is checked against the server's own list before it is sent", () => {
    const s = state({})
    expect(travelProblem({ city: "", days: 3 }, s)).toBe("Pick a city.")
    expect(travelProblem({ city: "atlantis", days: 3 }, s)).toBe("Pick a city from the list.")
    expect(travelProblem({ city: "mumbai", days: 0 }, s)).toBe("Choose a trip of 1 to 7 days.")
    expect(travelProblem({ city: "mumbai", days: 8 }, s)).toBe("Choose a trip of 1 to 7 days.")
    expect(travelProblem({ city: "mumbai", days: 2.5 }, s)).toBe("Choose a trip of 1 to 7 days.")
    expect(travelProblem({ city: "mumbai", days: 7 }, s)).toBe("")
    expect(travelBody({ city: "mumbai", days: 7 })).toEqual({ city: "mumbai", days: 7 })
  })

  test("the server's day range and the other refusals have our words", () => {
    expect(copyFor(errorFromEnvelope(axiosError(400, "INVALID_TRAVEL_DAYS", { min: 1, max: 7 }).response.data, 400))).toBe("Choose a trip of 1 to 7 days.")
    expect(copyFor(errorFromEnvelope(axiosError(400, "INVALID_TRAVEL_DAYS").response.data, 400))).toBe("Choose a shorter trip.")
    for (const code of ["INVALID_CITY", "INVALID_TIMEZONE", "INVALID_TRAVEL_DAYS", "TRAVEL_REQUIRES_PASS"]) expect(KNOWN_ERROR_CODES).toContain(code)
  })
})

/* ── the travelling marker ───────────────────────────────────────── */

describe("the travelling marker", () => {
  test("only `travelling: true` is a traveller; the city is the destination", () => {
    expect(travelMarker({ travelling: true, city: "Hyderabad" })).toBe("Visiting Hyderabad")
    expect(travelMarker({ travelling: true, city: "" })).toBe("Visiting from out of town")
    expect(travelMarker({ travelling: false, city: "Hyderabad" })).toBe("")
    expect(toPerson({ user_id: "u", travelling: "true" })?.travelling).toBe(false)
    expect(toPerson({ user_id: "u" })?.travelling).toBe(false)
  })

  test("a traveller's meta line leaves the city to the marker; anyone else keeps it", () => {
    const home = toPerson({ user_id: "u", city: "Pune", intent: "casual" })!
    expect(metaLine(home)).toContain("Pune")
    expect(metaLine(traveller.person)).not.toContain("Hyderabad")
  })

  test("on a deck card", () => {
    const out = html(<SwipeDeck cards={travellingDeck.cards} onAction={noop} />)
    expect(out).toContain(">Visiting Hyderabad<")
    expect(out).toContain("Asha, 30. Visiting Hyderabad. Arrow right to spark")
    // No one else gets one.
    const home = html(<SwipeDeck cards={toDeck(readFixture("pulse_today_get_200")).cards} onAction={noop} />)
    expect(home).not.toContain("Visiting")
  })

  test("on the person page", () => {
    expect(html(<PersonDetails person={traveller.person} />)).toContain(">Visiting Hyderabad<")
  })

  test("on an unlocked liked-you tile", () => {
    const data = toLikedYou({
      total: 1,
      unlocked: true,
      items: [{ spark_id: "s1", photo_url: "/v1/dating/photos/p1/full", person: { user_id: "u1", first_name: "Asha", age: 30, travelling: true, city: "Goa", primary_photo_url: "/v1/dating/photos/p1/full" } }],
    })
    expect(unlockedTileLabel(data.cards[0])).toBe("Asha, 30. Visiting Goa. Open profile.")
  })
})

/* ── travel: the page ────────────────────────────────────────────── */

describe("travel: the page", () => {
  test("locked without a trip: the upsell to a pass, nothing to end", () => {
    const out = html(<TravelLocked trip={null} onEnd={noop} />)
    expect(out).toContain(TRAVEL_UPSELL_TITLE)
    expect(out).toContain('href="/dating/premium"')
    expect(out).not.toContain("End trip")
  })

  test("locked with a trip on record: it can still be ended", () => {
    const out = html(<TravelLocked trip={onTrip.active} onEnd={noop} />)
    expect(out).toContain("Your trip to Mumbai is on hold")
    expect(out).toContain("End trip")
  })

  test("active: where, End trip, and the deck", () => {
    const out = html(<TravelActive trip={onTrip.active!} onEnd={noop} />)
    expect(out).toContain("You&#x27;re browsing Mumbai")
    expect(out).toContain("End trip")
    expect(out).toContain('href="/dating"')
  })

  test("the form: the server's cities alphabetically, 1 to max days, Start trip", () => {
    const out = html(<TravelFormPanel state={onTrip} form={{ city: "", days: 3 }} onChange={noop} onStart={noop} />)
    const labels = [...out.matchAll(/<option value="[a-z_]+"[^>]*>([^<]+)<\/option>/g)].map((m) => m[1])
    expect(labels).toHaveLength(22)
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))
    expect(out).toContain(">Choose a city<")
    expect(count(out, /<option value="\d+"/g)).toBe(7)
    expect(out).toContain(">7 days<")
    expect(out).toContain("Start trip")
    expect(out).toContain("Plan a trip")
    expect(html(<TravelFormPanel state={onTrip} form={{ city: "mumbai", days: 3 }} changing onChange={noop} onStart={noop} />)).toContain("Change your trip")
  })

  test("off: a note, nothing to send", () => {
    const out = html(<TravelOff />)
    expect(out).toContain("Travel isn&#x27;t on yet")
    expect(out).not.toContain("<form")
  })

  test("the deck: a Travel button while travel is on, and the trip banner", () => {
    const trip = { city: { code: "mumbai", label: "Mumbai" }, startsAt: "", endsAt: "" }
    const on = html(<DeckTitle showFilters={false} showTravel trip={trip} />)
    expect(on).toContain(`href="${TRAVEL_HREF}"`)
    expect(on).toContain("Browsing Mumbai")
    expect(html(<TripBanner trip={trip} />)).toContain(">Manage<")
    const off = html(<DeckTitle showFilters={false} />)
    expect(off).not.toContain(TRAVEL_HREF)
    expect(off).not.toContain("Browsing")
  })

  test("Settings links to Travel only while it is on, alphabetically", () => {
    expect(editLinks(false, true).map((l) => l.label)).toEqual(["About me", "Basics", "Looking for", "Photos", "Preferences", "Prompts", "Selfie check", "Travel"])
    expect(editLinks(true, false).map((l) => l.label)).not.toContain("Travel")
    expect(editLinks(true, true).find((l) => l.label === "Travel")?.href).toBe(TRAVEL_HREF)
  })
})
