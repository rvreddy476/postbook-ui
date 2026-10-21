/**
 * Inbox & messaging settings: the chat fields of the settings document behind
 * `GET` / `PUT /v1/users/me/settings` (identity user-service, CONTRACT §7).
 *
 * Same rules as privacySettings.ts:
 *  - the handler merges ONLY the fields present in the PUT body, so a save
 *    sends just what changed (diffMessagingSettings);
 *  - the response to a PUT is the stored record, and it is the new baseline,
 *    because strict-privacy and under-18 accounts are clamped server side;
 *  - `dm_filtered_keywords` is replaced whole by a PUT, so a change sends the
 *    full list, never a delta.
 *
 * Enum fields stay plain strings: a value this client does not know (a newer
 * server, a retired value) is shown as it is instead of snapping to a
 * default the user never picked. Field-level 400s carry
 * `error.details { field, code }`, mapped to plain words by
 * messagingFieldError.
 */

import { BUBBLE_STYLES, type BubbleStyle } from "@/lib/chat/bubbleStyle"
import { GENERIC_SAVE_ERROR } from "./saveFeedback"
import type { Option } from "./privacySettings"

export interface MessagingSettings {
    who_can_message: string
    who_can_add_to_groups: string
    who_can_call: string
    who_can_see_online_status: string
    who_can_see_read_receipts: string
    send_typing_indicators: boolean
    show_message_preview: boolean
    chat_availability: string
    dm_safe_mode: boolean
    dm_sensitive_media_filter: boolean
    dm_filtered_keywords: string[]
    chat_bubble_style: BubbleStyle
    /**
     * Read only, set by the server for an under-18 account (it is never
     * written from here). Present only when the response carried it.
     */
    under_18_mode?: boolean
}

export type MessagingPatch = Partial<Omit<MessagingSettings, "under_18_mode">>

export type MessagingKey = keyof Omit<MessagingSettings, "under_18_mode">

/** Every field this page reads and writes, in the order the page shows them. */
export const MESSAGING_KEYS = [
    "who_can_message",
    "who_can_add_to_groups",
    "who_can_call",
    "who_can_see_online_status",
    "who_can_see_read_receipts",
    "send_typing_indicators",
    "show_message_preview",
    "dm_safe_mode",
    "dm_sensitive_media_filter",
    "dm_filtered_keywords",
    "chat_bubble_style",
    "chat_availability",
] as const satisfies readonly MessagingKey[]

/** The server's column defaults; used only for a field the response omitted. */
export const MESSAGING_DEFAULTS: Readonly<MessagingSettings> = Object.freeze({
    who_can_message: "everyone_message_requests",
    who_can_add_to_groups: "connections_only",
    who_can_call: "accepted_chats_only",
    who_can_see_online_status: "connections_only",
    who_can_see_read_receipts: "connections_only",
    send_typing_indicators: true,
    show_message_preview: true,
    chat_availability: "enabled",
    dm_safe_mode: true,
    dm_sensitive_media_filter: false,
    dm_filtered_keywords: [] as string[],
    chat_bubble_style: "default" as BubbleStyle,
})

const STRING_KEYS = [
    "who_can_message",
    "who_can_add_to_groups",
    "who_can_call",
    "who_can_see_online_status",
    "who_can_see_read_receipts",
    "chat_availability",
] as const satisfies readonly MessagingKey[]

const BOOL_KEYS = [
    "send_typing_indicators",
    "show_message_preview",
    "dm_safe_mode",
    "dm_sensitive_media_filter",
] as const satisfies readonly MessagingKey[]

/** Keys that mark a body as the settings document (any one is enough). */
const DOCUMENT_MARKERS = [...MESSAGING_KEYS, "account_visibility", "privacy_version"]

/* ------------------------------------------------------------------ */
/*  Parse                                                              */
/* ------------------------------------------------------------------ */

