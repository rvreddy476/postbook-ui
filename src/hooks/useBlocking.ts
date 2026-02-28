"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { PaginatedMeta } from "@/hooks/useConnections"
import { AxiosError } from "axios"

export interface BlockedUser {
    blocker_id: string
    blocked_id: string
    created_at: string
}

interface BlockedUsersResponse {
    items: BlockedUser[]
    meta: PaginatedMeta
}

function getBlockErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
        const status = error.response?.status
        if (status === 403) return "You do not have permission to perform this action."
        if (status === 404) return "User not found."
    }
    return "An unexpected error occurred. Please try again."
}

export function useBlockUser() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (username: string) => {
            const res = await api.post<{ data: { status: string } }>(
                `/v1/profiles/${username}/block`
            )
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["relationship"] })
            qc.invalidateQueries({ queryKey: ["connections"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
            qc.invalidateQueries({ queryKey: ["blocked-users"] })
        },
        onError: (error) => {
            console.error("[Blocking] Failed to block user", error)
            const message = getBlockErrorMessage(error)
            window.alert(message)
        },
    })
}

export function useUnblockUser() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (username: string) => {
            const res = await api.delete<{ data: { status: string } }>(
                `/v1/profiles/${username}/block`
            )
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["relationship"] })
            qc.invalidateQueries({ queryKey: ["connections"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
            qc.invalidateQueries({ queryKey: ["blocked-users"] })
        },
        onError: (error) => {
            console.error("[Blocking] Failed to unblock user", error)
            const message = getBlockErrorMessage(error)
            window.alert(message)
        },
    })
}

export function useBlockedUsers(enabled = true) {
    return useQuery({
        queryKey: ["blocked-users"],
        queryFn: async () => {
            const res = await api.get<{ data: BlockedUsersResponse }>(
                "/v1/profiles/me/blocks",
                { params: { limit: 50, offset: 0 } }
            )
            return res.data.data
        },
        enabled,
    })
}
