/*
  The caller's own dating profile, privacy and preferences, and the gate that
  turns the server's `profile_status` into a screen.

  The SERVER advances the status (draft → pending_photo → pending_selfie →
  active). This file only decides which screen a status means and, inside
  draft, which field is still missing. Nothing but `active` opens the deck:
  an unknown status is a hold, never ready.
*/

import { PREFERENCE_LIMITS } from "./labels"
import { knownCodes, toBasics, type Basics, type ProfileOptions } from "./options"
import { bool, num, obj, str, strList, time } from "./wire"

export interface Profile {
  /** Interests, height and the lifestyle basics (M6); empty when not given. */
  basics: Basics
  userId: string
  firstName: string
  intent: string
  bio: string
  gender: string
  /** From identity; never typed here. */
  birthDate: string
  city: string
  hasPoint: boolean
  paused: boolean
  languages: string[]
  trustTier: string
  status: string
  dobSource: string
}

export function toProfile(wire: unknown): Profile {
  const w = obj(wire)
  return {
    userId: str(w.user_id),
    firstName: str(w.first_name),
    intent: str(w.intent),
    bio: str(w.bio),
    gender: str(w.gender),
    birthDate: time(w.birth_date),
    city: str(w.city),
    hasPoint: typeof w.latitude === "number" && typeof w.longitude === "number",
    paused: bool(w.paused),
    languages: strList(w.language_prefs),
    trustTier: str(w.trust_tier),
    status: str(w.profile_status),
    dobSource: str(w.dob_source),
    basics: toBasics(w),
  }
}

/** POST /profile — only what was filled in; an empty field is left out, not sent blank. */
export interface ProfileInput {
  intent?: string
  gender?: string
  firstName?: string
  city?: string
  bio?: string
}

export function profileBody(input: ProfileInput): Record<string, string> {
  const body: Record<string, string> = {}
  const put = (key: string, value: string | undefined) => {
    const v = (value ?? "").trim()
    if (v) body[key] = v
  }
  put("intent", input.intent)
  put("gender", input.gender)
  put("first_name", input.firstName)
  put("city", input.city)
  if (input.bio !== undefined) body.bio = input.bio.trim()
  return body
}

/* ── about me (mechanic M6) ──────────────────────────────────────── */

export interface AboutForm {
  interests: string[]
  /** 0 = not set. Once set, the server can change a height but not remove it. */
  heightCm: number
  languages: string[]
  /** "" = prefer not to say. */
  drinking: string
  smoking: string
  exercise: string
  diet: string
}

/**
  The editor's starting point: the saved values, keeping only codes the
  options list knows. A language saved before the list existed (a free word)
  is dropped here, since the server would refuse it on save.
*/
export function aboutForm(profile: Profile | null | undefined, options: ProfileOptions): AboutForm {
  const b = profile?.basics
  const one = (code: string | undefined, list: ProfileOptions["drinking"]) => (code && list.some((o) => o.value === code) ? code : "")
  const h = b?.heightCm ?? 0
  return {
    interests: knownCodes(b?.interests ?? [], options.interests).slice(0, options.maxInterests),
    heightCm: h >= options.heightMin && h <= options.heightMax ? h : 0,
    languages: knownCodes(profile?.languages ?? [], options.languages).slice(0, options.maxLanguages),
    drinking: one(b?.drinking, options.drinking),
    smoking: one(b?.smoking, options.smoking),
    exercise: one(b?.exercise, options.exercise),
    diet: one(b?.diet, options.diet),
  }
}

/** How many saved languages the list doesn't know (they go on the next save). */
export function droppedLanguages(profile: Profile | null | undefined, options: ProfileOptions): number {
  const langs = profile?.languages ?? []
  return langs.length - knownCodes(langs, options.languages).length
}

export interface AboutProblem {
  field: string
  message: string
}

/** The first thing wrong, or null. The server checks again. */
export function aboutProblem(form: AboutForm, options: ProfileOptions): AboutProblem | null {
  if (form.interests.length > options.maxInterests) return { field: "interests", message: `You can pick up to ${options.maxInterests} interests.` }
  if (form.languages.length > options.maxLanguages) return { field: "language_prefs", message: `You can pick up to ${options.maxLanguages} languages.` }
  if (form.heightCm !== 0 && (!Number.isInteger(form.heightCm) || form.heightCm < options.heightMin || form.heightCm > options.heightMax)) {
    return { field: "height_cm", message: `Choose a height between ${options.heightMin} and ${options.heightMax} cm.` }
  }
  return null
}

/** POST /profile: every M6 field, so a cleared pick is saved as cleared. No height is left out (it can't be removed). */
export function aboutBody(form: AboutForm): Record<string, unknown> {
  const body: Record<string, unknown> = {
    interests: [...form.interests],
    language_prefs: [...form.languages],
    drinking: form.drinking,
    smoking: form.smoking,
    exercise: form.exercise,
    diet: form.diet,
  }
  if (form.heightCm > 0) body.height_cm = form.heightCm
  return body
}

