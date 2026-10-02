import { describe, expect, test } from "bun:test"

import { leftToday, moreArrive, NO_ALLOWANCES, rewindLimitLine, rewindRefusal, showRewind, superSparkLimitLine, superSparkNote, toAllowances, toUsageLimit } from "../model/allowances"
import { datingErrorCopy, GENERIC_COPY, NETWORK_COPY, AGE_REQUIRED_COPY } from "../model/errors"
import { distanceLabel, GENDER_OPTIONS, INTENT_OPTIONS, INTERESTED_IN_OPTIONS, intentLabel, PHOTO_VISIBILITY_OPTIONS } from "../model/labels"
import { chatHref, countdown, MESSENGER_OPENS_CONVERSATION_BY_ID } from "../model/matches"
import { isBlurredPath, nameLine, photoPath, toPerson } from "../model/people"
import { moderationView, ownPhotoSrc, photoFileProblem } from "../model/photos"
import { afterRead, afterReadError, featureLabels, formatAmount, initialPoll, nextPollDelay, passLine, POLL_TIMEOUT_MS, productBlurb, productTitle, purchaseBody, razorpayOptions, toMyPremium, toPaymentReading, toPurchase, type PollState } from "../model/premium"
import { preferencesBody, preferencesForm, preferencesProblem, PRIVACY_TOGGLES, privacyPatch, profileBody, stepFor, stepHref, toPreferences, toProfile, type Profile } from "../model/profile"
import { answerProblem, toPromptCatalog } from "../model/prompts"
import { actionForDrag, actionForKey, deckEmptyKind, resetLine, toDeck } from "../model/pulse"
import { REPORT_REASONS, reportBody, reportProblem, toTrustedContacts } from "../model/safety"
import { sparkBody, toSparkLimit, toSparkOutcome, verdictFor } from "../model/sparks"
import { attemptsLine, clipExtension, notReadyDelay, pickRecorderMime, recordMillis, selfieBody, uploadMime, viewFromRefusal, viewFromResult, viewFromStatus } from "../model/verification"
import { bool, num, str, strList, time, toDatingError } from "../model/wire"
import { mediaVerdict } from "../api/media"
import { NO_BASICS } from "../model/options"

const axiosError = (status: number, code: string, details?: Record<string, unknown>) => ({ response: { status, data: { error: { code, message: "developer words", details } } } })
const isSorted = (labels: string[]) => labels.every((l, i) => i === 0 || labels[i - 1].localeCompare(l) <= 0)

describe("wire: Go zero values are empty", () => {
  test("absent, null, empty and zero all read as empty", () => {
    for (const v of [undefined, null, "", "   "]) expect(str(v)).toBe("")
    for (const v of [undefined, null, "", "3", NaN]) expect(num(v)).toBe(0)
    for (const v of [undefined, null, 0, "true", 1]) expect(bool(v)).toBe(false)
    expect(strList(null)).toEqual([])
    expect(strList(["a", "", null, " b "])).toEqual(["a", "b"])
    expect(time("<timestamp>")).toBe("")
    expect(time("2026-10-02T10:00:00Z")).toBe("2026-10-02T10:00:00Z")
  })

  test("an empty object maps to a profile with nothing in it, not undefined fields", () => {
    const p = toProfile({})
    expect(p).toEqual({ userId: "", firstName: "", intent: "", bio: "", gender: "", birthDate: "", city: "", hasPoint: false, paused: false, languages: [], trustTier: "", status: "", dobSource: "", basics: NO_BASICS })
    expect(toPreferences(null)).toEqual({ minAge: 0, maxAge: 0, distanceKm: 0, interestedIn: "", intentFilter: [], distanceBucket: "", passFilters: null, dealbreakers: null })
  })

  test("an error without a response is a network error with no code", () => {
    expect(toDatingError(new Error("boom"))).toEqual({ status: 0, code: "", details: {} })
    expect(datingErrorCopy(new Error("boom"))).toBe(NETWORK_COPY)
  })
})

describe("errors: codes become our words, never the server's", () => {
  test("known codes, the unknown fallback and the 18+ refusal", () => {
    expect(datingErrorCopy(axiosError(403, "AGE_REQUIRED"))).toBe(AGE_REQUIRED_COPY)
    expect(AGE_REQUIRED_COPY).toContain("18")
    expect(datingErrorCopy(axiosError(500, "SOMETHING_NEW"))).toBe(GENERIC_COPY)
    expect(datingErrorCopy(axiosError(400, "SPARK_NOTE_REFUSED"))).not.toContain("developer words")
    expect(datingErrorCopy(axiosError(429, "LOCATION_CHANGE_RATE_LIMITED"))).toContain("Try again later")
  })
})

