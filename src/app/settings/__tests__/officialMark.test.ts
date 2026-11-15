import { describe, expect, test } from "bun:test"
import {
    applicationBody,
    applicationComplete,
    lastRefused,
    markWords,
    officialStep,
    type OfficialStatus,
} from "@/hooks/useOfficialMark"

const base: OfficialStatus = {
    is_verified: true,
    verification_level: "person",
    badge_flags: 1,
    organisation_name: "",
    next: "apply",
}

describe("official mark", () => {
    test("the server's next picks the step; off wins", () => {
        expect(officialStep(base, false)).toBe("apply")
        expect(officialStep({ ...base, next: "email_code" }, false)).toBe("email_code")
        expect(officialStep({ ...base, next: "review" }, false)).toBe("review")
        expect(officialStep({ ...base, next: "" }, false)).toBe("done")
        expect(officialStep(null, false)).toBe("apply")
        expect(officialStep({ ...base, next: "" }, true)).toBe("off")
    })

    test("a refused or rejected last application shows the note only on the form", () => {
        expect(lastRefused({ ...base, status: "refused" })).toBe(true)
        expect(lastRefused({ ...base, status: "rejected" })).toBe(true)
        expect(lastRefused({ ...base, status: "superseded" })).toBe(false)
        expect(lastRefused({ ...base, status: "refused", next: "email_code" })).toBe(false)
    })

    test("the body sends exactly one registration, upper-cased, and a lower-case domain", () => {
        const a = { legalName: " Example Labs ", kind: "gstin" as const, number: "29abcde1234f1z5 ", domain: "Example.COM", email: " ceo@example.com " }
        expect(applicationBody(a)).toEqual({
            legal_name: "Example Labs",
            gstin: "29ABCDE1234F1Z5",
            official_domain: "example.com",
            signatory_email: "ceo@example.com",
        })
        const cin = applicationBody({ ...a, kind: "cin", number: "u72200ka2020ptc123456" })
        expect(cin).toHaveProperty("cin", "U72200KA2020PTC123456")
        expect(cin).not.toHaveProperty("gstin")
        expect(applicationComplete(a)).toBe(true)
        expect(applicationComplete({ ...a, domain: "  " })).toBe(false)
    })

    test("the done card names the mark", () => {
        expect(markWords({ ...base, next: "", verification_level: "organisation", organisation_name: "Example Labs" })).toEqual({
            heading: "Official mark",
            line: "Example Labs holds the Official mark.",
        })
        expect(markWords({ ...base, next: "", verification_level: "government", organisation_name: "Ministry X" }).heading).toBe(
            "Government mark",
        )
    })
})
