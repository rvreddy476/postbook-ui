"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { AxiosError } from "axios"

/**
 * graph-service reads the target as `user_id` (POST/DELETE /v1/graph/mute,
 * handler.go Mute/Unmute) and answers 204. The callers keep passing
 * `muted_id`; this is the one place the wire field is named.
 */
export function muteRequestBody(mutedId: string): { user_id: string } {
    return { user_id: mutedId }
}

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
            await api.post("/v1/graph/mute", muteRequestBody(muted_id))
            return { muted_id }
        },
        onSuccess: (_data, variables) => {
            qc.invalidateQueries({ queryKey: ["relationship", variables.muted_id] })
            qc.invalidateQueries({ queryKey: ["muted"] })
            // A mute is folded into the feed block scope: refetch the feeds so the author leaves.
            qc.invalidateQueries({ queryKey: ["home-feed"] })
            qc.invalidateQueries({ queryKey: ["reels", "feed"] })
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
            await api.delete("/v1/graph/mute", { data: muteRequestBody(muted_id) })
            return { muted_id }
        },
        onSuccess: (_data, variables) => {
            qc.invalidateQueries({ queryKey: ["relationship", variables.muted_id] })
            qc.invalidateQueries({ queryKey: ["muted"] })
            qc.invalidateQueries({ queryKey: ["home-feed"] })
            qc.invalidateQueries({ queryKey: ["reels", "feed"] })
        },
        onError: (error) => {
            console.error("[Muting] Failed to unmute user", error)
            const message = getMuteErrorMessage(error)
            window.alert(message)
        },
    })
}