describe("labels", () => {
  test("distance is a bucket label from a known code and nothing else", () => {
    expect(distanceLabel("lt_5_km")).toBe("Under 5 km away")
    expect(distanceLabel("gt_25_km")).toBe("More than 25 km away")
    expect(distanceLabel("3.2 km")).toBe("")
    expect(distanceLabel(3.2)).toBe("")
    expect(distanceLabel(undefined)).toBe("")
  })

  test("an unknown intent renders nothing", () => {
    expect(intentLabel("marriage")).toBe("Marriage")
    expect(intentLabel("hookup")).toBe("")
  })

  test("option lists are alphabetical by label", () => {
    for (const options of [GENDER_OPTIONS, INTENT_OPTIONS, INTERESTED_IN_OPTIONS, PHOTO_VISIBILITY_OPTIONS, REPORT_REASONS, PRIVACY_TOGGLES]) {
      expect(isSorted(options.map((o) => o.label))).toBe(true)
    }
    expect(isSorted(toPromptCatalog([{ id: 2, question: "Zebra?" }, { id: 1, question: "Apple?" }]).map((q) => q.question))).toBe(true)
  })
})

describe("the onboarding gate", () => {
  const base: Profile = { userId: "u", firstName: "Asha", intent: "casual", bio: "", gender: "woman", birthDate: "1996-01-01T00:00:00Z", city: "Hyderabad", hasPoint: false, paused: false, languages: [], trustTier: "phone", status: "draft", dobSource: "identity", basics: NO_BASICS }
  const prefs = toPreferences({ interested_in_gender: "everyone", distance_km: 25 })

  test("no profile starts at intent", () => {
    expect(stepFor(null, null)).toBe("intent")
  })

  test("inside draft, the first missing field decides", () => {
    expect(stepFor({ ...base, intent: "" }, prefs)).toBe("intent")
    expect(stepFor({ ...base, gender: "" }, prefs)).toBe("basics")
    expect(stepFor({ ...base, city: "" }, prefs)).toBe("basics")
    expect(stepFor({ ...base, city: "", hasPoint: true }, null)).toBe("preferences")
    expect(stepFor(base, null)).toBe("preferences")
    // Everything supplied and still draft: identity is missing something; basics explains.
    expect(stepFor(base, prefs)).toBe("basics")
  })

  test("the server's status maps to one screen each", () => {
    expect(stepFor({ ...base, status: "pending_photo" }, prefs)).toBe("photos")
    expect(stepFor({ ...base, status: "pending_selfie" }, prefs)).toBe("selfie")
    expect(stepFor({ ...base, status: "pending_review" }, prefs)).toBe("review")
    expect(stepFor({ ...base, status: "paused" }, prefs)).toBe("paused")
    expect(stepFor({ ...base, status: "active" }, prefs)).toBe("ready")
  })

  test("nothing but active is ready: an unknown status is a hold", () => {
    for (const status of ["suspended", "restricted", "", "ACTIVE", "something_new"]) {
      expect(stepFor({ ...base, status }, prefs)).toBe("held")
    }
  })

  test("the selfie step has a screen and no way round it", () => {
    expect(stepHref("selfie")).toBe("/dating/verify")
    expect(stepHref("ready")).toBe("")
    expect(stepHref("held")).toBe("")
  })

  test("bodies carry only what was filled in", () => {
    expect(profileBody({ intent: "casual", gender: "", city: "  " })).toEqual({ intent: "casual" })
    expect(profileBody({ bio: "" })).toEqual({ bio: "" })
    expect(privacyPatch("hideLastActive", true)).toEqual({ hide_last_active: true })
    expect(preferencesBody({ minAge: 21, maxAge: 30, distanceKm: 10, interestedIn: "woman", intentFilter: ["serious", "casual"] })).toEqual({ min_age: 21, max_age: 30, distance_km: 10, interested_in_gender: "woman", intent_filter: ["casual", "serious"] })
  })

  test("preferences: adults only, in range, lower age first", () => {
    const form = preferencesForm(null)
    expect(form.minAge).toBe(18)
    expect(preferencesProblem(form)).toBe("Choose who you'd like to see.")
    const ok = { ...form, interestedIn: "everyone" }
    expect(preferencesProblem(ok)).toBe("")
    expect(preferencesProblem({ ...ok, minAge: 17 })).toContain("adults only")
    expect(preferencesProblem({ ...ok, minAge: 40, maxAge: 30 })).toContain("lower age")
    expect(preferencesProblem({ ...ok, distanceKm: 0 })).toContain("between 1 and 500")
    expect(preferencesProblem({ ...ok, maxAge: 121 })).toContain("120")
  })
})

