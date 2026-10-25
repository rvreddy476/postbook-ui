import { describe, expect, test } from "bun:test"

import { asServerError, attemptSave, failedSave, saveFeedback, serverError } from "../_lib/saveFeedback"

// The shared api.Error envelope: { "error": { "code", "message" } }.
function axiosError(status: number, code: string, message: string) {
    return { response: { status, data: { error: { code, message } } } }
}

describe("no 'Saved' without a 2xx", () => {
    test("a 200 shows Saved", async () => {
        const result = await attemptSave(async () => ({ status: 200, data: { ok: true } }))
        expect(saveFeedback(result)).toEqual({ text: "Saved", isError: false })
    })

    test("a rejected request shows the server's message, not Saved", async () => {
        const result = await attemptSave(async () => {
            throw axiosError(400, "INVALID_REQUEST", "invalid privacy setting: \"only_me\"")
        })
        const fb = saveFeedback(result)
        expect(fb.isError).toBe(true)
        expect(fb.text).toBe("invalid privacy setting: \"only_me\"")
        expect(fb.text).not.toContain("Saved")
    })

    test("a non-2xx that a permissive client resolved is still a failure", async () => {
        const result = await attemptSave(async () => ({
            status: 500,
            data: { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
        }))
        expect(result.ok).toBe(false)
        expect(saveFeedback(result)).toEqual({ text: "Internal server error", isError: true })
    })

    test("a network failure shows a generic error", async () => {
        const result = await attemptSave(async () => {
            throw new Error("Network Error")
        })
        expect(saveFeedback(result).isError).toBe(true)
        expect(saveFeedback(result).text).not.toContain("Saved")
    })
})

describe("server error extraction", () => {
    test("reads code, status and message from the envelope", () => {
        expect(serverError(axiosError(409, "ACCOUNT_STATE_CONFLICT", "already pending deletion"))).toEqual({
            status: 409,
            code: "ACCOUNT_STATE_CONFLICT",
            message: "already pending deletion",
        })
    })

    test("normalises a plain Error and a prebuilt ServerError", () => {
        expect(asServerError(new Error("boom")).message).toBe("boom")
        expect(asServerError({ status: 400, code: "X", message: "bad" })).toEqual({ status: 400, code: "X", message: "bad" })
        expect(failedSave(axiosError(400, "INVALID_PREFERENCES", "email_digest must be never, daily or weekly"))).toEqual({
            ok: false,
            status: 400,
            code: "INVALID_PREFERENCES",
            message: "email_digest must be never, daily or weekly",
        })
    })
})
