/**
 * One rule for every settings page: "Saved" is shown only for a 2xx.
 *
 * Several pages used to toast "Saved!" after a request that was never sent,
 * or that the server answered with an error the page swallowed. A settings
 * confirmation is a claim about what the server now enforces, so it is made
 * only when the server said so, and the server's own reason is shown when it
 * did not.
 */

export interface ServerError {
    status?: number
    code?: string
    message: string
}

export type SaveResult<T> =
    | { ok: true; data: T }
    | ({ ok: false } & ServerError)

export const GENERIC_SAVE_ERROR = "Could not save. Please try again."

interface ErrorLike {
    response?: {
        status?: number
        data?: unknown
    }
    message?: string
}

/**
 * The server's error, as the shared `api.Error` envelope carries it:
 * `{ "error": { "code": "...", "message": "..." } }`. Falls back to a generic
 * message when there is no response (network failure) or no body.
 */
export function serverError(err: unknown, fallback = GENERIC_SAVE_ERROR): ServerError {
    const e = (err ?? {}) as ErrorLike
    const status = e.response?.status
    const body = e.response?.data as
        | { error?: { code?: unknown; message?: unknown }; message?: unknown }
        | undefined
    const code = typeof body?.error?.code === "string" ? body.error.code : undefined
    const nested = typeof body?.error?.message === "string" ? body.error.message.trim() : ""
    const flat = typeof body?.message === "string" ? body.message.trim() : ""
    return { status, code, message: nested || flat || fallback }
}

/**
 * Normalise anything a mutation threw: an axios error (read its envelope), a
 * ServerError a hook already built, or a plain Error.
 */
export function asServerError(err: unknown): ServerError {
    if (err && typeof err === "object" && "response" in err) return serverError(err)
    const e = (err ?? {}) as { status?: unknown; code?: unknown; message?: unknown }
    return {
        status: typeof e.status === "number" ? e.status : undefined,
        code: typeof e.code === "string" ? e.code : undefined,
        message: typeof e.message === "string" && e.message.trim() ? e.message : GENERIC_SAVE_ERROR,
    }
}

/** A failed SaveResult from whatever was thrown. */
export function failedSave(err: unknown): { ok: false } & ServerError {
    return { ok: false, ...asServerError(err) }
}

/** A minimal view of an axios response: the status is all that decides success. */
export interface HttpResponseLike<T> {
    status: number
    data: T
}

/**
 * Run a request and report success ONLY for a 2xx. axios rejects non-2xx by
 * default, but the check is made here too so a client configured with a
 * permissive `validateStatus` can never produce a false "Saved".
 */
export async function attemptSave<T>(request: () => Promise<HttpResponseLike<T>>): Promise<SaveResult<T>> {
    try {
        const res = await request()
        if (res.status >= 200 && res.status < 300) {
            return { ok: true, data: res.data }
        }
        return { ok: false, ...serverError({ response: res }) }
    } catch (err) {
        return { ok: false, ...serverError(err) }
    }
}

export interface Feedback {
    text: string
    isError: boolean
}

/** The toast a page shows for a save result. */
export function saveFeedback(result: SaveResult<unknown>, savedText = "Saved"): Feedback {
    return result.ok
        ? { text: savedText, isError: false }
        : { text: result.message, isError: true }
}

/** The `data` member of the standard `{ data: ... }` envelope, or the body itself. */
export function unwrapData<T>(body: unknown): T | undefined {
    if (body && typeof body === "object" && "data" in body) {
        return (body as { data?: T }).data
    }
    return body as T | undefined
}