describe("photos: the server's path, exactly", () => {
  test("only a dating photo route is accepted, and it is never rewritten", () => {
    expect(photoPath("/v1/dating/photos/abc/full")).toBe("/v1/dating/photos/abc/full")
    expect(photoPath("/v1/dating/photos/abc/blurred")).toBe("/v1/dating/photos/abc/blurred")
    for (const bad of ["", "https://evil.example/x.jpg", "/v1/dating/photos/abc", "/v1/dating/photos/abc/full?x=1", "/v1/dating/photos/a/b/full", "/v1/media/abc/serve", "//host/v1/dating/photos/abc/full"]) {
      expect(photoPath(bad)).toBe("")
    }
  })

  test("a blurred card stays blurred", () => {
    const p = toPerson({ user_id: "u", first_name: "Asha", age: 30, primary_photo_url: "/v1/dating/photos/p1/blurred", photo_state: "blurred" })!
    expect(p.photoUrl).toBe("/v1/dating/photos/p1/blurred")
    expect(p.photoBlurred).toBe(true)
    expect(isBlurredPath(p.photos[0].url)).toBe(true)
  })

  test("no feature source builds a /full photo URL", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs")
    const { resolve } = await import("node:path")
    const root = resolve(import.meta.dir, "..")
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = resolve(dir, name)
        if (statSync(path).isDirectory()) return name === "__tests__" ? [] : walk(path)
        return /\.(ts|tsx)$/.test(name) ? [path] : []
      })
    for (const file of walk(root)) {
      const source = readFileSync(file, "utf8")
      // A template or concatenation ending in /full or /blurred would be a constructed variant.
      expect(source).not.toMatch(/\}\/(full|blurred)`/)
      expect(source).not.toMatch(/\+\s*["'`]\/(full|blurred)/)
    }
  })

  test("a missing age is not drawn", () => {
    expect(nameLine({ firstName: "Asha", age: 0 })).toBe("Asha")
    expect(nameLine({ firstName: "Asha", age: 30 })).toBe("Asha, 30")
    expect(toPerson({ first_name: "No id" })).toBeNull()
  })

  test("own photos: preview from the media id, moderation state and reason", () => {
    expect(ownPhotoSrc({ mediaId: "m1" })).toBe("/v1/media/m1/serve")
    expect(ownPhotoSrc({ mediaId: "" })).toBe("")
    expect(moderationView({ moderationStatus: "rejected", moderationReason: "Face not visible" })).toEqual({ label: "Not accepted", tone: "danger", reason: "Face not visible" })
    expect(moderationView({ moderationStatus: "rejected", moderationReason: "" }).reason).not.toBe("")
    expect(moderationView({ moderationStatus: "pending", moderationReason: "" }).label).toBe("In review")
    expect(photoFileProblem({ type: "application/pdf", size: 10 })).not.toBe("")
    expect(photoFileProblem({ type: "image/jpeg", size: 10 })).toBe("")
    expect(photoFileProblem({ type: "image/jpeg", size: 11 * 1024 * 1024 })).toContain("10 MB")
  })

  test("media status: an image waits for moderation, a clip does not", () => {
    expect(mediaVerdict({ processing_status: "ready", moderation_status: "passed" }, "image")).toBe("ready")
    expect(mediaVerdict({ processing_status: "ready", moderation_status: "pending" }, "image")).toBe("waiting")
    expect(mediaVerdict({ processing_status: "ready" }, "video")).toBe("ready")
    expect(mediaVerdict({ processing_status: "processing" }, "video")).toBe("waiting")
    expect(mediaVerdict({ processing_status: "failed" }, "video")).toBe("refused")
    expect(mediaVerdict({ processing_status: "ready", moderation_status: "rejected" }, "image")).toBe("refused")
  })
})

