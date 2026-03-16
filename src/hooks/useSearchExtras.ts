import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"

interface SavedSearch { id: string; query: string; search_type: string; created_at: string }
interface SearchHistoryItem { id: string; query: string; search_type: string; searched_at: string }
interface ProductHit { id: string; name: string; description: string; price: number; currency: string; seller_id: string }
interface EventHit { id: string; title: string; description: string; start_time: string; location?: string }
interface MessageHit { id: string; content: string; sender_id: string; conversation_id: string; sent_at: string }

export function useSaveSearch() {
    return useMutation({
        mutationFn: async (body: { query: string; search_type: string }) => {
            const res = await api.post<{ data: SavedSearch }>("/v1/search/saved", body)
            return res.data?.data ?? res.data
        },
    })
}

export function useSavedSearches() {
    return useQuery({
        queryKey: ["search", "saved"],
        queryFn: async () => {
            const res = await api.get<{ data: { items: SavedSearch[] } }>("/v1/search/saved")
            return res.data?.data ?? res.data
        },
    })
}

export function useDeleteSavedSearch() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            const res = await api.delete<{ data: unknown }>(`/v1/search/saved/${id}`)
            return res.data?.data ?? res.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["search", "saved"] })
        },
    })
}

export function useSearchHistory() {
    return useQuery({
        queryKey: ["search", "history"],
        queryFn: async () => {
            const res = await api.get<{ data: { items: SearchHistoryItem[] } }>("/v1/search/history")
            return res.data?.data ?? res.data
        },
    })
}

export function useClearSearchHistory() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async () => {
            const res = await api.delete<{ data: unknown }>("/v1/search/history")
            return res.data?.data ?? res.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["search", "history"] })
        },
    })
}

export function useSearchProducts(query: string, enabled: boolean = true) {
    return useQuery({
        queryKey: ["search", "products", query],
        queryFn: async () => {
            const res = await api.get<{ data: { hits: ProductHit[] } }>("/v1/search/products", {
                params: { q: query, limit: 20 },
            })
            return res.data?.data ?? res.data
        },
        enabled: query.length > 0 && enabled,
    })
}

export function useSearchEvents(query: string, enabled: boolean = true) {
    return useQuery({
        queryKey: ["search", "events", query],
        queryFn: async () => {
            const res = await api.get<{ data: { hits: EventHit[] } }>("/v1/search/events", {
                params: { q: query, limit: 20 },
            })
            return res.data?.data ?? res.data
        },
        enabled: query.length > 0 && enabled,
    })
}

export function useSearchMessages(query: string, enabled: boolean = true) {
    return useQuery({
        queryKey: ["search", "messages", query],
        queryFn: async () => {
            const res = await api.get<{ data: { hits: MessageHit[] } }>("/v1/search/messages", {
                params: { q: query, limit: 20 },
            })
            return res.data?.data ?? res.data
        },
        enabled: query.length > 0 && enabled,
    })
}
