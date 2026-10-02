import { describe, expect, test } from "bun:test"

import { rewindLimitLine, rewindRefusal, showRewind, superSparkLimitLine, superSparkNote, toAllowances, toUsageLimit } from "../model/allowances"
import { isGranted, toConsents } from "../model/consents"
import { exportView, hasPendingExport, toDataExport, toDataExports } from "../model/dataExport"
import { KNOWN_ERROR_CODES, GENERIC_COPY, copyFor, FILTERS_PASS_COPY, isAgeRefusal, isFiltersRequirePass, isMechanicOff, isPremiumUnavailable, isTravelRequiresPass, PASSES_UNAVAILABLE_COPY, refusedField, TRAVEL_PASS_COPY } from "../model/errors"
import { picksResetLine, toPicks } from "../model/picks"
import { activeTrip, toTravelState, travelView, tripBanner } from "../model/travel"
import { answerRefusalRefetches, firstMoveListLine, firstMoveState, isFirstMoveOff, questionsChanged, toFirstMoveSettings, toOpeningAnswerResult } from "../model/firstMove"
import { chatHref, countdown, extendedLine, extendLimitLine, isOpen, toCloseResult, toExtendLimit, toExtendResult, toMatch, toMatches } from "../model/matches"
import { metaLine, photoPath, toPerson, travelMarker } from "../model/people"
import { moderationView, toMyPhoto, toMyPhotos } from "../model/photos"
import { filtersBody, filtersEnabled, filtersForm, hasPassFilters, toPreferences, toPrivacy, toProfile, stepFor, visiblePrivacyToggles } from "../model/profile"
import { basicsLabels, interestLabels, languageLabels, toProfileOptions } from "../model/options"
import { languageLabel } from "../model/labels"
import { toPromptAnswer, toPromptAnswers } from "../model/prompts"
import { deckEmptyKind, toDeck, toExplain, toPassResult, toRewindResult } from "../model/pulse"
import { razorpayOptions, toCatalogue, toMyPremium, toPaymentReading, toPurchase } from "../model/premium"
import { toBlockResult, toBlocks, toLocationShare, toLocationShares, toPanicResult, toReportResult, toTrustedContact, toTrustedContacts } from "../model/safety"
import { toLikedYou } from "../model/likedYou"
import { sparkLimitLine, toDeclineResult, toIncomingSparks, toSparkLimit, toSparkOutcome, toStash, toStashEntry, verdictFor } from "../model/sparks"
import { toSelfieChallenge, toSelfieResult, toVerificationStatus, viewFromRefusal, viewFromResult, viewFromStatus, recordMillis } from "../model/verification"
import { errorFromEnvelope } from "../model/wire"

import { backendContractsDir, fixtureNames, readFixture, readFixtureText } from "./contractFixtures"

type Fixture = ReturnType<typeof readFixture>

/** An error fixture: the envelope parses to its code, and the code has words that are not the server's. */
function refusal(code: string, extra?: (f: Fixture) => void) {
  return (f: Fixture) => {
    const e = errorFromEnvelope(f)
    expect(e.code).toBe(code)
    const message = (f.error as { message: string }).message
    expect(copyFor(e)).not.toBe(message)
    extra?.(f)
  }
}

const person = (wire: unknown) => {
  const p = toPerson(wire)
  expect(p).not.toBeNull()
  expect(p!.firstName).toBe("Asha")
  expect(p!.age).toBe(30)
  // The photo is the server's path, untouched.
  expect(p!.photoUrl).toBe((wire as { primary_photo_url: string }).primary_photo_url)
  return p!
}