describe("the deck", () => {
  const card = { candidate_id: "c1", profile: { user_id: "c1", first_name: "Asha", age: 30 } }

  test("the cards are data itself, and the meta limit fields are optional", () => {
    const deck = toDeck({ data: [card], meta: { generated_at: "2026-10-02T10:00:00Z", size: 1 } })
    expect(deck.cards.map((c) => c.candidateId)).toEqual(["c1"])
    expect(deck.dailyLimit).toBe(0)
    expect(deck.remainingToday).toBe(0)
    expect(deck.resetsAt).toBe("")
    expect(toDeck({ data: null, meta: null }).cards).toEqual([])
    expect(toDeck(undefined).cards).toEqual([])
  })

  test("a daily limit: an absent remaining_today means 0", () => {
    const out = toDeck({ data: [], meta: { daily_limit: 20, resets_at: "2026-10-03T00:30:00Z" } })
    expect(out.dailyLimit).toBe(20)
    expect(out.remainingToday).toBe(0)
    expect(out.resetsAt).toBe("2026-10-03T00:30:00Z")
    expect(deckEmptyKind(out, 0)).toBe("out_for_today")
  })

  test("out of cards only when a limit is set, none remain and the deck is empty", () => {
    expect(deckEmptyKind({ cohortGated: false, dailyLimit: 20, remainingToday: 0 }, 1)).toBeNull()
    expect(deckEmptyKind({ cohortGated: false, dailyLimit: 20, remainingToday: 3 }, 0)).toBe("none_left")
    expect(deckEmptyKind({ cohortGated: false, dailyLimit: 0, remainingToday: 0 }, 0)).toBe("none_left")
    expect(deckEmptyKind({ cohortGated: true, dailyLimit: 0, remainingToday: 0 }, 0)).toBe("gathering")
    expect(deckEmptyKind({ cohortGated: true, dailyLimit: 20, remainingToday: 0 }, 0)).toBe("out_for_today")
  })

  test("the reset time reads as a time today or a weekday", () => {
    const now = new Date(2026, 9, 2, 10, 0)
    expect(resetLine("", now)).toBe("")
    expect(resetLine("nonsense", now)).toBe("")
    expect(resetLine(new Date(2026, 9, 2, 23, 30).toISOString(), now, "en-GB")).toMatch(/^at 23:30$/)
    expect(resetLine(new Date(2026, 9, 3, 0, 30).toISOString(), now, "en-GB")).toMatch(/^Saturday at 0?0:30$/)
  })

  test("drag: right sparks, left passes, a short drag does nothing", () => {
    expect(actionForDrag(120)).toBe("spark")
    expect(actionForDrag(-120)).toBe("pass")
    expect(actionForDrag(40)).toBeNull()
    expect(actionForDrag(-95)).toBeNull()
  })

  test("keys: arrows act, Enter and Space open, ArrowUp is reserved", () => {
    expect(actionForKey("ArrowRight")).toBe("spark")
    expect(actionForKey("ArrowLeft")).toBe("pass")
    expect(actionForKey("Enter")).toBe("open")
    expect(actionForKey(" ")).toBe("open")
    expect(actionForKey("ArrowUp")).toBeNull()
    expect(actionForKey("ArrowUp", true)).toBe("super_spark")
    expect(actionForKey("a")).toBeNull()
  })

  test("keys: Backspace and Z undo only while the Undo control shows", () => {
    for (const key of ["Backspace", "z", "Z"]) {
      expect(actionForKey(key)).toBeNull()
      expect(actionForKey(key, true, false)).toBeNull()
      expect(actionForKey(key, false, true)).toBe("rewind")
    }
  })
})

