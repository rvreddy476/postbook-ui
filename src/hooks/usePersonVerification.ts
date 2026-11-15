import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { serverError } from "@/app/settings/_lib/saveFeedback"

/*
 * Person verification (identity profile-service, internal/personverify):
 * DigiLocker for the Aadhaar identity, then a selfie matched to its photo.
 * Required before the Official mark. Off unless the server's flag is on:
 * every route answers 503 PERSON_VERIFICATION_DISABLED and the settings
 * entry is hidden then.
 *
 *   GET  /v1/profiles/me/verification/person           status
 *   POST /v1/profiles/me/verification/person/start     {} → {attempt_id, authorize_url, expires_at}
 *   POST /v1/profiles/me/verification/person/callback  {state, code} → status
 *   POST /v1/profiles/me/verification/person/selfie    {selfie_media_id} → status
 *
 * DigiLocker comes back to /settings/verification/person/return?code&state,
 * which posts both in the body (never logged, and taken off the address bar
 * at once). In the server's local test mode the authorize URL already IS
 * that return URL.
 */

export const PERSON_PATH = "/v1/profiles/me/verification/person"
export const PERSON_DISABLED = "PERSON_VERIFICATION_DISABLED"
export const PERSON_RETURN_PATH = "/settings/verification/person/return"
export const PERSON_PAGE = "/settings/verification/person"

export type PersonNext = "digilocker" | "selfie" | ""

export interface PersonAttempt {
    id: string
    status: string
    refusal_code?: string
    expires_at: string
}

export interface PersonStatus {
    is_verified: boolean
    verification_level: string
    badge_flags: number
    attempt: PersonAttempt | null
    next: PersonNext
}

export type PersonStep = "off" | "digilocker" | "selfie" | "done"

export function personStep(status: PersonStatus | null | undefined, off: boolean): PersonStep {
    if (off) return "off"
    switch (status?.next) {
        case "selfie":
            return "selfie"
        case "":
            return "done"
        default:
            return "digilocker"
    }
}

/** The last attempt failed and the server wants a fresh start. */
export function lastAttemptFailed(status: PersonStatus | null | undefined): boolean {
    return status?.next === "digilocker" && status.attempt?.status === "refused"
}

/** code and state from a return URL's query, or null when either is missing. */
export function returnParams(search: string): { code: string; state: string } | null {
    const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
    const code = q.get("code")?.trim() ?? ""
    const state = q.get("state")?.trim() ?? ""
    return code && state ? { code, state } : null
}

/**
 * Where Continue with DigiLocker goes: DigiLocker itself, or — in the
 * server's local test mode, whose authorize URL is already our return URL —
 * straight to the return page on this origin (the URL may name another host
 * than the one this page is served from).
 */
export function digilockerTarget(authorizeUrl: string): string {
    try {
        const u = new URL(authorizeUrl)
        if (u.pathname.endsWith(PERSON_RETURN_PATH) && returnParams(u.search)) return `${PERSON_RETURN_PATH}${u.search}`
    } catch {
        /* not a URL: hand it over as is */
    }
    return authorizeUrl
}

/** The recorder's mime without codecs, as the upload declares it. */
export function uploadMime(recorderMime: string): string {
    return recorderMime.split(";")[0] || "video/webm"
}

export const SELFIE_CLIP_MS = 3000

/** Codes after which the server is back at "digilocker": read the status again. */
const RESTART_CODES = new Set(["NO_PENDING_ATTEMPT", "INVALID_STATE", "LIVENESS_FAILED", "FACE_MISMATCH"])

const KEY = ["person-verification"]

export function usePersonStatus() {
    return useQuery<{ status: PersonStatus | null; off: boolean }>({
        queryKey: KEY,
        queryFn: async () => {
            try {
                const res = await api.get<{ data: PersonStatus }>(PERSON_PATH)
                return { status: res.data?.data ?? null, off: false }
            } catch (err) {
                if (serverError(err).code === PERSON_DISABLED) return { status: null, off: true }
                throw err
            }
        },
        retry: false,
    })
}

export function useStartPersonVerification() {
    return useMutation({
        mutationFn: async () => {
            const res = await api.post<{ data: { attempt_id: string; authorize_url: string; expires_at: string } }>(
                `${PERSON_PATH}/start`,
                {},
            )
            return res.data.data
        },
    })
}

function useStatusMutation<T>(post: (body: T) => Promise<PersonStatus>) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: post,
        onSuccess: (status) => {
            qc.setQueryData(KEY, { status, off: false })
            // The Official mark page reads the person mark too.
            void qc.invalidateQueries({ queryKey: ["official-mark"] })
        },
        onError: (err) => {
            if (RESTART_CODES.has(serverError(err).code ?? "")) void qc.invalidateQueries({ queryKey: KEY })
        },
    })
}

export function usePersonCallback() {
    return useStatusMutation(async (p: { code: string; state: string }) => {
        const res = await api.post<{ data: PersonStatus }>(`${PERSON_PATH}/callback`, { state: p.state, code: p.code })
        return res.data.data
    })
}

export function useSubmitPersonSelfie() {
    return useStatusMutation(async (mediaId: string) => {
        const res = await api.post<{ data: PersonStatus }>(`${PERSON_PATH}/selfie`, { selfie_media_id: mediaId })
        return res.data.data
    })
}
