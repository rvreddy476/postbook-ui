import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
    KEYWORD_FILTERS_PATH,
    MAX_FEED_KEYWORDS,
    addFeedKeyword,
    feedKeywordCountText,
    keywordFiltersRequest,
    keywordFiltersSaveError,
    normaliseFeedKeyword,
    parseKeywordFilters,
    removeFeedKeyword,
} from "../_lib/keywordFilters"

const appDir = resolve(import.meta.dir, "../..")

describe("filter keywords: decoder", () => {
    test("reads trust-safety's { data: { keywords } }", () => {
        expect(parseKeywordFilters({ data: { keywords: ["spoiler", "tag"] } })).toEqual(["spoiler", "tag"])
        expect(parseKeywordFilters({ data: { keywords: [] } })).toEqual([])
        expect(parseKeywordFilters({ data: { keywords: null } })).toEqual([])
        expect(parseKeywordFilters({ data: { keywords: ["ok", 3, null] } })).toEqual(["ok"])
    })

    test("refuses anything else, so an empty list is never saved over the real one", () => {
        expect(parseKeywordFilters(undefined)).toBeNull()
        expect(parseKeywordFilters({ keywords: ["a"] })).toBeNull()
        expect(parseKeywordFilters({ data: null })).toBeNull()
        expect(parseKeywordFilters({ data: ["a"] })).toBeNull()
        expect(parseKeywordFilters({ data: { keywords: "a" } })).toBeNull()
        expect(parseKeywordFilters({ data: {} })).toBeNull()
    })
})

describe("filter keywords: the server's normalisation", () => {
    test("trim, one leading #, lower-case, inner whitespace collapsed", () => {
        expect(normaliseFeedKeyword("  #Travel  ")).toBe("travel")
        expect(normaliseFeedKeyword("##two")).toBe("#two")
        expect(normaliseFeedKeyword("# Big   Game ")).toBe("big game")
    })

    test("add: normalised, refused when empty, too long, a control character, a repeat, or over 50", () => {
        expect(addFeedKeyword([], " #Spoiler ")).toEqual({ ok: true, list: ["spoiler"], word: "spoiler" })
        expect(addFeedKeyword([], "  #  ")).toEqual({ ok: false, problem: "EMPTY" })
        expect(addFeedKeyword([], "x".repeat(40)).ok).toBe(true)
        expect(addFeedKeyword([], "x".repeat(41))).toEqual({ ok: false, problem: "TOO_LONG" })
        // Characters, not UTF-16 units: 40 emoji fit.
        expect(addFeedKeyword([], "😀".repeat(40)).ok).toBe(true)
        // The server measures before inner spaces collapse.
        expect(addFeedKeyword([], `a${" ".repeat(39)}b`)).toEqual({ ok: false, problem: "TOO_LONG" })
        expect(addFeedKeyword([], "a\tb")).toEqual({ ok: false, problem: "INVALID" })
        expect(addFeedKeyword(["spoiler"], "#SPOILER")).toEqual({ ok: false, problem: "DUPLICATE" })
        const full = Array.from({ length: MAX_FEED_KEYWORDS }, (_, i) => `w${i}`)
        expect(addFeedKeyword(full, "one more")).toEqual({ ok: false, problem: "TOO_MANY" })
        expect(addFeedKeyword(full.slice(1), "one more").ok).toBe(true)
    })

    test("remove and count", () => {
        expect(removeFeedKeyword(["a", "b", "c"], "b")).toEqual(["a", "c"])
        expect(feedKeywordCountText(["a", "b"])).toBe("2/50")
    })
})

describe("filter keywords: the save request", () => {
    test("a PUT of the WHOLE list to trust-safety's path", () => {
        expect(KEYWORD_FILTERS_PATH).toBe("/v1/users/me/keyword-filters")
        expect(keywordFiltersRequest(["a"], ["a", "b"])).toEqual({ method: "put", url: "/v1/users/me/keyword-filters", body: { keywords: ["a", "b"] } })
    })

    test("clearing the list sends [], never nothing", () => {
        expect(keywordFiltersRequest(["a"], [])).toEqual({ method: "put", url: KEYWORD_FILTERS_PATH, body: { keywords: [] } })
    })

    test("an unchanged list sends no request; order counts as a change", () => {
        expect(keywordFiltersRequest(["a", "b"], ["a", "b"])).toBeNull()
        expect(keywordFiltersRequest(["a", "b"], ["b", "a"])).not.toBeNull()
    })

    test("the body is a copy: editing the draft later cannot change a sent request", () => {
        const draft = ["a"]
        const req = keywordFiltersRequest([], draft)!
        draft.push("b")
        expect(req.body.keywords).toEqual(["a"])
    })

    test("400s in plain words", () => {
        const err = (code: string) => ({ response: { status: 400, data: { error: { code, message: "x" } } } })
        expect(keywordFiltersSaveError(err("TOO_MANY_KEYWORDS"))).toContain("50")
        expect(keywordFiltersSaveError(err("INVALID_KEYWORD"))).toContain("can't be used")
        expect(keywordFiltersSaveError(new Error("Network Error"))).toBe("Could not save your filter words. Please try again.")
    })
})

describe("filter keywords: wiring", () => {
    test("the page reads and writes through the decoder and the request builder; the privacy page links it", () => {
        const page = readFileSync(resolve(appDir, "settings/keyword-filters/page.tsx"), "utf8")
        expect(page).toContain("parseKeywordFilters(res.data)")
        expect(page).toContain("keywordFiltersRequest(saved, next)")
        expect(page).toContain("api.put(req.url, req.body)")
        const privacy = readFileSync(resolve(appDir, "settings/privacy/page.tsx"), "utf8")
        expect(privacy).toContain('href="/settings/keyword-filters"')
    })

    test("the privacy page draws the last-seen and profile-photo controls from the form", () => {
        const privacy = readFileSync(resolve(appDir, "settings/privacy/page.tsx"), "utf8")
        expect(privacy).toContain('set("lastSeen"')
        expect(privacy).toContain('set("profilePhoto"')
        expect(privacy).toContain("LAST_SEEN_OPTIONS.map")
        expect(privacy).toContain("PROFILE_PHOTO_OPTIONS.map")
    })
})
