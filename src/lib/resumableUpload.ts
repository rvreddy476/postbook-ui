import api from "@/lib/api"

/*
  Resumable (multipart) upload: init → one POST per part → complete, and
  status to pick an unfinished one up again (reels-39).

  Any size (founder, 2026-10-21: long video has no size limit). The rules
  that keep a multi-GB upload sound:

  - The server decides the part size. media-service returns chunk_size and
    total_parts from its chunk plan; the client slices exactly that, never
    an assumed 5 MiB.
  - Nothing is buffered. Each part is `file.slice(start, end)`, a lazy view
    of the file on disk; the browser reads it only while sending that part.
  - A dropped connection costs one part. Each part is retried with
    exponential backoff, and progress is counted in bytes, so a retried part
    rolls back only its own share of the bar.
  - A reload costs nothing already sent. The session (upload id, media id,
    plan, the file's name + size + lastModified) is kept in a ResumeStore. A
    File cannot survive a reload, so the creator chooses the same file
    again; the status call lists the parts the server holds and only the
    missing ones are sent. A session that expired (410 UPLOAD_EXPIRED, or
    status "expired") starts again from the beginning, and onRestart says so.
  - The video's length goes with init (`duration_ms`) when it is known, so
    an over-long file is refused (413 VIDEO_TOO_LONG) before any bytes move.

  media-service internal/http/resumable_handler.go:
    POST /v1/media/upload/resumable/init        {file_type, mime_type, total_bytes, duration_ms?}
         → {upload_id, media_id, chunk_size, total_parts, expires_at}
    POST /v1/media/upload/resumable/:id/chunk?part_number=n   raw bytes
         → {upload_id, part_number, uploaded_bytes, total_bytes, all_parts_in, expires_at}
    GET  /v1/media/upload/resumable/:id
         → {upload_id, media_id, total_bytes, uploaded_bytes, chunk_size, total_parts,
            status, mime_type, expires_at, uploaded_parts: [n...]}
    POST /v1/media/upload/resumable/:id/complete  (idempotent once completed)
*/

/** Files at or above this size go up resumably; smaller ones in one presigned PUT. */
export const RESUMABLE_UPLOAD_THRESHOLD = 20 * 1024 * 1024 // 20 MB

/** Attempts per part, and the backoff between them: 1 s, 2 s, 4 s, 8 s (capped at 16 s), ±25 %. */
export const PART_MAX_ATTEMPTS = 5
const BACKOFF_BASE_MS = 1000
const BACKOFF_CAP_MS = 16000

/**
 * Statuses a retry of the same part cannot fix: auth, a session that is
 * gone (404, 410), out of order (409), too big or too long (413), and a
 * quota or rate refusal (429, which carries a Retry-After far longer than
 * the backoff). Anything else (network, 5xx, a storage hiccup the service
 * maps to 400, 503 UPLOAD_LIMITER_UNAVAILABLE) is tried again.
 */
const PERMANENT_STATUSES = new Set([401, 403, 404, 409, 410, 413, 429])

export interface ResumablePlan {
    upload_id: string
    media_id: string
    chunk_size: number
    total_parts: number
    expires_at?: string
}

/** GET /v1/media/upload/resumable/:id */
export interface ResumableStatus {
    upload_id: string
    media_id: string
    total_bytes: number
    uploaded_bytes?: number
    chunk_size: number
    total_parts: number
    /** initiated | uploading | completed | expired | aborted */
    status: string
    expires_at?: string
    uploaded_parts?: number[] | null
}

export interface ResumableInitBody {
    file_type: "image" | "video"
    mime_type: string
    total_bytes: number
    /** The video's length as the browser read it; omitted when it could not be read. */
    duration_ms?: number
}

/** What the loop needs from the network; the default is the app's axios client. Tests pass their own. */
export interface ResumableTransport {
    init(body: ResumableInitBody): Promise<ResumablePlan>
    part(uploadId: string, partNumber: number, chunk: Blob, onBytes: (loaded: number) => void): Promise<{ expires_at?: string } | void>
    complete(uploadId: string): Promise<void>
    status(uploadId: string): Promise<ResumableStatus>
}

/* ── What is kept across a reload ─────────────────────────── */

