"use client"

import { useEffect, useMemo } from "react"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { getSharedNotificationSocket } from "@/lib/notificationSocket"
import type { Relationship, RelationshipBatchResponse, UserProfile } from "@/types/profile"

export interface ConnectionUser {
    user_id: string
    display_name: string
    username: string
    avatar_media_id?: string
    followed_at?: string
    friend_since?: string
    created_at?: string
}

export interface PaginatedMeta {
    limit: number
    offset: number
    total: number
    has_next: boolean
}

export interface PaginatedResponse<T> {
    items: T[]
    meta: PaginatedMeta
}

/**
 * A pending connection request from graph-service.
 *
 * graph-service has NO "friendship id" — a pending request is identified
 * solely by the COUNTERPARTY's user_id. For an incoming request that is the
 * sender; for an outgoing one it is the receiver. `user_id` always holds the
 * counterparty's id and is what accept/decline/cancel mutations must receive.
 */
export interface FriendRequestEntry {
    /** Counterparty user_id — sender (incoming) or receiver (outgoing). */
    user_id: string
    display_name: string
    username?: string
    avatar_media_id?: string
    created_at: string
    /** How the request originated — qr / contacts / group / etc. (spec §3.2). */
    source?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * graph-service mutations require a UUID. Callers historically pass either a
 * UUID or a username; this resolves a username to its user_id via
 * profile-service's by-username lookup. A value that already looks like a
 * UUID is returned untouched.
 */
async function resolveUserId(usernameOrId: string): Promise<string> {
    if (!usernameOrId) throw new Error("User identifier is required")
    if (UUID_RE.test(usernameOrId)) return usernameOrId
    const res = await api.get<{ data: { user_id?: string; id?: string } }>(
        `/v1/profiles/by-username/${encodeURIComponent(usernameOrId)}`
    )
    const id = res.data?.data?.user_id ?? res.data?.data?.id
    if (!id) throw new Error(`Could not resolve user "${usernameOrId}"`)
    return id
}

const markRelationshipRequestSent = (relationship: Relationship | null | undefined): Relationship => ({
    following: relationship?.following ?? false,
    followed_by: relationship?.followed_by ?? false,
    is_connection: false,
    connection_status: "pending_sent",
    in_circle: false,
    circle_request_sent: true,
    circle_request_received: false,
    blocked: relationship?.blocked ?? false,
    blocked_by: relationship?.blocked_by ?? false,
    is_muted: relationship?.is_muted,
    can_dm: relationship?.can_dm ?? false,
    can_see_online: relationship?.can_see_online ?? false,
    can_add_to_group: relationship?.can_add_to_group ?? false,
    mutual_circle_count: relationship?.mutual_circle_count ?? 0,
})

function applyRequestSentToCaches(qc: ReturnType<typeof useQueryClient>, userId: string) {
    qc.setQueriesData<Relationship | undefined>(
        {
            queryKey: ["relationship"],
            predicate: (query) => query.queryKey[2] === userId,
        },
        (old) => {
            if (!old) return old
            return markRelationshipRequestSent(old)
        },
    )

    qc.setQueriesData<{ profile?: { id?: string }, relationship?: Relationship | null } | undefined>(
        {
            queryKey: ["aggregated-profile"],
            predicate: (query) => {
                const data = query.state.data as { profile?: { id?: string } } | undefined
                return data?.profile?.id === userId
            },
        },
        (old) => {
            if (!old || !("relationship" in old)) return old
            return {
                ...old,
                relationship: markRelationshipRequestSent(old.relationship),
            }
        },
    )

    qc.setQueriesData<Map<string, Relationship> | undefined>({ queryKey: ["relationships", "batch"] }, (old) => {
        if (!old?.has(userId)) return old
        const next = new Map(old)
        next.set(userId, markRelationshipRequestSent(old.get(userId)))
        return next
    })
}

/**
 * graph-service connection endpoints return only IDs. Hydrate a list of user
 * ids into display objects via the batch-profile endpoint (POST /v1/profiles/batch).
 * The response is either { profiles: [...] } or a { "uuid": {profile} } map.
 */
async function hydrateProfiles(userIds: string[]): Promise<Map<string, UserProfile>> {
    const map = new Map<string, UserProfile>()
    const ids = userIds.slice(0, 100)
    if (ids.length === 0) return map
    const res = await api.post("/v1/profiles/batch", { user_ids: ids })
    const data = res.data
    if (data && typeof data === "object") {
        if (Array.isArray(data.profiles)) {
            for (const p of data.profiles) {
                const prof = p as Record<string, unknown>
                const key = (prof.user_id ?? prof.id) as string | undefined
                if (key) map.set(key, prof as unknown as UserProfile)
            }
        } else {
            for (const [key, value] of Object.entries(data)) {
                if (value && typeof value === "object" && "user_id" in (value as Record<string, unknown>)) {
                    map.set(key, value as UserProfile)
                }
            }
        }
    }
    return map
}

/** Raw graph-service connection-request shape. */
interface GraphConnectionRequest {
    sender_id: string
    receiver_id: string
    status: string
    source?: string
    message?: string
    created_at: string
    updated_at?: string
    expires_at?: string
}

export function useFollowers(userId: string | undefined, limit = 20) {
    return useQuery({
        queryKey: ["connections", "followers", userId, limit],
        queryFn: async () => {
            const res = await api.get<{ data: PaginatedResponse<ConnectionUser> }>(
                `/v1/profiles/${userId}/followers`,
                { params: { limit, offset: 0 } }
            )
            return res.data.data
        },
        enabled: !!userId,
    })
}

export function useFollowing(userId: string | undefined, limit = 20) {
    return useQuery({
        queryKey: ["connections", "following", userId, limit],
        queryFn: async () => {
            const res = await api.get<{ data: PaginatedResponse<ConnectionUser> }>(
                `/v1/profiles/${userId}/following`,
                { params: { limit, offset: 0 } }
            )
            return res.data.data
        },
        enabled: !!userId,
    })
}

// useInfiniteFollowers / useInfiniteFollowing — cursor-paginated for
// celebrity scale (HG2). Keyset on (created_at, follow_id) stays
// O(log n) past the 10k-offset wall the legacy hooks hit. Use these
// for any infinite-scroll surface; the offset hooks above remain for
// the small-list case where total counts matter.
export interface FollowerCursorPage {
    items: ConnectionUser[]
    next_cursor: string
    limit: number
}

export function useInfiniteFollowers(userId: string | undefined, limit = 20) {
    return useInfiniteQuery<FollowerCursorPage>({
        queryKey: ["connections", "followers", "cursor", userId, limit],
        initialPageParam: "",
        enabled: !!userId,
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string | number> = { limit }
            if (typeof pageParam === "string" && pageParam !== "") {
                params.cursor = pageParam
            } else {
                params.paginate = "cursor"
            }
            const res = await api.get<{ data: FollowerCursorPage }>(
                `/v1/profiles/${userId}/followers`,
                { params },
            )
            const d = res.data.data
            return {
                items: d?.items ?? [],
                next_cursor: d?.next_cursor ?? "",
                limit: d?.limit ?? limit,
            }
        },
        getNextPageParam: (last) => (last.next_cursor ? last.next_cursor : undefined),
    })
}

