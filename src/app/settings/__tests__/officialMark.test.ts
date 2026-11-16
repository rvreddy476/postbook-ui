import { describe, expect, test } from "bun:test"
import {
    CERTIFICATE_ACCEPT,
    CERTIFICATE_MAX_BYTES,
    CERTIFICATE_WORDS,
    NO_CERTIFICATE,
    ORG_PATH,
    applicationBody,
    applicationComplete,
    canSubmitApplication,
    certificateRefusal,
    lastRefused,
    markWords,
    officialStep,
    postApplication,
    uploadCertificate,
    withCertificate,
    type Certificate,
    type OfficialApplication,
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

/* Registration certificate: official-marks console contract section 6. */

const form: OfficialApplication = {
    legalName: "Example Labs",
    kind: "gstin",
    number: "29ABCDE1234F1Z5",
    domain: "example.com",
    email: "ceo@example.com",
}

function pdf(size = 1024, type = "application/pdf", name = "gst.pdf"): File {
    // A File whose reported size is `size` without allocating it.
    const f = new File(["%PDF-"], name, { type })
    Object.defineProperty(f, "size", { value: size })
    return f
}

const codeStatus: OfficialStatus = { ...base, next: "email_code" }

describe("registration certificate", () => {
    test("the words are the contract's, verbatim", () => {
        expect(CERTIFICATE_WORDS).toEqual({
            label: "Registration certificate (optional)",
            help: "Upload your GST or incorporation certificate as a PDF, JPEG or PNG, up to 10 MB. With a certificate, a person on our team checks your application instead of the registry. This can take a few days.",
            upload: "Upload certificate",
            uploading: "Uploading…",
            remove: "Remove",
            wrongType: "Upload a PDF, JPEG or PNG.",
            tooBig: "The certificate must be 10 MB or smaller.",
            failed: "The certificate didn't upload. Check your connection and try again.",
        })
        expect(CERTIFICATE_ACCEPT).toBe("application/pdf,image/jpeg,image/png")
        expect(CERTIFICATE_MAX_BYTES).toBe(10_485_760)
    })

    test("a wrong type or an oversized file is refused and never uploaded", async () => {
        expect(certificateRefusal({ type: "application/pdf", size: CERTIFICATE_MAX_BYTES })).toBeNull()
        expect(certificateRefusal({ type: "image/png", size: 1 })).toBeNull()
        expect(certificateRefusal({ type: "image/jpeg", size: 1 })).toBeNull()
        expect(certificateRefusal({ type: "image/webp", size: 1 })).toBe("Upload a PDF, JPEG or PNG.")
        expect(certificateRefusal({ type: "", size: 1 })).toBe("Upload a PDF, JPEG or PNG.")
        expect(certificateRefusal({ type: "application/pdf", size: CERTIFICATE_MAX_BYTES + 1 })).toBe(
            "The certificate must be 10 MB or smaller.",
        )

        for (const file of [pdf(10, "application/zip", "a.zip"), pdf(CERTIFICATE_MAX_BYTES + 1)]) {
            let calls = 0
            const seen: Certificate[] = []
            const out = await uploadCertificate(file, (c) => seen.push(c), async () => {
                calls++
                return "m-1"
            })
            expect(calls).toBe(0)
            expect(out.state).toBe("error")
            expect(seen.map((c) => c.state)).toEqual(["error"])
            expect(withCertificate(form, out).documentMediaId).toBeUndefined()
        }
    })

    test("upload then submit carries document_media_id", async () => {
        const kinds: string[] = []
        const seen: Certificate[] = []
        const cert = await uploadCertificate(pdf(), (c) => seen.push(c), async (_f, kind) => {
            kinds.push(kind)
            // Submit is disabled while the upload is in flight.
            expect(canSubmitApplication(form, seen[seen.length - 1])).toBe(false)
            return "media-42"
        })
        expect(kinds).toEqual(["document"])
        expect(seen.map((c) => c.state)).toEqual(["uploading", "ready"])
        expect(cert).toEqual({ state: "ready", name: "gst.pdf", mediaId: "media-42" })
        expect(canSubmitApplication(form, cert)).toBe(true)

        const posts: { path: string; body: unknown }[] = []
        await postApplication(withCertificate(form, cert), async (path, body) => {
            posts.push({ path, body })
            return { data: { data: codeStatus } }
        })
        expect(posts).toEqual([
            {
                path: ORG_PATH,
                body: {
                    legal_name: "Example Labs",
                    gstin: "29ABCDE1234F1Z5",
                    official_domain: "example.com",
                    signatory_email: "ceo@example.com",
                    document_media_id: "media-42",
                },
            },
        ])
    })

    test("a failed upload never submits and carries no media id", async () => {
        const seen: Certificate[] = []
        const cert = await uploadCertificate(pdf(), (c) => seen.push(c), async () => {
            throw new Error("network")
        })
        expect(seen.map((c) => c.state)).toEqual(["uploading", "error"])
        expect(cert).toEqual({ state: "error", message: "The certificate didn't upload. Check your connection and try again." })
        // An empty id from the server is a failure too.
        expect((await uploadCertificate(pdf(), () => {}, async () => "")).state).toBe("error")
        expect(withCertificate(form, cert)).not.toHaveProperty("documentMediaId")
        expect(applicationBody(withCertificate(form, cert))).not.toHaveProperty("document_media_id")
    })

    test("Remove drops the certificate from the submit body", () => {
        const ready: Certificate = { state: "ready", name: "gst.pdf", mediaId: "media-42" }
        const attached = withCertificate(form, ready)
        expect(applicationBody(attached)).toHaveProperty("document_media_id", "media-42")
        // Remove sets the field back to none; an id left on the form is dropped too.
        const removed = withCertificate(attached, NO_CERTIFICATE)
        expect(removed).not.toHaveProperty("documentMediaId")
        expect(applicationBody(removed)).not.toHaveProperty("document_media_id")
        expect(canSubmitApplication(form, NO_CERTIFICATE)).toBe(true)
    })
})
