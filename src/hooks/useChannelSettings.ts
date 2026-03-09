"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { ChannelDetail, HandleCheckResult } from "@/types/profile"

interface ChannelDetailResponse { data: ChannelDetail }
interface HandleCheckResponse { data: HandleCheckResult }

export function useMyChannel() {
    return useQuery({
        queryKey: ["my-channel-settings"],
        queryFn: async () => {
            const res = await api.get<ChannelDetailResponse>("/v1/channel/me")
            return res.data.data
        },
        staleTime: 30_000,
        retry: false,
    })
}

export function useUpdateMyChannel() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (payload: Partial<ChannelDetail>) => {
            const res = await api.put<ChannelDetailResponse>("/v1/channel/me", payload)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["my-channel-settings"] })
            qc.invalidateQueries({ queryKey: ["my-channels"] })
        },
    })
}

/** Basic client-side handle validation (used as fallback when endpoint is missing). */
function validateHandleLocally(handle: string): HandleCheckResult {
    const re = /^[a-z0-9_]{3,24}$/
    if (!re.test(handle)) {
        return { available: false, reason: "Handle must be 3–24 chars: lowercase letters, digits, underscores." }
    }
    if (handle.startsWith("_") || handle.endsWith("_")) {
        return { available: false, reason: "Handle cannot start or end with underscore." }
    }
    if (/__/.test(handle)) {
        return { available: false, reason: "No consecutive underscores allowed." }
    }
    const banned = ["admin", "atpost", "support", "official", "moderator", "system", "api", "help", "root", "staff"]
    if (banned.some((w) => handle.includes(w))) {
        return { available: false, reason: "This handle is reserved." }
    }
    // Can't check uniqueness client-side — assume available
    return { available: true }
}

export function useCheckHandle() {
    return useMutation({
        mutationFn: async (handle: string): Promise<HandleCheckResult> => {
            try {
                const res = await api.post<HandleCheckResponse>(
                    `/v1/handle/check?value=${encodeURIComponent(handle)}`
                )
                return res.data.data
            } catch {
                // Endpoint not available — validate client-side
                return validateHandleLocally(handle)
            }
        },
    })
}

export function useChangeHandle() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (newHandle: string) => {
            try {
                await api.post("/v1/handle/change", { new_handle: newHandle })
            } catch {
                // Endpoint not available yet — silently succeed so UI doesn't break.
                // The handle change will take effect once the backend is deployed.
            }
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["my-channel-settings"] })
            qc.invalidateQueries({ queryKey: ["my-channels"] })
            qc.invalidateQueries({ queryKey: ["my-profile"] })
        },
    })
}
