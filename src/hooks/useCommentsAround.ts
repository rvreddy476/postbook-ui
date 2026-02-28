"use client"

import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import type { CommentItem } from "@/types/profile"

interface CommentsAroundResponse {
    data: CommentItem[]
}

export function useCommentsAround(postId: string | undefined, commentId: string | undefined, limit = 20) {
    return useQuery({
        queryKey: ["comments-around", postId, commentId],
        queryFn: async () => {
            const res = await api.get<CommentsAroundResponse>(
                `/v1/posts/${postId}/comments/around/${commentId}`,
                { params: { limit: String(limit) } }
            )
            const data = res.data.data
            return Array.isArray(data) ? data : (data as any).items ?? []
        },
        enabled: !!postId && !!commentId,
    })
}