describe("allowances", () => {
  const iso = "2026-10-03T00:30:00Z"

  test("a mechanic that is absent is off; sparks are always there", () => {
    const a = toAllowances({ sparks: { unlimited: false, daily_limit: 50, remaining_today: 50 } })
    expect(a.deck).toBeNull()
    expect(a.rewind).toBeNull()
    expect(a.superSpark).toBeNull()
    // null and a non-object are off too.
    const b = toAllowances({ sparks: {}, rewind: null, super_spark: "yes" })
    expect(b.rewind).toBeNull()
    expect(b.superSpark).toBeNull()
    expect(toAllowances(undefined)).toEqual(NO_ALLOWANCES)
  })

  test("remaining_today omitted means 0, and the reset time is read", () => {
    const a = toAllowances({ sparks: {}, rewind: { unlimited: false, daily_limit: 1, resets_at: iso } })
    expect(a.rewind).toEqual({ unlimited: false, dailyLimit: 1, remainingToday: 0, resetsAt: iso })
    expect(leftToday(a.rewind!)).toBe("None left today")
  })

  test("a pass holder is unlimited and carries no counts", () => {
    const a = toAllowances({ sparks: { unlimited: true }, rewind: { unlimited: true }, super_spark: { unlimited: true, purchased_balance: 3 } })
    expect(a.sparks).toEqual({ unlimited: true, dailyLimit: 0, remainingToday: 0, resetsAt: "" })
    expect(leftToday(a.rewind!)).toBe("Unlimited today")
    expect(a.superSpark!.purchasedBalance).toBe(3)
    expect(superSparkNote(a.superSpark!)).toBe("Super Sparks: unlimited today · 3 bought")
  })

  test("the Super Spark line: today's count, then what was bought", () => {
    const s = (over: object) => superSparkNote({ unlimited: false, dailyLimit: 1, remainingToday: 0, resetsAt: "", purchasedBalance: 0, ...over })
    expect(s({ remainingToday: 1 })).toBe("Super Sparks: 1 left today")
    expect(s({})).toBe("Super Sparks: none left today")
    expect(s({ purchasedBalance: 4 })).toBe("Super Sparks: none left today · 4 bought")
  })

  test("Undo shows only with the mechanic on, not hidden this session, right after an accepted pass", () => {
    const rewind = { unlimited: false, dailyLimit: 1, remainingToday: 1, resetsAt: "" }
    expect(showRewind({ rewind, off: false, last: "pass" })).toBe(true)
    expect(showRewind({ rewind, off: false, last: "other" })).toBe(false)
    expect(showRewind({ rewind, off: false, last: null })).toBe(false)
    expect(showRewind({ rewind, off: true, last: "pass" })).toBe(false)
    expect(showRewind({ rewind: null, off: false, last: "pass" })).toBe(false)
    // Out of rewinds still shows the control: the server answers with the reset time.
    expect(showRewind({ rewind: { ...rewind, remainingToday: 0 }, off: false, last: "pass" })).toBe(true)
  })

  test("a refused rewind: nothing and gone hide the control, off hides it for the session, out shows the state", () => {
    const e = (code: string) => toDatingError(axiosError(code === "REWIND_LIMIT_REACHED" ? 429 : 409, code))
    expect(rewindRefusal(e("REWIND_NOTHING_TO_UNDO"))).toBe("nothing")
    expect(rewindRefusal(e("REWIND_LIMIT_REACHED"))).toBe("out")
    expect(rewindRefusal(e("MECHANIC_NOT_ENABLED"))).toBe("off")
    expect(rewindRefusal(e("CANDIDATE_UNAVAILABLE"))).toBe("gone")
    expect(rewindRefusal(e("SOMETHING_NEW"))).toBe("other")
  })

  test("limits: the three limit refusals read alike, the reset time is local", () => {
    const err = (code: string) => toDatingError(axiosError(429, code, { limit: 1, window_hours: 24, resets_at: iso }))
    for (const code of ["SPARK_RATE_LIMITED", "REWIND_LIMIT_REACHED", "SUPER_SPARK_LIMIT_REACHED"]) {
      expect(toUsageLimit(err(code))).toEqual({ limit: 1, windowHours: 24, resetsAt: iso })
    }
    expect(toUsageLimit(err("CANDIDATE_UNAVAILABLE"))).toBeNull()
    const now = new Date(2026, 9, 2, 10, 0)
    expect(moreArrive("", now)).toBe(" Try again later.")
    expect(moreArrive(new Date(2026, 9, 2, 23, 30).toISOString(), now, "en-GB")).toBe(" More arrive at 23:30.")
    expect(rewindLimitLine({ limit: 3, windowHours: 24, resetsAt: "" })).toBe("You can undo 3 passes every 24 hours.")
    expect(rewindLimitLine({ limit: 0, windowHours: 0, resetsAt: "" })).toBe("You've used your undos for now.")
    expect(superSparkLimitLine({ limit: 5, windowHours: 24, resetsAt: "" })).toContain("5 free Super Sparks every 24 hours")
  })
})

describe("sparks", () => {
  test("the body is a spark on the primary photo, with a note only when there is one", () => {
    expect(sparkBody("u2")).toEqual({ to_user_id: "u2", target_kind: "photo", target_ref: "0" })
    expect(sparkBody("u2", "  hi  ")).toEqual({ to_user_id: "u2", target_kind: "photo", target_ref: "0", note: "hi" })
    expect(sparkBody("u2", "   ")).toEqual({ to_user_id: "u2", target_kind: "photo", target_ref: "0" })
  })

  test("a Super Spark adds super: true; an ordinary spark's body never carries the field", () => {
    expect(sparkBody("u2", "hi", true)).toEqual({ to_user_id: "u2", target_kind: "photo", target_ref: "0", note: "hi", super: true })
    expect("super" in sparkBody("u2", "hi", false)).toBe(false)
    expect(verdictFor(toDatingError(axiosError(429, "SUPER_SPARK_LIMIT_REACHED")))).toBe("super_limit")
    expect(verdictFor(toDatingError(axiosError(404, "MECHANIC_NOT_ENABLED")))).toBe("keep")
  })

  test("matched needs a match id", () => {
    expect(toSparkOutcome({ spark: { id: "s" } })).toEqual({ sparkId: "s", matched: false, matchId: "", isSuper: false })
    expect(toSparkOutcome({ spark: { id: "s" }, matched: true })).toEqual({ sparkId: "s", matched: false, matchId: "", isSuper: false })
    expect(toSparkOutcome({ spark: { id: "s" }, matched: true, match_id: "m" }).matched).toBe(true)
  })

  test("a refusal decides what happens to the card", () => {
    expect(verdictFor(toDatingError(axiosError(404, "CANDIDATE_UNAVAILABLE")))).toBe("drop")
    expect(verdictFor(toDatingError(axiosError(429, "SPARK_RATE_LIMITED")))).toBe("limit")
    expect(verdictFor(toDatingError(axiosError(400, "SPARK_NOTE_REFUSED")))).toBe("keep")
    expect(verdictFor(toDatingError(axiosError(500, "CREATE_FAILED")))).toBe("keep")
    expect(verdictFor(toDatingError(new Error("offline")))).toBe("keep")
  })

  test("the limit carries resets_at when the server sends it", () => {
    const e = toDatingError(axiosError(429, "SPARK_RATE_LIMITED", { limit: 50, window_hours: 24, resets_at: "2026-10-03T00:00:00Z" }))
    expect(toSparkLimit(e)).toEqual({ limit: 50, windowHours: 24, resetsAt: "2026-10-03T00:00:00Z" })
    expect(toSparkLimit(toDatingError(axiosError(404, "CANDIDATE_UNAVAILABLE")))).toBeNull()
  })
})

