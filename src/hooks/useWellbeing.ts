import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { DigitalWellbeing, ScreenTimeResponse } from "@/types/wellbeing"

export function useWellbeing() {
    return useQuery({
        queryKey: ["wellbeing"],
        queryFn: async () => {
            const res = await api.get<{ data: DigitalWellbeing }>("/v1/users/me/wellbeing")
            return res.data?.data ?? res.data
        },
    })
}

export function useUpdateWellbeing() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (body: Partial<DigitalWellbeing>) => {
            const res = await api.put<{ data: DigitalWellbeing }>("/v1/users/me/wellbeing", body)
            return res.data?.data ?? res.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["wellbeing"] })
        },
    })
}

export function useScreenTime() {
    return useQuery({
        queryKey: ["screen-time"],
        queryFn: async () => {
            const res = await api.get<{ data: ScreenTimeResponse }>("/v1/users/me/screen-time")
            return res.data?.data ?? res.data
        },
    })
}

export function useLogScreenTime() {
    return useMutation({
        mutationFn: async (body: { minutes: number }) => {
            const res = await api.post<{ data: { ok: true } }>("/v1/users/me/screen-time", body)
            return res.data?.data ?? res.data
        },
    })
}
