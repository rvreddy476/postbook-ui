import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { normaliseDenyReason, readDecision, type DmDenyReason } from "@/lib/chat/dmConsent"

/**
 * What this viewer is allowed to do to these people, decided by the server.
 *
 * graph-service owns a single policy engine — permission.Resolve — and exposes
 * it at POST /v1/permissions/check-batch. It is the one place that knows the
 * whole rule (DM consent contract §4): a block either way, a paused account on
 * either side, `no_one`; then "the recipient follows the sender" (or an older
 * accepted connection) is a direct chat; otherwise who_can_message decides
 * between a message REQUEST and nothing. Android asks it too.
 *
 * `fallback: "message_request"` is not a refusal. It means the message goes
 * through as a REQUEST: text only, one message, until they accept. That
 * distinction is the whole reason to ask rather than guess — "can I message
 * this person" has three answers, not two.
 */

export type PermissionAction =
    | "message"
    /** Same answer as `message` (graph-service accepts both). */
    | "start_conversation"
    | "call"
    | "connect"
    | "follow"
    | "add_to_group"
    | "see_online_status"
    | "see_read_receipts"
    | "see_last_seen"
    | "view_profile"
    | "comment"
    | "view_posts"

/**
 * One action's answer. graph-service leaves empty fields out:
 *   allow    {allowed: true}
 *   request  {allowed: false, fallback: "message_request"}
 *   deny     {allowed: false, reason: "unavailable" | "messages_off" | "you_paused"
 *                                     | "no_one" | "followers_only" | "people_i_follow"}
 * A block is reported as `unavailable`, for every action.
 */
export interface PermissionDecision {
    allowed: boolean
    /** "message_request" | "follow_request" — allowed via a lighter path. */
    fallback?: string
    reason?: string
}

type BatchResponse = {
    data?: {
        results?: Record<string, Partial<Record<PermissionAction, PermissionDecision>>>
        ttl_seconds?: number
        computed_at?: string
    }
}

export type PermissionMap = Map<string, Partial<Record<PermissionAction, PermissionDecision>>>

/**
 * The server states its own freshness budget (ttl_seconds, currently 3). Match
 * it rather than inventing a number: a decision cached past the server's budget
 * is a UI promising something the next request will refuse.
 */
const DECISION_TTL_MS = 3000

export function usePermissions(targetUserIds: string[], actions: PermissionAction[]) {
    // Sorted and de-duplicated so the key is stable across renders that pass
    // the same people in a different order.
    const ids = Array.from(new Set(targetUserIds.filter(Boolean))).sort()
    const acts = Array.from(new Set(actions)).sort()

    return useQuery<PermissionMap>({
        queryKey: ["permissions", ids.join(","), acts.join(",")],
        enabled: ids.length > 0 && acts.length > 0,
        staleTime: DECISION_TTL_MS,
        queryFn: async () => {
            const res = await api.post<BatchResponse>("/v1/permissions/check-batch", {
                target_user_ids: ids,
                actions: acts,
            })
            const results = res.data?.data?.results ?? {}
            return new Map(Object.entries(results))
        },
    })
}

/**
 * A block: `unavailable` now, `blocked` from an older graph-service. Either
 * way the person is simply not reachable, and it is never shown as a block.
 */
export function isUnavailableReason(reason: string | undefined): boolean {
    return normaliseDenyReason(reason) === "unavailable"
}

/**
 * How a Message control should behave for one person: the short form. The
 * profile control uses the fuller messageButtonView (lib/chat/dmConsent.ts).
 *
 * Absent while the decision is loading: the caller shows a neutral, disabled
 * control rather than assuming either answer.
 *
 * Reasons are read by their current names; the older ones (`blocked`,
 * `chat_paused`, `privacy_*`) read as the new ones. An unknown reason still
 * disables the control — a new rule on the server must not become an
 * enabled button here by default.
 */
export type MessageAffordance =
    | { state: "loading" }
    | { state: "open"; label: string }
    | { state: "request"; label: string }
    | { state: "blocked"; label: string; reason: DmDenyReason | null }

export function messageAffordance(decision?: PermissionDecision): MessageAffordance {
    const read = readDecision(decision)
    if (!read) return { state: "loading" }
    if (read.decision === "allow") return { state: "open", label: "Message" }
    if (read.decision === "message_request") return { state: "request", label: "Send request" }
    const label =
        read.reason === "unavailable" ? "Unavailable"
        : read.reason === "messages_off" ? "Not taking messages right now"
        : read.reason === "you_paused" ? "Turn your messages on to send"
        : read.reason === "no_one" ? "Doesn't accept messages"
        : read.reason === "followers_only" ? "Follow them to send a request"
        : read.reason === "people_i_follow" ? "Only accepts messages from people they follow"
        : "Can't be messaged right now"
    return { state: "blocked", label, reason: read.reason }
}
