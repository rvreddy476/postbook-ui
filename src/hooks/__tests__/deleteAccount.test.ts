import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios"

import api from "@/lib/api"
import { deleteAccountErrorMessage, deleteAccountRequest } from "@/hooks/useSecurity"

// Drive the REAL axios instance (interceptors included) through a fake
// adapter, so the test sees exactly what would go on the wire.
const realAdapter = api.defaults.adapter
const realFetch = globalThis.fetch
let sent: InternalAxiosRequestConfig[] = []

function respondWith(status: number, data: unknown): AxiosAdapter {
    return async (config) => {
        sent.push(config)
        const response = { status, statusText: String(status), headers: {}, config, data }
        if (status >= 200 && status < 300) return response
        const err = Object.assign(new Error(`Request failed with status code ${status}`), {
            isAxiosError: true,
            config,
            response,
        })
        throw err
    }
}

// A refresh that SUCCEEDS, so the axios 401 path would really retry if the
// delete request let it.
function fakeJwt(): string {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url")
    return `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "u1", exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`
}

beforeEach(() => {
    sent = []
    globalThis.fetch = (async () =>
        new Response(JSON.stringify({ access_token: fakeJwt() }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        })) as unknown as typeof fetch
})

afterEach(() => {
    api.defaults.adapter = realAdapter
    globalThis.fetch = realFetch
})

describe("delete account (T-05)", () => {
    test("the request is DELETE /v1/auth/account with { password } in the body", async () => {
        api.defaults.adapter = respondWith(200, {
            data: {
                account_status: "pending_deletion",
                scheduled_purge_date: "2026-11-13T10:00:00Z",
                cancel_by_logging_in: true,
            },
        })
        const { url, config } = deleteAccountRequest("hunter2")
        const res = await api.delete(url, config)

        expect(sent).toHaveLength(1)
        expect(sent[0].method).toBe("delete")
        expect(sent[0].url).toBe("/v1/auth/account")
        expect(JSON.parse(String(sent[0].data))).toEqual({ password: "hunter2" })
        expect(res.data.data.account_status).toBe("pending_deletion")
    })

    test("it never calls the retired DELETE /v1/users/me", () => {
        expect(deleteAccountRequest("x").url).not.toContain("/v1/users/me")
    })

    test("a wrong password (401 INVALID_PASSWORD) is sent once, not refreshed and retried", async () => {
        api.defaults.adapter = respondWith(401, {
            error: { code: "INVALID_PASSWORD", message: "The password you entered is incorrect" },
        })
        const { url, config } = deleteAccountRequest("wrong")
        let caught: unknown
        try {
            await api.delete(url, config)
        } catch (err) {
            caught = err
        }
        expect(sent).toHaveLength(1)
        expect(deleteAccountErrorMessage(caught)).toBe(
            "That password is incorrect. Your account has not been deleted.",
        )
    })

    test("control: without the opt-out the same 401 would be refreshed and resent", async () => {
        api.defaults.adapter = respondWith(401, {
            error: { code: "INVALID_PASSWORD", message: "The password you entered is incorrect" },
        })
        await api.delete("/v1/auth/account", { data: { password: "wrong" } }).catch(() => undefined)
        expect(sent).toHaveLength(2)
    })

    test("error copy for the other auth-service outcomes", () => {
        const err = (status: number, code: string, message = "") => ({
            response: { status, data: { error: { code, message } } },
        })
        expect(deleteAccountErrorMessage(err(401, "UNAUTHORIZED"))).toContain("session has expired")
        expect(deleteAccountErrorMessage(err(400, "INVALID_REQUEST"))).toBe("Enter your password to confirm.")
        expect(deleteAccountErrorMessage(err(409, "ACCOUNT_STATE_CONFLICT", "account is already pending deletion"))).toBe(
            "account is already pending deletion",
        )
        expect(deleteAccountErrorMessage(new Error("Network Error"))).toContain("Could not reach the server")
    })
})