/**
  Every fixture, and the mapper it belongs to. A fixture on disk with no
  entry here fails the coverage test below.
*/
const PARSERS: Record<string, (f: Fixture) => void> = {
  /* consents */
  consents_get_200: (f) => {
    const c = toConsents(f.data)
    expect(c.policyVersion).toBe("v1.0-2026-04-29")
    expect(c.items.map((i) => i.type).sort()).toEqual(["biometric_selfie", "echoes", "sensitive_community", "sensitive_religion"])
    expect(isGranted(c, "sensitive_religion")).toBe(true)
    expect(isGranted(c, "biometric_selfie")).toBe(false)
  },
  consent_put_200_withdrawn: (f) => {
    const c = toConsents(f.data)
    expect(c.items.every((i) => !i.granted)).toBe(true)
  },
  consent_put_400_invalid_type: refusal("INVALID_CONSENT_TYPE"),

  /* profile, privacy, preferences */
  profile_get_200: (f) => {
    const p = toProfile(f.data)
    expect(p.status).toBe("active")
    expect(p.firstName).toBe("Asha")
    expect(p.bio).toBe("") // "" is empty, not a value
    expect(p.hasPoint).toBe(false)
    expect(stepFor(p, null)).toBe("ready")
  },
  profile_upsert_200: (f) => {
    const p = toProfile(f.data)
    expect(p.bio).toBe("Filter coffee and long walks.")
    expect(p.city).toBe("Hyderabad")
    expect(p.dobSource).toBe("identity")
  },
  profile_upsert_400_invalid_intent: refusal("INVALID_INTENT"),
  profile_upsert_400_invalid_location: refusal("INVALID_LOCATION"),
  profile_upsert_422_consent_required: refusal("CONSENT_REQUIRED", (f) => {
    expect(errorFromEnvelope(f).details.consent_type).toBe("sensitive_religion")
  }),
  profile_upsert_429_location_change_rate_limited: refusal("LOCATION_CHANGE_RATE_LIMITED", (f) => {
    expect(copyFor(errorFromEnvelope(f))).toContain("once every 15 minutes, up to 10 times a day")
  }),
  privacy_get_200: (f) => {
    const p = toPrivacy(f.data)
    expect(p).toEqual({ incognito: false, hideLastActive: true, verifiedOnlyFilter: false, blurPhotosUntilMatch: false, echoesConsent: false })
  },
  preferences_get_200: (f) => {
    const p = toPreferences(f.data)
    // min_age / max_age are omitted when unset: 0, not NaN or undefined.
    expect(p).toEqual({ minAge: 0, maxAge: 0, distanceKm: 25, interestedIn: "everyone", intentFilter: [], distanceBucket: "", passFilters: null })
    // No pass_filters member: the filters flag is off and the screens keep their old shape.
    expect(filtersEnabled(p)).toBe(false)
  },
  preferences_put_200: (f) => {
    expect(toPreferences(f.data)).toEqual({ minAge: 25, maxAge: 35, distanceKm: 25, interestedIn: "everyone", intentFilter: ["casual"], distanceBucket: "", passFilters: null })
  },
  /* profile basics and filters (mechanic M6) */
  profile_options_get_200: (f) => {
    const o = toProfileOptions(f.data)
    expect(o.interests).toHaveLength(40)
    expect(o.interests[0]).toEqual({ value: "art", label: "Art" })
    expect(o.maxInterests).toBe(10)
    expect(o.languages.find((l) => l.value === "te")?.label).toBe("Telugu")
    expect(o.maxLanguages).toBe(8)
    expect([o.heightMin, o.heightMax]).toEqual([120, 230])
    // Scales keep the server's order; lists are alphabetical by label.
    expect(o.drinking.map((x) => x.value)).toEqual(["never", "rarely", "socially", "regularly"])
    expect(o.distanceBuckets.map((x) => x.label)).toEqual(["Under 5 km", "Within 10 km", "Within 25 km", "Any distance"])
    expect(o.diet.map((x) => x.label)).toEqual(["Eggetarian", "Jain", "Non-vegetarian", "Other", "Vegan", "Vegetarian"])
  },
  preferences_get_200_filters: (f) => {
    const p = toPreferences(f.data)
    expect(filtersEnabled(p)).toBe(true)
    expect(p.distanceBucket).toBe("km_5_10")
    expect(p.passFilters).toEqual({
      active: true,
      verifiedOnly: true,
      minHeightCm: 160,
      maxHeightCm: 190,
      languages: ["en", "te"],
      drinking: ["never", "socially"],
      smoking: ["never"],
      exercise: [],
      diet: ["vegetarian"],
    })
    expect(hasPassFilters(p.passFilters)).toBe(true)
    // With the flag on, the free "verified only" privacy toggle moves to Filters.
    expect(visiblePrivacyToggles(p).map((t) => t.key)).not.toContain("verifiedOnlyFilter")
    const form = filtersForm(p, toProfileOptions(readFixture("profile_options_get_200").data))
    expect(form.distanceBucket).toBe("km_5_10")
    expect(filtersBody(form, true).pass_filters).toEqual({ verified_only: true, min_height_cm: 160, max_height_cm: 190, languages: ["en", "te"], drinking: ["never", "socially"], smoking: ["never"], exercise: [], diet: ["vegetarian"] })
  },
  preferences_put_200_filters: (f) => expect(toPreferences(f.data)).toEqual(toPreferences(readFixture("preferences_get_200_filters").data)),
  preferences_put_403_filters_require_pass: refusal("FILTERS_REQUIRE_PASS", (f) => {
    expect(isFiltersRequirePass({ response: { status: 403, data: f } })).toBe(true)
    expect(copyFor(errorFromEnvelope(f))).toBe(FILTERS_PASS_COPY)
  }),
  preferences_put_400_invalid_distance_bucket: refusal("INVALID_DISTANCE_BUCKET"),
  privacy_patch_403_filters_require_pass: refusal("FILTERS_REQUIRE_PASS", (f) => {
    expect(isFiltersRequirePass({ response: { status: 403, data: f } })).toBe(true)
  }),
  profile_upsert_400_invalid_interest: refusal("INVALID_INTEREST", (f) => {
    expect(refusedField({ response: { status: 400, data: f } })).toBe("interests")
  }),
  profile_upsert_400_invalid_height: refusal("INVALID_HEIGHT", (f) => {
    expect(refusedField({ response: { status: 400, data: f } })).toBe("height_cm")
    expect(copyFor(errorFromEnvelope(f))).toBe("Choose a height between 120 and 230 cm.")
  }),
  person_get_200_basics: (f) => {
    const p = person(f.data)
    expect(p.basics).toEqual({ interests: ["books", "cricket", "yoga"], heightCm: 172, drinking: "socially", smoking: "never", exercise: "often", diet: "vegetarian" })
    expect(p.languageCodes).toEqual(["en", "te"])
    const o = toProfileOptions(readFixture("profile_options_get_200").data)
    expect(interestLabels(p.basics, o)).toEqual(["Books", "Cricket", "Yoga"])
    expect(basicsLabels(p.basics, o)).toEqual(["172 cm", "Drinking: Socially", "Smoking: Never", "Exercise: Often", "Vegetarian"])
    expect(languageLabels(p.languageCodes, o, languageLabel)).toEqual(["English", "Telugu"])
    // Distance is the bucket label; the server's "< 5 km" is never used.
    expect(p.distanceLabel).toBe("Under 5 km away")
  },

  preferences_put_400_invalid_age_range: refusal("INVALID_AGE_RANGE"),
  preferences_put_400_invalid_distance_km: refusal("INVALID_DISTANCE_KM"),
  preferences_put_400_invalid_gender: refusal("INVALID_INTERESTED_IN_GENDER"),
  preferences_put_400_invalid_intent_filter: refusal("INVALID_INTENT_FILTER"),

  /* photos, prompts */
  photos_get_200: (f) => expect(toMyPhotos(f.data)).toEqual([]),
  photos_post_201: (f) => {
    const p = toMyPhoto(f.data)!
    expect(p.isPrimary).toBe(true)
    expect(p.sortOrder).toBe(0)
    expect(p.moderationReason).toBe("")
    expect(moderationView(p).label).toBe("Approved")
  },
  photos_post_400_invalid_visibility: refusal("INVALID_VISIBILITY"),
  prompts_get_200: (f) => expect(toPromptAnswers(f.data)).toEqual([]),
  prompts_put_200: (f) => expect(toPromptAnswer(f.data)).toEqual({ promptId: 1, answer: "Ask me about filter coffee." }),
  prompts_put_400_answer_required: refusal("PROMPT_ANSWER_REQUIRED"),
  prompts_put_400_answer_too_long: refusal("PROMPT_ANSWER_TOO_LONG"),
  prompts_put_400_unknown_prompt: refusal("UNKNOWN_PROMPT"),

  /* verification */
  verification_status_get_200: (f) => {
    const s = toVerificationStatus(f.data)
    expect(s).toEqual({ selfieState: "passed", attemptsLeftToday: 4, attemptsPerDay: 5, verified: true, profileStatus: "active", nextStep: "none" })
    expect(viewFromStatus(s)).toEqual({ kind: "passed" })
  },
  selfie_challenge_post_200: (f) => {
    const c = toSelfieChallenge(f.data)
    expect(c.instruction).toBe("blink_twice")
    expect(c.maxDurationMs).toBe(4000)
    expect(recordMillis(c.maxDurationMs)).toBeLessThanOrEqual(c.maxDurationMs)
  },
  selfie_challenge_422_consent_required: refusal("CONSENT_REQUIRED", (f) => {
    expect(viewFromRefusal(errorFromEnvelope(f))).toEqual({ kind: "needs_consent" })
  }),
  selfie_post_200_passed: (f) => expect(viewFromResult(toSelfieResult(f.data))).toEqual({ kind: "passed" }),
  selfie_post_200_review: (f) => expect(viewFromResult(toSelfieResult(f.data))).toEqual({ kind: "in_review" }),
  selfie_post_200_not_enough_blinks: (f) => {
    const view = viewFromResult(toSelfieResult(f.data))
    expect(view.kind).toBe("retry")
    if (view.kind === "retry") {
      expect(view.attemptsLeft).toBe(4)
      expect(view.copy).toContain("blink twice")
    }
  },
  selfie_post_409_media_not_ready: refusal("MEDIA_NOT_READY"),

  /* allowances (mechanic M10) */
  allowances_get_200: (f) => {
    const a = toAllowances(f.data)
    expect(a.sparks).toEqual({ unlimited: false, dailyLimit: 50, remainingToday: 49, resetsAt: "" })
    expect(a.deck).toEqual({ unlimited: false, dailyLimit: 25, remainingToday: 23, resetsAt: "" })
    expect(a.rewind).toEqual({ unlimited: false, dailyLimit: 1, remainingToday: 1, resetsAt: "" })
    expect(a.superSpark).toEqual({ unlimited: false, dailyLimit: 1, remainingToday: 1, resetsAt: "", purchasedBalance: 0 })
    expect(superSparkNote(a.superSpark!)).toBe("Super Sparks: 1 left today")
  },
  allowances_get_200_mechanics_off: (f) => {
    const a = toAllowances(f.data)
    expect(a.sparks.remainingToday).toBe(50)
    // Absent mechanics are off: no Undo, no Super Spark.
    expect(a.deck).toBeNull()
    expect(a.rewind).toBeNull()
    expect(a.superSpark).toBeNull()
    expect(showRewind({ rewind: a.rewind, off: false, last: "pass" })).toBe(false)
  },

  /* people, the deck */
  person_get_200: (f) => {
    const p = person(f.data)
    expect(p.photos).toHaveLength(1)
    expect(p.photoBlurred).toBe(false)
    expect(p.verified).toBe(false)
    expect(p.distanceLabel).toBe("") // no bucket sent, so no distance drawn
  },
  pulse_today_get_200: (f) => {
    const deck = toDeck(f)
    expect(deck.cards).toHaveLength(1)
    expect(deck.cards[0].person.distanceLabel).toBe("Under 5 km away")
    expect(deck.cards[0].reasons).toEqual(["Compatible vibes", "You both want casual", "Recently active on AtPost"])
    expect(deck.cohortGated).toBe(false)
    // The limit fields are not served yet: absent means no limit.
    expect(deck.dailyLimit).toBe(0)
    expect(deckEmptyKind(deck, deck.cards.length)).toBeNull()
  },
  pulse_today_get_200_rich_card: (f) => {
    const p = toDeck(f).cards[0].person
    expect(p.bio).toContain("Filter coffee")
    expect(p.prompts.map((x) => x.promptId)).toEqual([1, 2, 9])
    expect(p.languages).toEqual(["Telugu", "English"])
    // Each photo keeps the variant the server gave it; a blurred one is never upgraded.
    expect(p.photos.map((x) => x.blurred)).toEqual([false, false, true])
    expect(p.photos[2].url.endsWith("/blurred")).toBe(true)
  },
  pulse_today_get_200_out_of_cards: (f) => {
    const deck = toDeck(f)
    expect(deck.cards).toEqual([])
    expect(deck.dailyLimit).toBe(2)
    // remaining_today is omitted when it is 0.
    expect(deck.remainingToday).toBe(0)
    expect(deckEmptyKind(deck, 0)).toBe("out_for_today")
  },
  pulse_today_get_200_refill: (f) => {
    const deck = toDeck(f)
    expect(deck.cards).toHaveLength(1)
    expect(deck.dailyLimit).toBe(2)
    expect(deck.remainingToday).toBe(2)
    expect(deckEmptyKind(deck, 1)).toBeNull()
    // Cards gone locally but some remain today: not "out for today".
    expect(deckEmptyKind(deck, 0)).toBe("none_left")
  },
  // Mechanic M2: undo the last pass; the card comes back on top of the deck.
  pulse_rewind_post_200: (f) => {
    const r = toRewindResult(f.data)
    expect(r.rewound).toBe(true)
    expect(r.card?.candidateId).toBe("<candidate>")
    expect(r.card?.person.firstName).toBe("Asha")
    expect(r.unlimited).toBe(false)
    expect(r.dailyLimit).toBe(1)
    // The one rewind is spent: remaining_today is omitted, so 0.
    expect(r.remainingToday).toBe(0)
  },
  pulse_rewind_404_not_enabled: refusal("MECHANIC_NOT_ENABLED", (f) => {
    expect(rewindRefusal(errorFromEnvelope(f))).toBe("off")
  }),
  pulse_rewind_409_nothing_to_undo: refusal("REWIND_NOTHING_TO_UNDO", (f) => {
    expect(rewindRefusal(errorFromEnvelope(f))).toBe("nothing")
  }),
  pulse_rewind_429_limit_reached: refusal("REWIND_LIMIT_REACHED", (f) => {
    const e = errorFromEnvelope(f)
    expect(rewindRefusal(e)).toBe("out")
    expect(e.details.resets_at).toBe("<timestamp>")
    // The placeholder timestamp does not parse, so no reset time is drawn.
    expect(toUsageLimit(e)).toEqual({ limit: 1, windowHours: 24, resetsAt: "" })
    expect(rewindLimitLine(toUsageLimit(e)!)).toBe("You can undo one pass every 24 hours.")
  }),
  pulse_pass_post_200: (f) => expect(toPassResult(f.data).passed).toBe(true),
  pulse_pass_400_reason_too_long: refusal("PASS_REASON_TOO_LONG"),
  pulse_explain_get_200: (f) => {
    const e = toExplain(f.data)
    // The server's distance sentence carries a figure; it is not rendered.
    expect(e.reasons).toHaveLength(2)
    expect(e.reasons.join(" ")).not.toContain("km")
    expect(e.promoted).toBe(false)
  },
  pulse_explain_404_candidate_unavailable: refusal("CANDIDATE_UNAVAILABLE"),
  // Mechanic M8: someone on a trip shows up with the marker and their destination.
  pulse_today_get_200_travelling: (f) => {
    const p = toDeck(f).cards[0].person
    expect(p.travelling).toBe(true)
    expect(p.city).toBe("Hyderabad")
    expect(travelMarker(p)).toBe("Visiting Hyderabad")
    // The city lives in the marker, so the meta line does not repeat it.
    expect(metaLine(p)).not.toContain("Hyderabad")
  },

  /* daily picks (mechanic M7) */
  picks_get_200: (f) => {
    const picks = toPicks(f)
    expect(picks.cards).toHaveLength(1)
    expect(picks.cards[0].candidateId).toBe("<candidate>")
    // The deck's card shape: the same mapper, the same person.
    expect(picks.cards[0]).toEqual(toDeck({ data: f.data }).cards[0])
    expect(picks.cards[0].person.travelling).toBe(false)
    expect(picks.timezone).toBe("UTC")
    expect(picks.size).toBe(1)
    // Placeholders do not parse: no date drawn, no reset time drawn.
    expect(picks.resetsAt).toBe("")
    expect(picksResetLine(picks.resetsAt)).toBe("New picks arrive every day at midnight.")
  },
  picks_get_400_invalid_timezone: refusal("INVALID_TIMEZONE"),
  picks_get_404_not_enabled: refusal("MECHANIC_NOT_ENABLED", (f) => {
    expect(isMechanicOff({ response: { status: 404, data: f } })).toBe(true)
  }),

  /* travel mode (mechanic M8) */
  travel_get_200: (f) => {
    const t = toTravelState(f.data)
    expect(t.active).toBeNull()
    expect(t.available).toBe(false)
    expect(t.maxDays).toBe(7)
    expect(t.cities).toHaveLength(22)
    expect(t.cities[0]).toEqual({ code: "ahmedabad", label: "Ahmedabad" })
    const labels = t.cities.map((c) => c.label)
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))
    expect(travelView(t)).toBe("locked")
    expect(activeTrip(t)).toBeNull()
  },
  travel_put_200: (f) => {
    const t = toTravelState(f.data)
    expect(t.available).toBe(true)
    expect(t.active?.city).toEqual({ code: "mumbai", label: "Mumbai" })
    // Placeholder timestamps: the trip has no known end, so it reads as in effect.
    expect(t.active?.endsAt).toBe("")
    expect(travelView(t)).toBe("active")
    expect(activeTrip(t)?.city.label).toBe("Mumbai")
    expect(tripBanner(activeTrip(t)!)).toBe("Browsing Mumbai")
  },
  travel_put_403_requires_pass: refusal("TRAVEL_REQUIRES_PASS", (f) => {
    const e = { response: { status: 403, data: f } }
    expect(isTravelRequiresPass(e)).toBe(true)
    expect(copyFor(errorFromEnvelope(f))).toBe(TRAVEL_PASS_COPY)
  }),
  travel_put_400_invalid_city: refusal("INVALID_CITY", (f) => {
    expect((errorFromEnvelope(f).details.allowed as string[]).length).toBe(22)
  }),
  travel_get_404_not_enabled: refusal("MECHANIC_NOT_ENABLED", (f) => {
    expect(isMechanicOff({ response: { status: 404, data: f } })).toBe(true)
  }),

  /* sparks, stash */
  spark_create_post_201_matched: (f) => {
    const o = toSparkOutcome(f.data)
    expect(o.matched).toBe(true)
    expect(o.matchId).not.toBe("")
  },
  spark_accept_post_201: (f) => expect(toSparkOutcome(f.data).matched).toBe(true),
  spark_accept_403_liked_you_locked: refusal("LIKED_YOU_LOCKED"),
  liked_you_get_200_locked: (f) => {
    const l = toLikedYou(f.data)
    expect(l.unlocked).toBe(false)
    expect(l.total).toBe(2)
    expect(l.cards.map((c) => c.isSuper)).toEqual([true, false])
    for (const c of l.cards) {
      expect(c.person).toBeNull()
      expect(c.note).toBe("")
      expect(c.photoUrl).toBe("/v1/dating/liked-you/<uuid>/photo")
    }
  },
  liked_you_get_200_unlocked: (f) => {
    const l = toLikedYou(f.data)
    expect(l.unlocked).toBe(true)
    expect(l.cards).toHaveLength(2)
    expect(l.cards[0].isSuper).toBe(true)
    expect(l.cards[0].person?.firstName).toBe("Asha")
    expect(l.cards[0].note).toBe("Loved your answer")
  },
  sparks_incoming_get_200_locked: (f) => {
    const sparks = toIncomingSparks(f.data)
    expect(sparks).toHaveLength(2)
    expect(sparks.map((s) => s.isSuper)).toEqual([true, false])
    expect(sparks.every((s) => s.person === null && s.fromUserId === "" && s.note === "")).toBe(true)
  },
  spark_create_post_201_super: (f) => {
    const o = toSparkOutcome(f.data)
    expect(o.isSuper).toBe(true)
    expect(o.matched).toBe(false)
  },
  spark_create_429_super_limit_reached: refusal("SUPER_SPARK_LIMIT_REACHED", (f) => {
    const e = errorFromEnvelope(f)
    expect(verdictFor(e)).toBe("super_limit")
    expect(toUsageLimit(e)).toEqual({ limit: 1, windowHours: 24, resetsAt: "" })
    expect(superSparkLimitLine(toUsageLimit(e)!)).toContain("one free Super Spark every 24 hours")
  }),
  spark_create_404_candidate_unavailable: refusal("CANDIDATE_UNAVAILABLE", (f) => {
    expect(verdictFor(errorFromEnvelope(f))).toBe("drop")
  }),
  spark_create_409_onboarding_incomplete: refusal("ONBOARDING_INCOMPLETE", (f) => {
    expect(verdictFor(errorFromEnvelope(f))).toBe("onboarding")
  }),
  spark_create_429_rate_limited: refusal("SPARK_RATE_LIMITED", (f) => {
    const e = errorFromEnvelope(f)
    expect(verdictFor(e)).toBe("limit")
    // resets_at is always sent now; the fixture's placeholder does not parse, so it reads as "".
    expect(e.details.resets_at).toBe("<timestamp>")
    const limit = toSparkLimit(e)!
    expect(limit).toEqual({ limit: 50, windowHours: 24, resetsAt: "" })
    expect(toUsageLimit(e)).toEqual(limit)
    expect(sparkLimitLine(limit)).toBe("You can send 50 sparks every 24 hours.")
  }),
  spark_decline_post_200: (f) => expect(toDeclineResult(f.data)).toEqual({ declined: true, sparkId: "<spark>" }),
  sparks_incoming_get_200: (f) => {
    const sparks = toIncomingSparks(f.data)
    expect(sparks).toHaveLength(1)
    expect(sparks[0].note).toBe("Loved your answer")
    expect(sparks[0].person?.firstName).toBe("Asha")
  },
  sparks_incoming_get_200_super_first: (f) => {
    const sparks = toIncomingSparks(f.data)
    expect(sparks.map((s) => s.isSuper)).toEqual([true, false])
    expect(sparks[0].person?.firstName).toBe("Asha")
  },
  stash_get_200: (f) => expect(toStash(f.data).map((s) => s.candidateId)).toEqual(["<candidate>"]),
  stash_post_201: (f) => expect(toStashEntry(f.data)?.candidateId).toBe("<candidate>"),

  /* matches */
  matches_get_200: (f) => {
    const matches = toMatches(f.data)
    expect(matches).toHaveLength(1)
    expect(isOpen(matches[0])).toBe(true)
    person((f.data as { person: unknown }[])[0].person)
  },
  match_get_200: (f) => {
    const m = toMatch(f.data)!
    expect(m.conversationId).toBe("<conversation>")
    expect(m.firstMessageAt).toBe("")
    expect(chatHref(m.conversationId).startsWith("/messenger")).toBe(true)
    // The fixture's timestamps are placeholders: an unparseable expiry is no countdown, not NaN.
    expect(countdown(m).kind).toBe("none")
    // No first_move member: a normal match.
    expect(m.firstMove).toBeNull()
    expect(firstMoveState(m)).toEqual({ kind: "none" })
  },
  match_close_post_200: (f) => expect(toCloseResult(f.data).closed).toBe(true),

  /* first move (mechanic M5) */
  first_move_get_200: (f) => {
    const s = toFirstMoveSettings(f.data)
    expect(s.enabled).toBe(true)
    expect(s.questions.map((q) => q.text)).toEqual(["What does your perfect Sunday look like?", "Tea or coffee, and why?"])
    expect(s.maxQuestions).toBe(3)
    expect(s.maxLength).toBe(140)
    expect(questionsChanged(s.questions, s.questions.map((q) => q.text))).toBe(false)
  },
  first_move_put_200: (f) => expect(toFirstMoveSettings(f.data)).toEqual(toFirstMoveSettings(readFixture("first_move_get_200").data)),
  first_move_put_400_too_many_questions: refusal("OPENING_QUESTIONS_TOO_MANY", (f) => {
    expect(copyFor(errorFromEnvelope(f))).toBe("You can have up to 3 questions.")
  }),
  first_move_get_404_not_enabled: refusal("MECHANIC_NOT_ENABLED", (f) => {
    expect(isFirstMoveOff({ response: { status: 404, data: f } })).toBe(true)
  }),
  match_get_200_first_move_waiting: (f) => {
    const m = toMatch(f.data)!
    expect(m.firstMove).toEqual({
      youMoveFirst: false,
      deadline: "", // the placeholder timestamp does not parse
      openingQuestions: [
        { id: "<uuid>", text: "What does your perfect Sunday look like?" },
        { id: "<uuid>", text: "Tea or coffee, and why?" },
      ],
      canExtend: true,
    })
    const state = firstMoveState(m)
    expect(state.kind).toBe("waiting")
    expect(firstMoveListLine(state)).toBe("Waiting for them")
    person((f.data as { person: unknown }).person)
  },
  match_get_200_first_move_yours: (f) => {
    const m = toMatch(f.data)!
    // opening_questions is omitted for the first mover: [] not undefined.
    expect(m.firstMove).toEqual({ youMoveFirst: true, deadline: "", openingQuestions: [], canExtend: false })
    const state = firstMoveState(m)
    expect(state.kind).toBe("yours")
    expect(firstMoveListLine(state)).toBe("You start")
  },
  match_opening_answer_post_201: (f) => expect(toOpeningAnswerResult(f.data)).toEqual({ sent: true, conversationId: "<uuid>" }),
  match_opening_answer_409_not_pending: refusal("FIRST_MOVE_NOT_PENDING", (f) => {
    expect(answerRefusalRefetches(errorFromEnvelope(f))).toBe(true)
  }),
  match_extend_post_200_free: (f) => {
    const r = toExtendResult(f.data)
    expect(r).toEqual({ extended: true, extraDays: 0, extraHours: 24, expiresAt: "", free: true })
    expect(extendedLine(r)).toBe("24 more hours added")
  },
  match_extend_429_limit_reached: refusal("EXTEND_LIMIT_REACHED", (f) => {
    const l = toExtendLimit(errorFromEnvelope(f))!
    expect(l).toEqual({ limit: 1, windowHours: 24, resetsAt: "" })
    expect(extendLimitLine(l)).toBe("You can give more time once every 24 hours. Try again later.")
  }),

  /* safety */
  block_post_200: (f) => expect(toBlockResult(f.data).blocked).toBe(true),
  blocks_get_200: (f) => expect(toBlocks(f.data)).toEqual([{ userId: "<target>", firstName: "Asha", age: 30, blockedAt: "" }]),
  report_post_201: (f) => {
    const r = toReportResult(f.data)
    expect(r.status).toBe("submitted")
    expect(r.blocked).toBe(true)
  },
  trusted_contacts_get_200: (f) => {
    const c = toTrustedContacts(f.data)
    expect(c.max).toBe(3)
    expect(c.items[0].shareLocationOnPanic).toBe(true)
    expect(c.items[0].person?.firstName).toBe("Asha")
  },
  trusted_contacts_get_200_profile_gone: (f) => {
    const c = toTrustedContacts(f.data)
    expect(c.items).toHaveLength(1)
    expect(c.items[0].person).toBeNull()
  },
  trusted_contact_put_200: (f) => expect(toTrustedContact(f.data)?.contactId).toBe("<contact>"),
  panic_post_200: (f) => expect(toPanicResult(f.data)).toEqual({ recorded: true, incidentId: "<uuid>", status: "open" }),
  share_location_post_200: (f) => expect(toLocationShare(f.data)?.recipientKind).toBe("trusted_contact"),
  share_location_get_200: (f) => expect(toLocationShares(f.data)[0].person?.userId).toBe("<contact>"),
  share_location_delete_200: (f) => expect(toLocationShare(f.data)?.stopped).toBe(true),
  shared_location_get_200: (f) => {
    const share = toLocationShare(f.data)!
    expect(share.shareId).toBe("<share>")
    // Coordinates are on the wire and deliberately not mapped.
    expect(Object.keys(share)).not.toContain("latitude")
  },
  shared_locations_get_200: (f) => expect(toLocationShares(f.data)[0].person?.firstName).toBe("Asha"),

  /* data export */
  data_export_post_202: (f) => {
    const e = toDataExport(f.data)!
    expect(e.status).toBe("pending")
    expect(exportView(e).downloadable).toBe(false)
  },
  data_export_me_get_200: (f) => expect(hasPendingExport(toDataExports(f.data))).toBe(true),

  /* premium */
  premium_catalogue_get_200: (f) => {
    const products = toCatalogue(f.data)
    expect(products.map((p) => p.id)).toEqual(["pass_30d", "pass_90d", "pass_365d", "boost"])
    expect(products[0].amountMinor).toBe(39900)
    expect(products[3].durationDays).toBe(0)
  },
  premium_catalogue_get_200_super_spark: (f) => {
    const products = toCatalogue(f.data)
    const packs = products.filter((p) => p.kind === "super_spark")
    expect(packs.map((p) => [p.id, p.quantity, p.amountMinor])).toEqual([
      ["super_spark_5", 5, 9900],
      ["super_spark_15", 15, 24900],
    ])
    expect(products.filter((p) => p.kind !== "super_spark").every((p) => p.quantity === 0)).toBe(true)
  },
  premium_purchase_post_201: (f) => {
    const purchase = toPurchase(f.data)
    expect(purchase.status).toBe("confirming")
    // The dialog opens from the server's session alone.
    expect(razorpayOptions(purchase, "30-day pass")).toEqual({
      key: "rzp_test_contract",
      order_id: "order_contract_1",
      amount: 39900,
      currency: "INR",
      name: "Momentum Dating",
      description: "30-day pass",
    })
  },
  premium_purchase_post_200_repeat: (f) => {
    // The same key returns the same purchase.
    expect(toPurchase(f.data)).toEqual(toPurchase(readFixture("premium_purchase_post_201").data))
  },
  premium_purchase_post_400_client_price: refusal("CLIENT_PRICE_REFUSED"),
  premium_purchase_post_409_key_reused: refusal("IDEMPOTENCY_KEY_REUSED"),
  premium_purchase_post_503_unavailable: refusal("PREMIUM_UNAVAILABLE", (f) => {
    expect(copyFor(errorFromEnvelope(f))).toBe(PASSES_UNAVAILABLE_COPY)
    expect(isPremiumUnavailable({ response: { status: 503, data: f } })).toBe(true)
  }),
  premium_payment_get_200_confirming: (f) => expect(toPaymentReading(f.data)).toEqual({ state: "confirming", refundStatus: "" }),
  premium_payment_get_200_paid: (f) => expect(toPaymentReading(f.data)).toEqual({ state: "paid", refundStatus: "" }),
  premium_payment_get_404_not_owner: refusal("PURCHASE_NOT_FOUND"),
  premium_me_get_200: (f) => {
    const me = toMyPremium(f.data)
    expect(me.hasPass).toBe(true)
    expect(me.passProduct).toBe("pass_30d")
    expect(me.boostBalance).toBe(1)
    expect(me.features.sort()).toEqual(["daily_boost", "match_extend"])
  },
  // The retired subscription route. This client never calls it; the code falls back to the generic line.
  premium_checkout_post_410: (f) => {
    const e = errorFromEnvelope(f, 410)
    expect(e.code).toBe("PREMIUM_SUBSCRIPTIONS_REMOVED")
    expect(copyFor(e)).toBe(GENERIC_COPY)
  },
}

