import { expect, test } from "bun:test"

import { VERIFICATION_REQUESTS_PATH, VERIFICATION_TYPES, verificationRequestBody } from "@/hooks/useTrust"

test("verification submits to the routed trust-safety path, not /v1/trust/verification (T-09)", () => {
    expect(VERIFICATION_REQUESTS_PATH).toBe("/v1/verification-requests")
})

test("the body is { type, docs } with a type trust-safety accepts", () => {
    expect(verificationRequestBody("business")).toEqual({ type: "business", docs: {} })
    // validVerificationTypes in trust-safety internal/service/trust_extras.go
    expect([...VERIFICATION_TYPES]).toEqual(["creator", "business", "organization", "government"])
})
