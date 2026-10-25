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
export type MessageAudience =
    | "no_one"
    | "people_i_follow"
    | "connections_only"
    | "connections_and_mutual_followers"
    | "followers_message_requests"
    | "friends_of_friends_requests"
    | "everyone_message_requests"
export type VisibilityAudience = "everyone" | "connections_only" | "no_one"
/**
 * Who may @mention or tag this account (user-service service/user.go:70-75,
 * the "mention_tag" vocabulary). "following" is the accounts THIS user
 * follows, not their followers (graph-service resolves it as "target
 * follows actor"). A disallowed mention or tag is silently dropped from the
 * post, never an error (store/users.go:29-35).
 */
export type MentionTagAudience = "everyone" | "following" | "no_one"

/** The subset of the settings document the web settings pages read and write. */
export interface PrivacySettings {
    account_visibility: AccountVisibility
    allow_comments_from: CommentAudience
    who_can_message: MessageAudience
    who_can_see_read_receipts: VisibilityAudience
    /** Enforced by graph-service (see_last_seen), and mutual: no_one hides everyone else's from you too. */
    who_can_see_last_seen: VisibilityAudience
    /** Enforced by profile-service photo access (via graph-service view_profile); signed-out viewers see it only for everyone. */
    who_can_see_profile_photo: VisibilityAudience
    auto_filter_abusive_content: boolean
    /** Who can @mention me in a caption or comment. */
    who_can_mention: MentionTagAudience
    /** Who can tag me on a post (tagged_user_ids). */
    who_can_tag: MentionTagAudience
    strict_privacy_mode?: boolean
    under_18_mode?: boolean
}

export type PrivacyPatch = Partial<
    Pick<
        PrivacySettings,
        | "account_visibility"
        | "allow_comments_from"
        | "who_can_message"
        | "who_can_see_read_receipts"
        | "who_can_see_last_seen"
        | "who_can_see_profile_photo"
        | "auto_filter_abusive_content"
        | "who_can_mention"
        | "who_can_tag"
    >
>

