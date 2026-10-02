/*
  A person as dating-service shows them: the compact card (matches, sparks,
  GET /people/:id) and the richer deck card. Also the one rule for photos.

  Photos: the server names the image route for every photo, already decided
  for THIS viewer (`/v1/dating/photos/:id/full` or `/blurred`). The client
  renders exactly that path. It never builds one and never swaps `blurred`
  for `full`; anything that is not a dating photo path is dropped.
*/

import { distanceLabel, intentLabel, languageLabel, lastActiveLabel } from "./labels"
import { toBasics, type Basics } from "./options"
import { arr, bool, num, obj, str } from "./wire"

const PHOTO_PATH = /^\/v1\/dating\/photos\/[^/?#]+\/(full|blurred)$/

/** The server's path if it is a dating photo route, else "". */
export function photoPath(value: unknown): string {
  const s = str(value)
  return PHOTO_PATH.test(s) ? s : ""
}

/*
  Who liked you (M4): a locked card's one image is GET
  /v1/dating/liked-you/:sparkId/photo, which only ever redirects to the
  server-blurred image. It is never a person's photo, so toPerson never takes it.
*/
const LIKED_YOU_PHOTO_PATH = /^\/v1\/dating\/liked-you\/[^/?#]+\/photo$/

/** The server's path if it is a locked liked-you card's image route, else "". */
export function likedYouPhotoPath(value: unknown): string {
  const s = str(value)
  return LIKED_YOU_PHOTO_PATH.test(s) ? s : ""
}

/** Any image route this client may load with the token: a dating photo or a locked liked-you card. */
export function viewablePhotoPath(value: unknown): string {
  return photoPath(value) || likedYouPhotoPath(value)
}

/** Whether a server path is the blurred variant (from the path itself, so it cannot disagree). */
export function isBlurredPath(path: string): boolean {
  return path.endsWith("/blurred")
}

export interface PersonPhoto {
  id: string
  url: string
  blurred: boolean
}

export interface PersonPrompt {
  promptId: number
  question: string
  answer: string
}

export interface Person {
  userId: string
  firstName: string
  /** 0 when the server sent none; never drawn then. */
  age: number
  photoUrl: string
  photoBlurred: boolean
  verified: boolean
  city: string
  intentLabel: string
  distanceLabel: string
  lastActiveLabel: string
  bio: string
  prompts: PersonPrompt[]
  /** Capitalised words, for screens without the options list. */
  languages: string[]
  /** The raw codes, for labels from the options list (M6). */
  languageCodes: string[]
  photos: PersonPhoto[]
  /** Interests, height and the lifestyle basics (M6), as codes; empty when not given. */
  basics: Basics
}

function verifiedTier(tier: string): boolean {
  return tier === "selfie" || tier === "aadhaar"
}

function toDetail(wire: unknown): Pick<Person, "bio" | "prompts" | "languages" | "languageCodes" | "photos" | "basics"> {
  const d = obj(wire)
  return {
    basics: toBasics(d),
    languageCodes: arr(d.languages).map(str).filter(Boolean),
    bio: str(d.bio),
    prompts: arr(d.prompts)
      .map((raw) => {
        const p = obj(raw)
        return { promptId: num(p.prompt_id), question: str(p.question), answer: str(p.answer) }
      })
      .filter((p) => p.question && p.answer),
    languages: arr(d.languages).map(languageLabel).filter(Boolean),
    photos: arr(d.photos)
      .map((raw) => {
        const p = obj(raw)
        const url = photoPath(p.url)
        return { id: str(p.id), url, blurred: isBlurredPath(url) }
      })
      .filter((p) => p.url),
  }
}

/**
  One mapper for both shapes. The compact card says `verified` and
  `photo_state`; the deck card says `trust_tier` and `primary_photo_blurred`.
  Either way the photo comes from `primary_photo_url` untouched.
*/
export function toPerson(wire: unknown): Person | null {
  const w = obj(wire)
  const userId = str(w.user_id)
  if (!userId) return null
  const photoUrl = photoPath(w.primary_photo_url)
  const detail = toDetail(w.detail)
  return {
    userId,
    firstName: str(w.first_name),
    age: num(w.age),
    photoUrl,
    photoBlurred: photoUrl ? isBlurredPath(photoUrl) : false,
    verified: bool(w.verified) || verifiedTier(str(w.trust_tier)),
    city: str(w.city),
    intentLabel: intentLabel(w.intent),
    distanceLabel: distanceLabel(w.distance_bucket),
    lastActiveLabel: lastActiveLabel(w.last_active_bucket),
    ...detail,
    photos: detail.photos.length ? detail.photos : photoUrl ? [{ id: str(w.primary_photo_id), url: photoUrl, blurred: isBlurredPath(photoUrl) }] : [],
  }
}

/** "Asha, 30" — the age only when the server sent one. */
export function nameLine(person: Pick<Person, "firstName" | "age">): string {
  const name = person.firstName || "Someone"
  return person.age > 0 ? `${name}, ${person.age}` : name
}

/** The meta facts under a name, in a fixed order, empty ones dropped. */
export function metaLine(person: Person): string[] {
  return [person.distanceLabel, person.city, person.intentLabel, person.lastActiveLabel].filter(Boolean)
}

export const personHref = (userId: string) => `/dating/people/${encodeURIComponent(userId)}`
