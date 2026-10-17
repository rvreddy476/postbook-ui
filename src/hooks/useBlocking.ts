"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { PaginatedMeta } from "@/hooks/useConnections"
import { resolveUserId } from "@/hooks/useConnections"
import { useAuthUser } from "@/store/auth"
import { GRAPH_BATCH_MAX, GRAPH_ROUTES, blockedByViewer, graphUserIdBody } from "@/lib/graphApi"
import { AxiosError } from "axios"

/**
 * Blocks live in graph-service (lib/graphApi.ts). Callers pass a user id or
 * a username; graph-service needs the id.
 */
export interface BlockedUser {
    blocker_id: string
    blocked_id: string
    /** graph-service does not return when a block was made. */
    created_at?: string
}

interface BlockedUsersResponse {
    items: BlockedUser[]
    meta: PaginatedMeta
}

function getBlockErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
        const status = error.response?.status
        if (status === 403) return "You do not have permission to perform this action."
        if (status === 404) return "User not found."
    }
    return "An unexpected error occurred. Please try again."
}

function invalidateAfterBlockChange(qc: ReturnType<typeof useQueryClient>) {
    qc.invalidateQueries({ queryKey: ["relationship"] })
    qc.invalidateQueries({ queryKey: ["relationships", "batch"] })
    qc.invalidateQueries({ queryKey: ["connections"] })
    qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
    qc.invalidateQueries({ queryKey: ["blocked-users"] })
    // A block removes the person from feeds in both directions.
    qc.invalidateQueries({ queryKey: ["home-feed"] })
    qc.invalidateQueries({ queryKey: ["reels", "feed"] })
}

export function useBlockUser() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (usernameOrId: string) => {
            const userId = await resolveUserId(usernameOrId)
            const res = await api.post<{ data: { status: string } }>(GRAPH_ROUTES.block, graphUserIdBody(userId))
            return res.data.data
        },
        onSuccess: () => invalidateAfterBlockChange(qc),
        onError: (error) => {
            console.error("[Blocking] Failed to block user", error)
            const message = getBlockErrorMessage(error)
            window.alert(message)
        },
    })
}

export function useUnblockUser() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (usernameOrId: string) => {
            const userId = await resolveUserId(usernameOrId)
            const res = await api.delete<{ data: { status: string } }>(GRAPH_ROUTES.block, {
                data: graphUserIdBody(userId),
            })
            return res.data.data
        },
        onSuccess: () => invalidateAfterBlockChange(qc),
        onError: (error) => {
            console.error("[Blocking] Failed to unblock user", error)
            const message = getBlockErrorMessage(error)
            window.alert(message)
        },
    })
}

/**
 * The accounts the signed-in user has blocked.
 *
 * graph-service has no blocks-only list. `/v1/graph/blocked-and-muted` gives
 * everyone whose content is withheld from the viewer — blocks in both
 * directions plus the viewer's mutes — so the viewer's own blocks are picked
 * out of it with one relationships batch (`blocked` = viewer → target).
 */
export function useBlockedUsers(enabled = true) {
    const viewerId = useAuthUser()?.id ?? ""
    return useQuery({
        queryKey: ["blocked-users", viewerId],
        queryFn: async (): Promise<BlockedUsersResponse> => {
            const res = await api.get<{ data: { user_ids?: string[] } }>(GRAPH_ROUTES.blockedAndMuted)
            const candidates = (res.data?.data?.user_ids ?? []).slice(0, GRAPH_BATCH_MAX)
            if (candidates.length === 0) {
                return { items: [], meta: { limit: GRAPH_BATCH_MAX, offset: 0, total: 0, has_next: false } }
            }
            const batch = await api.post<Record<string, unknown>>(GRAPH_ROUTES.relationshipsBatch, {
                viewer_id: viewerId,
                target_ids: candidates,
            })
            const blocked = blockedByViewer(batch.data)
            return {
                items: blocked.map((id) => ({ blocker_id: viewerId, blocked_id: id })),
                meta: { limit: GRAPH_BATCH_MAX, offset: 0, total: blocked.length, has_next: false },
            }
        },
        enabled: enabled && !!viewerId,
    })
}