export function useInfiniteFollowing(userId: string | undefined, limit = 20) {
    return useInfiniteQuery<FollowerCursorPage>({
        queryKey: ["connections", "following", "cursor", userId, limit],
        initialPageParam: "",
        enabled: !!userId,
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string | number> = { limit }
            if (typeof pageParam === "string" && pageParam !== "") {
                params.cursor = pageParam
            } else {
                params.paginate = "cursor"
            }
            const res = await api.get<{ data: FollowerCursorPage }>(
                `/v1/profiles/${userId}/following`,
                { params },
            )
            const d = res.data.data
            return {
                items: d?.items ?? [],
                next_cursor: d?.next_cursor ?? "",
                limit: d?.limit ?? limit,
            }
        },
        getNextPageParam: (last) => (last.next_cursor ? last.next_cursor : undefined),
    })
}

/**
 * Friends ("circle") — now sourced from graph-service. The endpoint returns a
 * bare array of user-id strings; this hook hydrates them into ConnectionUser
 * objects and preserves the { items, meta } shape so consumers are unchanged.
 */
export function useFriends(userId: string | undefined, limit = 20) {
    return useQuery({
        queryKey: ["connections", "friends", userId, limit],
        queryFn: async (): Promise<PaginatedResponse<ConnectionUser>> => {
            const res = await api.get<{ data: string[] }>(
                `/v1/graph/connections/${userId}`
            )
            const allIds = res.data?.data ?? []
            const ids = allIds.slice(0, limit)
            const profiles = await hydrateProfiles(ids)
            const items: ConnectionUser[] = ids.map((id) => {
                const p = profiles.get(id)
                return {
                    user_id: id,
                    display_name: p?.display_name || p?.username || "User",
                    username: p?.username || "",
                    avatar_media_id: p?.avatar_media_id,
                }
            })
            return {
                items,
                meta: { limit, offset: 0, total: allIds.length, has_next: allIds.length > ids.length },
            }
        },
        enabled: !!userId,
    })
}

