/*
  The caller's own dating profile, privacy and preferences, and the gate that
  turns the server's `profile_status` into a screen.

  The SERVER advances the status (draft → pending_photo → pending_selfie →
  active). This file only decides which screen a status means and, inside
  draft, which field is still missing. Nothing but `active` opens the deck:
  an unknown status is a hold, never ready.
*/

import { PREFERENCE_LIMITS } from "./labels"
import { bool, num, obj, str, strList, time } from "./wire"

export interface Profile {
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

/* ── preferences ─────────────────────────────────────────────────── */

export interface Preferences {
  minAge: number
  maxAge: number
  distanceKm: number
  interestedIn: string
  intentFilter: string[]
}

export function toPreferences(wire: unknown): Preferences {
  const w = obj(wire)
  return {
    minAge: num(w.min_age),
    maxAge: num(w.max_age),
    distanceKm: num(w.distance_km),
    interestedIn: str(w.interested_in_gender),
    intentFilter: strList(w.intent_filter),
  }
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
