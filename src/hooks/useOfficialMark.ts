import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { serverError } from "@/app/settings/_lib/saveFeedback"

/*
 * The Official and Government marks (identity profile-service,
 * internal/officialverify; short-posts design "official matters must be
 * verified"). Off unless the server's flag is on: every route answers 503
 * ORG_VERIFICATION_DISABLED / GOVERNMENT_VERIFICATION_DISABLED, and the
 * settings entry is hidden then.
 *
 *   GET  /v1/profiles/me/verification/organisation                status
 *   POST /v1/profiles/me/verification/organisation                {legal_name, gstin|cin, official_domain, signatory_email}
 *   POST /v1/profiles/me/verification/organisation/confirm-email  {code}
 *   POST /v1/profiles/me/verification/government/accept           {invite_code}
 *
 * A hand-uploaded document (document_media_id) goes to human review, which
 * has no console yet, so the page does not offer it.
 */

export const ORG_PATH = "/v1/profiles/me/verification/organisation"
export const ORG_CONFIRM_PATH = `${ORG_PATH}/confirm-email`
export const GOV_ACCEPT_PATH = "/v1/profiles/me/verification/government/accept"
export const ORG_DISABLED = "ORG_VERIFICATION_DISABLED"

export type OfficialNext = "apply" | "email_code" | "review" | ""

export interface OfficialStatus {
    is_verified: boolean
    verification_level: string
    badge_flags: number
    organisation_name: string
    application_id?: string
    status?: string
    refusal_code?: string
    code_expires_at?: string
    next: OfficialNext
}

export type RegistrationKind = "gstin" | "cin"

export interface OfficialApplication {
    legalName: string
    kind: RegistrationKind
    number: string
    domain: string
    email: string
}

/** The step the page draws. A status read that failed (other than "off") draws the form. */
export type OfficialStep = "off" | "apply" | "email_code" | "review" | "done"

export function officialStep(status: OfficialStatus | null | undefined, off: boolean): OfficialStep {
    if (off) return "off"
    switch (status?.next) {
        case "email_code":
            return "email_code"
        case "review":
            return "review"
        case "":
            return "done"
        default:
            return "apply"
    }
}

/** The last application was turned down (the form shows a note above itself). */
export function lastRefused(status: OfficialStatus | null | undefined): boolean {
    return status?.next === "apply" && (status.status === "refused" || status.status === "rejected")
}

/** The request body: exactly one of gstin / cin, trimmed, registration upper-cased. */
export function applicationBody(a: OfficialApplication) {
    const number = a.number.trim().toUpperCase()
    return {
        legal_name: a.legalName.trim(),
        ...(a.kind === "gstin" ? { gstin: number } : { cin: number }),
        official_domain: a.domain.trim().toLowerCase(),
        signatory_email: a.email.trim(),
    }
}

export function applicationComplete(a: OfficialApplication): boolean {
    return [a.legalName, a.number, a.domain, a.email].every((v) => v.trim() !== "")
}

export const REGISTRATION_MAX: Record<RegistrationKind, number> = { gstin: 15, cin: 21 }

/** The done card's words. */
export function markWords(status: OfficialStatus): { heading: string; line: string } {
    const gov = status.verification_level === "government"
    const mark = gov ? "Government mark" : "Official mark"
    const name = status.organisation_name || "This account"
    return { heading: mark, line: `${name} holds the ${mark}.` }
}

const KEY = ["official-mark"]

/** Status, plus whether the feature is off on the server (503 ORG_VERIFICATION_DISABLED). */
export function useOfficialStatus() {
    return useQuery<{ status: OfficialStatus | null; off: boolean }>({
        queryKey: KEY,
        queryFn: async () => {
            try {
                const res = await api.get<{ data: OfficialStatus }>(ORG_PATH)
                return { status: res.data?.data ?? null, off: false }
            } catch (err) {
                const e = serverError(err)
                if (e.code === ORG_DISABLED) return { status: null, off: true }
                throw err
            }
        },
        retry: false,
    })
}

function useStatusMutation<T>(post: (body: T) => Promise<OfficialStatus>) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: post,
        onSuccess: (status) => qc.setQueryData(KEY, { status, off: false }),
        // A refused confirm (no pending code, too many tries) moves the server
        // back to "apply": read it again so the page follows.
        onError: () => qc.invalidateQueries({ queryKey: KEY }),
    })
}

export function useSubmitOfficial() {
    return useStatusMutation(async (a: OfficialApplication) => {
        const res = await api.post<{ data: OfficialStatus }>(ORG_PATH, applicationBody(a))
        return res.data.data
    })
}

export function useConfirmOfficialEmail() {
    return useStatusMutation(async (code: string) => {
        const res = await api.post<{ data: OfficialStatus }>(ORG_CONFIRM_PATH, { code: code.trim() })
        return res.data.data
    })
}

export function useAcceptGovernmentInvitation() {
    return useStatusMutation(async (inviteCode: string) => {
        const res = await api.post<{ data: OfficialStatus }>(GOV_ACCEPT_PATH, { invite_code: inviteCode.trim() })
        return res.data.data
    })
}
