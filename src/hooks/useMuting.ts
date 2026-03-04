"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { AxiosError } from "axios"

export interface MuteUser {
    muter_id: string
    muted_id: string
    created_at: string
}

function getMuteErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
        const status = error.response?.status
        if (status === 403) return "You do not have permission to perform this action."
        if (status === 404) return "User not found."
        if (status === 409) return "You have already muted this user."
    }
    return "An unexpected error occurred. Please try again."
}

export function useMuteUser() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ muted_id }: { muted_id: string }) => {
            const res = await api.post<{ data: MuteUser }>("/v1/graph/mute", { muted_id })
            return res.data.data
        },
        onSuccess: (_data, variables) => {
            qc.invalidateQueries({ queryKey: ["relationship", variables.muted_id] })
            qc.invalidateQueries({ queryKey: ["muted"] })
        },
        onError: (error) => {
            console.error("[Muting] Failed to mute user", error)
            const message = getMuteErrorMessage(error)
            window.alert(message)
        },
    })
}

export function useUnmuteUser() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ muted_id }: { muted_id: string }) => {
            const res = await api.delete<{ data: { status: string } }>("/v1/graph/mute", {
                data: { muted_id },
            })
            return res.data.data
        },
        onSuccess: (_data, variables) => {
            qc.invalidateQueries({ queryKey: ["relationship", variables.muted_id] })
            qc.invalidateQueries({ queryKey: ["muted"] })
        },
        onError: (error) => {
            console.error("[Muting] Failed to unmute user", error)
            const message = getMuteErrorMessage(error)
            window.alert(message)
        },
    })
}
