import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
    CALL_OPTIONS,
    GROUP_ADD_OPTIONS,
    MAX_FILTERED_KEYWORDS,
    MESSAGE_AUDIENCE_OPTIONS,
    MESSAGE_AUDIENCE_RETIRED,
    MESSAGING_DEFAULTS,
    MESSAGING_KEYS,
    MessagingSettingsError,
    VISIBILITY_OPTIONS,
    addKeyword,
    applyMessagingPatch,
    callChoices,
    chatAvailabilityValue,
    diffMessagingSettings,
    groupAddChoices,
    heldFields,
    isChatPaused,
    keywordCountText,
    keywordProblem,
    keywordProblemText,
    messageAudienceChoices,
    messagingFieldError,
    messagingSettingsError,
    normaliseKeyword,
    normaliseKeywordList,
    optionLabel,
    parseMessagingSettings,
    removeKeyword,
    unknownOptionLabel,
    visibilityChoices,
    type MessagingSettings,
} from "../_lib/messagingSettings"
import { messagingSaveRequest, MESSAGING_SETTINGS_KEY } from "@/hooks/useMessagingSettings"
import { MY_SETTINGS_KEY } from "@/hooks/useMySettings"
import { SETTINGS_GROUPS } from "../_lib/settingsHub"

// A full settings document as identity user-service returns it.
const full = {
    data: {
        user_id: "u1",
        account_visibility: "public",
        who_can_message: "followers_message_requests",
        who_can_add_to_groups: "everyone_with_approval",
        who_can_call: "accepted_chats_only",
        who_can_see_online_status: "no_one",
        who_can_see_read_receipts: "everyone",
        send_typing_indicators: false,
        show_message_preview: false,
        chat_availability: "paused",
        dm_safe_mode: false,
        dm_sensitive_media_filter: true,
        dm_filtered_keywords: ["spam", "buy now"],
        chat_bubble_style: "ocean",
        privacy_version: 7,
    },
}

function loaded(over: Partial<MessagingSettings> = {}): MessagingSettings {
    const s = parseMessagingSettings(full)
    if (!s) throw new Error("fixture did not parse")
    return { ...s, ...over }
}

describe("parseMessagingSettings", () => {
    test("reads every field of a full document", () => {
        expect(parseMessagingSettings(full)).toEqual({
            who_can_message: "followers_message_requests",
            who_can_add_to_groups: "everyone_with_approval",
            who_can_call: "accepted_chats_only",
            who_can_see_online_status: "no_one",
            who_can_see_read_receipts: "everyone",
            send_typing_indicators: false,
            show_message_preview: false,
            chat_availability: "paused",
            dm_safe_mode: false,
            dm_sensitive_media_filter: true,
            dm_filtered_keywords: ["spam", "buy now"],
            chat_bubble_style: "ocean",
        })
    })

    test("missing fields take the server defaults (an older server without the new keys)", () => {
        const s = parseMessagingSettings({ data: { account_visibility: "public", who_can_message: "no_one" } })
        expect(s).toEqual({ ...MESSAGING_DEFAULTS, who_can_message: "no_one", dm_filtered_keywords: [] })
        expect(MESSAGING_DEFAULTS).toMatchObject({
            who_can_message: "everyone_message_requests",
            who_can_add_to_groups: "connections_only",
            who_can_call: "connections_only",
            who_can_see_online_status: "connections_only",
            who_can_see_read_receipts: "connections_only",
            send_typing_indicators: true,
            show_message_preview: true,
            chat_availability: "enabled",
            dm_safe_mode: true,
            dm_sensitive_media_filter: false,
            chat_bubble_style: "default",
        })
    })

    test("unknown enum values are kept as they are, not snapped to a default", () => {
        const s = parseMessagingSettings({ data: { ...full.data, who_can_call: "verified_only", who_can_message: "friends_of_friends_requests" } })!
        expect(s.who_can_call).toBe("verified_only")
        expect(s.who_can_message).toBe("friends_of_friends_requests")
    })

    test("mistyped values fall back; null keyword list is an empty list; non-strings dropped", () => {
        const s = parseMessagingSettings({
            data: { account_visibility: "public", dm_safe_mode: "yes", dm_filtered_keywords: null, who_can_call: 3 },
        })!
        expect(s.dm_safe_mode).toBe(true)
        expect(s.dm_filtered_keywords).toEqual([])
        expect(s.who_can_call).toBe("connections_only")
        expect(parseMessagingSettings({ data: { account_visibility: "public", dm_filtered_keywords: ["a", 2, null, "b"] } })!.dm_filtered_keywords).toEqual(["a", "b"])
    })

    test("an unknown bubble style reads as default (no palette exists for it)", () => {
        expect(parseMessagingSettings({ data: { ...full.data, chat_bubble_style: "neon" } })!.chat_bubble_style).toBe("default")
    })

    test("not a settings document → null", () => {
        expect(parseMessagingSettings(null)).toBeNull()
        expect(parseMessagingSettings({ data: null })).toBeNull()
        expect(parseMessagingSettings({ data: [] })).toBeNull()
        expect(parseMessagingSettings({ data: { hello: 1 } })).toBeNull()
        expect(parseMessagingSettings("x")).toBeNull()
        // the bare document (no envelope) is accepted
        expect(parseMessagingSettings(full.data)?.who_can_call).toBe("accepted_chats_only")
    })

    test("defaults are not shared between parses", () => {
        const a = parseMessagingSettings({ data: { account_visibility: "public" } })!
        a.dm_filtered_keywords.push("x")
        expect(parseMessagingSettings({ data: { account_visibility: "public" } })!.dm_filtered_keywords).toEqual([])
    })
})

