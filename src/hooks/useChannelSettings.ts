"use client"

import axios from "axios"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { ChannelDetail, HandleCheckResult } from "@/types/profile"

interface ChannelDetailResponse { data: ChannelDetail }
interface ChannelsResponse { data: ChannelDetail[] }

type ChangeHandleInput = string | { username: string }

function normalizeHandle(handle: string) {
    return handle.trim().toLowerCase()
}

export function useMyChannel() {
    return useQuery({
        queryKey: ["my-channel-settings"],
        queryFn: async () => {
            const res = await api.get<ChannelsResponse>("/v1/users/me/channels")
            return res.data.data?.[0] ?? null
        },
        staleTime: 30_000,
        retry: false,
    })
}

export function useUpdateMyChannel() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, ...payload }: Partial<ChannelDetail> & { id: string }) => {
            if (!id) {
                throw new Error("Channel ID is required")
            }
            const res = await api.patch<ChannelDetailResponse>(`/v1/channels/${id}`, payload)
            return res.data.data
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["my-channel-settings"] })
            qc.invalidateQueries({ queryKey: ["my-channels"] })
            qc.invalidateQueries({ queryKey: ["channel", data.handle] })
        },
    })
}

/** Basic client-side handle validation, used before the server availability check. */
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
    return { available: true }
}

export function useCheckHandle() {
    return useMutation({
        mutationFn: async (handle: string): Promise<HandleCheckResult> => {
            const normalized = normalizeHandle(handle)
            const local = validateHandleLocally(normalized)
            if (!local.available) {
                return local
            }

            try {
                await api.get(`/v1/profiles/by-username/${encodeURIComponent(normalized)}`)
                return { available: false, reason: "This handle is already taken." }
            } catch (error) {
                if (axios.isAxiosError(error) && error.response?.status === 404) {
                    return { available: true }
                }
                return { available: true }
            }
        },
    })
}

export function useChangeHandle() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (input: ChangeHandleInput) => {
            const requestedHandle = typeof input === "string" ? input : input.username
            const normalized = normalizeHandle(requestedHandle)
            const local = validateHandleLocally(normalized)
            if (!local.available) {
                throw new Error(local.reason ?? "Invalid handle")
            }

            const res = await api.put<{ data: unknown }>("/v1/profiles/me/handle", { username: normalized })
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["my-channel-settings"] })
            qc.invalidateQueries({ queryKey: ["my-channels"] })
            qc.invalidateQueries({ queryKey: ["my-profile"] })
            qc.invalidateQueries({ queryKey: ["handle-history"] })
        },
    })
}
