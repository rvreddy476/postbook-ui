"use client"

import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import type { PostDetail, UserProfile } from "@/types/profile"

export type SearchType = "all" | "profiles" | "posts"

export interface ProfileResult {
    id: string
    username: string
    display_name: string
    bio: string
    avatar_media_id?: string
    is_verified: boolean
    follower_count: number
}

export interface SearchResults {
    profiles: ProfileResult[]
    posts: PostDetail[]
}

export function useUniversalSearch(
    query: string,
    type: SearchType = "all",
    enabled: boolean = true
) {
    return useQuery({
        queryKey: ["search", query, type],
        queryFn: async () => {
            const res = await api.get<{ data: SearchResults }>("/v1/search", {
                params: { q: query, type, limit: 20 },
            })
            return res.data.data
        },
        enabled: enabled && query.length >= 2,
    })
}

export function useSearchHashtags(query: string) {
    return useQuery({
        queryKey: ["search-hashtags", query],
        queryFn: async () => {
            const res = await api.get<{ data: string[] }>("/v1/search/hashtags", {
                params: { q: query, limit: 10 },
            })
            return res.data.data as string[]
        },
        enabled: query.length >= 2,
    })
}

export interface TrendingHashtag {
    tag: string
    post_count: number
    growth_rate?: number
}

export interface TrendingResponse {
    hashtags: TrendingHashtag[]
}

export function useTrending() {
    return useQuery({
        queryKey: ["trending"],
        queryFn: async () => {
            const res = await api.get<{ data: TrendingResponse }>("/v1/discover/trending")
            return res.data.data
        },
        staleTime: 60000,
    })
}

export interface SuggestedResponse {
    posts: PostDetail[]
}

export function useSuggested() {
    return useQuery({
        queryKey: ["suggested"],
        queryFn: async () => {
            const res = await api.get<{ data: SuggestedResponse }>("/v1/discover/suggested")
            return res.data.data
        },
    })
}