describe("diffMessagingSettings / save request", () => {
    test("only changed fields go in the patch", () => {
        const s = loaded()
        expect(diffMessagingSettings(s, { who_can_call: "accepted_chats_only", dm_safe_mode: true })).toEqual({ dm_safe_mode: true })
        expect(diffMessagingSettings(s, { ...s })).toEqual({})
    })

    test("a field absent from the response is not sent unless the user changes it", () => {
        const s = parseMessagingSettings({ data: { account_visibility: "public" } })!
        // the page offers the default; picking it again sends nothing
        expect(diffMessagingSettings(s, { dm_safe_mode: true, chat_bubble_style: "default" })).toEqual({})
        expect(diffMessagingSettings(s, { dm_safe_mode: false })).toEqual({ dm_safe_mode: false })
    })

    test("the keyword list is sent whole when any entry changes, and not at all when equal", () => {
        const s = loaded()
        expect(diffMessagingSettings(s, { dm_filtered_keywords: ["spam", "buy now"] })).toEqual({})
        const added = diffMessagingSettings(s, { dm_filtered_keywords: ["spam", "buy now", "crypto"] })
        expect(added).toEqual({ dm_filtered_keywords: ["spam", "buy now", "crypto"] })
        expect(diffMessagingSettings(s, { dm_filtered_keywords: ["buy now"] })).toEqual({ dm_filtered_keywords: ["buy now"] })
        expect(diffMessagingSettings(s, { dm_filtered_keywords: [] })).toEqual({ dm_filtered_keywords: [] })
        // reordering is a change too (the server keeps first-occurrence order)
        expect(diffMessagingSettings(s, { dm_filtered_keywords: ["buy now", "spam"] })).toEqual({ dm_filtered_keywords: ["buy now", "spam"] })
    })

    test("the patch's list is a copy, not the caller's array", () => {
        const list = ["a"]
        const patch = diffMessagingSettings(loaded(), { dm_filtered_keywords: list })
        list.push("b")
        expect(patch.dm_filtered_keywords).toEqual(["a"])
    })

    test("keys outside the messaging set are never sent", () => {
        const patch = diffMessagingSettings(loaded(), { account_visibility: "private" } as never)
        expect(patch).toEqual({})
    })

    test("save request: a PUT of only the patch, to the settings path; empty → no request", () => {
        expect(messagingSaveRequest({})).toBeNull()
        expect(messagingSaveRequest({ who_can_call: "no_one" })).toEqual({
            method: "put",
            url: "/v1/users/me/settings",
            body: { who_can_call: "no_one" },
        })
    })

    test("query key nests under useMySettings' key so either page's invalidation reaches the other", () => {
        expect(MESSAGING_SETTINGS_KEY).toEqual(["my-settings", "messaging"])
        expect(MESSAGING_SETTINGS_KEY[0]).toBe(MY_SETTINGS_KEY[0])
    })

    test("the hook sets its own cache and invalidates the exact ['my-settings'] query on success, and rolls back on error", () => {
        const src = readFileSync(resolve(import.meta.dir, "../../../hooks/useMessagingSettings.ts"), "utf8")
        expect(src).toContain("qc.invalidateQueries({ queryKey: MY_SETTINGS_KEY, exact: true })")
        expect(src).toContain("qc.setQueryData(MESSAGING_SETTINGS_KEY, stored)")
        expect(src).toContain("if (ctx?.previous) qc.setQueryData(MESSAGING_SETTINGS_KEY, ctx.previous)")
    })

    test("applyMessagingPatch shows the patch; heldFields names what the server kept different", () => {
        const s = loaded()
        expect(applyMessagingPatch(s, { who_can_call: "no_one" }).who_can_call).toBe("no_one")
        expect(heldFields({ who_can_see_read_receipts: "everyone", dm_safe_mode: false }, loaded({ who_can_see_read_receipts: "no_one" }))).toEqual([
            "who_can_see_read_receipts",
        ])
        expect(heldFields({ dm_filtered_keywords: ["SPAM"] }, loaded())).toEqual([])
    })

    test("pause switch maps to chat_availability", () => {
        expect(isChatPaused({ chat_availability: "paused" })).toBe(true)
        expect(isChatPaused({ chat_availability: "enabled" })).toBe(false)
        expect(chatAvailabilityValue(true)).toBe("paused")
        expect(chatAvailabilityValue(false)).toBe("enabled")
    })
})

