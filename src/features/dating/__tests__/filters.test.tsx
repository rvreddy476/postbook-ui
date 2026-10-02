import { describe, expect, test } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { AboutMeEditor, PREFER_NOT_TO_SAY, pickedLine } from "../components/AboutMe"
import { FILTERS_HREF, FILTERS_UPSELL_TITLE, FiltersOff, FiltersPanel } from "../components/Filters"
import { SwipeDeck } from "../components/SwipeDeck"
import { copyFor, datingErrorCopy, KNOWN_ERROR_CODES, refusedField } from "../model/errors"
import { languageLabel } from "../model/labels"
import { basicsLabels, cardChips, heightChoices, interestLabels, knownCodes, labelFor, labelsFor, languageLabels, NO_BASICS, OPTION_DEFAULTS, toBasics, toggleCode, toProfileOptions } from "../model/options"
import { toPerson } from "../model/people"
import {
  aboutBody,
  aboutForm,
  aboutProblem,
  clearPassFiltersBody,
  droppedLanguages,
  filtersBody,
  filtersEnabled,
  filtersForm,
  filtersProblem,
  hasPassFilters,
  PRIVACY_TOGGLES,
  toPreferences,
  toProfile,
  visiblePrivacyToggles,
  withoutPassFilters,
  type AboutForm,
} from "../model/profile"
import { errorFromEnvelope } from "../model/wire"
import { DeckTitle } from "../screens/HomeScreen"
import { PersonDetails } from "../screens/PersonScreen"
import { editLinks, PrivacyToggles } from "../screens/SettingsScreen"

import { readFixture } from "./contractFixtures"

const html = (node: React.ReactElement) => renderToStaticMarkup(node)
const noop = () => {}
const axiosError = (status: number, code: string, details?: Record<string, unknown>) => ({ response: { status, data: { error: { code, message: "developer words", details } } } })
const count = (text: string, re: RegExp) => (text.match(re) ?? []).length

const options = toProfileOptions(readFixture("profile_options_get_200").data)
const withFilters = toPreferences(readFixture("preferences_get_200_filters").data)
const flagOff = toPreferences(readFixture("preferences_get_200").data)
const locked = toPreferences({ ...(readFixture("preferences_get_200_filters").data as object), pass_filters: { active: false, verified_only: false, languages: [], drinking: [], smoking: [], exercise: [], diet: [] } })
const asha = toPerson(readFixture("person_get_200_basics").data)!

/* ── the model ───────────────────────────────────────────────────── */

describe("profile options", () => {
  test("an empty or broken read is empty lists and the documented limits, never undefined", () => {
    for (const wire of [null, undefined, {}, { interests: "x", height_cm: null }]) {
      const o = toProfileOptions(wire)
      expect(o.interests).toEqual([])
      expect(o.distanceBuckets).toEqual([])
      expect(o.maxInterests).toBe(OPTION_DEFAULTS.maxInterests)
      expect(o.maxLanguages).toBe(OPTION_DEFAULTS.maxLanguages)
      expect([o.heightMin, o.heightMax]).toEqual([120, 230])
    }
  })

  test("entries without a code or a label, and repeats, are dropped; lists sort by label, scales keep their order", () => {
    const o = toProfileOptions({
      interests: [{ code: "yoga", label: "Yoga" }, { code: "art", label: "Art" }, { code: "", label: "Nothing" }, { code: "x", label: "" }, { code: "art", label: "Art again" }],
      drinking: [{ code: "regularly", label: "Regularly" }, { code: "never", label: "Never" }],
    })
    expect(o.interests).toEqual([
      { value: "art", label: "Art" },
      { value: "yoga", label: "Yoga" },
    ])
    expect(o.drinking.map((d) => d.value)).toEqual(["regularly", "never"])
  })

  test("codes to labels: the server's labels, unknown codes ignored", () => {
    expect(labelFor("te", options.languages)).toBe("Telugu")
    expect(labelFor("klingon", options.languages)).toBe("")
    expect(labelFor("", options.languages)).toBe("")
    expect(labelsFor(["yoga", "made_up", "books", "yoga"], options.interests)).toEqual(["Books", "Yoga"])
    expect(knownCodes(["yoga", "made_up", "books"], options.interests)).toEqual(["books", "yoga"])
    expect(toggleCode(["a"], "b")).toEqual(["a", "b"])
    expect(toggleCode(["a", "b"], "a")).toEqual(["b"])
  })

  test("heights run the server's range in whole centimetres", () => {
    const h = heightChoices(options)
    expect(h).toHaveLength(111)
    expect(h[0]).toEqual({ value: "120", label: "120 cm" })
    expect(h[h.length - 1].label).toBe("230 cm")
  })
})

