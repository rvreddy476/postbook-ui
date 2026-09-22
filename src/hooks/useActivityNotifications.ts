"use client"

import { ensureAccessToken } from '@/lib/accessToken'
import { useEffect, useRef, useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { useAuthUser } from "@/store/auth"
import { playNotificationSound } from "@/hooks/useNotificationSound"

export interface ActivityNotification {
    user_id: string
    notification_id: string
    type: string           // "follow" | "reaction" | "comment" | "friend_request" | "friend_accepted"
    actor_user_id: string
    entity_type: string    // "user" | "post"
    entity_id: string
    deep_link?: string     // e.g. "/post/{id}?focusComment={cid}" or "/u/{userId}"
    is_read: boolean
    created_at: string
    bucket?: number        // partition key used for targeted read/delete operations
    ts?: string            // timestamp key used for targeted read/delete operations
}

interface NotificationsResponse {
    items: ActivityNotification[]
    next_cursor: string | null
}

// ---------- Polling: fetch stored notifications on mount and on interval ----------

export function useActivityNotifications(limit = 20) {
    return useQuery({
        queryKey: ["activity-notifications", limit],
        queryFn: async () => {
            const res = await api.get<{ data: NotificationsResponse }>(
                "/v1/notifications",
                { params: { limit } }
            )
            return res.data.data
        },
        refetchInterval: 30000,
        staleTime: 10000,
    })
}

// ---------- Real-time: SSE stream for instant notifications ----------

export function useNotificationStream(onNotification?: (notif: ActivityNotification) => void) {
    const authUser = useAuthUser()
    const qc = useQueryClient()
    const callbackRef = useRef(onNotification)
    callbackRef.current = onNotification

    useEffect(() => {
        if (!authUser?.id) return

        const userId = authUser.id

        // EventSource doesn't support custom headers, so we use fetch-based SSE
        const controller = new AbortController()

        const connect = async () => {
            try {
                // Resolved per attempt, from memory. This used to be read from
                // localStorage once, outside the effect, so a reconnect after a
                // rotation carried the old token — and a cold tab carried none.
                const accessToken = (await ensureAccessToken()) ?? ""
                if (controller.signal.aborted) return

                const response = await fetch("/api/notifications/stream", {
                    headers: {
                        "X-User-Id": userId,
                        "Authorization": accessToken ? `Bearer ${accessToken}` : "",
                    },
                    signal: controller.signal,
                })

                if (!response.ok || !response.body) return

                const reader = response.body.getReader()
                const decoder = new TextDecoder()
                let buffer = ""

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split("\n")
                    buffer = lines.pop() ?? ""

                    let eventType = ""
                    let dataStr = ""

                    for (const line of lines) {
                        if (line.startsWith("event: ")) {
                            eventType = line.slice(7).trim()
                        } else if (line.startsWith("data: ")) {
                            dataStr = line.slice(6).trim()
                        } else if (line === "" && dataStr) {
                            // End of event
                            if (eventType === "notification" && dataStr) {
                                try {
                                    const parsed = JSON.parse(dataStr)
                                    const notif = parsed.payload as ActivityNotification
                                    if (notif?.notification_id) {
                                        // Trigger callback (for toast/sound)
                                        callbackRef.current?.(notif)
                                        // Invalidate the query to refresh the list
                                        qc.invalidateQueries({ queryKey: ["activity-notifications"] })
                                    }
                                } catch {
                                    // Ignore malformed events
                                }
                            }
                            eventType = ""
                            dataStr = ""
                        }
                    }
                }
            } catch (err: unknown) {
                if (err instanceof DOMException && err.name === "AbortError") return
                // Reconnect after 5s on failure
                await new Promise(r => setTimeout(r, 5000))
                if (!controller.signal.aborted) connect()
            }
        }

        connect()
        return () => controller.abort()
    }, [authUser?.id, qc])
}

// ---------- Mark notification as read ----------

export function useMarkNotificationRead() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ bucket, ts }: { bucket: number; ts: string }) => {
            await api.post("/v1/notifications/read", { bucket, ts })
        },
        // Same reasoning as useMarkAllRead: the number moves when you act,
        // not when the network agrees.
        onMutate: async ({ ts }) => {
            await qc.cancelQueries({ queryKey: ["unread-count"] })
            const previousCount = qc.getQueryData<{ count: number }>(["unread-count"])
            if (previousCount && previousCount.count > 0) {
                qc.setQueryData(["unread-count"], { count: previousCount.count - 1 })
            }
            qc.setQueriesData<NotificationsResponse>(
                { queryKey: ["activity-notifications"] },
                (old) =>
                    old
                        ? {
                              ...old,
                              items: old.items.map((n) =>
                                  n.ts === ts ? { ...n, is_read: true } : n,
                              ),
                          }
                        : old,
            )
            return { previousCount }
        },
        onError: (_err, _vars, context) => {
            if (context?.previousCount !== undefined) {
                qc.setQueryData(["unread-count"], context.previousCount)
            }
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: ["activity-notifications"] })
            qc.invalidateQueries({ queryKey: ["unread-count"] })
        },
    })
}