describe("filtered words", () => {
    test("normalised as the server does: trimmed, inner spaces collapsed, lower-cased", () => {
        expect(normaliseKeyword("  Buy   NOW \t")).toBe("buy now")
        expect(normaliseKeywordList(["Spam", "spam ", "SPAM", "Ham"])).toEqual(["spam", "ham"])
    })

    test("length is 1..30 characters, counted as characters not UTF-16 units", () => {
        expect(keywordProblem("")).toBe("KEYWORD_LENGTH")
        expect(keywordProblem("a".repeat(30))).toBeNull()
        expect(keywordProblem("a".repeat(31))).toBe("KEYWORD_LENGTH")
        // 30 emoji are 60 UTF-16 units but 30 characters
        expect(keywordProblem("😀".repeat(30))).toBeNull()
        expect(keywordProblem("😀".repeat(31))).toBe("KEYWORD_LENGTH")
    })

    test("control characters are refused", () => {
        expect(keywordProblem("bad\u0007word")).toBe("KEYWORD_INVALID")
    })

    test("addKeyword: normalises, refuses blanks, duplicates (case-insensitive) and the 101st word", () => {
        expect(addKeyword([], "  Hello  World ")).toEqual({ ok: true, list: ["hello world"], word: "hello world" })
        expect(addKeyword([], "   ")).toEqual({ ok: false, problem: "KEYWORD_LENGTH" })
        expect(addKeyword(["spam"], "SPAM")).toEqual({ ok: false, problem: "DUPLICATE" })
        const full100 = Array.from({ length: MAX_FILTERED_KEYWORDS }, (_, i) => `w${i}`)
        expect(addKeyword(full100, "one more")).toEqual({ ok: false, problem: "TOO_MANY_KEYWORDS" })
        expect(addKeyword(full100.slice(1), "one more").ok).toBe(true)
        expect(addKeyword([], "x".repeat(31))).toEqual({ ok: false, problem: "KEYWORD_LENGTH" })
    })

    test("removeKeyword and the N/100 count", () => {
        expect(removeKeyword(["a", "b", "c"], "b")).toEqual(["a", "c"])
        expect(keywordCountText(["a", "b"])).toBe("2/100")
    })

    test("every problem has plain words", () => {
        for (const p of ["TOO_MANY_KEYWORDS", "KEYWORD_LENGTH", "KEYWORD_INVALID", "DUPLICATE"] as const) {
            expect(keywordProblemText(p).length).toBeGreaterThan(10)
        }
        expect(keywordProblemText("KEYWORD_LENGTH")).toContain("1 to 30")
        expect(keywordProblemText("TOO_MANY_KEYWORDS")).toContain("100")
    })
})

