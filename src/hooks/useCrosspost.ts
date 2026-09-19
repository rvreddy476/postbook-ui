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

export type MyCrosspostsResult = {
    items: CrosspostLink[]
    total: number
    /**
     * False when the endpoint is not reachable at the edge. The UI should say
     * so rather than render an empty list as if the user had no cross-posts.
     */
    endpoint_available: boolean
}

/**
 * BACKEND GAP — this 404s today, and the path is correct.
 *
 * post-service really does register `GET /v1/crossposts/mine`
 * (RegisterCrosspostRoutes in post-service/internal/http/crosspost.go), but
 * the api-gateway's prefix table has no `/v1/crossposts` entry, so the
 * request never leaves the gateway. The per-post routes in this file are
 * fine — they live under `/v1/posts/:postId/crossposts`, and `/v1/posts` IS
 * routed.
 *
 * So this is not repointable from the UI: there is no other path that serves
 * it. Until the gateway entry lands, report the outage instead of an empty
 * list.
 */
export function useMyCrossposts(limit = 20) {
    return useQuery<MyCrosspostsResult>({
        queryKey: ["my-crossposts"],
        queryFn: async () => {
            try {
                const res = await api.get<{ data: { items: CrosspostLink[]; total: number } }>("/v1/crossposts/mine", {
                    params: { limit: String(limit) },
                })
                return {
                    items: res.data.data?.items ?? [],
                    total: res.data.data?.total ?? 0,
                    endpoint_available: true,
                }
            } catch (err) {
                const status = (err as { response?: { status?: number } })?.response?.status
                if (status === 404 || status === 501) {
                    return { items: [], total: 0, endpoint_available: false }
                }
                throw err
            }
        },
        retry: false,
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