/**
 * Incoming pending connection requests — from graph-service. The endpoint
 * returns raw request rows ({sender_id, receiver_id, ...}); the sender_id is
 * hydrated and surfaced as `user_id` (the counterparty). { items, meta } shape
 * is preserved.
 */
export function usePendingFriendRequests() {
    return useQuery({
        queryKey: ["friend-requests", "pending"],
        queryFn: async (): Promise<PaginatedResponse<FriendRequestEntry>> => {
            const res = await api.get<{ data: GraphConnectionRequest[] }>(
                "/v1/graph/connection-requests"
            )
            const reqs = res.data?.data ?? []
            const profiles = await hydrateProfiles(reqs.map((r) => r.sender_id))
            const items: FriendRequestEntry[] = reqs.map((r) => {
                const p = profiles.get(r.sender_id)
                return {
                    user_id: r.sender_id,
                    display_name: p?.display_name || p?.username || "User",
                    username: p?.username,
                    avatar_media_id: p?.avatar_media_id,
                    created_at: r.created_at,
                    source: r.source,
                }
            })
            return {
                items,
                meta: { limit: items.length, offset: 0, total: items.length, has_next: false },
            }
        },
    })
}

/**
 * Accept an incoming connection request. The argument is the REQUESTER's
 * user_id (or username) — graph-service has no friendship id. A username is
 * resolved to a UUID first.
 */
export function useAcceptFriendRequest() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (senderIdOrUsername: string) => {
            const userId = await resolveUserId(senderIdOrUsername)
            await api.post("/v1/graph/connection-request/accept", { user_id: userId })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["friend-requests"] })
            qc.invalidateQueries({ queryKey: ["friend-suggestions"] })
            qc.invalidateQueries({ queryKey: ["connections"] })
            qc.invalidateQueries({ queryKey: ["relationship"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        },
        onError: (error) => {
            console.error("[Connections] Failed to accept friend request", error)
        },
    })
}

/**
 * Decline an incoming connection request. The argument is the REQUESTER's
 * user_id (or username).
 */
export function useRejectFriendRequest() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (senderIdOrUsername: string) => {
            const userId = await resolveUserId(senderIdOrUsername)
            await api.post("/v1/graph/connection-request/decline", { user_id: userId })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["friend-requests"] })
            qc.invalidateQueries({ queryKey: ["friend-suggestions"] })
            qc.invalidateQueries({ queryKey: ["connections"] })
            qc.invalidateQueries({ queryKey: ["relationship"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        },
        onError: (error) => {
            console.error("[Connections] Failed to reject friend request", error)
        },
    })
}

