import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { PortfolioItem, ProfileQRCode } from "@/types/profile"

// Pinned posts are not here: they are posts.is_pinned, read from by-author's
// leading rows and set with PUT /v1/posts/:id/pin (components/profile/pinned.ts).
// The old /v1/users/:id/pins hooks read a user-service table nothing writes.

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