describe("400 error details", () => {
    const axios400 = (field: string, code: string, message = "invalid privacy setting: x") => ({
        response: { status: 400, data: { error: { code: "INVALID_REQUEST", message, details: { field, code } } } },
        message: "Request failed with status code 400",
    })

    test("each field code maps to plain words for the field it names", () => {
        const many = messagingSettingsError(axios400("dm_filtered_keywords", "TOO_MANY_KEYWORDS"))
        expect(many).toBeInstanceOf(MessagingSettingsError)
        expect(many).toBeInstanceOf(Error)
        expect([many.status, many.code, many.field, many.fieldCode]).toEqual([400, "INVALID_REQUEST", "dm_filtered_keywords", "TOO_MANY_KEYWORDS"])
        expect(many.message).toContain("up to 100 words")
        expect(messagingSettingsError(axios400("dm_filtered_keywords", "KEYWORD_LENGTH")).message).toContain("1 to 30 characters")
        expect(messagingSettingsError(axios400("dm_filtered_keywords", "KEYWORD_INVALID")).message).toContain("characters that can't be used")
        expect(messagingSettingsError(axios400("who_can_call", "INVALID_VALUE")).message).toBe("That choice isn't available. Pick another option.")
    })

    test("a field this page does not own keeps the server's message; no details → server message; no response → generic", () => {
        expect(messagingSettingsError(axios400("account_visibility", "INVALID_VALUE", "invalid privacy setting: account_visibility")).message).toBe(
            "invalid privacy setting: account_visibility",
        )
        expect(messagingFieldError("account_visibility", "INVALID_VALUE")).toBeNull()
        const flat = messagingSettingsError({ response: { status: 403, data: { error: { code: "FORBIDDEN", message: "Not allowed" } } } })
        expect([flat.status, flat.code, flat.field, flat.message]).toEqual([403, "FORBIDDEN", undefined, "Not allowed"])
        expect(messagingSettingsError(new Error("Network Error")).message).toBe("Could not save. Please try again.")
        expect(messagingSettingsError(null, "Nothing to save.").message).toBe("Nothing to save.")
    })

    test("an unknown field code on our field still gets plain words", () => {
        expect(messagingFieldError("dm_safe_mode", "SOMETHING_NEW")).toBe("That setting couldn't be saved. Please try again.")
    })

    test("an already-built error passes through unchanged", () => {
        const e = new MessagingSettingsError("x", { field: "who_can_call" })
        expect(messagingSettingsError(e)).toBe(e)
    })
})