/**
 * Connection requests hidden by trust-safety. The endpoint
 * (GET /v1/graph/connection-requests/filtered) returns the SAME raw request
 * rows as the pending-requests endpoint ({sender_id, receiver_id, ...}); the
 * sender_id is hydrated and surfaced as `user_id` (the counterparty).
 * { items, meta } shape is preserved, matching usePendingFriendRequests.
 */
export function useFilteredFriendRequests() {
    return useQuery({
        queryKey: ["friend-requests", "filtered"],
        queryFn: async (): Promise<PaginatedResponse<FriendRequestEntry>> => {
            const res = await api.get<{ data: GraphConnectionRequest[] }>(
                "/v1/graph/connection-requests/filtered"
            )
            const reqs = res.data?.data ?? []
            const profiles = await hydrateProfiles(reqs.map((r) => r.sender_id))
            const items: FriendRequestEntry[] = reqs.map((r) => {
                const p = profiles.get(r.sender_id)
                return {
                    user_id: r.sender_id,
                    display_name: p?.display_name || p?.username || "User",
                    username: p?.username,
                    avatar_media_id: p?.avatar_media_id,
                    created_at: r.created_at,
                    source: r.source,
                }
            })
            return {
                items,
                meta: { limit: items.length, offset: 0, total: items.length, has_next: false },
            }
        },
    })
}

/**
 * Unfilter a connection request that trust-safety hid — moves it back into the
 * normal pending-requests list. The argument is the REQUESTER's (sender's)
 * user_id. POST /v1/graph/connection-request/unfilter with body { user_id }.
 */
export function useUnfilterFriendRequest() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (senderUserId: string) => {
            await api.post("/v1/graph/connection-request/unfilter", { user_id: senderUserId })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["friend-requests"] })
        },
        onError: (error) => {
            console.error("[Connections] Failed to unfilter connection request", error)
        },
    })
}

export interface SuggestionUser {
    user_id: string
    username?: string
    display_name: string
    avatar_media_id?: string
    score?: number
    reason_codes?: string[]
    explain_text?: string
    source_bucket?: string
    mutual_friend_count?: number
    mutual_friend_ids?: string[]
    is_fresh?: boolean
    generated_at?: string
}

interface SuggestionsApiResponse {
    type: string
    items: Array<{
        candidate_user_id: string
        username?: string
        display_name: string
        avatar_media_id?: string
        score: number
        reason_codes: string[]
        explain_text: string
        source_bucket: string
        mutual_friend_count: number
        mutual_friend_ids?: string[]
        is_fresh?: boolean
        generated_at?: string
    }>
    next_cursor?: string
    surface?: string
    experiment_id?: string
    variant_id?: string
    generated_at?: string
}

