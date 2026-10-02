"use client"

/*
  TanStack Query hooks for access, consents, the caller's profile, privacy,
  preferences, photos, prompts and the verification status.
  Keys: ["dating", …].
*/

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { createPhoto, deletePhoto, deletePrompt, fetchMyPhotos, fetchPromptCatalog, fetchPrompts, updatePhoto, upsertPrompt } from "../api/photos"
import { deleteProfile, fetchConsents, fetchPreferences, fetchPrivacy, fetchProfile, patchPrivacy, putPreferences, setConsent, setPaused, upsertProfile } from "../api/profile"
import { fetchVerificationStatus } from "../api/verification"
import type { Consents, ConsentType } from "../model/consents"
import { stepFor, type OnboardingStep, type Preferences, type Privacy, type Profile } from "../model/profile"
import { errorStatus } from "../model/wire"

export const KEYS = {
  all: ["dating"] as const,
  consents: ["dating", "consents"] as const,
  profile: ["dating", "profile"] as const,
  privacy: ["dating", "privacy"] as const,
  preferences: ["dating", "preferences"] as const,
  photos: ["dating", "photos"] as const,
  promptCatalog: ["dating", "prompts", "catalog"] as const,
  prompts: ["dating", "prompts", "mine"] as const,
  verification: ["dating", "verification"] as const,
  deck: ["dating", "deck"] as const,
  allowances: ["dating", "allowances"] as const,
  sparks: ["dating", "sparks"] as const,
  matches: ["dating", "matches"] as const,
  match: (id: string) => ["dating", "matches", id] as const,
  person: (id: string) => ["dating", "people", id] as const,
  blocks: ["dating", "blocks"] as const,
  trusted: ["dating", "trusted"] as const,
  exports: ["dating", "exports"] as const,
  catalogue: ["dating", "premium", "catalogue"] as const,
  premiumMe: ["dating", "premium", "me"] as const,
}

/** A 4xx will not change by asking again; anything else gets two more tries. */
const retry = (count: number, error: unknown) => {
  const status = errorStatus(error)
  if (status >= 400 && status < 500) return false
  return count < 2
}

/** GET /consents. A 404 here is the gateway saying "not in the pilot". */
export function useConsents() {
  return useQuery<Consents>({ queryKey: KEYS.consents, queryFn: fetchConsents, retry, staleTime: 60_000 })
}

export function useSetConsent() {
  const qc = useQueryClient()
  return useMutation<Consents, unknown, { type: ConsentType; granted: boolean }>({
    mutationFn: ({ type, granted }) => setConsent(type, granted),
    onSuccess: (consents) => {
      qc.setQueryData(KEYS.consents, consents)
      // Withdrawal clears what the consent covered.
      void qc.invalidateQueries({ queryKey: KEYS.profile })
      void qc.invalidateQueries({ queryKey: KEYS.privacy })
    },
  })
}

export function useProfile(enabled = true) {
  return useQuery<Profile | null>({ queryKey: KEYS.profile, queryFn: fetchProfile, retry, enabled })
}

export function usePreferences(enabled = true) {
  return useQuery<Preferences>({ queryKey: KEYS.preferences, queryFn: fetchPreferences, retry, enabled })
}

export function useUpsertProfile() {
  const qc = useQueryClient()
  return useMutation<Profile, unknown, Record<string, unknown>>({
    mutationFn: upsertProfile,
    onSuccess: (profile) => qc.setQueryData(KEYS.profile, profile),
  })
}

export function useSetPaused() {
  const qc = useQueryClient()
  return useMutation<Profile, unknown, boolean>({
    mutationFn: setPaused,
    onSuccess: (profile) => {
      qc.setQueryData(KEYS.profile, profile)
      void qc.invalidateQueries({ queryKey: KEYS.deck })
    },
  })
}

export function useDeleteProfile() {
  const qc = useQueryClient()
  return useMutation<void, unknown, string | undefined>({
    mutationFn: (reason) => deleteProfile(reason),
    onSuccess: () => {
      qc.removeQueries({ queryKey: KEYS.all })
    },
  })
}

export function usePrivacy() {
  return useQuery<Privacy>({ queryKey: KEYS.privacy, queryFn: fetchPrivacy, retry })
}

