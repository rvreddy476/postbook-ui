"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import type { PostDetail } from "@/types/profile"

interface ReelsResponse {
    data: PostDetail[]
    meta?: { next_cursor: string }
}

export function useReelsFeed(options?: { enabled?: boolean }) {
    const enabled = options?.enabled ?? true
    return useInfiniteQuery({
        queryKey: ["reels-feed"],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: "10" }
            if (pageParam) {
                params.cursor = pageParam as string
            }
            const res = await api.get<ReelsResponse>(`/v1/feed/reels`, { params })
            return res.data
        },
        initialPageParam: "" as string,
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
        enabled,
    })
}