describe("matches", () => {
  const now = Date.parse("2026-10-02T10:00:00Z")

  test("the countdown runs only until the first message", () => {
    expect(countdown({ expiresAt: "2026-10-03T12:30:00Z", firstMessageAt: "" }, now)).toEqual({ kind: "running", text: "1d 2h left to say hello" })
    expect(countdown({ expiresAt: "2026-10-02T12:30:00Z", firstMessageAt: "" }, now).text).toBe("2h 30m left to say hello")
    expect(countdown({ expiresAt: "2026-10-02T10:00:20Z", firstMessageAt: "" }, now).text).toBe("1m left to say hello")
    expect(countdown({ expiresAt: "2026-10-02T09:00:00Z", firstMessageAt: "" }, now).kind).toBe("expired")
    expect(countdown({ expiresAt: "2026-10-03T12:30:00Z", firstMessageAt: "2026-10-02T09:00:00Z" }, now).kind).toBe("none")
    expect(countdown({ expiresAt: "", firstMessageAt: "" }, now).kind).toBe("none")
  })

  test("Open chat opens the match conversation by id; no id falls back to the messenger", () => {
    expect(MESSENGER_OPENS_CONVERSATION_BY_ID).toBe(true)
    expect(chatHref("c1")).toBe("/messenger?conversation=c1")
    expect(chatHref("a b")).toBe("/messenger?conversation=a%20b")
    expect(chatHref("")).toBe("/messenger")
  })
})

describe("safety", () => {
  test("a report needs a known reason, and a description when the reason is other", () => {
    expect(reportProblem({ targetId: "u", reason: "", details: "" })).toBe("Choose a reason.")
    expect(reportProblem({ targetId: "u", reason: "rude", details: "" })).toBe("Choose a reason.")
    expect(reportProblem({ targetId: "u", reason: "other", details: "  " })).toBe("Tell us what happened.")
    expect(reportProblem({ targetId: "u", reason: "other", details: "x" })).toBe("")
    expect(reportProblem({ targetId: "u", reason: "spam", details: "" })).toBe("")
    expect(reportProblem({ targetId: "u", reason: "spam", details: "x".repeat(501) })).toContain("500")
    expect(REPORT_REASONS.map((r) => r.value).sort()).toEqual(["fake_profile", "harassment", "hate", "nudity", "other", "scam", "spam", "underage", "violence"])
  })

  test("the report body leaves out an empty description", () => {
    expect(reportBody({ targetId: "u", reason: "spam", details: " " })).toEqual({ target_id: "u", reason: "spam" })
    expect(reportBody({ targetId: "u", reason: "other", details: " x " })).toEqual({ target_id: "u", reason: "other", details: "x" })
  })

  test("trusted contacts default to a maximum of 3", () => {
    expect(toTrustedContacts({ items: null }).max).toBe(3)
    expect(toTrustedContacts({}).items).toEqual([])
  })
})

