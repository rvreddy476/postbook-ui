"use client"

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type {
    Wallet,
    Transaction,
    PayoutMethod,
    CreatorTier,
    TaxInfo,
    Dashboard,
} from "@/types/monetization"

// --- Response wrappers ---

interface WalletResponse { data: Wallet }
interface TransactionsResponse { data: Transaction[]; meta?: { next_cursor?: string } }
interface PayoutMethodsResponse { data: PayoutMethod[] }
interface PayoutMethodResponse { data: PayoutMethod }
interface TiersResponse { data: CreatorTier[] }
interface TierResponse { data: CreatorTier }
interface PayoutsResponse { data: Transaction[]; meta?: { next_cursor?: string } }
interface TaxInfoResponse { data: TaxInfo }
interface DashboardResponse { data: Dashboard }

// === QUERIES ===

export function useWallet() {
    return useQuery({
        queryKey: ["monetization-wallet"],
        queryFn: async () => {
            const res = await api.get<WalletResponse>("/v1/monetization/wallet")
            return res.data.data
        },
        staleTime: 30_000,
    })
}

export function useTransactions(type?: string) {
    return useInfiniteQuery({
        queryKey: ["monetization-transactions", type],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: "20" }
            if (type) params.type = type
            if (pageParam) params.cursor = pageParam as string
            const res = await api.get<TransactionsResponse>("/v1/monetization/transactions", { params })
            return res.data
        },
        initialPageParam: "" as string,
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
    })
}

export function usePayoutMethods() {
    return useQuery({
        queryKey: ["monetization-payout-methods"],
        queryFn: async () => {
            const res = await api.get<PayoutMethodsResponse>("/v1/monetization/payout-methods")
            return res.data.data
        },
        staleTime: 60_000,
    })
}

export function useAddPayoutMethod() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (payload: { method_type: string; details: Record<string, string> }) => {
            const res = await api.post<PayoutMethodResponse>("/v1/monetization/payout-methods", payload)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["monetization-payout-methods"] })
        },
    })
}

export function useRemovePayoutMethod() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/v1/monetization/payout-methods/${id}`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["monetization-payout-methods"] })
        },
    })
}

export function useRequestPayout() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (payload: { amount: number; payout_method_id: string }) => {
            const res = await api.post("/v1/monetization/payouts", payload)
            return res.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["monetization-wallet"] })
            qc.invalidateQueries({ queryKey: ["monetization-payout-history"] })
            qc.invalidateQueries({ queryKey: ["monetization-transactions"] })
            qc.invalidateQueries({ queryKey: ["monetization-dashboard"] })
        },
    })
}

export function usePayoutHistory() {
    return useInfiniteQuery({
        queryKey: ["monetization-payout-history"],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: "20" }
            if (pageParam) params.cursor = pageParam as string
            const res = await api.get<PayoutsResponse>("/v1/monetization/payouts", { params })
            return res.data
        },
        initialPageParam: "" as string,
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
    })
}

export function useSaveTaxInfo() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (payload: { country: string; pan_number: string; gst_number: string }) => {
            const res = await api.post<TaxInfoResponse>("/v1/monetization/tax-info", payload)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["monetization-dashboard"] })
        },
    })
}

export function useMyTiers() {
    return useQuery({
        queryKey: ["monetization-my-tiers"],
        queryFn: async () => {
            const res = await api.get<TiersResponse>("/v1/monetization/tiers")
            return res.data.data
        },
        staleTime: 60_000,
    })
}

export function useCreateTier() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (payload: { name: string; price: number; currency: string; perks: string[] }) => {
            const res = await api.post<TierResponse>("/v1/monetization/tiers", payload)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["monetization-my-tiers"] })
            qc.invalidateQueries({ queryKey: ["monetization-dashboard"] })
        },
    })
}

export function useUpdateTier() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, ...payload }: {
            id: string
            name?: string
            price?: number
            currency?: string
            perks?: string[]
            is_active?: boolean
        }) => {
            const res = await api.patch<TierResponse>(`/v1/monetization/tiers/${id}`, payload)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["monetization-my-tiers"] })
            qc.invalidateQueries({ queryKey: ["monetization-dashboard"] })
        },
    })
}

export function useSubscribe() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ creatorId, tier_id }: { creatorId: string; tier_id: string }) => {
            const res = await api.post(`/v1/monetization/subscribe/${creatorId}`, { tier_id })
            return res.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["monetization-wallet"] })
            qc.invalidateQueries({ queryKey: ["monetization-transactions"] })
        },
    })
}

export function useUnsubscribe() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (creatorId: string) => {
            await api.delete(`/v1/monetization/subscribe/${creatorId}`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["monetization-wallet"] })
            qc.invalidateQueries({ queryKey: ["monetization-transactions"] })
        },
    })
}

export function useDashboard() {
    return useQuery({
        queryKey: ["monetization-dashboard"],
        queryFn: async () => {
            const res = await api.get<DashboardResponse>("/v1/monetization/dashboard")
            return res.data.data
        },
        staleTime: 30_000,
    })
}
