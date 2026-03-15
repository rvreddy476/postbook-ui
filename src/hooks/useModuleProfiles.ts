"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { ModuleProfile, ModuleName, UpsertModuleProfileParams } from "@/types/profile"

export function useModuleProfiles() {
    return useQuery({
        queryKey: ["module-profiles"],
        queryFn: async () => {
            const res = await api.get<{ data: ModuleProfile[] }>("/v1/profiles/me/modules")
            return res.data.data ?? []
        },
        staleTime: 5 * 60 * 1000,
    })
}

export function useModuleProfile(module: ModuleName) {
    return useQuery({
        queryKey: ["module-profile", module],
        queryFn: async () => {
            const res = await api.get<{ data: ModuleProfile }>(`/v1/profiles/me/modules/${module}`)
            return res.data.data
        },
        staleTime: 5 * 60 * 1000,
    })
}

export function useUpsertModuleProfile() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ module, params }: { module: ModuleName; params: UpsertModuleProfileParams }) => {
            const res = await api.put<{ data: ModuleProfile }>(`/v1/profiles/me/modules/${module}`, params)
            return res.data.data
        },
        onSuccess: (_data, variables) => {
            qc.invalidateQueries({ queryKey: ["module-profiles"] })
            qc.invalidateQueries({ queryKey: ["module-profile", variables.module] })
        },
    })
}

export function useDeleteModuleProfile() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ module }: { module: ModuleName }) => {
            await api.delete(`/v1/profiles/me/modules/${module}`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["module-profiles"] })
        },
    })
}

export function useChangeHandle() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ username }: { username: string }) => {
            const res = await api.put<{ data: unknown }>("/v1/profiles/me/handle", { username })
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["profile"] })
            qc.invalidateQueries({ queryKey: ["my-profile"] })
        },
    })
}

export function useHandleHistory() {
    return useQuery({
        queryKey: ["handle-history"],
        queryFn: async () => {
            const res = await api.get<{ data: Array<{ old_username: string; new_username: string; changed_at: string; cooldown_until: string }> }>("/v1/profiles/me/handle-history")
            return res.data.data ?? []
        },
        staleTime: 60_000,
    })
}