/** The file a session belongs to. Name, size and lastModified: what a re-chosen File can be checked against. */
export interface FileFingerprint {
    name: string
    size: number
    last_modified: number
    type: string
}

export interface ResumeRecord {
    v: 1
    upload_id: string
    media_id: string
    chunk_size: number
    total_parts: number
    file: FileFingerprint
    /** The studio draft the upload belongs to, when one exists already. */
    draft_id: string | null
    /** The session's expiry as the server last said it (it slides with each part). */
    expires_at: string | null
    saved_at: number
}

/** Where a ResumeRecord lives. Every method is best-effort and never throws. */
export interface ResumeStore {
    load(): ResumeRecord | null
    save(record: ResumeRecord): void
    clear(): void
}

export type RestartReason = "expired"

export interface ResumableOptions {
    onProgress?: (pct: number) => void
    transport?: ResumableTransport
    maxAttempts?: number
    /** Waits between attempts; replaced in tests. */
    sleep?: (ms: number) => Promise<void>
    /** The video's length in ms, sent at init; null/undefined/non-positive is left out. */
    durationMs?: number | null
    /** Keeps the session so a reload can resume it. */
    store?: ResumeStore | null
    /** The draft this upload belongs to, kept in the record. */
    draftId?: string | null
    /** Called when a kept session could not be resumed and the upload starts again from 0. */
    onRestart?: (reason: RestartReason) => void
}

const axiosTransport: ResumableTransport = {
    async init(body) {
        const res = await api.post<{ data: ResumablePlan }>("/v1/media/upload/resumable/init", body)
        return res.data.data
    },
    async part(uploadId, partNumber, chunk, onBytes) {
        const res = await api.post<{ data?: { expires_at?: string } }>(`/v1/media/upload/resumable/${uploadId}/chunk`, chunk, {
            params: { part_number: partNumber },
            headers: { "Content-Type": "application/octet-stream" },
            onUploadProgress: (e) => onBytes(e.loaded ?? 0),
        })
        return res?.data?.data ?? undefined
    },
    async complete(uploadId) {
        await api.post(`/v1/media/upload/resumable/${uploadId}/complete`)
    },
    async status(uploadId) {
        const res = await api.get<{ data: ResumableStatus }>(`/v1/media/upload/resumable/${uploadId}`)
        return res.data.data
    },
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function statusOf(err: unknown): number | null {
    const status = (err as { response?: { status?: unknown } } | null)?.response?.status
    return typeof status === "number" ? status : null
}

function codeOf(err: unknown): string | null {
    const code = (err as { response?: { data?: { error?: { code?: unknown } } } } | null)?.response?.data?.error?.code
    return typeof code === "string" ? code : null
}

/** The wait before attempt `attempt + 1` (attempt is 1-based). */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
    const base = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** (attempt - 1))
    return Math.round(base * (0.75 + random() * 0.5))
}

/** The plan must cover the file exactly, or the object assembled at the end would be cut short. */
export function checkPlan(plan: Pick<ResumablePlan, "chunk_size" | "total_parts">, size: number): void {
    const { chunk_size: chunk, total_parts: parts } = plan
    if (!Number.isInteger(chunk) || chunk <= 0 || !Number.isInteger(parts) || parts < 1 || Math.ceil(size / chunk) !== parts) {
        throw new Error(`The server's upload plan (${parts} parts of ${chunk} bytes) does not fit a ${size}-byte file.`)
    }
}

/** Is this the server telling a simple upload to go resumable (413 USE_RESUMABLE_UPLOAD)? */
export function isUseResumableUpload(err: unknown): boolean {
    return codeOf(err) === "USE_RESUMABLE_UPLOAD"
}

/** A whole number of milliseconds for init, or undefined when the length is unknown. */
export function durationMsField(durationMs: number | null | undefined): number | undefined {
    return typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0 ? Math.ceil(durationMs) : undefined
}

/** The fingerprint of a File (or a File-shaped Blob). */
export function fingerprintOf(file: Blob & { type: string; name?: string; lastModified?: number }): FileFingerprint {
    return {
        name: typeof file.name === "string" ? file.name : "",
        size: file.size,
        last_modified: typeof file.lastModified === "number" ? file.lastModified : 0,
        type: file.type,
    }
}

