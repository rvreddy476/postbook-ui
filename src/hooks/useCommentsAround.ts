"use client"

import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { isMissingComment } from "@/components/comments/focusComment"
import type { CommentItem } from "@/types/profile"

interface CommentsAroundResponse {
    data: CommentItem[]
}

/**
 * GET /v1/posts/:id/comments/around/:commentId — top-level comments around
 * the linked one. A missing comment (404) is final, so it is not retried:
 * the section falls back to the plain thread straight away.
 */
export function useCommentsAround(postId: string | undefined, commentId: string | undefined, limit = 20) {
    return useQuery({
        queryKey: ["comments-around", postId, commentId],
        queryFn: async () => {
            const res = await api.get<CommentsAroundResponse>(
                `/v1/posts/${postId}/comments/around/${commentId}`,
                { params: { limit: String(limit) } }
            )
            const data = res.data.data
            return Array.isArray(data) ? data : (data as any)?.items ?? []
        },
        enabled: !!postId && !!commentId,
        retry: (failures, error) => !isMissingComment(error) && failures < 3,
    })
}
