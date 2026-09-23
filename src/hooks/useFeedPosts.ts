"use client"

import type { PostRichText } from '@/components/studio/postStyle'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { feedPostFromCreate } from "@/hooks/feedPostFromCreate"
import type { PostDetail } from "@/types/profile"

interface PostsResponse {
    data: PostDetail[]
    meta?: { next_cursor: string }
}

interface CreatePostPayload {
    text: string
    visibility: "public" | "followers" | "trusted" | "private"
    content_type: string
    media_ids?: string[]
    feeling?: string | null
    activity?: string | null
    activity_detail?: string | null
    location?: string | null
    location_name?: string | null
    location_lat?: number | null
    location_lng?: number | null
    post_type?: string
    app_origin?: string
    no_comments?: boolean
    no_likes?: boolean
    poll?: {
        question: string
        options: string[]
        allows_multiple?: boolean
        duration_hours?: number
    } | null
    // Presentation, stored as arbitrary JSON by post-service. It carried two
    // fields here while the column was always general; the shape lives in
    // components/studio/postStyle.ts so the composer, the payload and the
    // feed renderer cannot drift apart.
    rich_text?: PostRichText | null
    hashtags?: string[]
    /**
     * The uploaded media with their kinds, for rendering the card before the
     * server has hydrated it. NOT sent to the server, which takes media_ids
     * and resolves the kinds itself — it is stripped in mutationFn.
     */
    media?: { media_id: string; kind: string }[]
    /**
     * post-service requires a UUID Idempotency-Key on create and refuses
     * without one, because "server committed, response lost" is the normal
     * outcome of publishing from a phone. It belongs in the payload rather
     * than being minted inside the request: react-query hands the same
     * variables to every retry, so the key stays stable and a retry returns
     * the post that was already created instead of writing a second one.
     */
    idempotencyKey?: string
}

/*
  useFeedPosts lived here: an infinite query over /v1/posts/by-author keyed
  ["feed-posts", userId]. Nothing imported it. Its query key survived only as
  an invalidation target in useCreatePost and a setQueriesData target in
  Feed.tsx, both of which matched no live query and read as though they did
  something. The profile's own posts list is useProfilePosts, keyed
  ["profile-posts"], which is the one that is actually mounted.
*/

export type FeedMode = "ranked" | "chronological"

export function useHomeFeed(feedMode: FeedMode = "chronological", options?: { excludeSelf?: boolean; circleOnly?: boolean; enabled?: boolean }) {
    const excludeSelf = options?.excludeSelf ?? false
    const circleOnly = options?.circleOnly ?? false
    const enabled = options?.enabled ?? true
    return useInfiniteQuery({
        queryKey: ["home-feed", feedMode, excludeSelf, circleOnly],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string> = { limit: "20", feed_mode: feedMode, platform: "postbook" }
            if (excludeSelf) {
                params.exclude_self = "true"
            }
            if (circleOnly) {
                params.circle_only = "true"
            }
            if (pageParam) {
                params.cursor = pageParam as string
            }
            const res = await api.get<PostsResponse>(`/v1/feed/home`, { params })
            return res.data
        },
        initialPageParam: "" as string,
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
        enabled,
    })
}

export function useSaveFeedPreference() {
    return useMutation({
        mutationFn: async (feedMode: FeedMode) => {
            const res = await api.post("/v1/feed/preference", { feed_mode: feedMode })
            return res.data
        },
    })
}

export function usePostDetail(postId: string | undefined) {
    return useQuery({
        queryKey: ["post-detail", postId],
        queryFn: async () => {
            const res = await api.get<{ data: PostDetail }>(`/v1/posts/${postId}`)
            return res.data.data
        },
        enabled: !!postId,
    })
}

export function useCreatePost() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ idempotencyKey, media, ...payload }: CreatePostPayload) => {
            // `media` never goes on the wire — the server takes media_ids and
            // resolves the kinds itself. It exists on the payload only so
            // onSuccess can render the card before fan-out lands.
            void media
            const res = await api.post<{ data: PostDetail }>("/v1/posts", payload, {
                headers: { "Idempotency-Key": idempotencyKey ?? crypto.randomUUID() },
            })
            return res.data.data
        },
        onSuccess: (created, variables) => {
            /*
              Show the post NOW.

              Creating a post writes Postgres; the home feed reads a Scylla
              timeline that a Kafka consumer fills about a second later. So
              invalidating on success refetches a timeline that does not
              contain the post yet, and the author sees nothing happen —
              exactly what was reported. Fan-out used to take ten seconds; it
              is ~1s now, but the refetch still fires first and still loses.

              The created post therefore goes straight to the top of every
              loaded ranked page. The invalidation below still runs: the
              server's row replaces this one once fan-out lands, and the feed
              de-duplicates by id, so the swap is invisible.
            */
            const optimistic = feedPostFromCreate(created, variables.media)
            qc.setQueryData(["post-detail", created.id], optimistic)

            /*
              RANKED ONLY. The key is ["home-feed", feedMode, excludeSelf, …],
              so this prefix reaches For You and not Following — and Following
              asks the server for exclude_self=true, so a post of your own
              placed there would be contradicted by the very next refetch. It
              would appear and then vanish, which reads as a bug rather than
              as a feed.
            */
            qc.setQueriesData({ queryKey: ["home-feed", "ranked"] }, (old: any) => {
                if (!old?.pages?.length) return old
                const [first, ...rest] = old.pages
                const data: PostDetail[] = first?.data ?? []
                if (data.some((p) => p.id === created.id)) return old
                return { ...old, pages: [{ ...first, data: [optimistic, ...data] }, ...rest] }
            })

            qc.invalidateQueries({ queryKey: ["home-feed"] })
            qc.invalidateQueries({ queryKey: ["profile-posts"] })
        },
    })
}
