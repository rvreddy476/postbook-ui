"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { PollData } from "@/types/profile"

export function usePoll(postId: string | undefined, enabled = false) {
    return useQuery({
        queryKey: ["poll", postId],
        queryFn: async () => {
            const res = await api.get<{ data: PollData }>(`/v1/posts/${postId}/poll`)
            return res.data.data
        },
        enabled: !!postId && enabled,
    })
}

export function useCastVote() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ postId, optionId }: { postId: string; optionId: string }) => {
            await api.post(`/v1/posts/${postId}/vote`, { option_id: optionId })
        },
        onSuccess: (_data, variables) => {
            qc.invalidateQueries({ queryKey: ["poll", variables.postId] })
            qc.invalidateQueries({ queryKey: ["home-feed"] })
            qc.invalidateQueries({ queryKey: ["feed-posts"] })
            qc.invalidateQueries({ queryKey: ["profile-posts"] })
        },
    })
}