describe("a person's basics", () => {
  test("Go zero values are empty", () => {
    expect(toBasics({})).toEqual(NO_BASICS)
    expect(toBasics({ interests: null, height_cm: 0, drinking: "" })).toEqual(NO_BASICS)
    // The old card shape has no basics at all.
    expect(toPerson(readFixture("person_get_200").data)!.basics).toEqual(NO_BASICS)
  })

  test("labels come from the options; unknown codes and an out-of-range height are dropped", () => {
    const basics = { interests: ["yoga", "teleportation"], heightCm: 400, drinking: "socially", smoking: "sometimes_maybe", exercise: "", diet: "jain" }
    expect(interestLabels(basics, options)).toEqual(["Yoga"])
    expect(basicsLabels(basics, options)).toEqual(["Drinking: Socially", "Jain"])
    // Without the options read nothing is drawn: never a raw code.
    expect(interestLabels(basics, null)).toEqual([])
    expect(basicsLabels(basics, undefined)).toEqual([])
  })

  test("languages: the list's label for a code, the old capitalised word otherwise", () => {
    expect(languageLabels(["te", "en", "te"], options, languageLabel)).toEqual(["English", "Telugu"])
    expect(languageLabels(["telugu"], options, languageLabel)).toEqual(["Telugu"])
    expect(languageLabels(["te"], null, languageLabel)).toEqual(["Te"])
  })

  test("the deck card shows at most four chips and says how many more", () => {
    expect(cardChips(asha.basics, options)).toEqual({ chips: ["Books", "Cricket", "Yoga", "172 cm"], more: 4 })
    expect(cardChips(asha.basics, null)).toEqual({ chips: [], more: 0 })
    expect(cardChips({ ...NO_BASICS, interests: ["art"] }, options)).toEqual({ chips: ["Art"], more: 0 })
  })
})

describe("preferences with the filters flag", () => {
  test("absent pass_filters means the flag is off; partial ones read Go zero values as empty", () => {
    expect(flagOff.passFilters).toBeNull()
    expect(filtersEnabled(flagOff)).toBe(false)
    const p = toPreferences({ distance_bucket: "lt_5_km", pass_filters: { active: true, languages: null } })
    expect(p.passFilters).toEqual({ active: true, verifiedOnly: false, minHeightCm: 0, maxHeightCm: 0, languages: [], drinking: [], smoking: [], exercise: [], diet: [] })
    expect(hasPassFilters(p.passFilters)).toBe(false)
    expect(hasPassFilters({ ...p.passFilters!, maxHeightCm: 180 })).toBe(true)
  })

  test("the old verified-only privacy toggle goes only while the flag is on", () => {
    expect(visiblePrivacyToggles(flagOff)).toEqual(PRIVACY_TOGGLES)
    expect(visiblePrivacyToggles(null)).toEqual(PRIVACY_TOGGLES)
    expect(visiblePrivacyToggles(withFilters).map((t) => t.key)).toEqual(PRIVACY_TOGGLES.map((t) => t.key).filter((k) => k !== "verifiedOnlyFilter"))
    expect(visiblePrivacyToggles(withFilters, { verifiedOnlyFilter: false })).toHaveLength(4)
    // Still on from before the flag: it stays until switched off, or it could never be turned off.
    expect(visiblePrivacyToggles(withFilters, { verifiedOnlyFilter: true })).toEqual(PRIVACY_TOGGLES)
  })
})

