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
    hashtag: string
    score: number
}

export interface TrendingResponse {
    trending: TrendingHashtag[]
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

export interface AutocompleteUser {
    user_id: string
    username: string
    display_name: string
}

export function useAutocomplete(query: string) {
    return useQuery({
        queryKey: ["search", "autocomplete", query],
        queryFn: async () => {
            const res = await api.get("/v1/search/autocomplete", {
                params: { q: query, limit: 8 },
            })
            const results: AutocompleteUser[] = res.data.data || res.data || []
            return results
        },
        enabled: query.length >= 1,
        staleTime: 10_000,
    })
}
