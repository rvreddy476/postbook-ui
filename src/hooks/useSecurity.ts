"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Setup2FAResponse {
    secret: string
    qr_code_url: string
    recovery_codes: string[]
}

export interface Session {
    id: string
    device_id: string
    platform: string
    ip: string
    user_agent: string
    created_at: string
    expires_at: string
}

export interface TrustedDevice {
    id: string
    fingerprint: string
    device_name: string
    last_used: string
    created_at: string
}

/* ------------------------------------------------------------------ */
/*  2FA Hooks                                                          */
/* ------------------------------------------------------------------ */

export function useSetup2FA() {
    return useMutation({
        mutationFn: async (): Promise<Setup2FAResponse> => {
            console.info("[2FA]", "Setup initiated")
            const res = await api.post<{ data: Setup2FAResponse }>("/v1/auth/2fa/setup")
            return res.data.data
        },
        onError: (error) => {
            console.error("[SecuritySettings]", "Failed to setup 2FA", error)
        },
    })
}

export function useVerify2FASetup() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (code: string): Promise<{ message: string }> => {
            console.info("[2FA]", "Verifying setup code")
            const res = await api.post<{ data: { message: string } }>("/v1/auth/2fa/verify-setup", { code })
            return res.data.data
        },
        onSuccess: () => {
            console.info("[2FA]", "2FA enabled successfully")
            queryClient.invalidateQueries({ queryKey: ["sessions"] })
        },
        onError: (error) => {
            console.error("[SecuritySettings]", "Failed to verify 2FA setup", error)
        },
    })
}

export function useDisable2FA() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            password,
            code,
        }: {
            password: string
            code: string
        }): Promise<{ message: string }> => {
            console.info("[2FA]", "Disabling 2FA")
            const res = await api.post<{ data: { message: string } }>("/v1/auth/2fa/disable", {
                password,
                code,
            })
            return res.data.data
        },
        onSuccess: () => {
            console.info("[2FA]", "2FA disabled successfully")
            queryClient.invalidateQueries({ queryKey: ["sessions"] })
        },
        onError: (error) => {
            console.error("[SecuritySettings]", "Failed to disable 2FA", error)
        },
    })
}

/* ------------------------------------------------------------------ */
/*  Sessions Hooks                                                     */
/* ------------------------------------------------------------------ */

export function useSessions() {
    return useQuery({
        queryKey: ["sessions"],
        queryFn: async (): Promise<Session[]> => {
            const res = await api.get<{ data: Session[] }>("/v1/auth/sessions")
            return res.data.data ?? []
        },
        staleTime: 30 * 1000,
    })
}

export function useRevokeSession() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (sessionId: string): Promise<{ status: string }> => {
            console.info("[SecuritySettings]", `Revoking session ${sessionId}`)
            const res = await api.delete<{ data: { status: string } }>(`/v1/auth/sessions/${sessionId}`)
            return res.data.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["sessions"] })
        },
        onError: (error) => {
            console.error("[SecuritySettings]", "Failed to revoke session", error)
        },
    })
}

export function useLogoutAll() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (): Promise<{ status: string; sessions_revoked: number }> => {
            console.info("[SecuritySettings]", "Logging out all sessions")
            const res = await api.post<{ data: { status: string; sessions_revoked: number } }>(
                "/v1/auth/logout-all"
            )
            return res.data.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["sessions"] })
        },
        onError: (error) => {
            console.error("[SecuritySettings]", "Failed to logout all sessions", error)
        },
    })
}

/* ------------------------------------------------------------------ */
/*  Trusted Devices Hooks                                              */
/* ------------------------------------------------------------------ */

export function useTrustedDevices() {
    return useQuery({
        queryKey: ["trusted-devices"],
        queryFn: async (): Promise<TrustedDevice[]> => {
            const res = await api.get<{ data: TrustedDevice[] }>("/v1/auth/trusted-devices")
            return res.data.data ?? []
        },
        staleTime: 30 * 1000,
    })
}

