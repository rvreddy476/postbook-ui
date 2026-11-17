import { describe, expect, test } from "bun:test"

import {
    fingerprintOf,
    forgetUploadResume,
    localResumeStore,
    resumeRecordExpired,
    sameFile,
    uploadResumable,
    type ResumablePlan,
    type ResumableTransport,
    type ResumeRecord,
    type ResumeStore,
} from "@/lib/resumableUpload"

/* reels-39: resume after a reload; N-3 / lv-30: duration_ms at init. */

const MiB = 1024 * 1024
const noSleep = async () => {}

/** A File-shaped stand-in of any size with the fingerprint fields; slice() is recorded, never read. */
function namedFile(size: number, name = "holiday.mp4", lastModified = 1_700_000_000_000) {
    const slices: Array<[number, number]> = []
    const file = {
        size,
        type: "video/mp4",
        name,
        lastModified,
        slice(start: number, end: number) {
            slices.push([start, end])
            return { size: end - start, type: "" } as unknown as Blob
        },
    } as unknown as Blob & { type: string; name: string; lastModified: number }
    return { file, slices }
}

/** An in-memory media-service: init, parts, status and complete, holding the parts it was sent. */
function fakeServer(plan: ResumablePlan, opts: { total: number; status?: string; held?: number[]; statusError?: unknown; completeErrors?: unknown[] }) {
    const held = new Set(opts.held ?? [])
    const log: string[] = []
    const inits: unknown[] = []
    let state = opts.status ?? "uploading"
    const completeErrors = [...(opts.completeErrors ?? [])]
    const t: ResumableTransport = {
        async init(body) { inits.push(body); log.push("init"); return plan },
        async part(_id, part, chunk, onBytes) {
            log.push(`part ${part}`)
            onBytes(chunk.size)
            held.add(part)
            return { expires_at: `2026-11-20T00:00:0${part % 10}Z` }
        },
        async complete(id) {
            log.push(`complete ${id}`)
            const next = completeErrors.shift()
            if (next) throw next
            state = "completed"
        },
        async status(id) {
            log.push(`status ${id}`)
            if (opts.statusError) throw opts.statusError
            return {
                upload_id: plan.upload_id, media_id: plan.media_id, total_bytes: opts.total,
                chunk_size: plan.chunk_size, total_parts: plan.total_parts, status: state,
                expires_at: "2026-11-19T00:00:00Z", uploaded_parts: [...held].sort((a, b) => a - b),
            }
        },
    }
    return { t, log, inits, held }
}

function memoryStore(initial: ResumeRecord | null = null) {
    let value = initial
    const saves: ResumeRecord[] = []
    const store: ResumeStore = {
        load: () => value,
        save: (r) => { value = r; saves.push(r) },
        clear: () => { value = null },
    }
    return { store, saves, get: () => value }
}

function keptRecord(file: Blob & { type: string; name: string; lastModified: number }, over: Partial<ResumeRecord> = {}): ResumeRecord {
    return { v: 1, upload_id: "up-1", media_id: "med-1", chunk_size: 10 * MiB, total_parts: 4, draft_id: null, expires_at: null, saved_at: 0, file: fingerprintOf(file), ...over }
}

