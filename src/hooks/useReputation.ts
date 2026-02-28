"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { UserReputation, Endorsement, CompatibilityScore } from "@/types/profile"

interface ReputationResponse { data: UserReputation }
interface EndorsementsResponse { data: Endorsement[] }
interface EndorsementResponse { data: Endorsement }
interface CompatibilityResponse { data: CompatibilityScore }

// === QUERIES ===

export function useReputation(userId: string | undefined) {
    return useQuery({
        queryKey: ["reputation", userId],
        queryFn: async () => {
            const res = await api.get<ReputationResponse>(`/v1/users/${userId}/reputation`)
            return res.data.data
        },
        enabled: !!userId,
        staleTime: 5 * 60_000,
    })
}

export function useEndorsements(userId: string | undefined) {
    return useQuery({
        queryKey: ["endorsements", userId],
        queryFn: async () => {
            const res = await api.get<EndorsementsResponse>(`/v1/users/${userId}/endorsements`)
            return res.data.data
        },
        enabled: !!userId,
        staleTime: 5 * 60_000,
    })
}

export function useCompatibility(userId: string | undefined) {
    return useQuery({
        queryKey: ["compatibility", userId],
        queryFn: async () => {
            const res = await api.get<CompatibilityResponse>(`/v1/users/${userId}/compatibility`)
            return res.data.data
        },
        enabled: !!userId,
        staleTime: 10 * 60_000,
    })
}

// === MUTATIONS ===

export function useEndorseUser() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ userId, ...payload }: {
            userId: string
            skill_tag: string
            message?: string
        }) => {
            const res = await api.post<EndorsementResponse>(`/v1/users/${userId}/endorse`, payload)
            return res.data.data
        },
        onSuccess: (_, vars) => {
            qc.invalidateQueries({ queryKey: ["endorsements", vars.userId] })
            qc.invalidateQueries({ queryKey: ["reputation", vars.userId] })
        },
    })
}
