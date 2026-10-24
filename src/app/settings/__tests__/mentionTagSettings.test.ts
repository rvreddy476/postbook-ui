import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
    MENTION_TAG_OPTIONS,
    mentionTagNarrowedText,
    narrowedByServer,
    parsePrivacySettings,
    privacyFormFromSettings,
    privacyPatch,
    type PrivacySettings,
} from "../_lib/privacySettings"
import { settingsSaveRequest } from "@/hooks/useMySettings"

/*
  Who can mention me / Who can tag me (identity user-service, 24 Oct 2026).

  Fixture: GET /v1/users/me/settings, { data: UserSettings }. The two fields
  are store/users.go:50-51 (json who_can_mention / who_can_tag); PUT takes
  them as updateSettingsRequest.WhoCanMention / WhoCanTag
  (internal/http/handler.go:243-245); the values are the "mention_tag" set,
  everyone | following | no_one (service/user.go:70-75). A minor or a Strict
  Privacy Mode account has everyone narrowed to following on save
  (applyStrictMode, service/user.go:245-267) and the handler echoes the
  stored record.
*/
const adult = {
    data: {
        user_id: "u1",
        account_visibility: "public",
        allow_comments_from: "everyone",
        who_can_message: "people_i_follow",
        who_can_send_connection_request: "everyone",
        who_can_see_read_receipts: "connections_only",
        who_can_see_last_seen: "connections_only",
        who_can_see_profile_photo: "everyone",
        auto_filter_abusive_content: false,
        who_can_mention: "everyone",
        who_can_tag: "everyone",
        strict_privacy_mode: false,
        under_18_mode: false,
    },
}

function parsed(over: Record<string, unknown> = {}): PrivacySettings {
    const s = parsePrivacySettings({ data: { ...adult.data, ...over } })
    if (!s) throw new Error("fixture did not parse")
    return s
}

describe("decoding who_can_mention / who_can_tag", () => {
    test("reads the server's values", () => {
        const s = parsed({ who_can_mention: "following", who_can_tag: "no_one" })
        expect(s.who_can_mention).toBe("following")
        expect(s.who_can_tag).toBe("no_one")
    })

    test("a missing field (an older user-service) or an unknown value is the column default, everyone", () => {
        const { who_can_mention: _m, who_can_tag: _t, ...older } = adult.data
        const s = parsePrivacySettings({ data: older })!
        expect(s.who_can_mention).toBe("everyone")
        expect(s.who_can_tag).toBe("everyone")
        const odd = parsed({ who_can_mention: "friends", who_can_tag: "connections_only" })
        expect(odd.who_can_mention).toBe("everyone")
        expect(odd.who_can_tag).toBe("everyone")
    })

    test("the options are exactly the server's set, and following says whose", () => {
        expect(MENTION_TAG_OPTIONS.map((o) => o.value)).toEqual(["everyone", "following", "no_one"])
        expect(MENTION_TAG_OPTIONS.find((o) => o.value === "following")?.label).toBe("People you follow")
    })
})

describe("saving", () => {
    test("an untouched form sends nothing", () => {
        const s = parsed()
        expect(privacyPatch(s, privacyFormFromSettings(s))).toEqual({})
    })

    test("mentions alone is a PUT of ONLY who_can_mention", () => {
        const s = parsed()
        const patch = privacyPatch(s, { ...privacyFormFromSettings(s), mentions: "following" })
        expect(patch).toEqual({ who_can_mention: "following" })
        expect(settingsSaveRequest(patch)).toEqual({ method: "put", url: "/v1/users/me/settings", body: { who_can_mention: "following" } })
    })

    test("tags alone is a PUT of ONLY who_can_tag", () => {
        const s = parsed()
        const patch = privacyPatch(s, { ...privacyFormFromSettings(s), tags: "no_one" })
        expect(patch).toEqual({ who_can_tag: "no_one" })
    })

    test("the two are separate fields: changing one never sends the other", () => {
        const s = parsed({ who_can_mention: "no_one", who_can_tag: "following" })
        const patch = privacyPatch(s, { ...privacyFormFromSettings(s), mentions: "everyone" })
        expect(patch).toEqual({ who_can_mention: "everyone" })
        expect("who_can_tag" in patch).toBe(false)
    })
})

describe("the server's value after a save", () => {
    test("a strict-mode account sent everyone is stored as following, and the page says so", () => {
        const sent = { who_can_mention: "everyone" as const }
        const stored = parsed({ who_can_mention: "following", strict_privacy_mode: true })
        expect(narrowedByServer(sent, stored)).toEqual(["who_can_mention"])
        expect(mentionTagNarrowedText(sent, stored)).toBe(
            "Your account has strict privacy protections, so mentions are set to People you follow.",
        )
        // The form is rebuilt from the stored record, not from what was sent.
        expect(privacyFormFromSettings(stored).mentions).toBe("following")
    })

    test("both narrowed, and tags alone", () => {
        const both = parsed({ who_can_mention: "following", who_can_tag: "following", under_18_mode: true })
        expect(mentionTagNarrowedText({ who_can_mention: "everyone", who_can_tag: "everyone" }, both)).toBe(
            "Your account has strict privacy protections, so mentions and tags are set to People you follow.",
        )
        expect(mentionTagNarrowedText({ who_can_tag: "everyone" }, parsed({ who_can_tag: "following" }))).toBe(
            "Your account has strict privacy protections, so tags are set to People you follow.",
        )
    })

    test("nothing to say when the server kept what was sent, or the field was not sent", () => {
        expect(mentionTagNarrowedText({ who_can_mention: "following" }, parsed({ who_can_mention: "following" }))).toBeNull()
        expect(mentionTagNarrowedText({}, parsed({ who_can_mention: "following" }))).toBeNull()
        // Another field the server changed is not a mention / tag sentence.
        expect(mentionTagNarrowedText({ who_can_see_last_seen: "everyone" }, parsed())).toBeNull()
        expect(narrowedByServer({ who_can_see_last_seen: "everyone" }, parsed())).toEqual(["who_can_see_last_seen"])
    })
})

describe("the Privacy page", () => {
    const page = readFileSync(resolve(import.meta.dir, "../privacy/page.tsx"), "utf8")

    test("has the two rows, saved like the other who_can_* rows", () => {
        expect(page).toContain('htmlFor="who-can-mention"')
        expect(page).toContain("Who can mention me")
        expect(page).toContain('htmlFor="who-can-tag"')
        expect(page).toContain("Who can tag me")
        expect(page).toContain('set("mentions", e.target.value as MentionTagAudience)')
        expect(page).toContain('set("tags", e.target.value as MentionTagAudience)')
        expect(page).toContain("MENTION_TAG_OPTIONS.map")
    })

    test("explains following, and shows the server's value after save", () => {
        expect(page).toContain("People you follow means the accounts you follow, not your followers.")
        expect(page).toContain("setForm(privacyFormFromSettings(stored))")
        expect(page).toContain("setNarrowed(mentionTagNarrowedText(patch, stored))")
    })
})
