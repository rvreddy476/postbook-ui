import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { serverError } from "@/app/settings/_lib/saveFeedback"
import { uploadMedia } from "@/lib/mediaUpload"

/*
 * The Official and Government marks (identity profile-service,
 * internal/officialverify; short-posts design "official matters must be
 * verified"). Off unless the server's flag is on: every route answers 503
 * ORG_VERIFICATION_DISABLED / GOVERNMENT_VERIFICATION_DISABLED, and the
 * settings entry is hidden then.
 *
 *   GET  /v1/profiles/me/verification/organisation                status
 *   POST /v1/profiles/me/verification/organisation                {legal_name, gstin|cin, official_domain, signatory_email, document_media_id?}
 *   POST /v1/profiles/me/verification/organisation/confirm-email  {code}
 *   POST /v1/profiles/me/verification/government/accept           {invite_code}
 *
 * The optional registration certificate (official-marks console contract
 * section 6, 16 Nov 2026): a PDF, JPEG or PNG of at most 10 MB, checked here
 * and again by media-service, uploaded through media-service's private
 * `document` kind (init with file_type "document" -> PUT -> confirm, the
 * shared uploadMedia plumbing) and sent as `document_media_id`. With it the
 * registry is not asked: after the e-mail code the server answers
 * next = "review" and a person on the team checks it in the admin console.
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
    /** The uploaded registration certificate's media id, when one is attached. */
    documentMediaId?: string
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
        ...(a.documentMediaId ? { document_media_id: a.documentMediaId } : {}),
    }
}

export function applicationComplete(a: OfficialApplication): boolean {
    return [a.legalName, a.number, a.domain, a.email].every((v) => v.trim() !== "")
}

export const REGISTRATION_MAX: Record<RegistrationKind, number> = { gstin: 15, cin: 21 }

/* ---- Registration certificate (contract section 6; words verbatim, same on Android) ---- */

export const CERTIFICATE_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const
export const CERTIFICATE_ACCEPT = CERTIFICATE_TYPES.join(",")
/** 10 MB, media-service's MaxDocumentSizeBytes. */
export const CERTIFICATE_MAX_BYTES = 10_485_760

export const CERTIFICATE_WORDS = {
    label: "Registration certificate (optional)",
    help: "Upload your GST or incorporation certificate as a PDF, JPEG or PNG, up to 10 MB. With a certificate, a person on our team checks your application instead of the registry. This can take a few days.",
    upload: "Upload certificate",
    uploading: "Uploading…",
    remove: "Remove",
    wrongType: "Upload a PDF, JPEG or PNG.",
    tooBig: "The certificate must be 10 MB or smaller.",
    failed: "The certificate didn't upload. Check your connection and try again.",
} as const

export type Certificate =
    | { state: "none" }
    | { state: "uploading"; name: string }
    | { state: "ready"; name: string; mediaId: string }
    | { state: "error"; message: string }

export const NO_CERTIFICATE: Certificate = { state: "none" }

/** The refusal words for a file the client will not upload, or null when it may go. */
export function certificateRefusal(file: { type: string; size: number }): string | null {
    if (!(CERTIFICATE_TYPES as readonly string[]).includes(file.type)) return CERTIFICATE_WORDS.wrongType
    if (file.size <= 0 || file.size > CERTIFICATE_MAX_BYTES) return CERTIFICATE_WORDS.tooBig
    return null
}

type DocumentUpload = (file: File, fileType: "document") => Promise<string>

/**
 * Checks the file, then uploads it as a private document. `set` sees
 * "uploading" first (submit is disabled meanwhile) and then the outcome, which
 * is also returned. A refused or failed file never carries a media id.
 */
export async function uploadCertificate(
    file: File,
    set: (c: Certificate) => void,
    upload: DocumentUpload = uploadMedia,
): Promise<Certificate> {
    const refusal = certificateRefusal(file)
    if (refusal) {
        const c: Certificate = { state: "error", message: refusal }
        set(c)
        return c
    }
    set({ state: "uploading", name: file.name })
    let next: Certificate
    try {
        const mediaId = await upload(file, "document")
        next = mediaId
            ? { state: "ready", name: file.name, mediaId }
            : { state: "error", message: CERTIFICATE_WORDS.failed }
    } catch {
        next = { state: "error", message: CERTIFICATE_WORDS.failed }
    }
    set(next)
    return next
}

/** The media id to send, only for a finished upload. */
export function certificateMediaId(c: Certificate): string | undefined {
    return c.state === "ready" ? c.mediaId : undefined
}

/** Submit needs the four fields and no upload in flight. */
export function canSubmitApplication(a: OfficialApplication, c: Certificate): boolean {
    return applicationComplete(a) && c.state !== "uploading"
}

/** The application as submitted: the form plus the certificate, only when one is ready. */
export function withCertificate(a: OfficialApplication, c: Certificate): OfficialApplication {
    const id = certificateMediaId(c)
    const out: OfficialApplication = { ...a }
    if (id) out.documentMediaId = id
    else delete out.documentMediaId
    return out
}

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

type Post = (path: string, body: unknown) => Promise<{ data: { data: OfficialStatus } }>

/** POST the application; `post` is the app's api client unless a test passes one. */
export async function postApplication(a: OfficialApplication, post: Post = (p, b) => api.post(p, b)): Promise<OfficialStatus> {
    const res = await post(ORG_PATH, applicationBody(a))
    return res.data.data
}

export function useSubmitOfficial() {
    return useStatusMutation((a: OfficialApplication) => postApplication(a))
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
