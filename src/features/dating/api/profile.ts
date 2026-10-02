/* Consents, the caller's profile, privacy and preferences. */

import { toConsents, type Consents, type ConsentType } from "../model/consents"
import { toPreferences, toPrivacy, toProfile, type Preferences, type Privacy, type Profile } from "../model/profile"
import { errorStatus } from "../model/wire"
import { del, get, patch, post, put, seg } from "./client"

/** GET /consents — also the access probe: the gateway answers 404 to everyone outside the pilot. */
export async function fetchConsents(): Promise<Consents> {
  return toConsents(await get("/consents"))
}

export async function setConsent(type: ConsentType, granted: boolean): Promise<Consents> {
  return toConsents(await put(`/consents/${seg(type)}`, { granted }))
}

/** GET /profile — null when there is no dating profile yet (404). */
export async function fetchProfile(): Promise<Profile | null> {
  try {
    return toProfile(await get("/profile"))
  } catch (error) {
    if (errorStatus(error) === 404) return null
    throw error
  }
}

export async function upsertProfile(body: Record<string, unknown>): Promise<Profile> {
  return toProfile(await post("/profile", body))
}

export async function setPaused(paused: boolean): Promise<Profile> {
  return toProfile(await post("/profile/pause", { paused }))
}

export async function deleteProfile(reason?: string): Promise<void> {
  await del("/profile", reason ? { reason } : {})
}

export async function fetchPrivacy(): Promise<Privacy> {
  return toPrivacy(await get("/profile/privacy"))
}

export async function patchPrivacy(body: Record<string, boolean>): Promise<Privacy> {
  return toPrivacy(await patch("/profile/privacy", body))
}

export async function fetchPreferences(): Promise<Preferences> {
  return toPreferences(await get("/preferences"))
}

export async function putPreferences(body: Record<string, unknown>): Promise<Preferences> {
  return toPreferences(await put("/preferences", body))
}