/* ── privacy ─────────────────────────────────────────────────────── */

export interface Privacy {
  incognito: boolean
  hideLastActive: boolean
  verifiedOnlyFilter: boolean
  blurPhotosUntilMatch: boolean
  echoesConsent: boolean
}

export function toPrivacy(wire: unknown): Privacy {
  const w = obj(wire)
  return {
    incognito: bool(w.incognito),
    hideLastActive: bool(w.hide_last_active),
    verifiedOnlyFilter: bool(w.verified_only_filter),
    blurPhotosUntilMatch: bool(w.blur_photos_until_match),
    echoesConsent: bool(w.echoes_consent),
  }
}

export type PrivacyKey = keyof Privacy

const PRIVACY_WIRE: Record<PrivacyKey, string> = {
  incognito: "incognito",
  hideLastActive: "hide_last_active",
  verifiedOnlyFilter: "verified_only_filter",
  blurPhotosUntilMatch: "blur_photos_until_match",
  echoesConsent: "echoes_consent",
}

/** PATCH /profile/privacy is a partial update: one key per toggle. */
export function privacyPatch(key: PrivacyKey, value: boolean): Record<string, boolean> {
  return { [PRIVACY_WIRE[key]]: value }
}

/** Alphabetical by label. */
export const PRIVACY_TOGGLES: readonly { key: PrivacyKey; label: string; help: string }[] = [
  { key: "blurPhotosUntilMatch", label: "Blur my photos until we match", help: "People see a blurred version until you both spark." },
  { key: "hideLastActive", label: "Hide when I was last active", help: "Nobody sees your activity status." },
  { key: "incognito", label: "Incognito", help: "Only people you spark can see your profile." },
  { key: "echoesConsent", label: "Show my Momentum activity", help: "Adds a little of your public activity to your profile." },
  { key: "verifiedOnlyFilter", label: "Show me verified people only", help: "Your deck holds only people who passed the face check." },
].sort((a, b) => a.label.localeCompare(b.label)) as { key: PrivacyKey; label: string; help: string }[]

/**
  The privacy toggles to draw. With the filters flag on (the server sends
  `pass_filters`), "verified only" is a pass filter and lives on the filters
  screen, so the old free toggle goes. One exception: if it is still ON from
  before, it stays until switched off, because the server still applies it
  for a pass holder and a hidden switch could never be turned off.
*/
export function visiblePrivacyToggles(preferences: Preferences | null | undefined, privacy?: Pick<Privacy, "verifiedOnlyFilter"> | null) {
  if (!filtersEnabled(preferences) || privacy?.verifiedOnlyFilter) return PRIVACY_TOGGLES
  return PRIVACY_TOGGLES.filter((t) => t.key !== "verifiedOnlyFilter")
}

/* ── preferences ─────────────────────────────────────────────────── */

/** The filters that come with a pass (M6). Stored for anyone, applied only while `active`. */
export interface PassFilters {
  /** The caller holds a pass, so these apply to the deck. */
  active: boolean
  verifiedOnly: boolean
  /** 0 = no lower bound. */
  minHeightCm: number
  /** 0 = no upper bound. */
  maxHeightCm: number
  languages: string[]
  drinking: string[]
  smoking: string[]
  exercise: string[]
  diet: string[]
}

export interface Preferences {
  minAge: number
  maxAge: number
  distanceKm: number
  interestedIn: string
  intentFilter: string[]
  /** "" while the filters flag is off. */
  distanceBucket: string
  /** null while the filters flag is off: the screens keep their old shape. */
  passFilters: PassFilters | null
  /**
    Mechanic M12: the preferences marked as dealbreakers. null while that
    flag is off (the member is absent, or not a list); [] when on and none set.
  */
  dealbreakers: string[] | null
}

function toPassFilters(wire: unknown): PassFilters | null {
  if (!wire || typeof wire !== "object" || Array.isArray(wire)) return null
  const w = obj(wire)
  return {
    active: bool(w.active),
    verifiedOnly: bool(w.verified_only),
    minHeightCm: num(w.min_height_cm),
    maxHeightCm: num(w.max_height_cm),
    languages: strList(w.languages),
    drinking: strList(w.drinking),
    smoking: strList(w.smoking),
    exercise: strList(w.exercise),
    diet: strList(w.diet),
  }
}