/**
 * Parse a GET/PUT response body (`{ data: UserSettings }`, or the document
 * itself). Null when it is not a settings document, so the page shows an
 * error instead of a form seeded with invented values.
 *
 * Missing or mistyped fields take MESSAGING_DEFAULTS. Unknown enum strings are
 * kept as they are. `chat_bubble_style` is the exception: there is no palette
 * for a name this client does not know, so it reads as "default".
 */
export function parseMessagingSettings(body: unknown): MessagingSettings | null {
    const raw =
        body && typeof body === "object" && !Array.isArray(body) && "data" in body
            ? (body as { data?: unknown }).data
            : body
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
    const s = raw as Record<string, unknown>
    if (!DOCUMENT_MARKERS.some((k) => k in s)) return null

    const out: MessagingSettings = { ...MESSAGING_DEFAULTS, dm_filtered_keywords: [] }
    for (const key of STRING_KEYS) {
        const v = s[key]
        if (typeof v === "string" && v.trim() !== "") out[key] = v
    }
    for (const key of BOOL_KEYS) {
        const v = s[key]
        if (typeof v === "boolean") out[key] = v
    }
    if (Array.isArray(s.dm_filtered_keywords)) {
        out.dm_filtered_keywords = s.dm_filtered_keywords.filter((k): k is string => typeof k === "string")
    }
    const bubble = s.chat_bubble_style
    if (typeof bubble === "string" && (BUBBLE_STYLES as readonly string[]).includes(bubble)) {
        out.chat_bubble_style = bubble as BubbleStyle
    }
    if (typeof s.under_18_mode === "boolean") out.under_18_mode = s.under_18_mode
    return out
}

/* ------------------------------------------------------------------ */
/*  Diff                                                               */
/* ------------------------------------------------------------------ */