describe("resuming after a reload (reels-39)", () => {
    const plan = { upload_id: "up-1", media_id: "med-1", chunk_size: 10 * MiB, total_parts: 4 }
    const size = 35 * MiB

    test("a new upload keeps its session, sliding the expiry with each part, and forgets it on completion", async () => {
        const { file } = namedFile(size)
        const server = fakeServer(plan, { total: size })
        const mem = memoryStore()
        const id = await uploadResumable(file, { transport: server.t, sleep: noSleep, store: mem.store, draftId: "d-9" })
        expect(id).toBe("med-1")
        expect(mem.saves[0]).toMatchObject({
            v: 1, upload_id: "up-1", media_id: "med-1", chunk_size: 10 * MiB, total_parts: 4, draft_id: "d-9",
            file: { name: "holiday.mp4", size, last_modified: 1_700_000_000_000, type: "video/mp4" },
        })
        // Each accepted part moved the kept expiry to what the server said.
        expect(mem.saves.slice(1).map((r) => r.expires_at)).toEqual(["2026-11-20T00:00:01Z", "2026-11-20T00:00:02Z", "2026-11-20T00:00:03Z", "2026-11-20T00:00:04Z"])
        expect(mem.get()).toBeNull()
    })

    test("after a reload the same file sends only the parts the server does not hold, then completes", async () => {
        const first = namedFile(size)
        const server = fakeServer(plan, { total: size })
        const mem = memoryStore()
        // The first visit: parts 1 and 2 land, then the page goes away during part 3.
        const cut = { response: { status: 401 } }
        const dying: ResumableTransport = { ...server.t, async part(id, n, c, b) { if (n === 3) throw cut; return server.t.part(id, n, c, b) } }
        await expect(uploadResumable(first.file, { transport: dying, sleep: noSleep, store: mem.store })).rejects.toBe(cut)
        expect(mem.get()?.upload_id).toBe("up-1")

        // The reload: a new File object for the same file on disk, and a new store object over the same storage.
        server.log.length = 0
        const again = namedFile(size)
        const progress: number[] = []
        const id = await uploadResumable(again.file, { transport: server.t, sleep: noSleep, store: mem.store, onProgress: (p) => progress.push(p) })
        expect(id).toBe("med-1")
        expect(server.log).toEqual(["status up-1", "part 3", "part 4", "complete up-1"])
        expect(server.inits).toHaveLength(1)
        expect(again.slices).toEqual([[20 * MiB, 30 * MiB], [30 * MiB, size]])
        // Progress starts from what was already there, not 0 %.
        expect(progress[0]).toBe(Math.floor((20 / 35) * 100))
        expect(progress[progress.length - 1]).toBe(100)
        expect(mem.get()).toBeNull()
    })

    test("a different file (same name, another date) does not resume: a new session replaces the kept one", async () => {
        const server = fakeServer({ ...plan, upload_id: "up-2", media_id: "med-2" }, { total: size })
        const { file } = namedFile(size)
        const other = keptRecord(file, { file: { name: "holiday.mp4", size, last_modified: 1, type: "video/mp4" } })
        expect(sameFile(other, file)).toBe(false)
        expect(sameFile(keptRecord(file), file)).toBe(true)
        expect(sameFile(keptRecord(file), namedFile(size + 1).file)).toBe(false)
        const mem = memoryStore(other)
        expect(await uploadResumable(file, { transport: server.t, sleep: noSleep, store: mem.store })).toBe("med-2")
        expect(server.log[0]).toBe("init")
        expect(server.log.some((l) => l.startsWith("status"))).toBe(false)
    })

    for (const variant of ["status says expired", "status answers 410 UPLOAD_EXPIRED", "status answers 404"] as const) {
        test(`an expired session (${variant}) starts again from the beginning and says so`, async () => {
            const { file } = namedFile(size)
            const statusError =
                variant === "status answers 410 UPLOAD_EXPIRED" ? { response: { status: 410, data: { error: { code: "UPLOAD_EXPIRED" } } } }
                : variant === "status answers 404" ? { response: { status: 404 } }
                : undefined
            const server = fakeServer({ ...plan, upload_id: "up-new", media_id: "med-new" }, { total: size, status: "expired", statusError })
            const mem = memoryStore(keptRecord(file, { upload_id: "up-old", media_id: "med-old" }))
            const restarts: string[] = []
            const id = await uploadResumable(file, { transport: server.t, sleep: noSleep, store: mem.store, onRestart: (r) => restarts.push(r) })
            expect(id).toBe("med-new")
            expect(restarts).toEqual(["expired"])
            expect(server.log.slice(0, 2)).toEqual(["status up-old", "init"])
            expect(server.log.filter((l) => l.startsWith("part"))).toHaveLength(4)
        })
    }

    test("a session that completed meanwhile is confirmed and returns its media without sending a byte", async () => {
        const { file, slices } = namedFile(size)
        const server = fakeServer(plan, { total: size, status: "completed", held: [1, 2, 3, 4] })
        const mem = memoryStore(keptRecord(file))
        const progress: number[] = []
        expect(await uploadResumable(file, { transport: server.t, sleep: noSleep, store: mem.store, onProgress: (p) => progress.push(p) })).toBe("med-1")
        expect(server.log).toEqual(["status up-1", "complete up-1"])
        expect(slices).toHaveLength(0)
        expect(progress).toEqual([100])
        expect(mem.get()).toBeNull()
    })

    test("a status outage is not taken for an expired session: the kept upload survives for the next try", async () => {
        const { file } = namedFile(size)
        const outage = { response: { status: 500 } }
        const server = fakeServer(plan, { total: size, statusError: outage })
        const mem = memoryStore(keptRecord(file))
        await expect(uploadResumable(file, { transport: server.t, sleep: noSleep, store: mem.store })).rejects.toBe(outage)
        expect(server.inits).toHaveLength(0)
        expect(mem.get()?.upload_id).toBe("up-1")
    })

    test("409 UPLOAD_INCOMPLETE at complete re-reads the status, sends the missing part and completes", async () => {
        const { file } = namedFile(size)
        const incomplete = { response: { status: 409, data: { error: { code: "UPLOAD_INCOMPLETE" } } } }
        const server = fakeServer(plan, { total: size, completeErrors: [incomplete] })
        // The server lost part 2 after acknowledging it.
        const lossy: ResumableTransport = { ...server.t, async complete(id) { server.held.delete(2); return server.t.complete(id) } }
        expect(await uploadResumable(file, { transport: lossy, sleep: noSleep })).toBe("med-1")
        expect(server.log.slice(-4)).toEqual(["complete up-1", "status up-1", "part 2", "complete up-1"])
    })

    test("410 on a part forgets the kept session at once, so the next press starts clean", async () => {
        const { file } = namedFile(size)
        const server = fakeServer(plan, { total: size })
        const gone = { response: { status: 410, data: { error: { code: "UPLOAD_EXPIRED" } } } }
        const mem = memoryStore()
        let waits = 0
        await expect(uploadResumable(file, { transport: { ...server.t, async part() { throw gone } }, store: mem.store, sleep: async () => { waits++ } })).rejects.toBe(gone)
        expect(waits).toBe(0)
        expect(mem.get()).toBeNull()
    })

    test("a quota refusal (429) is not retried part by part, and the session is kept for later", async () => {
        const { file } = namedFile(size)
        const server = fakeServer(plan, { total: size })
        const quota = { response: { status: 429, data: { error: { code: "UPLOAD_QUOTA_EXCEEDED" } } } }
        const mem = memoryStore()
        let waits = 0
        await expect(uploadResumable(file, { transport: { ...server.t, async part() { throw quota } }, store: mem.store, sleep: async () => { waits++ } })).rejects.toBe(quota)
        expect(waits).toBe(0)
        expect(mem.get()?.upload_id).toBe("up-1")
    })
})