describe("selfie verification", () => {
  test("the body names the video by video_media_id", () => {
    expect(selfieBody("c1", "m1")).toEqual({ challenge_id: "c1", video_media_id: "m1" })
  })

  test("the clip never runs past the challenge's limit, or past 4 s", () => {
    expect(recordMillis(4000)).toBe(3700)
    expect(recordMillis(3000)).toBe(2700)
    expect(recordMillis(0)).toBe(3700)
    expect(recordMillis(60_000)).toBe(3700)
    expect(recordMillis(1000)).toBe(2000)
  })

  test("recording needs getUserMedia, MediaRecorder and a supported webm or mp4 type", () => {
    const env = (types: string[], over: Partial<{ hasGetUserMedia: boolean; hasMediaRecorder: boolean }> = {}) => ({ hasGetUserMedia: true, hasMediaRecorder: true, isTypeSupported: (m: string) => types.includes(m), ...over })
    expect(pickRecorderMime(env(["video/webm", "video/mp4"]))).toBe("video/mp4")
    expect(pickRecorderMime(env(["video/webm;codecs=vp8", "video/webm"]))).toBe("video/webm;codecs=vp8")
    expect(pickRecorderMime(env([]))).toBe("")
    expect(pickRecorderMime(env(["video/mp4"], { hasGetUserMedia: false }))).toBe("")
    expect(pickRecorderMime(env(["video/mp4"], { hasMediaRecorder: false }))).toBe("")
    expect(pickRecorderMime({ hasGetUserMedia: true, hasMediaRecorder: true, isTypeSupported: () => { throw new Error("x") } })).toBe("")
    expect(uploadMime("video/webm;codecs=vp8")).toBe("video/webm")
    expect(clipExtension("video/mp4;codecs=avc1.42E01E")).toBe("mp4")
  })

  test("the status settles passed, in review and the daily limit; otherwise record", () => {
    const s = { selfieState: "none", attemptsLeftToday: 5, attemptsPerDay: 5, verified: false, profileStatus: "pending_selfie", nextStep: "submit_selfie" }
    expect(viewFromStatus(s)).toBeNull()
    expect(viewFromStatus({ ...s, selfieState: "passed" })).toEqual({ kind: "passed" })
    expect(viewFromStatus({ ...s, nextStep: "wait_for_review" })).toEqual({ kind: "in_review" })
    expect(viewFromStatus({ ...s, selfieState: "failed", nextStep: "retry_tomorrow" })).toEqual({ kind: "limit_reached" })
  })

  test("a failed verdict with no attempts left is the limit", () => {
    expect(viewFromResult({ status: "failed", passed: false, reason: "NO_FACE", profileStatus: "pending_selfie", attemptsRemaining: 0 })).toEqual({ kind: "limit_reached" })
    const retry = viewFromResult({ status: "failed", passed: false, reason: "NO_FACE", profileStatus: "pending_selfie", attemptsRemaining: 2 })
    expect(retry.kind).toBe("retry")
    expect(attemptsLine(2)).toBe("2 attempts left today")
    expect(attemptsLine(1)).toBe("1 attempt left today")
    expect(attemptsLine(0)).toBe("")
    expect(attemptsLine(null)).toBe("")
  })

  test("refusals: the limit, a dead challenge, an unapproved photo", () => {
    const view = (code: string) => viewFromRefusal(toDatingError(axiosError(400, code))).kind
    expect(view("SELFIE_ATTEMPTS_EXCEEDED")).toBe("limit_reached")
    expect(view("SELFIE_CHALLENGE_INVALID")).toBe("new_challenge")
    expect(view("SELFIE_CHALLENGE_REQUIRED")).toBe("new_challenge")
    expect(view("PRIMARY_PHOTO_NOT_APPROVED")).toBe("blocked")
    expect(view("SELFIE_ALREADY_PASSED")).toBe("passed")
    expect(view("SELFIE_REVIEW_PENDING")).toBe("in_review")
    expect(view("SELFIE_VIDEO_UNSUPPORTED")).toBe("retry")
    expect(view("FACE_COMPARE_UNAVAILABLE")).toBe("error")
  })

  test("MEDIA_NOT_READY backs off, then stops and lets the person decide", () => {
    const delays = [0, 1, 2, 3, 4].map(notReadyDelay)
    expect(delays).toEqual([1500, 3000, 5000, 8000, 12000])
    expect(delays.every((d, i) => i === 0 || d! > delays[i - 1]!)).toBe(true)
    expect(notReadyDelay(5)).toBeNull()
  })
})