/** Is this the same file the record was made for? Name, size and lastModified must all agree. */
export function sameFile(record: Pick<ResumeRecord, "file">, file: Blob & { type: string; name?: string; lastModified?: number }): boolean {
    const f = fingerprintOf(file)
    return record.file.name === f.name && record.file.size === f.size && record.file.last_modified === f.last_modified
}

/** A session the server says can no longer take parts. */
function deadStatus(status: string): boolean {
    return status === "expired" || status === "aborted" || status === "failed"
}

export async function uploadResumable(
    file: Blob & { type: string; name?: string; lastModified?: number },
    options: ResumableOptions = {},
): Promise<string> {
    const transport = options.transport ?? axiosTransport
    const maxAttempts = Math.max(1, options.maxAttempts ?? PART_MAX_ATTEMPTS)
    const sleep = options.sleep ?? realSleep
    const store = options.store ?? null
    const total = file.size

    let plan: ResumablePlan | null = null
    let received = new Set<number>()
    let record: ResumeRecord | null = null

    const keep = (expiresAt: string | null | undefined) => {
        if (!store || !record) return
        if (expiresAt) record = { ...record, expires_at: expiresAt }
        record = { ...record, saved_at: Date.now() }
        store.save(record)
    }

    // 1. A session kept from before (a reload, or an earlier failed press): resume it when it is this file.
    const kept = store?.load() ?? null
    if (kept && sameFile(kept, file)) {
        let status: ResumableStatus | null = null
        let gone = false
        try {
            status = await transport.status(kept.upload_id)
        } catch (err) {
            const code = statusOf(err)
            // 404: unknown or someone else's; 410: expired. Anything else (network, 5xx) is not "gone": say it.
            if (code === 404 || code === 410) gone = true
            else throw err
        }
        if (status) {
            if (status.status === "completed") {
                // It finished meanwhile (the tab closed after complete). complete is idempotent and re-confirms.
                await transport.complete(status.upload_id)
                store?.clear()
                options.onProgress?.(100)
                return status.media_id
            }
            if (deadStatus(status.status) || status.total_bytes !== total || status.upload_id !== kept.upload_id) {
                gone = true
            } else {
                checkPlan(status, total)
                plan = { upload_id: status.upload_id, media_id: status.media_id, chunk_size: status.chunk_size, total_parts: status.total_parts }
                received = new Set((status.uploaded_parts ?? []).filter((n) => Number.isInteger(n)))
                record = { ...kept, chunk_size: status.chunk_size, total_parts: status.total_parts }
                keep(status.expires_at)
            }
        }
        if (gone) {
            store?.clear()
            options.onRestart?.("expired")
        }
    }

    // 2. A new session.
    if (!plan) {
        const body: ResumableInitBody = {
            file_type: file.type.startsWith("video/") ? "video" : "image",
            mime_type: file.type,
            total_bytes: total,
        }
        const durationMs = durationMsField(options.durationMs)
        if (durationMs !== undefined) body.duration_ms = durationMs
        plan = await transport.init(body)
        checkPlan(plan, total)
        if (store) {
            record = {
                v: 1,
                upload_id: plan.upload_id,
                media_id: plan.media_id,
                chunk_size: plan.chunk_size,
                total_parts: plan.total_parts,
                file: fingerprintOf(file),
                draft_id: options.draftId ?? null,
                expires_at: plan.expires_at ?? null,
                saved_at: Date.now(),
            }
            store.save(record)
        }
    }
    const session = plan

    const partLength = (part: number) => {
        const start = (part - 1) * session.chunk_size
        return Math.min(start + session.chunk_size, total) - start
    }

    let done = 0
    for (const part of received) if (part >= 1 && part <= session.total_parts) done += partLength(part)
    let reported = -1
    const report = (inFlight: number) => {
        if (!options.onProgress) return
        const pct = total > 0 ? Math.min(100, Math.floor(((done + inFlight) / total) * 100)) : 100
        if (pct !== reported) {
            reported = pct
            options.onProgress(pct)
        }
    }
    report(0)

    /** A refusal that means this session is finished with: forget it so the next press starts clean. */
    const forgetIfGone = (err: unknown) => {
        const code = statusOf(err)
        if (code === 404 || code === 410) store?.clear()
    }

    const sendMissing = async () => {
        for (let part = 1; part <= session.total_parts; part++) {
            if (received.has(part)) continue
            const start = (part - 1) * session.chunk_size
            const end = Math.min(start + session.chunk_size, total)
            const chunk = file.slice(start, end)
            const length = end - start
            for (let attempt = 1; ; attempt++) {
                try {
                    const res = await transport.part(session.upload_id, part, chunk, (loaded) => report(Math.min(loaded, length)))
                    keep(res && typeof res === "object" ? res.expires_at : undefined)
                    break
                } catch (err) {
                    report(0)
                    const status = statusOf(err)
                    if (attempt >= maxAttempts || (status !== null && PERMANENT_STATUSES.has(status))) {
                        forgetIfGone(err)
                        throw err
                    }
                    await sleep(backoffMs(attempt))
                }
            }
            received.add(part)
            done += length
            report(0)
        }
    }

    await sendMissing()

    // 3. Complete. 409 UPLOAD_INCOMPLETE: the server is missing a part we
    //    thought landed; read the status, send what is missing, once more.
    for (let round = 0; ; round++) {
        try {
            await transport.complete(session.upload_id)
            break
        } catch (err) {
            if (round === 0 && codeOf(err) === "UPLOAD_INCOMPLETE") {
                const status = await transport.status(session.upload_id)
                received = new Set(status.uploaded_parts ?? [])
                done = 0
                for (const part of received) if (part >= 1 && part <= session.total_parts) done += partLength(part)
                await sendMissing()
                continue
            }
            forgetIfGone(err)
            throw err
        }
    }
    store?.clear()
    return session.media_id
}

