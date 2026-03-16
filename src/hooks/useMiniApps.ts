import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { MiniApp, AppInstallation, AppCategory } from "@/types/mini_apps"

export function useMiniApps(category?: AppCategory, page: number = 0) {
    return useQuery({
        queryKey: ["apps", category, page],
        queryFn: async () => {
            const res = await api.get<{ data: MiniApp[] }>("/v1/apps", {
                params: { category, limit: 20, offset: page * 20 },
            })
            return res.data?.data ?? res.data
        },
    })
}

export function useMiniApp(id: string) {
    return useQuery({
        queryKey: ["apps", id],
        queryFn: async () => {
            const res = await api.get<{ data: MiniApp }>(`/v1/apps/${id}`)
            return res.data?.data ?? res.data
        },
        enabled: !!id,
    })
}

export function useInstalledApps() {
    return useQuery({
        queryKey: ["apps", "installed"],
        queryFn: async () => {
            const res = await api.get<{ data: MiniApp[] }>("/v1/apps/installed")
            return res.data?.data ?? res.data
        },
    })
}

export function useInstallApp() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, granted_permissions }: { id: string; granted_permissions: string[] }) => {
            const res = await api.post<{ data: AppInstallation }>(`/v1/apps/${id}/install`, { granted_permissions })
            return res.data?.data ?? res.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["apps", "installed"] })
        },
    })
}

export function useUninstallApp() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            const res = await api.delete<{ data: unknown }>(`/v1/apps/${id}/install`)
            return res.data?.data ?? res.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["apps", "installed"] })
        },
    })
}
