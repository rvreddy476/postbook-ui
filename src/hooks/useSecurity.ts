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