describe("duration_ms at init (N-3, lv-30)", () => {
    const plan = { upload_id: "u", media_id: "m", chunk_size: 10 * MiB, total_parts: 3 }

    test("the length the browser read goes with init, rounded up to whole ms", async () => {
        const { file } = namedFile(30 * MiB)
        const server = fakeServer(plan, { total: 30 * MiB })
        await uploadResumable(file, { transport: server.t, sleep: noSleep, durationMs: 14_400_000.4 })
        expect(server.inits).toEqual([{ file_type: "video", mime_type: "video/mp4", total_bytes: 30 * MiB, duration_ms: 14_400_001 }])
    })

    test("an unreadable length is left out rather than sent as 0", async () => {
        for (const durationMs of [null, undefined, 0, NaN, Infinity, -5]) {
            const { file } = namedFile(30 * MiB)
            const server = fakeServer(plan, { total: 30 * MiB })
            await uploadResumable(file, { transport: server.t, sleep: noSleep, durationMs })
            expect("duration_ms" in (server.inits[0] as object)).toBe(false)
        }
    })

    test("413 VIDEO_TOO_LONG at init stops the upload before any part is sent, and keeps nothing", async () => {
        const { file, slices } = namedFile(30 * MiB)
        const tooLong = { response: { status: 413, data: { error: { code: "VIDEO_TOO_LONG", details: { max_duration_seconds: 14400 } } } } }
        const mem = memoryStore()
        const t: ResumableTransport = {
            async init() { throw tooLong },
            async part() { throw new Error("no part may be sent") },
            async complete() { throw new Error("no complete") },
            async status() { throw new Error("no status") },
        }
        await expect(uploadResumable(file, { transport: t, sleep: noSleep, durationMs: 5 * 3600 * 1000, store: mem.store })).rejects.toBe(tooLong)
        expect(slices).toHaveLength(0)
        expect(mem.get()).toBeNull()
    })
})

