import { describe, expect, test } from "bun:test"
import {
    digilockerTarget,
    lastAttemptFailed,
    personStep,
    returnParams,
    uploadMime,
    type PersonStatus,
} from "@/hooks/usePersonVerification"

const base: PersonStatus = { is_verified: false, verification_level: "", badge_flags: 0, attempt: null, next: "digilocker" }

describe("person verification", () => {
    test("the server's next picks the step; off wins", () => {
        expect(personStep(base, false)).toBe("digilocker")
        expect(personStep({ ...base, next: "selfie" }, false)).toBe("selfie")
        expect(personStep({ ...base, next: "" }, false)).toBe("done")
        expect(personStep(null, false)).toBe("digilocker")
        expect(personStep({ ...base, next: "" }, true)).toBe("off")
    })

    test("a refused attempt shows the try-again note only before a new start", () => {
        const refused = { id: "a", status: "refused", expires_at: "2026-11-15T00:00:00Z" }
        expect(lastAttemptFailed({ ...base, attempt: refused })).toBe(true)
        expect(lastAttemptFailed({ ...base, attempt: { ...refused, status: "started" } })).toBe(false)
        expect(lastAttemptFailed({ ...base, next: "selfie", attempt: refused })).toBe(false)
    })

    test("the return page needs both code and state", () => {
        expect(returnParams("?code=c%3A1&state=s")).toEqual({ code: "c:1", state: "s" })
        expect(returnParams("code=c")).toBeNull()
        expect(returnParams("?state=s&code=")).toBeNull()
    })

    test("test mode goes straight to our return page; DigiLocker is left alone", () => {
        expect(
            digilockerTarget("http://localhost:3000/settings/verification/person/return?code=mock-name%3AQQ&state=xyz"),
        ).toBe("/settings/verification/person/return?code=mock-name%3AQQ&state=xyz")
        const dl = "https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize?client_id=a&state=b"
        expect(digilockerTarget(dl)).toBe(dl)
        expect(digilockerTarget("http://x.test/settings/verification/person/return?code=only")).toBe(
            "http://x.test/settings/verification/person/return?code=only",
        )
    })

    test("the upload declares the recorder mime without codecs", () => {
        expect(uploadMime("video/mp4;codecs=avc1.42E01E")).toBe("video/mp4")
        expect(uploadMime("video/webm")).toBe("video/webm")
    })
})
