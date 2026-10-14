import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"

// Endpoint audit: these hooks used to call `/v1/trust/appeals` and
// `/v1/trust/verification`. There is no `/v1/trust` prefix in the api-gateway
// route table at all, so every call 404'd at the edge.
//
// trust-safety-service actually serves:
//   POST  /v1/appeals                     submit an appeal
//   GET   /v1/appeals?mine=true           the caller's own appeals
//   POST  /v1/verification-requests       submit a verification request
//   GET   /v1/verification-requests       ADMIN ONLY (403 for a normal user)
//
// The gateway routes `/v1/verification-requests` to trust-safety-service
// (api-gateway cmd/server/main.go; internal key stamped per
// pkg/internalroutes).
//
// Two caveats the paths alone don't show, both handled below:
//   - the list responses are `{ data: { items: [...] } }`, not `{ data: [] }`
//   - `/v1/verification-requests` has no self-service read, so a user cannot
//     poll their own verification status. See useVerificationRequest.

interface ContentAppeal { id: string; content_type: string; content_id: string; action_taken: string; appeal_reason: string; status: string; created_at: string }

/** trust-safety store/postgres/trust_extras.go VerificationRequest. */
export interface VerificationRequest {
    id: string
    user_id: string
    type: string
    status: string
    rejection_reason?: string
    created_at: string
    updated_at?: string
}

/**
 * The types trust-safety accepts (`validVerificationTypes` in
 * internal/service/trust_extras.go). Anything else is a 400.
 */
export const VERIFICATION_TYPES = ["creator", "business", "organization", "government"] as const
export type VerificationType = (typeof VERIFICATION_TYPES)[number]

export const VERIFICATION_REQUESTS_PATH = "/v1/verification-requests"

/** The submit body: `type` is required; `docs` is a flat string map upstream (map[string]string). */
export function verificationRequestBody(type: VerificationType, docs: Record<string, string> = {}) {
    return { type, docs }
}

export function useSubmitAppeal() {
    const qc = useQueryClient()
    return useMutation({
        // `action_taken` is accepted for call-site compatibility and is not
        // sent: trust-safety derives the action from the moderation record it
        // already holds and binds only content_type/content_id/appeal_reason.
        mutationFn: async (body: { content_type: string; content_id: string; action_taken?: string; appeal_reason: string }) => {
            const res = await api.post<{ data: ContentAppeal }>("/v1/appeals", {
                content_type: body.content_type,
                content_id: body.content_id,
                appeal_reason: body.appeal_reason,
            })
            return res.data?.data ?? res.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["appeals"] })
        },
    })
}

export function useMyAppeals() {
    return useQuery<ContentAppeal[]>({
        queryKey: ["appeals"],
        queryFn: async () => {
            // The filter is `mine=true`. Anything else falls through to the
            // admin listing, which a normal user gets a 403 on.
            const res = await api.get<{ data: { items: ContentAppeal[] } }>("/v1/appeals", {
                params: { mine: true },
            })
            return res.data?.data?.items ?? []
        },
    })
}

/**
 * There is no self-service read for a verification request. trust-safety
 * exposes only `GET /v1/verification-requests`, which is admin-scoped and
 * answers 403 to a normal user, so this reports "unknown" rather than
 * surfacing a permission error as if it were the user's own status.
 *
 * A UI that wants to show "your verification is pending" needs a backend
 * endpoint first (e.g. `GET /v1/verification-requests/me`).
 */
export function useVerificationRequest() {
    return useQuery<VerificationRequest | null>({
        queryKey: ["verification"],
        queryFn: async () => null,
        enabled: false,
        initialData: null,
    })
}

export function useSubmitVerification() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (body: { type: VerificationType; docs?: Record<string, string> }) => {
            const res = await api.post<{ data: VerificationRequest }>(
                VERIFICATION_REQUESTS_PATH,
                verificationRequestBody(body.type, body.docs),
            )
            return res.data?.data ?? res.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["verification"] })
        },
    })
}