// ---------- Actor profile cache: resolve user IDs to display names ----------

interface ActorProfile {
    display_name: string
    username?: string
    avatar_media_id?: string
}

const actorCache = new Map<string, ActorProfile>()
const pendingFetches = new Map<string, Promise<ActorProfile | null>>()

async function fetchActorProfile(userId: string): Promise<ActorProfile | null> {
    if (actorCache.has(userId)) return actorCache.get(userId)!
    if (pendingFetches.has(userId)) return pendingFetches.get(userId)!

    const promise = (async () => {
        try {
            const res = await api.get<{ data: ActorProfile }>(`/v1/profiles/${userId}`)
            const profile = res.data?.data ?? res.data
            if (profile?.display_name) {
                actorCache.set(userId, profile)
                return profile
            }
            return null
        } catch {
            return null
        } finally {
            pendingFetches.delete(userId)
        }
    })()

    pendingFetches.set(userId, promise)
    return promise
}

export function useActorProfiles(actorIds: string[]) {
    const [profiles, setProfiles] = useState<Map<string, ActorProfile>>(new Map())

    useEffect(() => {
        if (actorIds.length === 0) return
        let cancelled = false

        const unique = [...new Set(actorIds)]
        Promise.all(unique.map(id => fetchActorProfile(id))).then(results => {
            if (cancelled) return
            const map = new Map<string, ActorProfile>()
            unique.forEach((id, i) => {
                if (results[i]) map.set(id, results[i]!)
            })
            setProfiles(map)
        })

        return () => { cancelled = true }
    }, [actorIds.join(",")])

    return profiles
}

// ---------- Unread count ----------

export function useUnreadCount() {
    const user = useAuthUser()
    return useQuery({
        queryKey: ["unread-count"],
        queryFn: async () => {
            const res = await api.get<{ data: { count: number } }>("/v1/notifications/unread-count")
            return res.data.data
        },
        enabled: !!user,
        refetchInterval: 30000,
        retry: false,
    })
}

// ---------- Mark all notifications as read ----------

export function useMarkAllRead() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async () => {
            await api.patch("/v1/notifications/read-all")
        },
        // Clear the badge IMMEDIATELY, before the request resolves.
        //
        // It used to update only in onSuccess, so the number on the bell
        // depended on a round trip completing. Anything that stopped that
        // request — a slow hop, a 401 in flight, a refetch that lost the
        // race — left the badge sitting there with its old number while the
        // server had already marked everything read. Opening the panel
        // visibly did nothing, which is the bug as the user experiences it.
        //
        // The badge is a view of "have I looked at these", and opening the
        // panel settles that question locally. If the request really does
        // fail, onError puts the old value back and the 30s poll reconciles
        // against the server, which stays the authority.
        onMutate: async () => {
            await qc.cancelQueries({ queryKey: ["unread-count"] })
            const previousCount = qc.getQueryData(["unread-count"])
            qc.setQueryData(["unread-count"], { count: 0 })
            qc.setQueriesData<NotificationsResponse>(
                { queryKey: ["activity-notifications"] },
                (old) =>
                    old
                        ? { ...old, items: old.items.map((n) => ({ ...n, is_read: true })) }
                        : old,
            )
            return { previousCount }
        },
        onError: (_err, _vars, context) => {
            if (context?.previousCount !== undefined) {
                qc.setQueryData(["unread-count"], context.previousCount)
            }
            qc.invalidateQueries({ queryKey: ["activity-notifications"] })
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: ["activity-notifications"] })
            qc.invalidateQueries({ queryKey: ["unread-count"] })
        },
    })
}

// ---------- Delete a single notification ----------

export function useDeleteNotification() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ bucket, ts }: { bucket: number; ts: string }) => {
            await api.delete(`/v1/notifications/${bucket}/${ts}`)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["activity-notifications"] })
            qc.invalidateQueries({ queryKey: ["unread-count"] })
        },
    })
}

// ---------- Notification preferences ----------

export function useNotificationPreferences() {
    return useQuery({
        queryKey: ["notification-preferences"],
        queryFn: async () => {
            const res = await api.get<{ data: unknown }>("/v1/notifications/preferences")
            return res.data.data
        },
    })
}

export function useUpdateNotificationPreferences() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (body: unknown) => {
            const res = await api.patch<{ data: unknown }>("/v1/notifications/preferences", body)
            return res.data.data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["notification-preferences"] })
        },
    })
}
