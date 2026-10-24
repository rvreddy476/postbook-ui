"use client"

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query"
import api from "@/lib/api"
import type { PostDetail } from "@/types/profile"
import {
    FOLLOWED_HASHTAGS_PATH,
    FOLLOWED_HASHTAG_POSTS_PATH,
    followedHashtagPostsParams,
    followedHashtagsParams,
    hashtagFollowPath,
    hashtagFollowRequest,
    parseFollowedHashtags,
    parseHashtagFollowState,
    withoutFollowedHashtag,
    type FollowedHashtagsPage,
    type HashtagFollowState,
} from "@/features/hashtag/hashtagFollow"

/*
  Followed hashtags (post-service hashtag_follows_handler.go). Signed-in
  only: callers pass enabled=false for a visitor.
*/

export const hashtagFollowKey = (tag: string) => ["hashtag-follow", tag.toLowerCase()] as const
export const FOLLOWED_HASHTAGS_KEY = ["followed-hashtags"] as const
/**
 * The Hashtags tab of the home feed. Under "home-feed" so the feed's live
 * count patches and post removals (setQueriesData on ["home-feed"]) reach
 * it too; the page shape is the same { data, meta }.
 */
export const FOLLOWED_HASHTAG_POSTS_KEY = ["home-feed", "followed-hashtags"] as const

export function useHashtagFollowState(tag: string, enabled: boolean) {
    return useQuery<HashtagFollowState>({
        queryKey: hashtagFollowKey(tag),
        queryFn: async () => {
            const res = await api.get(hashtagFollowPath(tag))
            const state = parseHashtagFollowState(res.data)
            if (!state) throw new Error("The follow state response had no state.")
            return state
        },
        enabled: enabled && !!tag,
        retry: false,
        staleTime: 30_000,
    })
}

export function useToggleHashtagFollow(tag: string) {
    const qc = useQueryClient()
    return useMutation<HashtagFollowState, unknown, boolean>({
        mutationFn: async (follow) => {
            const req = hashtagFollowRequest(tag, follow)
            const res = req.method === "post" ? await api.post(req.url) : await api.delete(req.url)
            const state = parseHashtagFollowState(res.data)
            if (!state) throw new Error("The server did not confirm the change.")
            return state
        },
        onSuccess: (state) => {
            qc.setQueryData(hashtagFollowKey(tag), state)
            if (!state.following) {
                qc.setQueryData<InfiniteData<FollowedHashtagsPage>>(FOLLOWED_HASHTAGS_KEY, (old) =>
                    old ? { ...old, pages: withoutFollowedHashtag(old.pages, state.tag) } : old,
                )
            }
            void qc.invalidateQueries({ queryKey: FOLLOWED_HASHTAGS_KEY })
            void qc.invalidateQueries({ queryKey: FOLLOWED_HASHTAG_POSTS_KEY })
        },
    })
}

export function useFollowedHashtags(enabled = true) {
    return useInfiniteQuery({
        queryKey: FOLLOWED_HASHTAGS_KEY,
        queryFn: async ({ pageParam }) => {
            const res = await api.get(FOLLOWED_HASHTAGS_PATH, { params: followedHashtagsParams(pageParam as string) })
            return parseFollowedHashtags(res.data)
        },
        initialPageParam: "" as string,
        getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
        enabled,
    })
}

interface PostsPage {
    data: PostDetail[]
    meta?: { next_cursor: string }
}

/** GET /v1/hashtags/followed/posts: post details, newest first, as the hashtag page reads them. */
export function useFollowedHashtagPosts(enabled: boolean) {
    return useInfiniteQuery({
        queryKey: FOLLOWED_HASHTAG_POSTS_KEY,
        queryFn: async ({ pageParam, signal }) => {
            const res = await api.get<PostsPage>(FOLLOWED_HASHTAG_POSTS_PATH, {
                params: followedHashtagPostsParams(pageParam as string),
                signal,
            })
            return { data: Array.isArray(res.data?.data) ? res.data.data : [], meta: res.data?.meta }
        },
        initialPageParam: "" as string,
        getNextPageParam: (lastPage) => lastPage.meta?.next_cursor || undefined,
        enabled,
        refetchOnWindowFocus: false,
    })
}