describe("dating contract fixtures", () => {
  const names = fixtureNames()

  test("the fixtures are on disk", () => {
    expect(names.length).toBeGreaterThanOrEqual(93)
  })

  test("every fixture has a parser, and every parser has a fixture", () => {
    expect(names.filter((n) => !PARSERS[n])).toEqual([])
    expect(Object.keys(PARSERS).filter((n) => !names.includes(n))).toEqual([])
  })

  for (const name of names) {
    const parse = PARSERS[name]
    ;(parse ? test : test.skip)(`${name} parses through its mapper`, () => {
      parse(readFixture(name))
    })
  }

  test("every refusal the server writes in a fixture has its own words", () => {
    const codes = new Set(
      names
        .map((n) => errorFromEnvelope(readFixture(n)).code)
        .filter((c) => c && c !== "PREMIUM_SUBSCRIPTIONS_REMOVED"),
    )
    expect([...codes].filter((c) => !KNOWN_ERROR_CODES.includes(c))).toEqual([])
  })

  test("no server photo path in any fixture is rejected or rewritten", () => {
    for (const name of names) {
      const paths = readFixtureText(name).match(/\/v1\/dating\/photos\/[^"]+/g) ?? []
      for (const p of paths) expect(photoPath(p)).toBe(p)
    }
  })

  test("AGE_REQUIRED is recognised from an axios-shaped error", () => {
    expect(isAgeRefusal({ response: { status: 403, data: { error: { code: "AGE_REQUIRED", message: "x" } } } })).toBe(true)
  })

  const backend = backendContractsDir()
  ;(backend ? test : test.skip)("the copies are byte for byte the backend's", () => {
    const theirs = fixtureNames(backend!)
    expect(theirs).toEqual(names)
    for (const name of names) {
      expect(readFixtureText(name)).toBe(readFixtureText(name, backend!))
    }
  })
})