export function useFriendSuggestions(userId: string | undefined, limit = 5) {
    return useQuery({
        queryKey: ["friend-suggestions", userId, limit],
        queryFn: async () => {
            // Relationship-separation spec §2.4: explicit users-only endpoint.
            // The legacy /v1/suggestions?type=friend still works but the
            // typed /people route is the spec-blessed shape.
            const res = await api.get<{ data: SuggestionsApiResponse }>(
                "/v1/suggestions/people",
                { params: { limit } }
            )
            const items = res.data?.data?.items ?? []
            return items.map((item): SuggestionUser => ({
                user_id: item.candidate_user_id,
                username: item.username,
                display_name: item.display_name,
                avatar_media_id: item.avatar_media_id,
                score: item.score,
                reason_codes: item.reason_codes,
                explain_text: item.explain_text,
                source_bucket: item.source_bucket,
                mutual_friend_count: item.mutual_friend_count,
                mutual_friend_ids: item.mutual_friend_ids,
                is_fresh: item.is_fresh,
                generated_at: item.generated_at,
            }))
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
    })
}

// useHubSuggestions feeds the "Suggested Hubs" sidebar widget — entirely
// distinct from useFriendSuggestions per relationship-separation spec §6.
// Backend returns approved hubs/pages (currently empty until the hub
// candidate generator ships).
export function useHubSuggestions(userId: string | undefined, limit = 5) {
    return useQuery({
        queryKey: ["hub-suggestions", userId, limit],
        queryFn: async () => {
            const res = await api.get<{ data: SuggestionsApiResponse }>(
                "/v1/suggestions/hubs",
                { params: { limit } }
            )
            const items = res.data?.data?.items ?? []
            return items.map((item): SuggestionUser => ({
                user_id: item.candidate_user_id,
                username: item.username,
                display_name: item.display_name,
                avatar_media_id: item.avatar_media_id,
                score: item.score,
                reason_codes: item.reason_codes,
                explain_text: item.explain_text,
                source_bucket: item.source_bucket,
                mutual_friend_count: item.mutual_friend_count,
                mutual_friend_ids: item.mutual_friend_ids,
                is_fresh: item.is_fresh,
                generated_at: item.generated_at,
            }))
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
    })
}

export function useHideSuggestion() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ candidateUserId, type = "friend" }: { candidateUserId: string; type?: string }) => {
            await api.post("/v1/suggestions/action", {
                type,
                surface: "circle",
                candidate_user_id: candidateUserId,
                action: "hide",
            })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["friend-suggestions"] })
        },
    })
}

/**
 * Send a connection request via graph-service. Accepts a username or a UUID;
 * a username is resolved to a UUID before the request is sent.
 */
export function useSendFriendRequest() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (usernameOrId: string) => {
            const userId = await resolveUserId(usernameOrId)
            await api.post("/v1/graph/connection-request", { user_id: userId })
            return userId
        },
        onMutate: async (usernameOrId) => {
            const userId = UUID_RE.test(usernameOrId) ? usernameOrId : undefined
            if (!userId) return
            await qc.cancelQueries({ queryKey: ["relationship"] })
            await qc.cancelQueries({ queryKey: ["relationships", "batch"] })
            await qc.cancelQueries({ queryKey: ["aggregated-profile"] })
            applyRequestSentToCaches(qc, userId)
        },
        onSuccess: (userId) => {
            applyRequestSentToCaches(qc, userId)
            qc.invalidateQueries({ queryKey: ["friend-requests", "sent"] })
            qc.invalidateQueries({ queryKey: ["friend-requests", "pending"] })
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: ["friend-suggestions"] })
            qc.invalidateQueries({ queryKey: ["connections"] })
        },
        onError: (error) => {
            console.error("[Connections] Failed to send friend request", error)
        },
    })
}

// ---------- Circle: Sent Requests ----------

/**
 * Outgoing pending connection requests — from graph-service. The receiver_id
 * is hydrated and surfaced as `user_id` (the counterparty you sent the
 * request to). { items, meta } shape is preserved.
 */
export function useSentFriendRequests() {
    return useQuery({
        queryKey: ["friend-requests", "sent"],
        queryFn: async (): Promise<PaginatedResponse<FriendRequestEntry>> => {
            const res = await api.get<{ data: GraphConnectionRequest[] }>(
                "/v1/graph/connection-requests/sent"
            )
            const reqs = res.data?.data ?? []
            const profiles = await hydrateProfiles(reqs.map((r) => r.receiver_id))
            const items: FriendRequestEntry[] = reqs.map((r) => {
                const p = profiles.get(r.receiver_id)
                return {
                    user_id: r.receiver_id,
                    display_name: p?.display_name || p?.username || "User",
                    username: p?.username,
                    avatar_media_id: p?.avatar_media_id,
                    created_at: r.created_at,
                    source: r.source,
                }
            })
            return {
                items,
                meta: { limit: items.length, offset: 0, total: items.length, has_next: false },
            }
        },
    })
}

