import { describe, expect, test } from "bun:test"

import { config as middlewareConfig } from "@/middleware"
import {
    PART_MAX_ATTEMPTS,
    RESUMABLE_UPLOAD_THRESHOLD,
    backoffMs,
    checkPlan,
    isUseResumableUpload,
    uploadResumable,
    type ResumablePlan,
    type ResumableTransport,
} from "@/lib/resumableUpload"

const MiB = 1024 * 1024

/** A Blob-shaped stand-in for a file of any size: slice() is recorded, never read. */
function fakeFile(size: number, type = "video/mp4") {
    const slices: Array<[number, number]> = []
    return {
        slices,
        file: {
            size,
            type,
            slice(start: number, end: number) {
                slices.push([start, end])
                return { size: end - start, type: "" } as unknown as Blob
            },
        } as unknown as Blob & { type: string },
    }
}

function transport(plan: ResumablePlan, failures: Record<number, unknown[]> = {}) {
    const sent: Array<{ part: number; size: number }> = []
    const calls = { init: [] as unknown[], complete: 0 }
    const t: ResumableTransport = {
        async init(body) { calls.init.push(body); return plan },
        async part(_id, part, chunk, onBytes) {
            const queue = failures[part]
            if (queue && queue.length) throw queue.shift()
            onBytes(Math.floor(chunk.size / 2))
            onBytes(chunk.size)
            sent.push({ part, size: chunk.size })
        },
        async complete() { calls.complete++ },
    }
    return { t, sent, calls }
}

const noSleep = async () => {}

describe("resumable upload uses the server's plan, any size", () => {
    test("the threshold for going resumable is still 20 MB", () => {
        expect(RESUMABLE_UPLOAD_THRESHOLD).toBe(20 * MiB)
    })

    test("a 3 GB long video is sliced in the server's 64 MiB parts, never 5 MiB, with no buffering", async () => {
        const size = 3 * 1024 * MiB + 123
        const chunk = 64 * MiB
        const parts = Math.ceil(size / chunk)
        const { file, slices } = fakeFile(size)
        const { t, sent, calls } = transport({ upload_id: "u", media_id: "m", chunk_size: chunk, total_parts: parts })
        const progress: number[] = []
        const id = await uploadResumable(file, { transport: t, sleep: noSleep, onProgress: (p) => progress.push(p) })
        expect(id).toBe("m")
        expect(calls.init).toEqual([{ file_type: "video", mime_type: "video/mp4", total_bytes: size }])
        expect(sent).toHaveLength(parts)
        expect(slices[0]).toEqual([0, chunk])
        expect(slices[1]).toEqual([chunk, 2 * chunk])
        expect(slices[parts - 1]).toEqual([(parts - 1) * chunk, size])
        expect(sent.reduce((n, s) => n + s.size, 0)).toBe(size)
        expect(calls.complete).toBe(1)
        // Byte-based and monotonic when nothing fails, ending at 100.
        expect(progress[progress.length - 1]).toBe(100)
        for (let i = 1; i < progress.length; i++) expect(progress[i]).toBeGreaterThan(progress[i - 1])
        // Mid-part progress is reported, not only whole parts.
        expect(progress.length).toBeGreaterThan(parts)
    })

    test("a plan that does not cover the file is refused before any bytes move", async () => {
        const { file } = fakeFile(100 * MiB)
        const { t, sent } = transport({ upload_id: "u", media_id: "m", chunk_size: 5 * MiB, total_parts: 3 })
        await expect(uploadResumable(file, { transport: t, sleep: noSleep })).rejects.toThrow("upload plan")
        expect(sent).toHaveLength(0)
        expect(() => checkPlan({ upload_id: "u", media_id: "m", chunk_size: 0, total_parts: 1 }, 10)).toThrow()
        expect(() => checkPlan({ upload_id: "u", media_id: "m", chunk_size: 5 * MiB, total_parts: 20 }, 100 * MiB)).not.toThrow()
    })
})

describe("per-part retry with backoff", () => {
    test("a part that fails four times is re-sent alone and the upload completes", async () => {
        const { file } = fakeFile(30 * MiB)
        const netErr = new Error("Network Error")
        const { t, sent, calls } = transport(
            { upload_id: "u", media_id: "m", chunk_size: 10 * MiB, total_parts: 3 },
            { 2: [netErr, netErr, netErr, { response: { status: 502 } }] },
        )
        const waits: number[] = []
        await uploadResumable(file, { transport: t, sleep: async (ms) => { waits.push(ms) } })
        expect(sent.map((s) => s.part)).toEqual([1, 2, 3])
        expect(waits).toHaveLength(4)
        expect(calls.complete).toBe(1)
    })

    test(`gives up after ${PART_MAX_ATTEMPTS} attempts`, async () => {
        const { file } = fakeFile(30 * MiB)
        const err = { response: { status: 503 } }
        const { t, calls } = transport(
            { upload_id: "u", media_id: "m", chunk_size: 10 * MiB, total_parts: 3 },
            { 1: Array(PART_MAX_ATTEMPTS).fill(err) },
        )
        let waits = 0
        await expect(uploadResumable(file, { transport: t, sleep: async () => { waits++ } })).rejects.toBe(err)
        expect(waits).toBe(PART_MAX_ATTEMPTS - 1)
        expect(calls.complete).toBe(0)
    })

    test("a permanent refusal (403) is not retried", async () => {
        const { file } = fakeFile(30 * MiB)
        const err = { response: { status: 403 } }
        const { t } = transport({ upload_id: "u", media_id: "m", chunk_size: 10 * MiB, total_parts: 3 }, { 1: [err] })
        let waits = 0
        await expect(uploadResumable(file, { transport: t, sleep: async () => { waits++ } })).rejects.toBe(err)
        expect(waits).toBe(0)
    })

    test("backoff doubles from 1 s and is capped at 16 s (±25 %)", () => {
        const mid = () => 0.5
        expect([1, 2, 3, 4, 5, 6].map((a) => backoffMs(a, mid))).toEqual([1000, 2000, 4000, 8000, 16000, 16000])
        expect(backoffMs(1, () => 0)).toBe(750)
        expect(backoffMs(1, () => 1)).toBe(1250)
    })
})

describe("the simple path's 413 hand-off", () => {
    test("USE_RESUMABLE_UPLOAD is recognised by its code; other errors are not", () => {
        expect(isUseResumableUpload({ response: { status: 413, data: { error: { code: "USE_RESUMABLE_UPLOAD", message: "x" } } } })).toBe(true)
        expect(isUseResumableUpload({ response: { status: 413, data: { error: { code: "FILE_TOO_LARGE" } } } })).toBe(false)
        expect(isUseResumableUpload(new Error("boom"))).toBe(false)
        expect(isUseResumableUpload(null)).toBe(false)
    })
})

describe("the proxy hop does not cap a part's body", () => {
    // proxyClientMaxBodySize (10 MB) truncates bodies only where the middleware
    // runs; upload parts go through /v1/... → /api/proxy/..., which it must skip.
    const matcher = new RegExp(`^${(middlewareConfig.matcher as string[])[0]}$`)
    test("the middleware matcher skips /v1/ and /api/", () => {
        expect(matcher.test("/v1/media/upload/resumable/abc/chunk")).toBe(false)
        expect(matcher.test("/api/proxy/media/upload/resumable/abc/chunk")).toBe(false)
        expect(matcher.test("/reels/create")).toBe(true)
    })
})
