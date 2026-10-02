/*
  Profile options (mechanic M6): GET /v1/dating/profile/options.

  The server owns every list and every label. This file only reads them and
  turns codes into those labels; a code the lists don't know renders nothing,
  so a raw value never reaches the screen.

  Order: interests, languages and diet are alphabetical by label (sorted here
  as well, in case the server ever isn't). Drinking, smoking, exercise and the
  distance buckets are scales, so they keep the server's order (never → daily,
  nearest → any distance).
*/

import type { Option } from "./labels"
import { arr, num, obj, str } from "./wire"

export interface ProfileOptions {
  interests: Option[]
  maxInterests: number
  languages: Option[]
  maxLanguages: number
  heightMin: number
  heightMax: number
  drinking: Option[]
  smoking: Option[]
  exercise: Option[]
  diet: Option[]
  distanceBuckets: Option[]
}

/** The server's documented limits, used only when a read leaves one out. */
export const OPTION_DEFAULTS = { maxInterests: 10, maxLanguages: 8, heightMin: 120, heightMax: 230 } as const

const byLabel = (a: Option, b: Option) => a.label.localeCompare(b.label)

/** `[{code, label}]` → `[{value, label}]`; an entry missing either half is dropped, and so is a repeat. */
function toOptions(wire: unknown, sort = false): Option[] {
  const seen = new Set<string>()
  const out: Option[] = []
  for (const raw of arr(wire)) {
    const o = obj(raw)
    const value = str(o.code)
    const label = str(o.label)
    if (!value || !label || seen.has(value)) continue
    seen.add(value)
    out.push({ value, label })
  }
  return sort ? out.sort(byLabel) : out
}

export function toProfileOptions(wire: unknown): ProfileOptions {
  const w = obj(wire)
  const height = obj(w.height_cm)
  const heightMin = num(height.min) || OPTION_DEFAULTS.heightMin
  const heightMax = num(height.max) || OPTION_DEFAULTS.heightMax
  return {
    interests: toOptions(w.interests, true),
    maxInterests: num(w.max_interests) || OPTION_DEFAULTS.maxInterests,
    languages: toOptions(w.languages, true),
    maxLanguages: num(w.max_languages) || OPTION_DEFAULTS.maxLanguages,
    heightMin: Math.min(heightMin, heightMax),
    heightMax: Math.max(heightMin, heightMax),
    drinking: toOptions(w.drinking),
    smoking: toOptions(w.smoking),
    exercise: toOptions(w.exercise),
    diet: toOptions(w.diet, true),
    distanceBuckets: toOptions(w.distance_buckets),
  }
}

/** The label for a code, or "" when the list doesn't know it. */
export function labelFor(code: unknown, options: readonly Option[]): string {
  const c = str(code)
  return c ? (options.find((o) => o.value === c)?.label ?? "") : ""
}

/** Labels for codes, in the list's own order; unknown codes and repeats are dropped. */
export function labelsFor(codes: readonly string[], options: readonly Option[]): string[] {
  const wanted = new Set(codes.map(str).filter(Boolean))
  return options.filter((o) => wanted.has(o.value)).map((o) => o.label)
}

/** Only the codes the list knows, in the list's order. */
export function knownCodes(codes: readonly string[], options: readonly Option[]): string[] {
  const wanted = new Set(codes.map(str).filter(Boolean))
  return options.filter((o) => wanted.has(o.value)).map((o) => o.value)
}

/** "172 cm"; "" for no height. */
export function heightLabel(cm: number): string {
  return cm > 0 ? `${cm} cm` : ""
}

/** Every height the server accepts, as select options. */
export function heightChoices(options: Pick<ProfileOptions, "heightMin" | "heightMax">): Option[] {
  const out: Option[] = []
  for (let cm = options.heightMin; cm <= options.heightMax; cm++) out.push({ value: String(cm), label: heightLabel(cm) })
  return out
}

/** Add or remove one code from a multi-pick. */
export function toggleCode(list: readonly string[], code: string): string[] {
  return list.includes(code) ? list.filter((c) => c !== code) : [...list, code]
}

/* ── a person's basics ───────────────────────────────────────────── */

export interface Basics {
  /** Codes from the interest list. */
  interests: string[]
  /** 0 = not given. */
  heightCm: number
  drinking: string
  smoking: string
  exercise: string
  diet: string
}

/** The four lifestyle basics, in the order they are drawn and edited. */
export const LIFESTYLE_FIELDS = ["drinking", "smoking", "exercise", "diet"] as const
export type LifestyleField = (typeof LIFESTYLE_FIELDS)[number]

/** Our own words for each basic; diet's label reads well alone, the scales need a name. */
export const LIFESTYLE_TITLES: Record<LifestyleField, string> = {
  drinking: "Drinking",
  smoking: "Smoking",
  exercise: "Exercise",
  diet: "Diet",
}

export function toBasics(wire: unknown): Basics {
  const w = obj(wire)
  const height = num(w.height_cm)
  return {
    interests: arr(w.interests).map(str).filter(Boolean),
    heightCm: height > 0 ? Math.round(height) : 0,
    drinking: str(w.drinking),
    smoking: str(w.smoking),
    exercise: str(w.exercise),
    diet: str(w.diet),
  }
}

export const NO_BASICS: Basics = { interests: [], heightCm: 0, drinking: "", smoking: "", exercise: "", diet: "" }

/** Interest labels, alphabetical; unknown codes dropped. */
export function interestLabels(basics: Pick<Basics, "interests">, options: ProfileOptions | null | undefined): string[] {
  return options ? labelsFor(basics.interests, options.interests) : []
}

/** "172 cm", "Drinking: Socially", "Smoking: Never", "Exercise: Often", "Vegetarian" — empty or unknown ones dropped. */
export function basicsLabels(basics: Basics, options: ProfileOptions | null | undefined): string[] {
  if (!options) return []
  const out: string[] = []
  const h = basics.heightCm >= options.heightMin && basics.heightCm <= options.heightMax ? heightLabel(basics.heightCm) : ""
  if (h) out.push(h)
  for (const field of LIFESTYLE_FIELDS) {
    const label = labelFor(basics[field], options[field])
    if (!label) continue
    out.push(field === "diet" ? label : `${LIFESTYLE_TITLES[field]}: ${label}`)
  }
  return out
}

/** Language labels: the list's label when it knows the code, else the old capitalised word. */
export function languageLabels(codes: readonly string[], options: ProfileOptions | null | undefined, fallback: (code: string) => string): string[] {
  const out: string[] = []
  for (const code of codes) {
    const label = (options ? labelFor(code, options.languages) : "") || fallback(code)
    if (label && !out.includes(label)) out.push(label)
  }
  return out.sort((a, b) => a.localeCompare(b))
}

/** The deck card's chips: interests first, then basics, at most `max`, and how many more there are. */
export function cardChips(basics: Basics, options: ProfileOptions | null | undefined, max = 4): { chips: string[]; more: number } {
  const all = [...interestLabels(basics, options), ...basicsLabels(basics, options)]
  return { chips: all.slice(0, max), more: Math.max(all.length - max, 0) }
}
