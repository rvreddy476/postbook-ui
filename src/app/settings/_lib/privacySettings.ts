/**
 * The privacy document behind `GET` / `PUT /v1/users/me/settings`.
 *
 * Authority: identity-platform user-service (api-gateway routes the exact
 * prefix `/v1/users/me/settings` to identity-user). The handler is
 * `UpdateMySettings` in identity-platform/services/user-service/internal/http/
 * handler.go: every field of `updateSettingsRequest` is a pointer and only the
 * fields present in the body are merged onto the stored record. That makes
 * "send only what the user changed" both possible and the only safe way to
 * save: a page that sends its defaults overwrites values chosen elsewhere,
 * which is how saving one toggle on Social preferences used to make a private
 * account public.
 *
 * Enum values are the server's (`allowedPrivacyValues` in
 * identity-platform/services/user-service/internal/service/user.go). The
 * server validates the WHOLE merged record, so an out-of-range value fails the
 * entire save with 400 INVALID_REQUEST.
 */

export type AccountVisibility = "public" | "private"
export type CommentAudience = "everyone" | "friends"
export type ConnectionRequestAudience =
    | "no_one"
    | "friends_of_friends_or_contacts"
    | "friends_of_friends"
    | "contacts_only"
    | "everyone"
export type MessageAudience =
    | "no_one"
    | "connections_only"
    | "connections_and_mutual_followers"
    | "followers_message_requests"
    | "friends_of_friends_requests"
    | "everyone_message_requests"
export type VisibilityAudience = "everyone" | "connections_only" | "no_one"

/** The subset of the settings document the web settings pages read and write. */
export interface PrivacySettings {
    account_visibility: AccountVisibility
    allow_comments_from: CommentAudience
    who_can_message: MessageAudience
    who_can_send_connection_request: ConnectionRequestAudience
    who_can_see_read_receipts: VisibilityAudience
    auto_filter_abusive_content: boolean
    strict_privacy_mode?: boolean
    under_18_mode?: boolean
}

export type PrivacyPatch = Partial<
    Pick<
        PrivacySettings,
        | "account_visibility"
        | "allow_comments_from"
        | "who_can_message"
        | "who_can_send_connection_request"
        | "who_can_see_read_receipts"
        | "auto_filter_abusive_content"
    >
>

const WRITABLE_KEYS = [
    "account_visibility",
    "allow_comments_from",
    "who_can_message",
    "who_can_send_connection_request",
    "who_can_see_read_receipts",
    "auto_filter_abusive_content",
] as const satisfies readonly (keyof PrivacyPatch)[]

export interface Option<V extends string> {
    value: V
    label: string
}

export const ACCOUNT_VISIBILITY_OPTIONS: Option<AccountVisibility>[] = [
    { value: "public", label: "Everyone" },
    { value: "private", label: "Approved followers only" },
]

export const COMMENT_AUDIENCE_OPTIONS: Option<CommentAudience>[] = [
    { value: "everyone", label: "Everyone" },
    { value: "friends", label: "Friends" },
]

export const READ_RECEIPT_OPTIONS: Option<VisibilityAudience>[] = [
    { value: "everyone", label: "Everyone" },
    { value: "connections_only", label: "Connections only" },
    { value: "no_one", label: "No one" },
]

/**
 * The four values offered for new choices, the same set Android's picker
 * offers (DirectMessageAudience.kt). The other two server values are retired
 * from the UI but still valid for existing accounts; see messageAudienceOptions.
 */
const MESSAGE_AUDIENCE_PRIMARY: Option<MessageAudience>[] = [
    { value: "everyone_message_requests", label: "Everyone (as message requests)" },
    { value: "followers_message_requests", label: "Followers (as message requests)" },
    { value: "connections_only", label: "Connections only" },
    { value: "no_one", label: "No one" },
]

const MESSAGE_AUDIENCE_RETIRED: Option<MessageAudience>[] = [
    { value: "connections_and_mutual_followers", label: "Connections and mutual followers" },
    { value: "friends_of_friends_requests", label: "Friends of friends (as message requests)" },
]

/**
 * The options for the "who can message me" picker. A stored retired value is
 * listed too, so the control shows what is actually in force instead of
 * silently snapping to a different value the user never picked.
 */
export function messageAudienceOptions(current: MessageAudience | undefined): Option<MessageAudience>[] {
    const retired = MESSAGE_AUDIENCE_RETIRED.find((o) => o.value === current)
    return retired ? [...MESSAGE_AUDIENCE_PRIMARY, retired] : MESSAGE_AUDIENCE_PRIMARY
}

const ACCOUNT_VISIBILITY = new Set<string>(["public", "private"])
const COMMENT_AUDIENCE = new Set<string>(["everyone", "friends"])
const MESSAGE_AUDIENCE = new Set<string>([...MESSAGE_AUDIENCE_PRIMARY, ...MESSAGE_AUDIENCE_RETIRED].map((o) => o.value))
const CONNECTION_REQUEST_AUDIENCE = new Set<string>([
    "no_one",
    "friends_of_friends_or_contacts",
    "friends_of_friends",
    "contacts_only",
    "everyone",
])
const VISIBILITY_AUDIENCE = new Set<string>(["everyone", "connections_only", "no_one"])