describe("options and labels", () => {
    test("who can message: the four offered values; a stored retired value is listed with its own words", () => {
        expect(MESSAGE_AUDIENCE_OPTIONS.map((o) => o.value)).toEqual([
            "everyone_message_requests",
            "followers_message_requests",
            "connections_only",
            "no_one",
        ])
        expect(messageAudienceChoices("connections_only")).toHaveLength(4)
        const retired = messageAudienceChoices("friends_of_friends_requests")
        expect(retired).toHaveLength(5)
        expect(retired[4]).toEqual({ value: "friends_of_friends_requests", label: "Friends of friends (as message requests)" })
        expect(messageAudienceChoices("connections_and_mutual_followers")[4].label).toBe("Connections and mutual followers")
    })

    test("an unknown stored value is listed with a generic label carrying the raw value", () => {
        expect(callChoices("verified_only").at(-1)).toEqual({ value: "verified_only", label: unknownOptionLabel("verified_only") })
        expect(unknownOptionLabel("verified_only")).toBe("Current setting (verified_only)")
        expect(groupAddChoices("brand_new").at(-1)?.value).toBe("brand_new")
        expect(visibilityChoices("contacts").at(-1)?.value).toBe("contacts")
        expect(messageAudienceChoices("x_y").at(-1)?.label).toBe("Current setting (x_y)")
        expect(optionLabel(CALL_OPTIONS, "zzz")).toBe("Current setting (zzz)")
    })

    test("every confirmed server value has its own words", () => {
        const confirmed: Record<string, [ReturnType<typeof callChoices>, string[]]> = {
            who_can_message: [
                [...MESSAGE_AUDIENCE_OPTIONS, ...MESSAGE_AUDIENCE_RETIRED],
                ["no_one", "connections_only", "connections_and_mutual_followers", "followers_message_requests", "everyone_message_requests", "friends_of_friends_requests"],
            ],
            who_can_add_to_groups: [GROUP_ADD_OPTIONS, ["no_one", "connections_only", "connections_and_contacts", "everyone_with_approval", "friends_of_friends_invites"]],
            who_can_call: [CALL_OPTIONS, ["no_one", "connections_only", "accepted_chats_only"]],
            visibility: [VISIBILITY_OPTIONS, ["everyone", "connections_only", "no_one"]],
        }
        for (const [name, [options, values]] of Object.entries(confirmed)) {
            expect([name, options.map((o) => o.value).sort()]).toEqual([name, [...values].sort()])
            for (const v of values) {
                const label = optionLabel(options, v)
                expect(label).not.toContain("Current setting")
                expect(label).not.toMatch(/tiktok/i)
            }
            expect(new Set(options.map((o) => o.label)).size).toBe(options.length)
        }
    })

    test("every key the page owns is in MESSAGING_KEYS once", () => {
        expect(new Set(MESSAGING_KEYS).size).toBe(MESSAGING_KEYS.length)
        expect([...MESSAGING_KEYS].sort()).toEqual(Object.keys(MESSAGING_DEFAULTS).sort())
    })
})

describe("hub and page", () => {
    test("the Inbox & messaging group sits right after Privacy & safety with one row to the page", () => {
        const keys = SETTINGS_GROUPS.map((g) => g.key)
        expect(keys.indexOf("messaging")).toBe(keys.indexOf("privacy") + 1)
        const group = SETTINGS_GROUPS.find((g) => g.key === "messaging")!
        expect(group.title).toBe("Inbox & messaging")
        expect(group.rows.map((r) => [r.key, r.label, r.href])).toEqual([["messaging", "Inbox & messaging", "/settings/messaging"]])
    })

    const appDir = resolve(import.meta.dir, "../..")
    const page = readFileSync(resolve(appDir, "settings/messaging/page.tsx"), "utf8")
    const css = readFileSync(resolve(appDir, "settings/messaging/messaging-settings.css"), "utf8")

    test("the page exists and shows the §9 controls in order", () => {
        expect(existsSync(resolve(appDir, "settings/messaging/page.tsx"))).toBe(true)
        const labels = [
            "Who can message you",
            "Who can add you to groups",
            "Who can call you",
            "Activity status",
            "Read receipts",
            "Typing indicators",
            "Message previews in notifications",
            "Safe requests",
            "Blur sensitive media",
        ]
        // The last two are their own components; their place on the page is where they are drawn.
        expect(page).toContain('label="Filtered words"')
        expect(page).toContain('label="Bubble colour"')
        const markers = [...labels.map((l) => `label="${l}"`), "<KeywordEditor", "<BubblePicker"]
        const at = markers.map((m) => page.indexOf(m))
        expect(at.every((i) => i >= 0)).toBe(true)
        expect([...at].sort((a, b) => a - b)).toEqual(at)
        expect(page).toContain("<AppShell>")
        expect(page).toContain('href="/settings"')
        expect(page).not.toMatch(/tiktok/i)
    })

    test("the page's CSS uses tokens only: no hex or rgb() literals, font sizes on the 11–15px scale (20px title aside)", () => {
        expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
        expect(css).not.toMatch(/rgba?\(\s*\d/)
        const sizes = [...css.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1]))
        expect(sizes.length).toBeGreaterThan(0)
        expect(sizes.every((n) => n >= 11 && n <= 15)).toBe(true)
    })

    test("Privacy and Social preferences link to the new page", () => {
        for (const p of ["settings/privacy/page.tsx", "settings/social-preferences/page.tsx"]) {
            const src = readFileSync(resolve(appDir, p), "utf8")
            expect(src).toContain('href="/settings/messaging"')
            expect(src).toContain("Inbox &amp; messaging settings")
        }
    })
})