describe("premium", () => {
  const wire = { purchase: { id: "p1", product: "pass_30d", amount_minor: 39900, currency: "INR", status: "confirming" }, client_session: { provider: "razorpay", order_id: "order_1", key_id: "rzp_test_x", merchant_display_name: "Momentum Dating" } }

  test("the purchase request carries a product and a key, and no price", () => {
    expect(Object.keys(purchaseBody("pass_30d", "k1")).sort()).toEqual(["idempotency_key", "product"])
  })

  test("the dialog opens from client_session; without one there is nothing to open", () => {
    expect(razorpayOptions(toPurchase(wire))?.key).toBe("rzp_test_x")
    expect(razorpayOptions(toPurchase({ purchase: wire.purchase }))).toBeNull()
    expect(razorpayOptions(toPurchase({ ...wire, client_session: { ...wire.client_session, key_id: "" } }))).toBeNull()
    expect(razorpayOptions(toPurchase({ ...wire, client_session: { ...wire.client_session, provider: "stub" } }))).toBeNull()
  })

  test("nothing in the premium model or hook reads the build environment", async () => {
    const { readFileSync } = await import("node:fs")
    const { resolve } = await import("node:path")
    for (const file of ["../model/premium.ts", "../hooks/premium.ts", "../api/premium.ts"]) {
      expect(readFileSync(resolve(import.meta.dir, file), "utf8")).not.toContain("process.env")
    }
  })

  test("paid only when the payment read says paid", () => {
    expect(toPaymentReading({ status: "paid" }).state).toBe("paid")
    expect(toPaymentReading({ status: "failed" }).state).toBe("failed")
    for (const status of ["confirming", "captured", "success", "", undefined]) {
      expect(toPaymentReading({ status }).state).toBe("confirming")
    }
    expect(toPaymentReading({ status: "paid", refund_status: "pending" }).refundStatus).toBe("pending")
    expect(toPaymentReading({ status: "paid", refund_status: null }).refundStatus).toBe("")
  })

  test("the poll: 1, 2, 3, 4 s then every 5 s; stops on a verdict; times out at 180 s without calling it failed", () => {
    let state: PollState = initialPoll
    const delays: number[] = []
    for (;;) {
      const delay = nextPollDelay(state, true)
      if (delay === null) break
      delays.push(delay)
      state = afterRead(state, delay, { state: "confirming", refundStatus: "" })
    }
    expect(delays.slice(0, 6)).toEqual([1000, 2000, 3000, 4000, 5000, 5000])
    expect(state.phase).toBe("timed_out")
    expect(state.elapsedMs).toBeGreaterThanOrEqual(POLL_TIMEOUT_MS)
    expect(afterRead(initialPoll, 1000, { state: "paid", refundStatus: "" }).phase).toBe("paid")
    expect(afterRead(initialPoll, 1000, { state: "failed", refundStatus: "" }).phase).toBe("failed")
    expect(nextPollDelay(initialPoll, false)).toBeNull()
  })

  test("a failed read is not a verdict unless it is a permanent 4xx", () => {
    expect(afterReadError(initialPoll, 1000, 503).phase).toBe("confirming")
    expect(afterReadError(initialPoll, 1000, 0).phase).toBe("confirming")
    expect(afterReadError(initialPoll, 1000, 429).phase).toBe("confirming")
    expect(afterReadError(initialPoll, 1000, 404).phase).toBe("stopped")
  })

  test("what I hold: an inactive pass is no pass", () => {
    const none = toMyPremium({ is_premium: false, boost_balance: 0 })
    expect(none.hasPass).toBe(false)
    expect(passLine(none)).toBe("You don't have a pass right now.")
    const expired = toMyPremium({ pass: { product: "pass_30d", active: false, expires_at: "2026-09-01T00:00:00Z" } })
    expect(expired.hasPass).toBe(false)
    expect(expired.passExpiresAt).toBe("")
    const live = toMyPremium({ pass: { product: "pass_30d", active: true, expires_at: "2026-11-01T12:00:00Z" }, entitlements: [{ feature: "match_extend", active: false }, { feature: "daily_boost", active: true }] })
    expect(passLine(live, "en-GB")).toContain("1 November 2026")
    expect(live.features).toEqual(["daily_boost"])
  })

  test("the words are one-off: never a subscription, never a renewal", () => {
    const words = [productTitle({ kind: "pass", durationDays: 30, name: "x" }), productBlurb({ kind: "pass", durationDays: 30 }), productBlurb({ kind: "boost", durationDays: 0 }), ...featureLabels(["match_extend", "daily_boost", "unknown"])].join(" ")
    expect(words).not.toMatch(/subscri|renew/i)
    expect(productTitle({ kind: "pass", durationDays: 30, name: "x" })).toBe("30-day pass")
    expect(featureLabels(["match_extend", "daily_boost", "unknown"])).toEqual(["Extra time on a match", "One Boost every day"])
    expect(formatAmount(39900, "INR")).toContain("399")
  })
})

describe("prompts", () => {
  test("an answer is 1 to 280 characters", () => {
    expect(answerProblem("  ")).not.toBe("")
    expect(answerProblem("x".repeat(281))).toContain("280")
    expect(answerProblem("x".repeat(280))).toBe("")
  })
})