const WRITABLE_KEYS = [
    "account_visibility",
    "allow_comments_from",
    "who_can_message",
    "who_can_see_read_receipts",
    "who_can_see_last_seen",
    "who_can_see_profile_photo",
    "auto_filter_abusive_content",
    "who_can_mention",
    "who_can_tag",
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

/** Mentions and tags share one set; "following" is spelled out because it is the people YOU follow. */
export const MENTION_TAG_OPTIONS: Option<MentionTagAudience>[] = [
    { value: "everyone", label: "Everyone" },
    { value: "following", label: "People you follow" },
    { value: "no_one", label: "No one" },
]

/** Last seen and profile photo share the visibility vocabulary with read receipts. */
export const LAST_SEEN_OPTIONS: Option<VisibilityAudience>[] = READ_RECEIPT_OPTIONS
export const PROFILE_PHOTO_OPTIONS: Option<VisibilityAudience>[] = READ_RECEIPT_OPTIONS

/*
  "Who can message you" has ONE control: Settings › Inbox & messaging
  (messagingSettings.ts, DM consent contract §1). This file only reads the
  value, and accepts the four values plus the retired ones the server still
  maps on write.
*/
const ACCOUNT_VISIBILITY = new Set<string>(["public", "private"])
const COMMENT_AUDIENCE = new Set<string>(["everyone", "friends"])
const MESSAGE_AUDIENCE = new Set<string>([
    "everyone_message_requests",
    "followers_message_requests",
    "people_i_follow",
    "no_one",
    "connections_only",
    "connections_and_mutual_followers",
    "friends_of_friends_requests",
])
const VISIBILITY_AUDIENCE = new Set<string>(["everyone", "connections_only", "no_one"])
const MENTION_TAG_AUDIENCE = new Set<string>(["everyone", "following", "no_one"])

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
        who_can_message: pick(MESSAGE_AUDIENCE, s.who_can_message, "everyone_message_requests"),
        who_can_see_read_receipts: pick(VISIBILITY_AUDIENCE, s.who_can_see_read_receipts, "connections_only"),
        who_can_see_last_seen: pick(VISIBILITY_AUDIENCE, s.who_can_see_last_seen, "connections_only"),
        who_can_see_profile_photo: pick(VISIBILITY_AUDIENCE, s.who_can_see_profile_photo, "everyone"),
        auto_filter_abusive_content: s.auto_filter_abusive_content === true,
        // Column default everyone (store/users.go:29-35).
        who_can_mention: pick(MENTION_TAG_AUDIENCE, s.who_can_mention, "everyone"),
        who_can_tag: pick(MENTION_TAG_AUDIENCE, s.who_can_tag, "everyone"),
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

/*
  Connect is gone (founder, 24 Oct 2026): no connection requests anywhere,
  so the "who can send me connection requests" control and the Social
  preferences page that held it were removed. Follow approval (a private
  account) is the Privacy page's "Who can see my profile".
*/

/* ------------------------------------------------------------------ */
/*  Privacy page                                                       */
/* ------------------------------------------------------------------ */

export interface PrivacyForm {
    accountVisibility: AccountVisibility
    allowCommentsFrom: CommentAudience
    readReceipts: VisibilityAudience
    lastSeen: VisibilityAudience
    profilePhoto: VisibilityAudience
    filterAbusiveContent: boolean
    mentions: MentionTagAudience
    tags: MentionTagAudience
}

export function privacyFormFromSettings(s: PrivacySettings): PrivacyForm {
    return {
        accountVisibility: s.account_visibility,
        allowCommentsFrom: s.allow_comments_from,
        readReceipts: s.who_can_see_read_receipts,
        lastSeen: s.who_can_see_last_seen,
        profilePhoto: s.who_can_see_profile_photo,
        filterAbusiveContent: s.auto_filter_abusive_content,
        mentions: s.who_can_mention,
        tags: s.who_can_tag,
    }
}

export function privacyPatch(original: PrivacySettings, form: PrivacyForm): PrivacyPatch {
    return diffPrivacySettings(original, {
        account_visibility: form.accountVisibility,
        allow_comments_from: form.allowCommentsFrom,
        who_can_see_read_receipts: form.readReceipts,
        who_can_see_last_seen: form.lastSeen,
        who_can_see_profile_photo: form.profilePhoto,
        auto_filter_abusive_content: form.filterAbusiveContent,
        who_can_mention: form.mentions,
        who_can_tag: form.tags,
    })
}

/**
 * The fields the server stored differently from what was sent. A minor or a
 * Strict Privacy Mode account has "everyone" narrowed to "following" for
 * mentions and tags (applyStrictMode, service/user.go:245-267); the page
 * shows the stored value and says why.
 */
export function narrowedByServer(sent: PrivacyPatch, stored: PrivacySettings): (keyof PrivacyPatch)[] {
    return WRITABLE_KEYS.filter((key) => sent[key] !== undefined && sent[key] !== stored[key])
}

const MENTION_TAG_WORDS: Record<MentionTagAudience, string> = {
    everyone: "Everyone",
    following: "People you follow",
    no_one: "No one",
}

/** The sentence after a save the server narrowed, or null when it kept what was sent. */
export function mentionTagNarrowedText(sent: PrivacyPatch, stored: PrivacySettings): string | null {
    const changed = narrowedByServer(sent, stored).filter((k) => k === "who_can_mention" || k === "who_can_tag")
    if (changed.length === 0) return null
    const what = changed.length === 2 ? "mentions and tags are" : changed[0] === "who_can_mention" ? "mentions are" : "tags are"
    const value = MENTION_TAG_WORDS[stored[changed[0]] as MentionTagAudience]
    return `Your account has strict privacy protections, so ${what} set to ${value}.`
}
