"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { CrosspostLink } from "@/types/profile"

export function useCrossposts(postId: string) {
    return useQuery({
        queryKey: ["crossposts", postId],
        queryFn: async () => {
            const res = await api.get<{ data: CrosspostLink[] }>(`/v1/posts/${postId}/crossposts`)
            return res.data.data ?? []
        },
        enabled: !!postId,
        staleTime: 60_000,
    })
}

export function useMyCrossposts(limit = 20) {
    return useQuery({
        queryKey: ["my-crossposts"],
        queryFn: async () => {
            const res = await api.get<{ data: { items: CrosspostLink[]; total: number } }>("/v1/crossposts/mine", {
                params: { limit: String(limit) },
            })
            return res.data.data
        },
        staleTime: 30_000,
    })
}

export function useCreateCrosspost() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ postId, targetModule }: { postId: string; targetModule: string }) => {
            const res = await api.post<{ data: CrosspostLink }>(`/v1/posts/${postId}/crossposts`, {
                target_module: targetModule,
            })
            return res.data.data
        },
        onSuccess: (_data, variables) => {
            qc.invalidateQueries({ queryKey: ["crossposts", variables.postId] })
            qc.invalidateQueries({ queryKey: ["my-crossposts"] })
        },
    })
}

export function useRemoveCrosspost() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ postId, crosspostId }: { postId: string; crosspostId: string }) => {
            await api.delete(`/v1/posts/${postId}/crossposts/${crosspostId}`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["crossposts"] })
            qc.invalidateQueries({ queryKey: ["my-crossposts"] })
        },
    })
}
