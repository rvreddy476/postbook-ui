import { describe, expect, test } from "bun:test"

import {
    diffPrivacySettings,
    parsePrivacySettings,
    privacyFormFromSettings,
    privacyPatch,
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
        // Mentions and tags (2026-10-24): user-service store/users.go:50-51
        // (json who_can_mention / who_can_tag), vocabulary service/user.go:73-75.
        who_can_mention: "following",
        who_can_tag: "no_one",
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
            who_can_see_read_receipts: "no_one",
            who_can_see_last_seen: "connections_only",
            who_can_see_profile_photo: "everyone",
            auto_filter_abusive_content: true,
            who_can_mention: "following",
            who_can_tag: "no_one",
            strict_privacy_mode: false,
            under_18_mode: false,
        })
    })

    test("last seen and profile photo read the server's vocabulary; an unknown value or a gap takes the column default", () => {
        const odd = parsePrivacySettings({ data: { ...privateAccount.data, who_can_see_last_seen: "friends", who_can_see_profile_photo: "no_one" } })
        expect(odd?.who_can_see_last_seen).toBe("connections_only")
        expect(odd?.who_can_see_profile_photo).toBe("no_one")
        const { who_can_see_last_seen: _a, who_can_see_profile_photo: _b, ...rest } = privateAccount.data
        const gap = parsePrivacySettings({ data: rest })
        expect(gap?.who_can_see_last_seen).toBe("connections_only")
        expect(gap?.who_can_see_profile_photo).toBe("everyone")
    })

    test("refuses a body that is not a settings document, so no form is seeded with defaults", () => {
        expect(parsePrivacySettings({ data: null })).toBeNull()
        expect(parsePrivacySettings({ data: { foo: 1 } })).toBeNull()
        expect(parsePrivacySettings(undefined)).toBeNull()
    })
})

describe("Connect is gone (founder, 24 Oct 2026)", () => {
    test("the connection-request audience is neither read nor ever written", () => {
        const s = stored()
        expect(s).not.toHaveProperty("who_can_send_connection_request")
        const patch = diffPrivacySettings(s, { who_can_send_connection_request: "no_one" } as never)
        expect(patch).toEqual({})
        expect(settingsSaveRequest(patch)).toBeNull()
    })

    test("the contract's new value and the retired ones are read as stored", () => {
        for (const v of ["people_i_follow", "connections_only", "friends_of_friends_requests"]) {
            expect(parsePrivacySettings({ data: { ...privateAccount.data, who_can_message: v } })?.who_can_message).toBe(v as never)
        }
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
            lastSeen: "connections_only",
            profilePhoto: "everyone",
            filterAbusiveContent: true,
            mentions: "following",
            tags: "no_one",
        })
        expect(privacyPatch(s, form)).toEqual({})
    })

    test("last seen alone sends ONLY who_can_see_last_seen, and the request is a PUT of that field", () => {
        const s = stored()
        const patch = privacyPatch(s, { ...privacyFormFromSettings(s), lastSeen: "no_one" })
        expect(patch).toEqual({ who_can_see_last_seen: "no_one" })
        expect(settingsSaveRequest(patch)).toEqual({ method: "put", url: "/v1/users/me/settings", body: { who_can_see_last_seen: "no_one" } })
    })

    test("profile photo alone sends ONLY who_can_see_profile_photo; a private account stays private", () => {
        const s = stored()
        const req = settingsSaveRequest(privacyPatch(s, { ...privacyFormFromSettings(s), profilePhoto: "connections_only" }))
        expect(req?.body).toEqual({ who_can_see_profile_photo: "connections_only" })
        expect(req?.body.account_visibility).toBeUndefined()
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
            lastSeen: "everyone",
            profilePhoto: "no_one",
            filterAbusiveContent: false,
            mentions: "no_one",
            tags: "everyone",
        })
        expect(patch).toEqual({
            account_visibility: "public",
            allow_comments_from: "everyone",
            who_can_see_read_receipts: "everyone",
            who_can_see_last_seen: "everyone",
            who_can_see_profile_photo: "no_one",
            auto_filter_abusive_content: false,
            who_can_mention: "no_one",
            who_can_tag: "everyone",
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
