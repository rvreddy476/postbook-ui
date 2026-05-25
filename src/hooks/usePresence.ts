"use client"

import { useCallback, useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { sendSignaling } from "@/services/messageService"
import type { ConversationPresence } from "@/types/chat"

/**
 * Per-conversation presence (M1).
 *
 * Backend interface (already shipped):
 *   - Client → server WS messages on the existing `/v1/ws/connect` socket:
 *       {"type":"conversation.enter",     "conversation_id": "<uuid>"}
 *       {"type":"conversation.heartbeat", "conversation_id": "<uuid>"}
 *       {"type":"conversation.leave",     "conversation_id": "<uuid>"}
 *       {"type":"typing.start",            "conversation_id": "<uuid>"}
 *   - REST poll: GET /v1/conversations/:id/presence
 *
 * `sendSignaling` from messageService is the queue-aware sender for that
 * shared socket — it buffers messages and replays them once the socket
 * opens, so we don't need to gate on connection state here.
 */

const HEARTBEAT_MS = 15_000
const POLL_MS = 10_000
const TYPING_THROTTLE_MS = 3_000

/**
 * useConversationPresence — drives a single conversation's presence view.
 *
 * - Sends `conversation.enter` on mount.
 * - Sends `conversation.heartbeat` every 15s while mounted (server TTL is
 *   longer than that, so a single missed beat doesn't drop us).
 * - Sends `conversation.leave` on unmount.
 * - Polls `GET /v1/conversations/:id/presence` every 10s via React Query.
 *
 * Returns the polled presence rollup; consumers should hydrate
 * `active_users` via `useBatchProfiles` and filter out the viewer.
 */
export function useConversationPresence(convID: string | null | undefined) {
    const enabled = !!convID

    // Heartbeat + enter/leave lifecycle, scoped to the conversation id.
    useEffect(() => {
        if (!convID) return

        sendSignaling({ type: "conversation.enter", conversation_id: convID })

        const beat = () => {
            sendSignaling({
                type: "conversation.heartbeat",
                conversation_id: convID,
            })
        }
        const timer = setInterval(beat, HEARTBEAT_MS)

        return () => {
            clearInterval(timer)
            sendSignaling({
                type: "conversation.leave",
                conversation_id: convID,
            })
        }
    }, [convID])

    return useQuery<ConversationPresence>({
        queryKey: ["conversationPresence", convID],
        queryFn: async () => {
            const res = await api.get(`/v1/conversations/${convID}/presence`)
            // Backend wraps responses as { data, error, meta } — accept either
            // the wrapped or raw form so we don't fight envelope drift.
            const body = res.data
            const payload =
                body && typeof body === "object" && "data" in body
                    ? (body as { data: ConversationPresence }).data
                    : (body as ConversationPresence)
            return {
                active_count: payload?.active_count ?? 0,
                active_users: Array.isArray(payload?.active_users)
                    ? payload.active_users
                    : [],
                typing_users: Array.isArray(payload?.typing_users)
                    ? payload.typing_users
                    : [],
                is_big_group: !!payload?.is_big_group,
            }
        },
        enabled,
        refetchInterval: POLL_MS,
        // Server is the source of truth for presence; avoid showing a
        // stale-cached count when the user opens a different chat.
        staleTime: 0,
    })
}

/**
 * useSetTyping — returns a function the message-input `onChange` should
 * call on every keystroke. It throttles outbound `typing.start` to at
 * most once per 3s so a fast typist doesn't flood the WS.
 */
export function useSetTyping(convID: string | null | undefined) {
    const lastSentRef = useRef(0)

    return useCallback(() => {
        if (!convID) return
        const now = Date.now()
        if (now - lastSentRef.current < TYPING_THROTTLE_MS) return
        lastSentRef.current = now
        sendSignaling({ type: "typing.start", conversation_id: convID })
    }, [convID])
}