export function toPreferences(wire: unknown): Preferences {
  const w = obj(wire)
  return {
    minAge: num(w.min_age),
    maxAge: num(w.max_age),
    distanceKm: num(w.distance_km),
    interestedIn: str(w.interested_in_gender),
    intentFilter: strList(w.intent_filter),
    distanceBucket: str(w.distance_bucket),
    passFilters: toPassFilters(w.pass_filters),
    dealbreakers: Array.isArray(w.dealbreakers) ? strList(w.dealbreakers) : null,
  }
}

/** The filters flag is on when the server sends `pass_filters`. */
export function filtersEnabled(p: Preferences | null | undefined): boolean {
  return !!p?.passFilters
}

/** Whether any pass filter is set (a set one can always be cleared, pass or not). */
export function hasPassFilters(f: Omit<PassFilters, "active"> | null | undefined): boolean {
  if (!f) return false
  return f.verifiedOnly || f.minHeightCm > 0 || f.maxHeightCm > 0 || [f.languages, f.drinking, f.smoking, f.exercise, f.diet].some((l) => l.length > 0)
}

export interface PreferencesInput {
  minAge: number
  maxAge: number
  distanceKm: number
  interestedIn: string
  intentFilter: string[]
}

/** What the form starts from: the saved values, or the widest legal defaults. */
export function preferencesForm(p: Preferences | null | undefined): PreferencesInput {
  return {
    minAge: p && p.minAge > 0 ? p.minAge : PREFERENCE_LIMITS.minAge,
    maxAge: p && p.maxAge > 0 ? p.maxAge : 45,
    distanceKm: p && p.distanceKm > 0 ? p.distanceKm : 25,
    interestedIn: p?.interestedIn || "",
    intentFilter: p?.intentFilter ?? [],
  }
}

/** The first thing wrong with the form, or "". The server checks again. */
export function preferencesProblem(input: PreferencesInput): string {
  const L = PREFERENCE_LIMITS
  if (!input.interestedIn) return "Choose who you'd like to see."
  if (!Number.isInteger(input.minAge) || input.minAge < L.minAge) return `The youngest age is ${L.minAge}. Pulse is for adults only.`
  if (!Number.isInteger(input.maxAge) || input.maxAge > L.maxAge) return `The oldest age is ${L.maxAge}.`
  if (input.minAge > input.maxAge) return "The lower age must come first."
  if (!Number.isInteger(input.distanceKm) || input.distanceKm < L.minDistanceKm || input.distanceKm > L.maxDistanceKm) {
    return `Choose a distance between ${L.minDistanceKm} and ${L.maxDistanceKm} km.`
  }
  return ""
}

export function preferencesBody(input: PreferencesInput): Record<string, unknown> {
  return {
    min_age: input.minAge,
    max_age: input.maxAge,
    distance_km: input.distanceKm,
    interested_in_gender: input.interestedIn,
    intent_filter: [...input.intentFilter].sort(),
  }
}

/* ── filters (mechanic M6) ───────────────────────────────────────── */

export interface FiltersForm {
  minAge: number
  maxAge: number
  distanceBucket: string
  intentFilter: string[]
  verifiedOnly: boolean
  /** 0 = any. */
  minHeightCm: number
  /** 0 = any. */
  maxHeightCm: number
  languages: string[]
  drinking: string[]
  smoking: string[]
  exercise: string[]
  diet: string[]
  /** Mechanic M12: the dealbreaker codes switched on; [] while the flag is off. See model/dealbreakers. */
  dealbreakers: string[]
}

/** Only a fallback for the form when the server sent no bucket; the server maps a bucket to its radius. */
function bucketForKm(km: number): string {
  if (km <= 0) return "km_10_25"
  if (km <= 5) return "lt_5_km"
  if (km <= 10) return "km_5_10"
  if (km <= 25) return "km_10_25"
  return "gt_25_km"
}

/** What the filters screen starts from: the saved values, codes the lists don't know dropped. */
export function filtersForm(p: Preferences | null | undefined, options: ProfileOptions): FiltersForm {
  const base = preferencesForm(p)
  const f = p?.passFilters
  const inRange = (cm: number) => (cm >= options.heightMin && cm <= options.heightMax ? cm : 0)
  const saved = p?.distanceBucket || bucketForKm(p?.distanceKm ?? 0)
  return {
    minAge: base.minAge,
    maxAge: base.maxAge,
    distanceBucket: options.distanceBuckets.some((o) => o.value === saved) ? saved : (options.distanceBuckets[0]?.value ?? ""),
    intentFilter: base.intentFilter,
    verifiedOnly: f?.verifiedOnly ?? false,
    minHeightCm: inRange(f?.minHeightCm ?? 0),
    maxHeightCm: inRange(f?.maxHeightCm ?? 0),
    languages: knownCodes(f?.languages ?? [], options.languages),
    drinking: knownCodes(f?.drinking ?? [], options.drinking),
    smoking: knownCodes(f?.smoking ?? [], options.smoking),
    exercise: knownCodes(f?.exercise ?? [], options.exercise),
    diet: knownCodes(f?.diet ?? [], options.diet),
    dealbreakers: [...(p?.dealbreakers ?? [])],
  }
}