/* ── The browser's store ──────────────────────────────────── */

const RESUME_KEY_PREFIX = "pb.upload-resume.v1:"

function browserStorage(): Storage | null {
    try {
        return typeof localStorage === "undefined" ? null : localStorage
    } catch {
        return null
    }
}

function isRecord(value: unknown): value is ResumeRecord {
    if (!value || typeof value !== "object") return false
    const r = value as Partial<ResumeRecord>
    return r.v === 1 && typeof r.upload_id === "string" && !!r.upload_id && typeof r.media_id === "string" &&
        typeof r.chunk_size === "number" && typeof r.total_parts === "number" &&
        !!r.file && typeof r.file.name === "string" && typeof r.file.size === "number" && typeof r.file.last_modified === "number"
}

/**
 * A ResumeStore in localStorage under one key per scope (the studio:
 * "reel", "long", ...). Every access is wrapped: blocked storage (private
 * mode, a sandboxed frame) means no resume, never an error.
 */
export function localResumeStore(scope: string, storage: () => Storage | null = browserStorage): ResumeStore {
    const key = RESUME_KEY_PREFIX + scope
    return {
        load() {
            try {
                const raw = storage()?.getItem(key)
                if (!raw) return null
                const parsed: unknown = JSON.parse(raw)
                return isRecord(parsed) ? parsed : null
            } catch {
                return null
            }
        },
        save(record) {
            try { storage()?.setItem(key, JSON.stringify(record)) } catch { /* storage full or blocked: no resume */ }
        },
        clear() {
            try { storage()?.removeItem(key) } catch { /* blocked */ }
        },
    }
}

/** Sign-out: forget every kept upload session in this browser (a file name is personal). */
export function forgetUploadResume(storage: () => Storage | null = browserStorage): void {
    try {
        const s = storage()
        if (!s) return
        const keys: string[] = []
        for (let i = 0; i < s.length; i++) {
            const k = s.key(i)
            if (k && k.startsWith(RESUME_KEY_PREFIX)) keys.push(k)
        }
        for (const k of keys) s.removeItem(k)
    } catch { /* blocked */ }
}

/** Has a kept session's own expiry passed? (The server slides it with each part, up to 7 days.) */
export function resumeRecordExpired(record: Pick<ResumeRecord, "expires_at">, now: number = Date.now()): boolean {
    if (!record.expires_at) return false
    const at = Date.parse(record.expires_at)
    return Number.isFinite(at) && at <= now
}
