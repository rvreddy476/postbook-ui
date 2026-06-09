'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { BusinessPage, BusinessReview, PageDocument } from '@/types/profile'

// --- Queries ---

export function useDiscoverPages(params: {
    category?: string
    search?: string
    limit?: number
    offset?: number
} = {}) {
    const { category = '', search = '', limit = 20, offset = 0 } = params
    return useQuery({
        queryKey: ['pages', 'discover', category, search, limit, offset],
        queryFn: async () => {
            const p = new URLSearchParams()
            if (category) p.set('category', category)
            if (search) p.set('q', search)
            p.set('limit', String(limit))
            p.set('offset', String(offset))
            const res = await api.get<{ data: BusinessPage[] }>(`/v1/pages?${p}`)
            return res.data.data ?? []
        },
    })
}

export function useBusinessPage(handle: string | undefined) {
    return useQuery({
        queryKey: ['pages', 'detail', handle],
        queryFn: async () => {
            const res = await api.get<{ data: BusinessPage }>(`/v1/pages/${handle}`)
            return res.data.data
        },
        enabled: !!handle,
        staleTime: 60_000,
    })
}

export function useMyPages() {
    return useQuery({
        queryKey: ['pages', 'mine'],
        queryFn: async () => {
            const res = await api.get<{ data: BusinessPage[] }>('/v1/users/me/pages')
            return res.data.data ?? []
        },
    })
}

export function usePageReviews(handle: string | undefined) {
    return useQuery({
        queryKey: ['pages', 'reviews', handle],
        queryFn: async () => {
            const res = await api.get<{ data: BusinessReview[] }>(`/v1/pages/${handle}/reviews`)
            return res.data.data ?? []
        },
        enabled: !!handle,
    })
}

// --- Mutations ---

interface CreatePagePayload {
    page_handle: string
    page_name: string
    page_type: string // required — one of the 13 canonical types
    category?: string
    description?: string
    address?: string
    phone?: string
    whatsapp?: string
    business_email?: string
    website?: string
    price_range?: string
    booking_url?: string
    cover_media_id?: string
    avatar_media_id?: string
}

export function useCreatePage() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (payload: CreatePagePayload) => {
            const res = await api.post<{ data: BusinessPage }>('/v1/users/me/pages', payload)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['pages', 'mine'] })
            qc.invalidateQueries({ queryKey: ['pages', 'discover'] })
        },
    })
}

export function useUpdatePage(handle: string) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (payload: Partial<Omit<CreatePagePayload, 'page_handle'>>) => {
            const res = await api.patch<{ data: BusinessPage }>(`/v1/pages/${handle}`, payload)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['pages', 'detail', handle] })
            qc.invalidateQueries({ queryKey: ['pages', 'mine'] })
        },
    })
}

export function useDeletePage() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (pageId: string) => {
            await api.delete(`/v1/pages/${pageId}`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['pages', 'mine'] })
            qc.invalidateQueries({ queryKey: ['pages', 'discover'] })
        },
    })
}

interface FollowResult {
    following: boolean
    followerCount: number
}

export function useFollowPage(handle: string) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (pageId: string) => {
            const res = await api.post<{ data: FollowResult }>(`/v1/pages/${pageId}/follow`)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['pages', 'detail', handle] })
        },
    })
}

export function useUnfollowPage(handle: string) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (pageId: string) => {
            const res = await api.delete<{ data: FollowResult }>(`/v1/pages/${pageId}/follow`)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['pages', 'detail', handle] })
        },
    })
}

// --- Verification documents + lifecycle ---

export function usePageDocuments(handle: string | undefined, pageId: string | undefined, enabled = true) {
    return useQuery({
        queryKey: ['pages', 'documents', pageId],
        queryFn: async () => {
            const res = await api.get<{ data: PageDocument[] }>(`/v1/pages/${pageId}/documents`)
            return res.data.data ?? []
        },
        enabled: enabled && !!pageId,
    })
}

export function useAddPageDocument(handle: string) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ pageId, documentType, documentUrl }: { pageId: string; documentType: string; documentUrl: string }) => {
            const res = await api.post<{ data: PageDocument }>(`/v1/pages/${pageId}/documents`, {
                document_type: documentType,
                document_url: documentUrl,
            })
            return res.data.data
        },
        onSuccess: (_d, vars) => {
            qc.invalidateQueries({ queryKey: ['pages', 'documents', vars.pageId] })
            qc.invalidateQueries({ queryKey: ['pages', 'detail', handle] })
        },
    })
}

export function useSubmitPageForReview(handle: string) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (pageId: string) => {
            const res = await api.post<{ data: { status: string } }>(`/v1/pages/${pageId}/submit-review`)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['pages', 'detail', handle] })
            qc.invalidateQueries({ queryKey: ['pages', 'mine'] })
        },
    })
}

export function useSubmitReview(handle: string) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (payload: { rating: number; review_text?: string }) => {
            const res = await api.post<{ data: BusinessReview }>(`/v1/pages/${handle}/reviews`, payload)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['pages', 'reviews', handle] })
            qc.invalidateQueries({ queryKey: ['pages', 'detail', handle] })
        },
    })
}
