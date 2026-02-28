"use client"

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { BusinessPage, BusinessReview } from "@/types/profile"

interface PagesResponse { data: BusinessPage[] }
interface PageResponse { data: BusinessPage }
interface ReviewsResponse { data: BusinessReview[] }
interface ReviewResponse { data: BusinessReview }

// === QUERIES ===

export function useMyPages() {
    return useQuery({
        queryKey: ["my-pages"],
        queryFn: async () => {
            const res = await api.get<PagesResponse>("/v1/users/me/pages")
            return res.data.data
        },
    })
}

export function useBusinessPage(handle: string | undefined) {
    return useQuery({
        queryKey: ["business-page", handle],
        queryFn: async () => {
            const res = await api.get<PageResponse>(`/v1/pages/${handle}`)
            return res.data.data
        },
        enabled: !!handle,
        staleTime: 60_000,
    })
}

export function usePageReviews(pageId: string | undefined) {
    return useInfiniteQuery({
        queryKey: ["page-reviews", pageId],
        queryFn: async ({ pageParam = 0 }) => {
            const res = await api.get<ReviewsResponse>(`/v1/pages/${pageId}/reviews`, {
                params: { limit: 20, offset: pageParam },
            })
            return { data: res.data.data, offset: pageParam as number }
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            if (lastPage.data.length < 20) return undefined
            return (lastPage.offset as number) + 20
        },
        enabled: !!pageId,
    })
}

// === MUTATIONS ===

export function useCreatePage() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (payload: {
            handle: string
            name: string
            description?: string
            category?: string
            phone?: string
            email?: string
            website?: string
            address?: string
            city?: string
            state?: string
            country?: string
            zip_code?: string
            hours?: Record<string, { open: string; close: string }>
            avatar_media_id?: string
            cover_media_id?: string
        }) => {
            const res = await api.post<PageResponse>("/v1/users/me/pages", payload)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["my-pages"] })
        },
    })
}

export function useUpdatePage() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, ...payload }: {
            id: string
            handle?: string
            name?: string
            description?: string
            category?: string
            phone?: string
            email?: string
            website?: string
            address?: string
            city?: string
            state?: string
            country?: string
            zip_code?: string
            hours?: Record<string, { open: string; close: string }>
            avatar_media_id?: string
            cover_media_id?: string
        }) => {
            const res = await api.patch<PageResponse>(`/v1/pages/${id}`, payload)
            return res.data.data
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["my-pages"] })
            qc.invalidateQueries({ queryKey: ["business-page", data.handle] })
        },
    })
}

export function useSubmitReview() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ pageId, ...payload }: {
            pageId: string
            rating: number
            review_text: string
        }) => {
            const res = await api.post<ReviewResponse>(`/v1/pages/${pageId}/reviews`, payload)
            return res.data.data
        },
        onSuccess: (_, vars) => {
            qc.invalidateQueries({ queryKey: ["page-reviews", vars.pageId] })
            qc.invalidateQueries({ queryKey: ["business-page"] })
        },
    })
}
