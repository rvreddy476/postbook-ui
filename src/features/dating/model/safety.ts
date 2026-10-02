/*
  Safety: blocks, reports, trusted contacts. Panic and live location are
  mobile-only on this client; their answers are still parsed here so the
  contract tests cover every fixture the server writes.
*/

import { toPerson, type Person } from "./people"
import { arr, bool, num, obj, str, time } from "./wire"

/* ── blocks ──────────────────────────────────────────────────────── */

export interface BlockedPerson {
  userId: string
  firstName: string
  age: number
  blockedAt: string
}

export function toBlocks(wire: unknown): BlockedPerson[] {
  return arr(obj(wire).items)
    .map((raw) => {
      const w = obj(raw)
      return { userId: str(w.user_id), firstName: str(w.first_name), age: num(w.age), blockedAt: time(w.blocked_at) }
    })
    .filter((b) => b.userId)
}

export function toBlockResult(wire: unknown): { blocked: boolean } {
  return { blocked: bool(obj(wire).blocked) }
}

/* ── reports ─────────────────────────────────────────────────────── */

/** store.ReportReasons, alphabetical by label; `other` needs a description. */
export const REPORT_REASONS: readonly { value: string; label: string }[] = [
  { value: "fake_profile", label: "Fake profile" },
  { value: "harassment", label: "Harassment" },
  { value: "hate", label: "Hate speech" },
  { value: "nudity", label: "Nudity or sexual content" },
  { value: "other", label: "Something else" },
  { value: "scam", label: "Scam or fraud" },
  { value: "spam", label: "Spam" },
  { value: "underage", label: "Under 18" },
  { value: "violence", label: "Threats or violence" },
].sort((a, b) => a.label.localeCompare(b.label))

export const REPORT_DETAILS_MAX = 500

export interface ReportInput {
  targetId: string
  reason: string
  details: string
}

export function reportProblem(input: ReportInput): string {
  if (!REPORT_REASONS.some((r) => r.value === input.reason)) return "Choose a reason."
  const details = input.details.trim()
  if (input.reason === "other" && !details) return "Tell us what happened."
  if (details.length > REPORT_DETAILS_MAX) return `Keep the description to ${REPORT_DETAILS_MAX} characters.`
  return ""
}

export function reportBody(input: ReportInput): Record<string, string> {
  const body: Record<string, string> = { target_id: input.targetId, reason: input.reason }
  const details = input.details.trim()
  if (details) body.details = details
  return body
}

export interface ReportResult {
  id: string
  status: string
  /** The server also blocked the person. */
  blocked: boolean
}

export function toReportResult(wire: unknown): ReportResult {
  const w = obj(wire)
  return { id: str(w.id), status: str(w.status), blocked: bool(w.blocked) || bool(w.auto_blocked) }
}

/* ── trusted contacts ────────────────────────────────────────────── */

export interface TrustedContact {
  contactId: string
  shareLocationOnPanic: boolean
  /** null when their profile is gone. */
  person: Person | null
}

export interface TrustedContacts {
  items: TrustedContact[]
  max: number
}

export const TRUSTED_CONTACTS_MAX = 3

export function toTrustedContact(wire: unknown): TrustedContact | null {
  const w = obj(wire)
  const contactId = str(w.contact_id)
  return contactId ? { contactId, shareLocationOnPanic: bool(w.share_location_on_panic), person: toPerson(w.person) } : null
}

export function toTrustedContacts(wire: unknown): TrustedContacts {
  const w = obj(wire)
  return {
    items: arr(w.items)
      .map(toTrustedContact)
      .filter((c): c is TrustedContact => c !== null),
    max: num(w.max) || TRUSTED_CONTACTS_MAX,
  }
}

/* ── mobile-only surfaces, parsed for the contract ───────────────── */

export interface PanicResult {
  recorded: boolean
  incidentId: string
  status: string
}

export function toPanicResult(wire: unknown): PanicResult {
  const w = obj(wire)
  return { recorded: bool(w.recorded), incidentId: str(w.incident_id), status: str(w.status) }
}

export interface LocationShare {
  shareId: string
  recipientId: string
  recipientKind: string
  expiresAt: string
  stopped: boolean
  /** Whoever the row names: the recipient of my share, or the sharer of theirs. */
  person: Person | null
}

/** Coordinates are deliberately not mapped: this client draws no map and no distance. */
export function toLocationShare(wire: unknown): LocationShare | null {
  const w = obj(wire)
  const shareId = str(w.share_id)
  if (!shareId) return null
  return {
    shareId,
    recipientId: str(w.recipient_id),
    recipientKind: str(w.recipient_kind),
    expiresAt: time(w.expires_at),
    stopped: bool(w.stopped) || time(w.stopped_at) !== "",
    person: toPerson(w.recipient) ?? toPerson(w.person),
  }
}

export function toLocationShares(wire: unknown): LocationShare[] {
  return arr(obj(wire).items)
    .map(toLocationShare)
    .filter((s): s is LocationShare => s !== null)
}