/** The first thing wrong with the filters, or null. The server checks again. */
export function filtersProblem(form: FiltersForm, options: ProfileOptions): AboutProblem | null {
  const L = PREFERENCE_LIMITS
  if (!Number.isInteger(form.minAge) || form.minAge < L.minAge) return { field: "min_age", message: `The youngest age is ${L.minAge}. Pulse is for adults only.` }
  if (!Number.isInteger(form.maxAge) || form.maxAge > L.maxAge) return { field: "max_age", message: `The oldest age is ${L.maxAge}.` }
  if (form.minAge > form.maxAge) return { field: "min_age", message: "The lower age must come first." }
  if (!options.distanceBuckets.some((o) => o.value === form.distanceBucket)) return { field: "distance_bucket", message: "Choose how far to look." }
  if (form.minHeightCm > 0 && form.maxHeightCm > 0 && form.minHeightCm > form.maxHeightCm) {
    return { field: "min_height_cm", message: "The shorter height must come first." }
  }
  return null
}

/** The pass section of a filters form, as the server takes it. */
function passFiltersBody(form: FiltersForm): Record<string, unknown> {
  const body: Record<string, unknown> = {
    verified_only: form.verifiedOnly,
    languages: [...form.languages],
    drinking: [...form.drinking],
    smoking: [...form.smoking],
    exercise: [...form.exercise],
    diet: [...form.diet],
  }
  if (form.minHeightCm > 0) body.min_height_cm = form.minHeightCm
  if (form.maxHeightCm > 0) body.max_height_cm = form.maxHeightCm
  return body
}

/**
  PUT /preferences from the filters screen. The free section always; the
  pass section only with `withPass` (a caller without a pass is refused for
  setting one, so it is left out and the saved ones stay as they were).
*/
export function filtersBody(form: FiltersForm, withPass: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    min_age: form.minAge,
    max_age: form.maxAge,
    distance_bucket: form.distanceBucket,
    intent_filter: [...form.intentFilter].sort(),
  }
  if (withPass) body.pass_filters = passFiltersBody(form)
  return body
}

/** Clearing the pass filters is allowed without a pass. */
export function clearPassFiltersBody(): Record<string, unknown> {
  return { pass_filters: { verified_only: false, languages: [], drinking: [], smoking: [], exercise: [], diet: [] } }
}

/** A filters form with the pass section emptied. */
export function withoutPassFilters(form: FiltersForm): FiltersForm {
  return { ...form, verifiedOnly: false, minHeightCm: 0, maxHeightCm: 0, languages: [], drinking: [], smoking: [], exercise: [], diet: [] }
}

/* ── the onboarding gate ─────────────────────────────────────────── */

export type OnboardingStep =
  | "intent"
  | "basics"
  | "preferences"
  | "photos"
  | "selfie"
  | "review"
  | "paused"
  | "held"
  | "ready"

export const STATUS = {
  draft: "draft",
  pendingPhoto: "pending_photo",
  pendingSelfie: "pending_selfie",
  pendingReview: "pending_review",
  active: "active",
  paused: "paused",
} as const

/** Identity supplies the name and birth date; without both the server never leaves draft. */
export function identityIncomplete(profile: Profile): boolean {
  return !profile.firstName || !profile.birthDate
}

export function stepFor(profile: Profile | null, preferences: Preferences | null): OnboardingStep {
  if (!profile) return "intent"
  switch (profile.status) {
    case STATUS.draft:
      if (!profile.intent) return "intent"
      if (!profile.gender || !(profile.city || profile.hasPoint)) return "basics"
      if (!preferences?.interestedIn) return "preferences"
      // Everything this client can supply is there and the server still says
      // draft: identity is missing a name or a birth date. Basics explains.
      return "basics"
    case STATUS.pendingPhoto:
      return "photos"
    case STATUS.pendingSelfie:
      return "selfie"
    case STATUS.pendingReview:
      return "review"
    case STATUS.active:
      return "ready"
    case STATUS.paused:
      return "paused"
    default:
      return "held"
  }
}

export const DATING_BASE = "/dating"

/** Where a step lives; "" for the steps the root screen draws itself. */
export function stepHref(step: OnboardingStep): string {
  switch (step) {
    case "intent":
      return `${DATING_BASE}/onboarding/intent`
    case "basics":
      return `${DATING_BASE}/onboarding/basics`
    case "preferences":
      return `${DATING_BASE}/onboarding/preferences`
    case "photos":
      return `${DATING_BASE}/onboarding/photos`
    case "selfie":
      return `${DATING_BASE}/verify`
    default:
      return ""
  }
}
