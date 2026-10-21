import { describe, expect, test } from "bun:test"

import {
    diffPrivacySettings,
    parsePrivacySettings,
    privacyFormFromSettings,
    privacyPatch,
    socialFormFromSettings,
    socialPatch,
    type PrivacySettings,
} from "../_lib/privacySettings"
import { settingsSaveRequest } from "@/hooks/useMySettings"

// A private account, as identity user-service returns it from
// GET /v1/users/me/settings ({ data: UserSettings }).
const privateAccount = {
    data: {
        user_id: "u1",
        account_visibility: "private",
        allow_messages_from: "everyone",
        allow_comments_from: "friends",
        who_can_message: "followers_message_requests",
        who_can_send_connection_request: "friends_of_friends",
        who_can_call: "connections_only",
        who_can_add_to_groups: "connections_only",
        who_can_see_online_status: "connections_only",
        who_can_see_read_receipts: "no_one",
        who_can_see_last_seen: "connections_only",
        who_can_see_profile_photo: "everyone",
        auto_filter_abusive_content: true,
        strict_privacy_mode: false,
        under_18_mode: false,
        privacy_version: 4,
    },
}

function stored(): PrivacySettings {
    const s = parsePrivacySettings(privateAccount)
    if (!s) throw new Error("fixture did not parse")
    return s
}

describe("parsePrivacySettings", () => {
    test("reads the server's field names from the { data } envelope", () => {
        expect(stored()).toEqual({
            account_visibility: "private",
            allow_comments_from: "friends",
            who_can_message: "followers_message_requests",
            who_can_send_connection_request: "friends_of_friends",
            who_can_see_read_receipts: "no_one",
            auto_filter_abusive_content: true,
            strict_privacy_mode: false,
            under_18_mode: false,
        })
    })

    test("refuses a body that is not a settings document, so no form is seeded with defaults", () => {
        expect(parsePrivacySettings({ data: null })).toBeNull()
        expect(parsePrivacySettings({ data: { foo: 1 } })).toBeNull()
        expect(parsePrivacySettings(undefined)).toBeNull()
    })
})

describe("social preferences (T-04)", () => {
    test("an untouched form sends nothing, and no request is built", () => {
        const s = stored()
        const patch = socialPatch(s, socialFormFromSettings(s))
        expect(patch).toEqual({})
        expect(settingsSaveRequest(patch)).toBeNull()
    })

    test("toggling friend requests off sends ONLY that field and never account_visibility", () => {
        const s = stored()
        const form = { ...socialFormFromSettings(s), allowConnectionRequests: false }
        const patch = socialPatch(s, form)
        expect(patch).toEqual({ who_can_send_connection_request: "no_one" })
        expect(Object.keys(patch)).not.toContain("account_visibility")
    })

    test("a private account stays private when another control is saved", () => {
        const s = stored()
        const form = { ...socialFormFromSettings(s), allowConnectionRequests: false }
        const req = settingsSaveRequest(socialPatch(s, form))
        expect(req).toEqual({ method: "put", url: "/v1/users/me/settings", body: { who_can_send_connection_request: "no_one" } })
        expect(req?.body.account_visibility).toBeUndefined()
    })

    test("who can message you is not on this page (one control, in Inbox & messaging)", () => {
        const s = stored()
        expect(Object.keys(socialFormFromSettings(s))).not.toContain("whoCanMessage")
        const all = socialPatch(s, { allowConnectionRequests: false, requireFollowApproval: false })
        expect(all).not.toHaveProperty("who_can_message")
    })

    test("the contract's new value and the retired ones are read as stored", () => {
        for (const v of ["people_i_follow", "connections_only", "friends_of_friends_requests"]) {
            expect(parsePrivacySettings({ data: { ...privateAccount.data, who_can_message: v } })?.who_can_message).toBe(v as never)
        }
    })

    test("turning friend requests back on restores the stored audience instead of widening it", () => {
        const s = stored()
        const off = { ...socialFormFromSettings(s), allowConnectionRequests: false }
        const backOn = { ...off, allowConnectionRequests: true }
        expect(socialPatch(s, backOn)).toEqual({})

        const closed = { ...s, who_can_send_connection_request: "no_one" as const }
        const opened = { ...socialFormFromSettings(closed), allowConnectionRequests: true }
        expect(socialPatch(closed, opened)).toEqual({ who_can_send_connection_request: "everyone" })
    })

    test("require follow approval maps to account_visibility public/private", () => {
        const s = stored()
        const form = { ...socialFormFromSettings(s), requireFollowApproval: false }
        expect(socialPatch(s, form)).toEqual({ account_visibility: "public" })
    })

})

describe("privacy page (T-08)", () => {
    test("every visible control round-trips: form from server, unchanged form, empty patch", () => {
        const s = stored()
        const form = privacyFormFromSettings(s)
        expect(form).toEqual({
            accountVisibility: "private",
            allowCommentsFrom: "friends",
            readReceipts: "no_one",
            filterAbusiveContent: true,
        })
        expect(privacyPatch(s, form)).toEqual({})
    })

    test("who-can-comment is sent as allow_comments_from with the server's values", () => {
        const s = stored()
        const patch = privacyPatch(s, { ...privacyFormFromSettings(s), allowCommentsFrom: "everyone" })
        expect(patch).toEqual({ allow_comments_from: "everyone" })
    })

    test("each control maps to its own server field", () => {
        const s = stored()
        const patch = privacyPatch(s, {
            accountVisibility: "public",
            allowCommentsFrom: "everyone",
            readReceipts: "everyone",
            filterAbusiveContent: false,
        })
        expect(patch).toEqual({
            account_visibility: "public",
            allow_comments_from: "everyone",
            who_can_see_read_receipts: "everyone",
            auto_filter_abusive_content: false,
        })
    })

    test("fields with no server column are never sent", () => {
        const s = stored()
        const patch = diffPrivacySettings(s, {
            ...({ post_visibility: "friends", appear_in_search: false, allow_tagging: "nobody" } as object),
            account_visibility: "private",
        })
        expect(patch).toEqual({})
    })
})
