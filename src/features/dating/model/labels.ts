/*
  Wire codes to the words on screen. An unknown code renders nothing rather
  than leaking a raw value onto a card.
*/

import { str } from "./wire"

export interface Option {
  value: string
  label: string
}

const byLabel = (a: Option, b: Option) => a.label.localeCompare(b.label)

/**
  How far away someone is: a BUCKET, never a number. Only these four labels
  are ever drawn, mapped from the server's bucket code. The server's own
  `distance_label` is not rendered, so a future server that sent "3.2 km"
  could not reach the screen. Nothing here computes a distance.
*/
const DISTANCE_BUCKETS: Record<string, string> = {
  lt_5_km: "Under 5 km away",
  km_5_10: "5 to 10 km away",
  km_10_25: "10 to 25 km away",
  gt_25_km: "More than 25 km away",
}

export function distanceLabel(bucket: unknown): string {
  return DISTANCE_BUCKETS[str(bucket)] || ""
}

const LAST_ACTIVE: Record<string, string> = {
  today: "Active today",
  this_week: "Active this week",
  a_while_ago: "Active a while ago",
}

export function lastActiveLabel(bucket: unknown): string {
  return LAST_ACTIVE[str(bucket)] || ""
}

/** service.Intents. */
export const INTENT_OPTIONS: readonly Option[] = [
  { value: "casual", label: "Something casual" },
  { value: "marriage", label: "Marriage" },
  { value: "serious", label: "A serious relationship" },
].sort(byLabel)

export function intentLabel(code: unknown): string {
  return INTENT_OPTIONS.find((o) => o.value === str(code))?.label || ""
}

/** service.Genders. */
export const GENDER_OPTIONS: readonly Option[] = [
  { value: "man", label: "Man" },
  { value: "nonbinary", label: "Non-binary" },
  { value: "woman", label: "Woman" },
].sort(byLabel)

/** service.InterestedInGenders. */
export const INTERESTED_IN_OPTIONS: readonly Option[] = [
  { value: "everyone", label: "Everyone" },
  { value: "man", label: "Men" },
  { value: "nonbinary", label: "Non-binary people" },
  { value: "woman", label: "Women" },
].sort(byLabel)

/** service.PhotoVisibilities. */
export const PHOTO_VISIBILITY_OPTIONS: readonly Option[] = [
  { value: "match_only", label: "Matches only" },
  { value: "public", label: "Everyone on Pulse" },
  { value: "sparked_only", label: "People I've sparked" },
].sort(byLabel)

export function languageLabel(code: unknown): string {
  const s = str(code)
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""
}

export const PREFERENCE_LIMITS = { minAge: 18, maxAge: 120, minDistanceKm: 1, maxDistanceKm: 500 } as const
export const PROMPT_ANSWER_MAX = 280
export const SPARK_NOTE_MAX = 280
