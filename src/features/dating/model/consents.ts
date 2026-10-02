/*
  Explicit consent for sensitive data (lane D9): GET /consents,
  PUT /consents/:type {granted}. Withdrawal clears what the consent covered.
*/

import { arr, bool, obj, str, time } from "./wire"

export type ConsentType = "biometric_selfie" | "echoes" | "sensitive_community" | "sensitive_religion"

export interface ConsentState {
  type: string
  granted: boolean
  policyVersion: string
  updatedAt: string
}

export interface Consents {
  policyVersion: string
  items: ConsentState[]
}

export function toConsents(wire: unknown): Consents {
  const w = obj(wire)
  return {
    policyVersion: str(w.current_policy_version),
    items: arr(w.consents)
      .map((raw) => {
        const c = obj(raw)
        return { type: str(c.consent_type), granted: bool(c.granted), policyVersion: str(c.policy_version), updatedAt: time(c.updated_at) }
      })
      .filter((c) => c.type),
  }
}

export function isGranted(consents: Consents | null | undefined, type: ConsentType): boolean {
  return consents?.items.some((c) => c.type === type && c.granted) === true
}

export interface ConsentCopy {
  type: ConsentType
  title: string
  body: string
}

/** Alphabetical by title. */
export const CONSENT_COPY: readonly ConsentCopy[] = (
  [
    {
      type: "biometric_selfie",
      title: "Face check",
      body: "To confirm it's really you, a short selfie video is compared with your main photo. The video is used only for this check.",
    },
    {
      type: "echoes",
      title: "Momentum activity on your profile",
      body: "Shows a little of your public Momentum activity on your Pulse profile. Off unless you turn it on.",
    },
    {
      type: "sensitive_community",
      title: "Community",
      body: "Community is sensitive personal data. With your consent it is stored encrypted and used only on your profile and for matching. Withdrawing deletes it.",
    },
    {
      type: "sensitive_religion",
      title: "Religion",
      body: "Religion is sensitive personal data. With your consent it is stored encrypted and used only on your profile and for matching. Withdrawing deletes it.",
    },
  ] as ConsentCopy[]
).sort((a, b) => a.title.localeCompare(b.title))
