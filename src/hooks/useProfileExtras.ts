import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { ProfilePin, PortfolioItem, ProfileQRCode } from "@/types/profile"

export function useMyPins() {
    return useQuery({
        queryKey: ["pins", "me"],
        queryFn: async () => {
            const res = await api.get<{ data: { items: ProfilePin[] } }>("/v1/users/me/pins")
            return res.data?.data ?? res.data
        },
    })
}

export function useUserPins(userId: string) {
    return useQuery({
        queryKey: ["pins", userId],
        queryFn: async () => {
            const res = await api.get<{ data: { items: ProfilePin[] } }>(`/v1/users/${userId}/pins`)
            return res.data?.data ?? res.data
        },
        enabled: !!userId,
    })
}

export function usePinContent() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (body: { content_type: string; content_id: string }) => {
            const res = await api.post<{ data: ProfilePin }>("/v1/users/me/pins", body)
            return res.data?.data ?? res.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["pins"] })
        },
    })
}

export function useUnpinContent(pinId: string) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async () => {
            const res = await api.delete<{ data: unknown }>(`/v1/users/me/pins/${pinId}`)
            return res.data?.data ?? res.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["pins"] })
        },
    })
}

export function useMyPortfolio() {
    return useQuery({
        queryKey: ["portfolio", "me"],
        queryFn: async () => {
            const res = await api.get<{ data: { items: PortfolioItem[] } }>("/v1/users/me/portfolio")
            return res.data?.data ?? res.data
        },
    })
}

export function useUserPortfolio(userId: string) {
    return useQuery({
        queryKey: ["portfolio", userId],
        queryFn: async () => {
            const res = await api.get<{ data: { items: PortfolioItem[] } }>(`/v1/users/${userId}/portfolio`)
            return res.data?.data ?? res.data
        },
        enabled: !!userId,
    })
}

export function useAddPortfolioItem() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (body: PortfolioItem) => {
            const res = await api.post<{ data: PortfolioItem }>("/v1/users/me/portfolio", body)
            return res.data?.data ?? res.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["portfolio"] })
        },
    })
}

export function useUpdatePortfolioItem() {
    return useMutation({
        mutationFn: async ({ id, ...body }: Partial<PortfolioItem> & { id: string }) => {
            const res = await api.patch<{ data: PortfolioItem }>(`/v1/users/me/portfolio/${id}`, body)
            return res.data?.data ?? res.data
        },
    })
}

export function useDeletePortfolioItem() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            const res = await api.delete<{ data: unknown }>(`/v1/users/me/portfolio/${id}`)
            return res.data?.data ?? res.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["portfolio"] })
        },
    })
}

export function useMyQRCode() {
    return useQuery({
        queryKey: ["qr-code"],
        queryFn: async () => {
            const res = await api.get<{ data: ProfileQRCode }>("/v1/users/me/qr")
            return res.data?.data ?? res.data
        },
    })
}