describe("the browser store", () => {
    function fakeStorage(): Storage {
        const map = new Map<string, string>()
        return {
            get length() { return map.size },
            key: (i: number) => [...map.keys()][i] ?? null,
            getItem: (k: string) => map.get(k) ?? null,
            setItem: (k: string, v: string) => { map.set(k, v) },
            removeItem: (k: string) => { map.delete(k) },
            clear: () => map.clear(),
        }
    }
    const record: ResumeRecord = { v: 1, upload_id: "u", media_id: "m", chunk_size: 1, total_parts: 1, draft_id: null, expires_at: null, saved_at: 0, file: { name: "a.mp4", size: 1, last_modified: 1, type: "video/mp4" } }

    test("keeps one record per studio, survives a new store object (a reload), and is cleared at sign-out", () => {
        const s = fakeStorage()
        localResumeStore("long", () => s).save(record)
        localResumeStore("reel", () => s).save({ ...record, upload_id: "r" })
        s.setItem("unrelated", "x")
        expect(localResumeStore("long", () => s).load()?.upload_id).toBe("u")
        expect(localResumeStore("reel", () => s).load()?.upload_id).toBe("r")
        forgetUploadResume(() => s)
        expect(localResumeStore("long", () => s).load()).toBeNull()
        expect(localResumeStore("reel", () => s).load()).toBeNull()
        expect(s.getItem("unrelated")).toBe("x")
    })

    test("blocked or corrupt storage means no resume, never an error", () => {
        const throwing = (() => { throw new Error("SecurityError") }) as () => Storage
        const blocked = localResumeStore("long", throwing)
        expect(blocked.load()).toBeNull()
        expect(() => blocked.save(record)).not.toThrow()
        expect(() => blocked.clear()).not.toThrow()
        expect(() => forgetUploadResume(throwing)).not.toThrow()
        const s = fakeStorage()
        s.setItem("pb.upload-resume.v1:long", "{not json")
        expect(localResumeStore("long", () => s).load()).toBeNull()
        s.setItem("pb.upload-resume.v1:long", JSON.stringify({ v: 1, upload_id: "" }))
        expect(localResumeStore("long", () => s).load()).toBeNull()
    })

    test("a kept session past its own expiry reads as expired", () => {
        expect(resumeRecordExpired({ expires_at: "2026-11-18T00:00:00Z" }, Date.parse("2026-11-18T00:00:01Z"))).toBe(true)
        expect(resumeRecordExpired({ expires_at: "2026-11-18T00:00:00Z" }, Date.parse("2026-11-17T23:59:59Z"))).toBe(false)
        expect(resumeRecordExpired({ expires_at: null })).toBe(false)
    })
})
