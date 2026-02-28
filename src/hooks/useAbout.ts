"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { AboutItem, AboutSection, AboutVisibility } from "@/types/profile"

export function useAbout(userId: string | undefined) {
    return useQuery({
        queryKey: ["about", userId],
        queryFn: async () => {
            const res = await api.get<{ data: Record<string, AboutItem[]> }>(
                `/v1/profiles/${userId}/about`
            )
            return res.data.data ?? {}
        },
        staleTime: 5 * 60 * 1000,
        enabled: !!userId,
    })
}

export function useAboutSection(userId: string | undefined, section: AboutSection) {
    return useQuery({
        queryKey: ["about", userId, section],
        queryFn: async () => {
            const res = await api.get<{ data: AboutItem[] }>(
                `/v1/profiles/${userId}/about/${section}`
            )
            return res.data.data ?? []
        },
        staleTime: 5 * 60 * 1000,
        enabled: !!userId,
    })
}

export function useUpsertAboutItem() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (params: {
            section: AboutSection
            data: Record<string, unknown>
            visibility?: AboutVisibility
            sort_order?: number
            item_id?: string
        }) => {
            const res = await api.put<{ data: AboutItem }>(
                `/v1/profiles/me/about/${params.section}`,
                {
                    data: params.data,
                    visibility: params.visibility ?? "public",
                    sort_order: params.sort_order ?? 0,
                    item_id: params.item_id,
                }
            )
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["about"] })
        },
    })
}

export function useDeleteAboutItem() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (params: { section: AboutSection; itemId: string }) => {
            await api.delete(`/v1/profiles/me/about/${params.section}/${params.itemId}`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["about"] })
        },
    })
}
