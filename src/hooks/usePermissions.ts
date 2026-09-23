import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"

/**
 * What this viewer is allowed to do to these people, decided by the server.
 *
 * graph-service owns a single policy engine — permission.Resolve — and exposes
 * it at POST /v1/permissions/check-batch. It is the one place that knows the
 * whole rule: a block denies everything; a paused chat accepts nothing at all;
 * who_can_message then decides between a real thread, a message REQUEST, and
 * nothing, given the relationship (connected, mutual followers, second
 * degree). Android already asks it.
 *
 * The web never has. Every affordance here was derived from raw relationship
 * booleans instead, which is how two clients end up disagreeing about what the
 * same pair of people may do — and the client's guess is the one that is wrong,
 * because the server enforces its own answer regardless.
 *
 * `fallback: "message_request"` is not a refusal. It means the message goes
 * through as a REQUEST: text only, one message, until they accept. That
 * distinction is the whole reason to ask rather than guess — "can I message
 * this person" has three answers, not two.
 */

export type PermissionAction =
    | "message"
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
 * How a Message control should behave for one person.
 *
 * Absent while the decision is loading: the caller shows a neutral, disabled
 * control rather than assuming either answer. Guessing "allowed" flashes an
 * affordance that then disappears; guessing "denied" hides one the viewer is
 * entitled to.
 */
export type MessageAffordance =
    | { state: "loading" }
    | { state: "open"; label: string }
    | { state: "request"; label: string }
    | { state: "blocked"; label: string }

export function messageAffordance(decision?: PermissionDecision): MessageAffordance {
    if (!decision) return { state: "loading" }
    if (decision.allowed) return { state: "open", label: "Message" }
    if (decision.fallback === "message_request") {
        return { state: "request", label: "Send a message request" }
    }
    // The server's reasons, said in words a reader can act on. An unknown
    // reason still disables the control — a new rule on the server must not
    // become an enabled button here by default.
    const reason = decision.reason ?? ""
    const label =
        reason === "blocked" ? "Unavailable"
        : reason === "chat_paused" ? "Not accepting messages right now"
        : reason === "privacy_no_one" ? "Does not accept messages"
        : reason === "privacy_connections_only" ? "Accepts messages from connections only"
        : "Cannot be messaged"
    return { state: "blocked", label }
}