export function usePatchPrivacy() {
  const qc = useQueryClient()
  return useMutation<Privacy, unknown, Record<string, boolean>>({
    mutationFn: patchPrivacy,
    onSuccess: (privacy) => {
      qc.setQueryData(KEYS.privacy, privacy)
      void qc.invalidateQueries({ queryKey: KEYS.consents })
    },
  })
}

export function usePutPreferences() {
  const qc = useQueryClient()
  return useMutation<Preferences, unknown, Record<string, unknown>>({
    mutationFn: putPreferences,
    onSuccess: (prefs) => {
      qc.setQueryData(KEYS.preferences, prefs)
      void qc.invalidateQueries({ queryKey: KEYS.profile })
      void qc.invalidateQueries({ queryKey: KEYS.deck })
    },
  })
}

/* ── photos and prompts ──────────────────────────────────────────── */

export function useMyPhotos() {
  return useQuery({ queryKey: KEYS.photos, queryFn: fetchMyPhotos, retry })
}

function usePhotoMutation<V>(fn: (vars: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation<unknown, unknown, V>({
    mutationFn: fn,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: KEYS.photos })
      // An approved primary photo is what moves the profile out of pending_photo.
      void qc.invalidateQueries({ queryKey: KEYS.profile })
    },
  })
}

export const useCreatePhoto = () => usePhotoMutation<{ mediaId: string; isPrimary: boolean; sortOrder: number }>((v) => createPhoto(v.mediaId, v.isPrimary, v.sortOrder))
export const useSetPrimaryPhoto = () => usePhotoMutation<string>((id) => updatePhoto(id, { is_primary: true }))
export const useSetPhotoVisibility = () => usePhotoMutation<{ id: string; visibility: string }>((v) => updatePhoto(v.id, { visibility: v.visibility }))
export const useDeletePhoto = () => usePhotoMutation<string>(deletePhoto)

export function usePromptCatalog() {
  return useQuery({ queryKey: KEYS.promptCatalog, queryFn: fetchPromptCatalog, retry, staleTime: 10 * 60_000 })
}

export function usePrompts() {
  return useQuery({ queryKey: KEYS.prompts, queryFn: fetchPrompts, retry })
}

export function useUpsertPrompt() {
  const qc = useQueryClient()
  return useMutation<unknown, unknown, { promptId: number; answer: string }>({
    mutationFn: (v) => upsertPrompt(v.promptId, v.answer),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.prompts }),
  })
}

export function useDeletePrompt() {
  const qc = useQueryClient()
  return useMutation<void, unknown, number>({
    mutationFn: deletePrompt,
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.prompts }),
  })
}

export function useVerificationStatus(enabled = true) {
  return useQuery({ queryKey: KEYS.verification, queryFn: fetchVerificationStatus, retry, enabled })
}

/* ── the gate ────────────────────────────────────────────────────── */

export type GateState =
  | { kind: "loading" }
  /** The gateway answered 404: this account is outside the pilot. */
  | { kind: "closed" }
  | { kind: "error"; error: unknown; retry: () => void }
  | { kind: "open"; step: OnboardingStep; profile: Profile | null; preferences: Preferences | null; consents: Consents }

/**
  Access first (GET /consents; 404 = closed), then the profile and the
  preferences, then the step the server's status means.
*/
export function useGate(): GateState {
  const consents = useConsents()
  const open = consents.isSuccess
  const profile = useProfile(open)
  const preferences = usePreferences(open && profile.isSuccess && profile.data !== null)

  if (consents.isError) {
    if (errorStatus(consents.error) === 404) return { kind: "closed" }
    return { kind: "error", error: consents.error, retry: () => void consents.refetch() }
  }
  if (!consents.isSuccess || profile.isPending) return { kind: "loading" }
  if (profile.isError) return { kind: "error", error: profile.error, retry: () => void profile.refetch() }
  const p = profile.data ?? null
  if (p && preferences.isPending) return { kind: "loading" }
  if (p && preferences.isError) return { kind: "error", error: preferences.error, retry: () => void preferences.refetch() }
  const prefs = p ? (preferences.data ?? null) : null
  return { kind: "open", step: stepFor(p, prefs), profile: p, preferences: prefs, consents: consents.data }
}