describe("the filters form", () => {
  test("the distance bucket: the saved one, else read from the radius, else the first option", () => {
    expect(filtersForm(withFilters, options).distanceBucket).toBe("km_5_10")
    expect(filtersForm(toPreferences({ distance_km: 4, pass_filters: { active: false } }), options).distanceBucket).toBe("lt_5_km")
    expect(filtersForm(toPreferences({ distance_km: 300, pass_filters: { active: false } }), options).distanceBucket).toBe("gt_25_km")
    expect(filtersForm(toPreferences({ distance_bucket: "on_the_moon", pass_filters: { active: false } }), options).distanceBucket).toBe("lt_5_km")
  })

  test("codes the lists don't know are dropped from the form", () => {
    const p = toPreferences({ pass_filters: { active: true, languages: ["te", "xx"], diet: ["vegan", "carnivore"], min_height_cm: 90 } })
    const form = filtersForm(p, options)
    expect(form.languages).toEqual(["te"])
    expect(form.diet).toEqual(["vegan"])
    expect(form.minHeightCm).toBe(0)
  })

  test("without a pass the pass section is left out of the save; with one it is all sent", () => {
    const form = filtersForm(withFilters, options)
    const free = filtersBody({ ...form, intentFilter: ["serious", "casual"] }, false)
    expect(free).toEqual({ min_age: 24, max_age: 34, distance_bucket: "km_5_10", intent_filter: ["casual", "serious"] })
    expect(free).not.toHaveProperty("pass_filters")
    expect(free).not.toHaveProperty("language_filter")
    const all = filtersBody({ ...form, minHeightCm: 0 }, true)
    expect(all.pass_filters).not.toHaveProperty("min_height_cm")
    expect(all.pass_filters).toHaveProperty("max_height_cm", 190)
  })

  test("clearing is every pass filter off, and the cleared form has none", () => {
    expect(clearPassFiltersBody()).toEqual({ pass_filters: { verified_only: false, languages: [], drinking: [], smoking: [], exercise: [], diet: [] } })
    const cleared = withoutPassFilters(filtersForm(withFilters, options))
    expect(hasPassFilters(cleared)).toBe(false)
    expect(cleared.distanceBucket).toBe("km_5_10")
  })

  test("problems: ages, the bucket, and the shorter height first", () => {
    const form = filtersForm(withFilters, options)
    expect(filtersProblem(form, options)).toBeNull()
    expect(filtersProblem({ ...form, minAge: 17 }, options)?.field).toBe("min_age")
    expect(filtersProblem({ ...form, minAge: 40, maxAge: 30 }, options)?.message).toBe("The lower age must come first.")
    expect(filtersProblem({ ...form, distanceBucket: "" }, options)?.field).toBe("distance_bucket")
    expect(filtersProblem({ ...form, minHeightCm: 190, maxHeightCm: 160 }, options)).toEqual({ field: "min_height_cm", message: "The shorter height must come first." })
  })
})

describe("about me", () => {
  const profile = toProfile({ ...(readFixture("profile_get_200").data as object), language_prefs: ["te", "telugu"], interests: ["yoga", "made_up"], height_cm: 172, drinking: "socially", diet: "carnivore" })

  test("the form starts from what is saved, keeping only known codes", () => {
    const form = aboutForm(profile, options)
    expect(form).toEqual({ interests: ["yoga"], heightCm: 172, languages: ["te"], drinking: "socially", smoking: "", exercise: "", diet: "" })
    expect(droppedLanguages(profile, options)).toBe(1)
    expect(aboutForm(null, options)).toEqual({ interests: [], heightCm: 0, languages: [], drinking: "", smoking: "", exercise: "", diet: "" })
  })

  test("limits are checked before saving", () => {
    const base = aboutForm(null, options)
    const eleven = options.interests.slice(0, 11).map((o) => o.value)
    expect(aboutProblem({ ...base, interests: eleven }, options)).toEqual({ field: "interests", message: "You can pick up to 10 interests." })
    expect(aboutProblem({ ...base, languages: options.languages.slice(0, 9).map((o) => o.value) }, options)?.field).toBe("language_prefs")
    expect(aboutProblem({ ...base, heightCm: 119 }, options)?.field).toBe("height_cm")
    expect(aboutProblem({ ...base, interests: eleven.slice(0, 10) }, options)).toBeNull()
  })

  test("the save sends every field; prefer not to say is \"\"; no height is left out", () => {
    const form: AboutForm = { interests: [], heightCm: 0, languages: ["en"], drinking: "", smoking: "never", exercise: "", diet: "vegan" }
    expect(aboutBody(form)).toEqual({ interests: [], language_prefs: ["en"], drinking: "", smoking: "never", exercise: "", diet: "vegan" })
    expect(aboutBody({ ...form, heightCm: 180 }).height_cm).toBe(180)
  })
})

describe("refusals for M6", () => {
  test("every new code has its own words, and the limits come from details", () => {
    for (const code of ["FILTERS_REQUIRE_PASS", "INVALID_DISTANCE_BUCKET", "INVALID_HEIGHT", "INVALID_INTEREST", "INVALID_LANGUAGE", "INVALID_LIFESTYLE", "TOO_MANY_INTEREST", "TOO_MANY_LANGUAGE"]) {
      expect(KNOWN_ERROR_CODES).toContain(code)
      expect(datingErrorCopy(axiosError(400, code))).not.toBe("developer words")
    }
    expect(datingErrorCopy(axiosError(400, "TOO_MANY_INTEREST", { field: "interests", max: 10 }))).toBe("You can pick up to 10 interests.")
    expect(datingErrorCopy(axiosError(400, "TOO_MANY_LANGUAGE", { field: "language_prefs" }))).toBe("That's too many languages. Remove one and save.")
    expect(datingErrorCopy(axiosError(400, "INVALID_HEIGHT", { field: "min_height_cm", min: 120, max: 230 }))).toBe("Choose heights between 120 and 230 cm, the shorter one first.")
    expect(refusedField(axiosError(400, "INVALID_LIFESTYLE", { field: "diet" }))).toBe("diet")
    expect(refusedField(axiosError(403, "FILTERS_REQUIRE_PASS"))).toBe("")
    expect(copyFor(errorFromEnvelope(readFixture("preferences_put_400_invalid_distance_bucket")))).toContain("distance")
  })
})