/**
 * Cancel an outgoing connection request. The argument is the RECEIVER's
 * user_id (or username) — the person you sent the request to.
 */
export function useCancelFriendRequest() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (receiverIdOrUsername: string) => {
            const userId = await resolveUserId(receiverIdOrUsername)
            await api.post("/v1/graph/connection-request/cancel", { user_id: userId })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["friend-requests"] })
            qc.invalidateQueries({ queryKey: ["friend-suggestions"] })
            qc.invalidateQueries({ queryKey: ["connections"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        },
        onError: (error) => {
            console.error("[Connections] Failed to cancel friend request", error)
        },
    })
}

/**
 * Remove an existing connection. The argument is the other user's user_id
 * (or username). graph-service expects the id in the DELETE request body.
 */
export function useRemoveFriend() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (usernameOrId: string) => {
            const userId = await resolveUserId(usernameOrId)
            await api.delete("/v1/graph/connection", { data: { user_id: userId } })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["connections"] })
            qc.invalidateQueries({ queryKey: ["friend-requests"] })
            qc.invalidateQueries({ queryKey: ["relationship"] })
            qc.invalidateQueries({ queryKey: ["aggregated-profile"] })
        },
        onError: (error) => {
            console.error("[Connections] Failed to remove friend", error)
        },
    })
}

// ---------- Follow Suggestions ----------

export function useFollowSuggestions(userId: string | undefined, limit = 5) {
    return useQuery({
        queryKey: ["follow-suggestions", userId, limit],
        queryFn: async () => {
            const res = await api.get<{ data: SuggestionsApiResponse }>(
                "/v1/suggestions",
                { params: { type: "follow", limit, surface: "home" } }
            )
            const items = res.data?.data?.items ?? []
            return items.map((item): SuggestionUser => ({
                user_id: item.candidate_user_id,
                username: item.username,
                display_name: item.display_name,
                avatar_media_id: item.avatar_media_id,
                score: item.score,
                reason_codes: item.reason_codes,
                explain_text: item.explain_text,
                source_bucket: item.source_bucket,
                mutual_friend_count: item.mutual_friend_count,
            }))
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
    })
}

// ---------- Dismiss Category ----------

export function useDismissCategory() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ candidateUserId, signalType, type = "friend" }: { candidateUserId: string; signalType: string; type?: string }) => {
            await api.post("/v1/suggestions/action", {
                type,
                surface: "circle",
                candidate_user_id: candidateUserId,
                action: "dismiss_category",
                signal_type: signalType,
            })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["friend-suggestions"] })
            qc.invalidateQueries({ queryKey: ["follow-suggestions"] })
        },
    })
}

export function useBatchRelationships(viewerId: string, targetIds: string[]) {
    const capped = targetIds.slice(0, 100)
    return useQuery({
        queryKey: ["relationships", "batch", viewerId, ...capped.slice().sort()],
        queryFn: async () => {
            const res = await api.post<RelationshipBatchResponse>("/v1/graph/relationships/batch", {
                viewer_id: viewerId,
                target_ids: capped,
            })
            // graph-service returns a bare { "<uuid>": {...} } map (no
            // envelope); tolerate a wrapped shape too. Wire field names
            // differ from the UI Relationship type, so normalize:
            // follows -> following, is_connection -> is_connection/accepted.
            const raw = ((res.data as unknown as { relationships?: Record<string, unknown> }).relationships
                ?? (res.data as unknown)) as Record<string, Record<string, unknown>>
            const map = new Map<string, Relationship>()
            for (const [userId, rel] of Object.entries(raw ?? {})) {
                if (!rel || typeof rel !== 'object') continue
                const isConnection = !!rel.is_connection
                const status = (rel.connection_status as Relationship['connection_status']) ?? 'none'
                map.set(userId, {
                    following: !!(rel.follows ?? rel.following),
                    followed_by: !!rel.followed_by,
                    is_connection: isConnection,
                    connection_status: isConnection ? 'accepted' : status,
                    in_circle: isConnection,
                    circle_request_sent: status === 'pending_sent',
                    circle_request_received: status === 'pending_received',
                } as Relationship)
            }
            return map
        },
        staleTime: 30_000,
        enabled: !!viewerId && capped.length > 0,
    })
}

