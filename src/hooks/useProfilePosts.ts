"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import type { PostDetail } from "@/types/profile"

interface PostsResponse {
    data: PostDetail[]
    meta?: { next_cursor: string }
}

export function useProfilePosts(userId: string | undefined, contentType: string) {
    return useInfiniteQuery({
        queryKey: ["profile-posts", userId, contentType],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: "20" }
            if (contentType && contentType !== "all") {
                params.type = contentType
            }
            if (pageParam) {
                params.cursor = pageParam as string
            }
            const res = await api.get<PostsResponse>(`/v1/posts/by-author/${userId}`, { params })
            return res.data
        },
        initialPageParam: "" as string,
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
        enabled: !!userId,
    })
}
