"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { StatusMood } from "@/types/profile"

interface StatusResponse { data: StatusMood }

export function useUpdateStatus() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (payload: {
            status_text: string
            status_emoji: string
            expires_at?: string | null
        }) => {
            const res = await api.patch<StatusResponse>("/v1/users/me/status", payload)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["my-profile"] })
            qc.invalidateQueries({ queryKey: ["profile"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        },
    })
}