// ---------- Close Friends ("Trusted Circle") ----------

/**
 * The current user's close friends ("Trusted Circle") — from graph-service.
 * GET /v1/graph/close-friends returns a bare array of user-id strings; this
 * hydrates them into ConnectionUser objects.
 */
export function useCloseFriends() {
    return useQuery({
        queryKey: ["close-friends"],
        queryFn: async (): Promise<ConnectionUser[]> => {
            const res = await api.get<{ data: string[] }>("/v1/graph/close-friends")
            const ids = res.data?.data ?? []
            const profiles = await hydrateProfiles(ids)
            return ids.map((id) => {
                const p = profiles.get(id)
                return {
                    user_id: id,
                    display_name: p?.display_name || p?.username || "User",
                    username: p?.username || "",
                    avatar_media_id: p?.avatar_media_id,
                }
            })
        },
    })
}

/** Add a user to the current user's close-friends list. Argument is a UUID. */
export function useAddCloseFriend() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (userId: string) => {
            await api.post(`/v1/graph/close-friends/${userId}`)
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ["close-friends"] }),
        onError: (error) => {
            console.error("[Connections] Failed to add close friend", error)
        },
    })
}

/** Remove a user from the current user's close-friends list. */
export function useRemoveCloseFriend() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (userId: string) => {
            await api.delete(`/v1/graph/close-friends/${userId}`)
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ["close-friends"] }),
        onError: (error) => {
            console.error("[Connections] Failed to remove close friend", error)
        },
    })
}

// ---------- Presence (online status) ----------

/**
 * Online status for a set of users — one batch request via
 * POST /v1/users/online/batch (capped at 100 ids). Returns a
 * { userId: online } map; refetches every 60s.
 */
export function usePresence(userIds: string[]) {
    const capped = userIds.slice(0, 100)
    const qc = useQueryClient()
    // Sorted, comma-joined ids — a stable primitive for the query key and
    // effect deps (the raw `capped` array is a fresh reference each render).
    const idsKey = capped.slice().sort().join(",")
    const queryKey = useMemo(
        () => ["presence", ...idsKey.split(",").filter(Boolean)],
        [idsKey],
    )

    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<Record<string, boolean>> => {
            try {
                const res = await api.post<{
                    data?: { online?: Record<string, boolean> }
                }>("/v1/users/online/batch", { user_ids: capped })
                return res.data?.data?.online ?? {}
            } catch {
                return {}
            }
        },
        enabled: capped.length > 0,
        // Initial snapshot + a 20s reconciler. The real-time path below is
        // what makes presence feel instant; this poll is the fallback.
        staleTime: 10_000,
        refetchInterval: 20_000,
    })

    // Real-time push: the WS gateway broadcasts `presence_update` the instant
    // any user connects/disconnects. Patch the cache directly so a friend's
    // dot flips in well under a second instead of waiting for the next poll.
    useEffect(() => {
        if (idsKey === "") return
        const socket = getSharedNotificationSocket()
        if (!socket) return
        const watched = new Set(idsKey.split(","))
        return socket.on(
            "presence_update",
            (data: { user_id?: string; online?: boolean }) => {
                const uid = data?.user_id
                if (!uid || !watched.has(uid)) return
                qc.setQueryData<Record<string, boolean>>(queryKey, (prev) => ({
                    ...(prev ?? {}),
                    [uid]: !!data?.online,
                }))
            },
        )
    }, [idsKey, qc, queryKey])

    return query
}