function pick<V extends string>(allowed: Set<string>, value: unknown, fallback: V): V {
    return typeof value === "string" && allowed.has(value) ? (value as V) : fallback
}

/**
 * Parse the GET response body (`{ data: UserSettings }`). Returns null when
 * the body is not a settings document, so the page shows an error instead of
 * rendering a form seeded with invented defaults.
 */
export function parsePrivacySettings(body: unknown): PrivacySettings | null {
    const raw =
        body && typeof body === "object" && "data" in body
            ? (body as { data?: unknown }).data
            : body
    if (!raw || typeof raw !== "object") return null
    const s = raw as Record<string, unknown>
    if (typeof s.account_visibility !== "string") return null
    return {
        // Fallbacks are the server's column defaults; they apply only to a
        // field the response omitted, never to a value the user chose.
        account_visibility: pick(ACCOUNT_VISIBILITY, s.account_visibility, "public"),
        allow_comments_from: pick(COMMENT_AUDIENCE, s.allow_comments_from, "everyone"),
        who_can_message: pick(MESSAGE_AUDIENCE, s.who_can_message, "connections_only"),
        who_can_send_connection_request: pick(
            CONNECTION_REQUEST_AUDIENCE,
            s.who_can_send_connection_request,
            "everyone",
        ),
        who_can_see_read_receipts: pick(VISIBILITY_AUDIENCE, s.who_can_see_read_receipts, "connections_only"),
        auto_filter_abusive_content: s.auto_filter_abusive_content === true,
        strict_privacy_mode: s.strict_privacy_mode === true,
        under_18_mode: s.under_18_mode === true,
    }
}

/**
 * The fields of `desired` whose value differs from the server's `original`.
 * Only writable keys are considered; anything equal to the stored value is
 * left out of the body so the server keeps it exactly as it is.
 */
export function diffPrivacySettings(original: PrivacySettings, desired: PrivacyPatch): PrivacyPatch {
    const patch: PrivacyPatch = {}
    for (const key of WRITABLE_KEYS) {
        const next = desired[key]
        if (next === undefined) continue
        if (next !== original[key]) {
            ;(patch as Record<string, unknown>)[key] = next
        }
    }
    return patch
}

export function isEmptyPatch(patch: object): boolean {
    return Object.keys(patch).length === 0
}

/* ------------------------------------------------------------------ */
/*  Social preferences page                                            */
/* ------------------------------------------------------------------ */

export interface SocialForm {
    /** On unless who_can_send_connection_request is `no_one`. */
    allowConnectionRequests: boolean
    /** account_visibility === "private". */
    requireFollowApproval: boolean
    whoCanMessage: MessageAudience
}

export function socialFormFromSettings(s: PrivacySettings): SocialForm {
    return {
        allowConnectionRequests: s.who_can_send_connection_request !== "no_one",
        requireFollowApproval: s.account_visibility === "private",
        whoCanMessage: s.who_can_message,
    }
}

/**
 * Turning connection requests back on restores whatever narrower audience the
 * account already had (e.g. friends_of_friends) rather than widening it to
 * `everyone`; only an account that was at `no_one` goes to `everyone`.
 */
function connectionRequestValue(on: boolean, original: ConnectionRequestAudience): ConnectionRequestAudience {
    if (!on) return "no_one"
    return original === "no_one" ? "everyone" : original
}

export function socialPatch(original: PrivacySettings, form: SocialForm): PrivacyPatch {
    return diffPrivacySettings(original, {
        who_can_send_connection_request: connectionRequestValue(
            form.allowConnectionRequests,
            original.who_can_send_connection_request,
        ),
        account_visibility: form.requireFollowApproval ? "private" : "public",
        who_can_message: form.whoCanMessage,
    })
}

/* ------------------------------------------------------------------ */
/*  Privacy page                                                       */
/* ------------------------------------------------------------------ */

export interface PrivacyForm {
    accountVisibility: AccountVisibility
    allowCommentsFrom: CommentAudience
    readReceipts: VisibilityAudience
    filterAbusiveContent: boolean
}

export function privacyFormFromSettings(s: PrivacySettings): PrivacyForm {
    return {
        accountVisibility: s.account_visibility,
        allowCommentsFrom: s.allow_comments_from,
        readReceipts: s.who_can_see_read_receipts,
        filterAbusiveContent: s.auto_filter_abusive_content,
    }
}

export function privacyPatch(original: PrivacySettings, form: PrivacyForm): PrivacyPatch {
    return diffPrivacySettings(original, {
        account_visibility: form.accountVisibility,
        allow_comments_from: form.allowCommentsFrom,
        who_can_see_read_receipts: form.readReceipts,
        auto_filter_abusive_content: form.filterAbusiveContent,
    })
}