/* ── the components ──────────────────────────────────────────────── */

describe("filters screen", () => {
  const form = filtersForm(withFilters, options)
  const panel = (over: Partial<React.ComponentProps<typeof FiltersPanel>>) =>
    html(<FiltersPanel options={options} form={form} locked={false} savedPass={false} busy={false} clearing={false} error="" fieldError={null} onChange={noop} onSave={noop} onClear={noop} {...over} />)

  test("unlocked: every filter works, no upsell", () => {
    const out = panel({})
    expect(out).not.toContain(FILTERS_UPSELL_TITLE)
    expect(out).toMatch(/<fieldset class="pulse-filters__pass">/)
    expect(out).toContain("Your pass is active")
    expect(out).not.toContain(">Clear pass filters<")
    // The server's labels, never its codes; buckets keep their order.
    expect(out).toContain(">Within 10 km<")
    expect(out).not.toContain(">km_5_10<")
    const at = ["Under 5 km", "Within 10 km", "Within 25 km", "Any distance"].map((l) => out.indexOf(`>${l}<`))
    expect(at.every((x, i) => x >= 0 && (i === 0 || x > at[i - 1]))).toBe(true)
    // Saved choices show as picked.
    expect(out).toMatch(/checked="" value="km_5_10"/)
    expect(out).toMatch(/name="filter-diet" checked="" value="vegetarian"/)
  })

  test("locked: the free section stays, the pass section is off under a Premium upsell", () => {
    const out = panel({ locked: true, form: filtersForm(locked, options) })
    expect(out).toContain(FILTERS_UPSELL_TITLE)
    expect(out).toContain('href="/dating/premium"')
    expect(out).toContain(">See passes<")
    expect(out).toMatch(/<fieldset class="pulse-filters__pass" disabled=""/)
    // The free section is outside the locked fieldset and still enabled.
    expect(out).toMatch(/<fieldset class="pulse-choices"><legend class="pulse-field__label">How far to look</)
    expect(out).toMatch(/<button type="submit"[^>]*>.*Save filters/)
    expect(out).not.toContain(">Clear pass filters<")
    expect(out).not.toMatch(/subscri|renew/i)
  })

  test("locked with saved pass filters: they can still be cleared", () => {
    const out = panel({ locked: true, savedPass: true })
    expect(out).toContain("They&#x27;re kept, but they don&#x27;t change your deck")
    expect(out).toMatch(/<button type="button" class="pulse-btn pulse-btn--secondary"><svg[^>]*>.*?<span>Clear pass filters<\/span>/)
    expect(out).not.toMatch(/<button type="button"[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Clear pass filters/)
  })

  test("a refusal is drawn under the field it names", () => {
    const out = panel({ fieldError: { field: "min_height_cm", message: "The shorter height must come first." } })
    expect(out).toMatch(/Shortest<\/label><select[^>]*>.*<\/select><p class="pulse-field__error" role="alert">The shorter height must come first.<\/p>/)
  })

  test("flag off: a pointer to Preferences, nothing to save", () => {
    const out = html(<FiltersOff />)
    expect(out).toContain("Filters aren&#x27;t on yet")
    expect(out).toContain('href="/dating/onboarding/preferences"')
    expect(out).not.toContain("<form")
  })

  test("the deck's Filters button shows only while the flag is on", () => {
    const on = html(<DeckTitle showFilters />)
    expect(on).toContain(`href="${FILTERS_HREF}"`)
    expect(on).toContain(">Filters<")
    expect(html(<DeckTitle showFilters={false} />)).not.toContain(FILTERS_HREF)
  })
})

describe("about me editor", () => {
  const editor = (form: AboutForm, over: Partial<React.ComponentProps<typeof AboutMeEditor>> = {}) =>
    html(<AboutMeEditor options={options} form={form} heightSaved={false} busy={false} error="" fieldError={null} onChange={noop} onSave={noop} {...over} />)
  const empty = aboutForm(null, options)
  const disabledIn = (out: string, name: string) => count(out, new RegExp(`<input type="checkbox" disabled="" name="${name}"`, "g"))

  test("under the limits nothing is switched off", () => {
    const out = editor(empty)
    expect(out).toContain(pickedLine(0, 10))
    expect(disabledIn(out, "interests")).toBe(0)
    expect(disabledIn(out, "languages")).toBe(0)
    expect(out).toContain(">Board games<")
    expect(out).not.toContain(">board_games<")
  })

  test("at ten interests and eight languages the unpicked chips switch off", () => {
    const interests = options.interests.slice(0, 10).map((o) => o.value)
    const languages = options.languages.slice(0, 8).map((o) => o.value)
    const out = editor({ ...empty, interests, languages })
    expect(out).toContain("10 of 10 picked")
    expect(out).toContain("8 of 8 picked")
    expect(disabledIn(out, "interests")).toBe(options.interests.length - 10)
    expect(disabledIn(out, "languages")).toBe(options.languages.length - 8)
    // A picked chip can always be unpicked.
    expect(out).not.toMatch(/disabled="" name="interests" checked=""/)
    expect(out).toMatch(/name="interests" checked="" value="art"\/>/)
  })

  test("each basic offers prefer not to say; height does too until one is saved", () => {
    const out = editor(empty)
    expect(count(out, new RegExp(`>${PREFER_NOT_TO_SAY}<`, "g"))).toBe(5)
    const saved = editor({ ...empty, heightCm: 172 }, { heightSaved: true })
    expect(count(saved, new RegExp(`>${PREFER_NOT_TO_SAY}<`, "g"))).toBe(4)
    expect(saved).toContain('<option value="172" selected="">172 cm</option>')
    expect(saved).toContain("You can change your height, but not remove it.")
    // The four basics, in the server's order for the scales.
    expect(out.indexOf(">Trying to quit<")).toBeGreaterThan(out.indexOf(">Regularly<"))
  })

  test("a refusal lands under the field the server names", () => {
    const out = editor(empty, { fieldError: { field: "interests", message: "One of those interests isn't on the list any more. Pick again and save." } })
    expect(out).toMatch(/name="interests".*One of those interests isn&#x27;t on the list any more/)
    expect(count(out, /role="alert"/g)).toBe(1)
  })
})

describe("chips on the card and the profile", () => {
  test("the deck card: labels from the options, capped, never codes", () => {
    const cards = [{ candidateId: "c1", person: asha, reasons: [] }]
    const out = html(<SwipeDeck cards={cards} onAction={noop} options={options} />)
    for (const label of [">Books<", ">Cricket<", ">Yoga<", ">172 cm<", ">+4 more<"]) expect(out).toContain(label)
    expect(out).not.toContain(">books<")
    // Without the options read the card is exactly as before.
    expect(html(<SwipeDeck cards={cards} onAction={noop} />)).not.toContain("pulse-card__chips")
  })

  test("the person page: interests, basics and languages as labelled chips", () => {
    const out = html(<PersonDetails person={asha} options={options} />)
    expect(out).toContain(">Interests<")
    expect(out).toContain(">Basics<")
    for (const label of [">Books<", ">172 cm<", ">Drinking: Socially<", ">Smoking: Never<", ">Exercise: Often<", ">Vegetarian<", ">English<", ">Telugu<"]) expect(out).toContain(label)
    const plain = html(<PersonDetails person={asha} />)
    expect(plain).not.toContain(">Interests<")
    expect(plain).not.toContain(">Basics<")
  })
})

describe("settings with the filters flag", () => {
  const privacy = { incognito: false, hideLastActive: true, verifiedOnlyFilter: true, blurPhotosUntilMatch: false, echoesConsent: false }

  test("the verified-only toggle is gone while the flag is on", () => {
    const on = html(<PrivacyToggles privacy={privacy} busy={false} onChange={noop} toggles={visiblePrivacyToggles(withFilters)} />)
    expect(count(on, /role="switch"/g)).toBe(4)
    expect(on).not.toContain("Show me verified people only")
    const off = html(<PrivacyToggles privacy={privacy} busy={false} onChange={noop} toggles={visiblePrivacyToggles(flagOff)} />)
    expect(count(off, /role="switch"/g)).toBe(5)
  })

  test("the profile links are alphabetical, with Filters only while the flag is on", () => {
    const labels = (on: boolean) => editLinks(on).map((l) => l.label)
    expect(labels(false)).toEqual(["About me", "Basics", "Looking for", "Photos", "Preferences", "Prompts", "Selfie check"])
    expect(labels(true)).toEqual(["About me", "Basics", "Filters", "Looking for", "Photos", "Preferences", "Prompts", "Selfie check"])
  })
})