function sameList(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * The fields of `desired` that differ from what was loaded. Equal values are
 * left out so the server keeps them exactly as stored; a changed keyword list
 * goes in whole (the server replaces it).
 */
export function diffMessagingSettings(original: MessagingSettings, desired: MessagingPatch): MessagingPatch {
    const patch: MessagingPatch = {}
    for (const key of MESSAGING_KEYS) {
        const next = desired[key]
        if (next === undefined) continue
        if (key === "dm_filtered_keywords") {
            const list = next as string[]
            if (!sameList(list, original.dm_filtered_keywords)) patch.dm_filtered_keywords = [...list]
            continue
        }
        if (next !== original[key]) (patch as Record<string, unknown>)[key] = next
    }
    return patch
}

/** The settings with a patch applied: what the page shows while a save is in flight. */
export function applyMessagingPatch(current: MessagingSettings, patch: MessagingPatch): MessagingSettings {
    const next = { ...current, ...patch }
    if (patch.dm_filtered_keywords) next.dm_filtered_keywords = [...patch.dm_filtered_keywords]
    return next
}

/**
 * Fields the server stored differently from what was sent: strict privacy
 * and under-18 rules hold some values fixed. The page says so rather than
 * claiming the change stuck.
 */
export function heldFields(patch: MessagingPatch, stored: MessagingSettings): MessagingKey[] {
    const held: MessagingKey[] = []
    for (const key of MESSAGING_KEYS) {
        const sent = patch[key]
        if (sent === undefined) continue
        if (key === "dm_filtered_keywords") continue // normalised server side; not a clamp
        if (sent !== stored[key]) held.push(key)
    }
    return held
}

/* ------------------------------------------------------------------ */
/*  Options and labels                                                 */
/* ------------------------------------------------------------------ */

/** The label for a value this client has no words for. */
export function unknownOptionLabel(value: string): string {
    return `Current setting (${value})`
}

/**
 * `primary` plus the stored value when it is not one of them: its own label
 * when it is a known retired value, the generic one otherwise. The control
 * always shows what is actually in force.
 */
export function withCurrent(primary: Option<string>[], current: string, extra: Option<string>[] = []): Option<string>[] {
    if (primary.some((o) => o.value === current)) return primary
    const known = extra.find((o) => o.value === current)
    return [...primary, known ?? { value: current, label: unknownOptionLabel(current) }]
}

/* ---- Who can message you (DM consent contract §1) -------------------- */

/** A choice with its one-line explanation. */
export interface AudienceOption extends Option<string> {
    description: string
}

/**
 * The four values, and the only ones the server returns. People you follow
 * always reach your Chats (except under "No one"); the value decides what
 * happens to everyone else.
 */
export const MESSAGE_AUDIENCE_OPTIONS: AudienceOption[] = [
    {
        value: "everyone_message_requests",
        label: "Everyone",
        description: "People you follow go to your chats. Anyone else can send you a request.",
    },
    {
        value: "followers_message_requests",
        label: "Followers",
        description: "People you follow go to your chats. Your followers can send you a request.",
    },
    {
        value: "people_i_follow",
        label: "People I follow",
        description: "Only people you follow can message you. Nobody else can send a request.",
    },
    {
        value: "no_one",
        label: "No one",
        description: "Nobody can start a chat with you. Your existing chats stay as they are.",
    },
]

/**
 * Retired values and the choice each now means. The server migrates stored
 * rows with the same map and only ever returns the four, but an older read
 * still shows as the choice it became, never as an extra option.
 */
export const LEGACY_MESSAGE_AUDIENCE: Readonly<Record<string, string>> = Object.freeze({
    connections_only: "people_i_follow",
    connections_and_mutual_followers: "people_i_follow",
    friends_of_friends_requests: "followers_message_requests",
})

/** Choices an under-18 account may not pick (the server clamps them to People I follow). */
export const ADULT_ONLY_MESSAGE_AUDIENCE: readonly string[] = ["everyone_message_requests", "followers_message_requests"]

/** The value the picker shows: a retired value as the choice it maps to. */
export function displayedMessageAudience(stored: string): string {
    return LEGACY_MESSAGE_AUDIENCE[stored] ?? stored
}

export const GROUP_ADD_OPTIONS: Option<string>[] = [
    { value: "connections_only", label: "Connections only" },
    { value: "connections_and_contacts", label: "Connections and contacts" },
    { value: "friends_of_friends_invites", label: "Friends of friends (as invites)" },
    { value: "everyone_with_approval", label: "Everyone (you approve each add)" },
    { value: "no_one", label: "No one" },
]

/*
  Calls (DM consent §3): accepting a request no longer makes a connection,
  so "connections only" is retired and means accepted chats. The server
  maps it on write and migrates stored rows the same way.
*/
export const CALL_OPTIONS: Option<string>[] = [
    { value: "accepted_chats_only", label: "People whose chats you accepted" },
    { value: "no_one", label: "No one" },
]

export const LEGACY_CALL_AUDIENCE: Readonly<Record<string, string>> = Object.freeze({
    connections_only: "accepted_chats_only",
})

/** The value the calls picker shows: a retired value as the choice it maps to. */
export function displayedCallAudience(stored: string): string {
    return LEGACY_CALL_AUDIENCE[stored] ?? stored
}

export const VISIBILITY_OPTIONS: Option<string>[] = [
    { value: "everyone", label: "Everyone" },
    { value: "connections_only", label: "Connections only" },
    { value: "no_one", label: "No one" },
]

/**
 * The choices for "Who can message you", for the STORED value. A retired
 * value shows as the choice it maps to. An under-18 account is not offered
 * Everyone or Followers; were one of those ever stored for it, it is still
 * listed so the control shows what is in force. An unknown value is listed
 * with the generic label.
 */
export function messageAudienceChoices(stored: string, opts: { under18?: boolean } = {}): AudienceOption[] {
    const shown = displayedMessageAudience(stored)
    const offered = opts.under18
        ? MESSAGE_AUDIENCE_OPTIONS.filter((o) => !ADULT_ONLY_MESSAGE_AUDIENCE.includes(o.value))
        : MESSAGE_AUDIENCE_OPTIONS
    if (offered.some((o) => o.value === shown)) return offered
    const known = MESSAGE_AUDIENCE_OPTIONS.find((o) => o.value === shown)
    return [...offered, known ?? { value: shown, label: unknownOptionLabel(shown), description: "" }]
}

/** The patch for picking `value` while `stored` is in force; empty when nothing changes. */
export function messageAudiencePatch(stored: string, value: string): MessagingPatch {
    if (value === stored) return {}
    // Picking the choice a retired value already shows as still migrates it.
    return { who_can_message: value }
}

export function groupAddChoices(current: string): Option<string>[] {
    return withCurrent(GROUP_ADD_OPTIONS, current)
}
export function callChoices(current: string): Option<string>[] {
    return withCurrent(CALL_OPTIONS, displayedCallAudience(current))
}

/** The "Messages" master switch: on means chat_availability = enabled. */
export function messagesOn(s: Pick<MessagingSettings, "chat_availability">): boolean {
    return !isChatPaused(s)
}
export function visibilityChoices(current: string): Option<string>[] {
    return withCurrent(VISIBILITY_OPTIONS, current)
}

/** The words for a stored value of `options`, or the generic label. */
export function optionLabel(options: Option<string>[], value: string): string {
    return options.find((o) => o.value === value)?.label ?? unknownOptionLabel(value)
}

/** The "Pause chats" switch: on means chat_availability = paused. */
export function isChatPaused(s: Pick<MessagingSettings, "chat_availability">): boolean {
    return s.chat_availability === "paused"
}
export function chatAvailabilityValue(paused: boolean): "paused" | "enabled" {
    return paused ? "paused" : "enabled"
}

/* ------------------------------------------------------------------ */
/*  Filtered words                                                     */
/* ------------------------------------------------------------------ */

export const MAX_FILTERED_KEYWORDS = 100
export const MAX_KEYWORD_LENGTH = 30

export type KeywordProblem = "TOO_MANY_KEYWORDS" | "KEYWORD_LENGTH" | "KEYWORD_INVALID" | "DUPLICATE"

/**
 * The server's normalisation (NormaliseFilteredKeywords): whitespace runs
 * collapse to one space, ends trimmed, lower-cased.
 */
export function normaliseKeyword(raw: string): string {
    return raw.split(/\s+/u).filter(Boolean).join(" ").toLowerCase()
}

// Go's unicode.IsControl is the Cc category.
const CONTROL = /\p{Cc}/u

/** Why a normalised word would be refused, or null when it is fine. Length counts characters, not UTF-16 units. */
export function keywordProblem(word: string): Exclude<KeywordProblem, "TOO_MANY_KEYWORDS" | "DUPLICATE"> | null {
    const n = Array.from(word).length
    if (n < 1 || n > MAX_KEYWORD_LENGTH) return "KEYWORD_LENGTH"
    if (CONTROL.test(word)) return "KEYWORD_INVALID"
    return null
}

export type AddKeywordResult =
    | { ok: true; list: string[]; word: string }
    | { ok: false; problem: KeywordProblem }

/** Add one word to the list the way the server would store it. */
export function addKeyword(list: readonly string[], raw: string): AddKeywordResult {
    const word = normaliseKeyword(raw)
    const problem = keywordProblem(word)
    if (problem) return { ok: false, problem }
    if (list.includes(word)) return { ok: false, problem: "DUPLICATE" }
    if (list.length >= MAX_FILTERED_KEYWORDS) return { ok: false, problem: "TOO_MANY_KEYWORDS" }
    return { ok: true, list: [...list, word], word }
}

export function removeKeyword(list: readonly string[], word: string): string[] {
    return list.filter((w) => w !== word)
}

/** Normalise and dedupe a whole list (first occurrence wins), as the server stores it. */
export function normaliseKeywordList(list: readonly string[]): string[] {
    const out: string[] = []
    for (const raw of list) {
        const w = normaliseKeyword(raw)
        if (w && !out.includes(w)) out.push(w)
    }
    return out
}

export function keywordCountText(list: readonly string[]): string {
    return `${list.length}/${MAX_FILTERED_KEYWORDS}`
}

const KEYWORD_PROBLEM_TEXT: Record<KeywordProblem, string> = {
    TOO_MANY_KEYWORDS: `You can filter up to ${MAX_FILTERED_KEYWORDS} words. Remove one to add another.`,
    KEYWORD_LENGTH: `Each word or phrase needs 1 to ${MAX_KEYWORD_LENGTH} characters.`,
    KEYWORD_INVALID: "That word has characters that can't be used.",
    DUPLICATE: "That word is already on your list.",
}

export function keywordProblemText(problem: KeywordProblem): string {
    return KEYWORD_PROBLEM_TEXT[problem]
}

/* ------------------------------------------------------------------ */
/*  Save errors                                                        */
/* ------------------------------------------------------------------ */

/** What a failed save threw: the server's envelope plus the field it named. */
export class MessagingSettingsError extends Error {
    readonly status?: number
    readonly code?: string
    /** error.details.field, e.g. "dm_filtered_keywords". */
    readonly field?: string
    /** error.details.code: INVALID_VALUE | TOO_MANY_KEYWORDS | KEYWORD_LENGTH | KEYWORD_INVALID. */
    readonly fieldCode?: string

    constructor(message: string, opts: { status?: number; code?: string; field?: string; fieldCode?: string } = {}) {
        super(message)
        this.name = "MessagingSettingsError"
        this.status = opts.status
        this.code = opts.code
        this.field = opts.field
        this.fieldCode = opts.fieldCode
    }
}

interface ErrorLike {
    response?: { status?: number; data?: unknown }
    message?: unknown
}

/** Read an axios error (or anything thrown) into a MessagingSettingsError. */
export function messagingSettingsError(err: unknown, fallback = GENERIC_SAVE_ERROR): MessagingSettingsError {
    if (err instanceof MessagingSettingsError) return err
    const e = (err ?? {}) as ErrorLike
    const status = typeof e.response?.status === "number" ? e.response.status : undefined
    const body = (e.response?.data ?? {}) as {
        error?: { code?: unknown; message?: unknown; details?: unknown }
        message?: unknown
    }
    const envelope = body && typeof body === "object" ? body.error : undefined
    const code = typeof envelope?.code === "string" ? envelope.code : undefined
    const details = envelope?.details && typeof envelope.details === "object"
        ? (envelope.details as { field?: unknown; code?: unknown })
        : undefined
    const field = typeof details?.field === "string" ? details.field : undefined
    const fieldCode = typeof details?.code === "string" ? details.code : undefined
    const message =
        (field ? messagingFieldError(field, fieldCode) : null) ??
        (typeof envelope?.message === "string" && envelope.message.trim() ? envelope.message.trim() : null) ??
        fallback
    return new MessagingSettingsError(message, { status, code, field, fieldCode })
}

/**
 * Plain words for a field-level 400 (`error.details`), shown next to the
 * control it names. Null for a field this page does not own.
 */
export function messagingFieldError(field: string, code: string | undefined): string | null {
    if (!(MESSAGING_KEYS as readonly string[]).includes(field)) return null
    switch (code) {
        case "TOO_MANY_KEYWORDS":
            return keywordProblemText("TOO_MANY_KEYWORDS")
        case "KEYWORD_LENGTH":
            return keywordProblemText("KEYWORD_LENGTH")
        case "KEYWORD_INVALID":
            return "One of your words has characters that can't be used. Remove it and try again."
        case "INVALID_VALUE":
            return "That choice isn't available. Pick another option."
        default:
            return "That setting couldn't be saved. Please try again."
    }
}
