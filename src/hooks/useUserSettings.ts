"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"

/**
 * The current user's settings — from user-service.
 *
 * The four `tc_*` fields back the Trusted Circle toggles on the Friends page.
 * They control which surfaces the user's close-friends ("Trusted Circle") see:
 *   tc_close_friends_posts → close-friends-only posts
 *   tc_location_pings      → live location pings shared with the circle
 *   tc_after_hours_posts   → after-hours posts
 *   tc_audio_room_invite   → automatic Audio Room invites for the circle
 *
 * The shape is intentionally open (`[key: string]: unknown`) — user-service
 * returns more fields than the Trusted Circle toggles need.
 */
export interface UserSettings {
    tc_close_friends_posts: boolean
    tc_location_pings: boolean
    tc_after_hours_posts: boolean
    tc_audio_room_invite: boolean
    [key: string]: unknown
}

/** The four Trusted Circle toggle keys — a PUT body uses a subset of these. */
export type TrustedCircleSettingKey =
    | "tc_close_friends_posts"
    | "tc_location_pings"
    | "tc_after_hours_posts"
    | "tc_audio_room_invite"

/**
 * The current user's settings. GET /v1/users/me/settings returns
 * `{ data: { ...UserSettings } }`.
 */
export function useUserSettings() {
    return useQuery({
        queryKey: ["user-settings"],
        queryFn: async (): Promise<UserSettings> => {
            const res = await api.get<{ data: UserSettings }>("/v1/users/me/settings")
            return res.data?.data ?? ({} as UserSettings)
        },
    })
}

/**
 * Update the current user's settings. The body is PARTIAL — only the changed
 * fields are sent. PUT /v1/users/me/settings.
 */
export function useUpdateUserSettings() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (patch: Partial<UserSettings>) => {
            const res = await api.put<{ data: UserSettings }>("/v1/users/me/settings", patch)
            return res.data?.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["user-settings"] })
        },
        onError: (error) => {
            console.error("[UserSettings] Failed to update settings", error)
        },
    })
}