export function useRemoveTrustedDevice() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (deviceId: string): Promise<{ status: string }> => {
            console.info("[SecuritySettings]", `Removing trusted device ${deviceId}`)
            const res = await api.delete<{ data: { status: string } }>(`/v1/auth/trusted-devices/${deviceId}`)
            return res.data.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["trusted-devices"] })
        },
        onError: (error) => {
            console.error("[SecuritySettings]", "Failed to remove trusted device", error)
        },
    })
}

export function useTrustDevice() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            fingerprint,
            device_name,
        }: {
            fingerprint: string
            device_name: string
        }): Promise<{ status: string }> => {
            console.info("[SecuritySettings]", "Trusting current device")
            const res = await api.post<{ data: { status: string } }>("/v1/auth/trust-device", {
                fingerprint,
                device_name,
            })
            return res.data.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["trusted-devices"] })
        },
        onError: (error) => {
            console.error("[SecuritySettings]", "Failed to trust device", error)
        },
    })
}

/* ------------------------------------------------------------------ */
/*  Password Reset Hooks                                               */
/* ------------------------------------------------------------------ */

export function useForgotPassword() {
    return useMutation({
        mutationFn: async (identifier: string): Promise<{ message: string }> => {
            console.info("[Auth]", "Requesting password reset")
            const res = await api.post<{ data: { message: string } }>("/v1/auth/forgot-password", {
                identifier,
            })
            return res.data.data
        },
        onError: (error) => {
            console.error("[Auth]", "Failed to request password reset", error)
        },
    })
}

export function useResetPassword() {
    return useMutation({
        mutationFn: async ({
            identifier,
            code,
            new_password,
        }: {
            identifier: string
            code: string
            new_password: string
        }): Promise<{ message: string }> => {
            console.info("[Auth]", "Resetting password")
            const res = await api.post<{ data: { message: string } }>("/v1/auth/reset-password", {
                identifier,
                code,
                new_password,
            })
            return res.data.data
        },
        onError: (error) => {
            console.error("[Auth]", "Failed to reset password", error)
        },
    })
}

/* ------------------------------------------------------------------ */
/*  Verification Hooks                                                 */
/* ------------------------------------------------------------------ */

/**
 * Verify an email address with the code that was mailed.
 *
 * BOTH the code and the verification token are required. The endpoint
 * deliberately takes no user id — on a public route a caller-supplied id
 * would let anyone grind codes against any account they can name — so the
 * token issued at registration is what scopes the code to one account.
 * Sending the code alone answers 400, and the account can never verify.
 */
export function useVerifyEmail() {
    return useMutation({
        mutationFn: async (
            { verificationToken, code }: { verificationToken: string; code: string },
        ): Promise<{ message: string }> => {
            console.info("[Auth]", "Verifying email")
            const res = await api.post<{ data: { message: string } }>("/v1/auth/verify-email", {
                verification_token: verificationToken,
                code,
            })
            return res.data.data
        },
        onError: (error) => {
            console.error("[Auth]", "Failed to verify email", error)
        },
    })
}

export function useVerifyPhone() {
    return useMutation({
        mutationFn: async (code: string): Promise<{ message: string }> => {
            console.info("[Auth]", "Verifying phone")
            const res = await api.post<{ data: { message: string } }>("/v1/auth/verify-phone", { code })
            return res.data.data
        },
        onError: (error) => {
            console.error("[Auth]", "Failed to verify phone", error)
        },
    })
}

/**
 * Resend the verification email. Takes the SAME token registration issued
 * — it reuses that transaction rather than starting a new one — and for
 * the same reason as verify-email, the token is required.
 */
export function useResendVerification() {
    return useMutation({
        mutationFn: async (
            { type, verificationToken }: { type: "email" | "phone"; verificationToken: string },
        ): Promise<{ message: string }> => {
            console.info("[Auth]", `Resending ${type} verification`)
            const res = await api.post<{ data: { message: string } }>("/v1/auth/resend-verification", {
                type,
                verification_token: verificationToken,
            })
            return res.data.data
        },
        onError: (error) => {
            console.error("[Auth]", "Failed to resend verification", error)
        },
    })
}

/* ------------------------------------------------------------------ */
/*  Account Deletion Hook                                              */
/* ------------------------------------------------------------------ */

