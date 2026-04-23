"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { uploadMedia } from "@/lib/mediaUpload"
import type { UserProfile, UserLink, ProfileLink, Follow, Friendship } from "@/types/profile"

// Backend returns user_id, frontend expects id — normalize once at the data layer
function normalizeProfile(raw: Record<string, unknown>): UserProfile {
    const data = raw as Record<string, unknown>
    if (data.user_id && !data.id) {
        data.id = data.user_id
    }
    return data as unknown as UserProfile
}

export function useMyProfile(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["my-profile"],
        queryFn: async () => {
            const res = await api.get<{ data: Record<string, unknown> }>("/v1/profiles/me")
            return normalizeProfile(res.data.data)
        },
        staleTime: 30 * 1000,
        enabled: options?.enabled ?? true,
    })
}

export function useUserProfile(userId: string | undefined) {
    return useQuery({
        queryKey: ["user-profile", userId],
        queryFn: async () => {
            const res = await api.get<{ data: Record<string, unknown> }>(`/v1/profiles/${userId}`)
            return normalizeProfile(res.data.data)
        },
        staleTime: 5 * 60 * 1000,
        enabled: !!userId,
    })
}

export function useUpdateProfile() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (payload: {
            display_name: string
            bio: string
            username?: string | null
            first_name?: string | null
            last_name?: string | null
            preferred_name?: string | null
            pronouns?: string | null
            gender?: string | null
            dob?: string | null
            category?: string | null
            profession?: string | null
            website?: string | null
            location?: string | null
            status_text?: string | null
            status_emoji?: string | null
            profile_theme_color?: string
            cta_label?: string | null
            cta_url?: string | null
            timezone?: string | null
        }) => {
            const res = await api.put<{ data: Record<string, unknown> }>("/v1/profiles/me", payload)
            return normalizeProfile(res.data.data)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["my-profile"] })
            qc.invalidateQueries({ queryKey: ["profile"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        },
    })
}

export function useUpdateAvatar() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (file: File) => {
            const mediaId = await uploadMedia(file, "image", "avatar")
            await api.put("/v1/profiles/me/avatar", { media_id: mediaId })
            return mediaId
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["my-profile"] })
            qc.invalidateQueries({ queryKey: ["profile"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        },
    })
}

export function useUpdateCover() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (file: File) => {
            const mediaId = await uploadMedia(file, "image", "cover")
            await api.put("/v1/profiles/me/cover", { media_id: mediaId })
            return mediaId
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["my-profile"] })
            qc.invalidateQueries({ queryKey: ["profile"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        },
    })
}

// Legacy bulk links update
export function useUpdateLinks() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (links: Pick<UserLink, "platform" | "url" | "display_label" | "sort_order">[]) => {
            await api.put("/v1/profiles/me/links", { links })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["user-links"] })
        },
    })
}

// New profile links (individual CRUD)
export function useProfileLinks() {
    return useQuery({
        queryKey: ["profile-links"],
        queryFn: async () => {
            const res = await api.get<{ data: ProfileLink[] }>("/v1/profiles/me/profile-links")
            return res.data.data
        },
    })
}

export function useCreateProfileLink() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (link: { title: string; url: string; icon?: string; category?: string; sort_order?: number; is_pinned?: boolean; visibility?: string }) => {
            const res = await api.post<{ data: ProfileLink }>("/v1/profiles/me/profile-links", link)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["profile-links"] })
        },
    })
}

export function useUpdateProfileLink() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, ...link }: { id: string; title: string; url: string; icon?: string; category?: string; sort_order?: number; is_pinned?: boolean; visibility?: string }) => {
            const res = await api.patch<{ data: ProfileLink }>(`/v1/profiles/me/profile-links/${id}`, link)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["profile-links"] })
        },
    })
}

export function useDeleteProfileLink() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (linkId: string) => {
            await api.delete(`/v1/profiles/me/profile-links/${linkId}`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["profile-links"] })
        },
    })
}

// Follow
export function useFollowUser() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (username: string) => {
            const res = await api.post<{ data: Follow }>(`/v1/profiles/${username}/follow`)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["profile"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        },
    })
}

export function useUnfollowUser() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (username: string) => {
            await api.delete(`/v1/profiles/${username}/follow`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["profile"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        },
    })
}

// Friend requests
export function useSendFriendRequest() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (username: string) => {
            const res = await api.post<{ data: Friendship }>(`/v1/profiles/${username}/friend-request`)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["profile"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        },
    })
}

export function useRespondToFriendRequest() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ friendshipId, accept }: { friendshipId: string; accept: boolean }) => {
            const res = await api.patch<{ data: Friendship }>(`/v1/profiles/friend-requests/${friendshipId}`, { accept })
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["profile"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        },
    })
}