/**
 * What `DELETE /v1/auth/account` answers on success
 * (identity auth-service, DeletionSchedule in internal/service/
 * account_lifecycle.go). Nothing is erased now: the account is
 * pending_deletion until scheduled_purge_date, and signing in before then
 * cancels. Every session has already been revoked by the time this arrives.
 */
export interface DeletionSchedule {
    account_status: string
    scheduled_purge_date: string
    cancel_by_logging_in: boolean
}

export const DELETE_ACCOUNT_PATH = "/v1/auth/account"

/**
 * The ONE account-deletion request (auth-service DeleteAccount in
 * internal/http/account_control.go): `DELETE /v1/auth/account` with the
 * password in the JSON body, because a signed-in device alone is not enough
 * authority to delete an account.
 *
 * `_retry: true` opts this call out of the axios 401 refresh-and-retry. A 401
 * here is normally INVALID_PASSWORD, and refreshing the session to resend the
 * same wrong password only rotates the refresh token and checks the password
 * twice. (The request interceptor already refreshes an expiring access token
 * before sending.)
 *
 * The old web path, `DELETE /v1/users/me`, is gone: no service implements it.
 */
export function deleteAccountRequest(password: string) {
    return {
        url: DELETE_ACCOUNT_PATH,
        config: { data: { password }, _retry: true } as { data: { password: string }; _retry: true },
    }
}

/** User-facing text for a failed delete, from the auth-service error codes. */
export function deleteAccountErrorMessage(err: unknown): string {
    const e = err as { response?: { status?: number; data?: { error?: { code?: string; message?: string } } } }
    const status = e?.response?.status
    const code = e?.response?.data?.error?.code
    const message = e?.response?.data?.error?.message
    if (code === "INVALID_PASSWORD") {
        return "That password is incorrect. Your account has not been deleted."
    }
    if (status === 401) {
        return "Your session has expired. Sign in again, then retry. Your account has not been deleted."
    }
    if (code === "INVALID_REQUEST") {
        return "Enter your password to confirm."
    }
    if (status === 409 && message) {
        return message
    }
    if (!e?.response) {
        return "Could not reach the server. Your account has not been deleted."
    }
    return message || "Could not delete your account. Please try again."
}

export function useDeleteAccount() {
    return useMutation({
        mutationFn: async (password: string): Promise<DeletionSchedule> => {
            const { url, config } = deleteAccountRequest(password)
            const res = await api.delete<{ data: DeletionSchedule }>(url, config)
            return res.data.data
        },
    })
}

/* ------------------------------------------------------------------ */
/*  Login Anomaly Hooks (A13)                                          */
/* ------------------------------------------------------------------ */

// LoginAnomaly mirrors auth-service auth.login_anomalies. risk_score
// 0-100; >=70 is a sign-in we revoked + still want the user to
// acknowledge. acknowledged_at flips when the user dismisses the
// entry from their inbox.
export interface LoginAnomaly {
    id: string
    user_id: string
    anomaly_type:
        | "new_ip"
        | "new_device"
        | "new_country"
        | "impossible_travel"
        | "many_failed"
        | "password_reset_used"
        | "session_revoked"
    ip?: string
    user_agent?: string
    device_id?: string
    country_code?: string
    metadata?: Record<string, unknown>
    risk_score: number
    challenged: boolean
    acknowledged_at?: string | null
    occurred_at: string
}

export function useLoginAnomalies() {
    return useQuery({
        queryKey: ["login-anomalies"],
        queryFn: async (): Promise<LoginAnomaly[]> => {
            const res = await api.get<{ data: LoginAnomaly[] }>("/v1/auth/security/anomalies")
            return res.data.data ?? []
        },
        staleTime: 30 * 1000,
    })
}

export function useAcknowledgeAnomaly() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (anomalyId: string): Promise<{ status: string }> => {
            const res = await api.post<{ data: { status: string } }>(
                `/v1/auth/security/anomalies/${anomalyId}/ack`,
            )
            return res.data.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["login-anomalies"] })
        },
        onError: (error) => {
            console.error("[SecuritySettings]", "Failed to ack anomaly", error)
        },
    })
}
