import api from "@/lib/api"

/*
  Resumable (multipart) upload: init → one POST per part → complete.

  Any size (founder, 2026-10-21: long video has no size limit). Three rules
  keep a multi-GB upload sound:

  - The server decides the part size. media-service returns chunk_size and
    total_parts from its chunk plan (5 MiB up to 64 MiB, at most 10,000
    parts); the client slices exactly that, never an assumed 5 MiB.
  - Nothing is buffered. Each part is `file.slice(start, end)`, a lazy view
    of the file on disk; the browser reads it only while sending that part.
  - A dropped connection costs one part. Each part is retried with
    exponential backoff, and progress is counted in bytes, so a retried part
    rolls back only its own share of the bar.
*/

/** Files at or above this size go up resumably; smaller ones in one presigned PUT. */
export const RESUMABLE_UPLOAD_THRESHOLD = 20 * 1024 * 1024 // 20 MB

/** Attempts per part, and the backoff between them: 1 s, 2 s, 4 s, 8 s (capped at 16 s), ±25 %. */
export const PART_MAX_ATTEMPTS = 5
const BACKOFF_BASE_MS = 1000
const BACKOFF_CAP_MS = 16000

/** Statuses a retry cannot fix; anything else (network, 5xx, a storage hiccup the service maps to 400) is tried again. */
const PERMANENT_STATUSES = new Set([401, 403, 404, 413])

export interface ResumablePlan {
    upload_id: string
    media_id: string
    chunk_size: number
    total_parts: number
}

/** What the loop needs from the network; the default is the app's axios client. Tests pass their own. */
export interface ResumableTransport {
    init(body: { file_type: "image" | "video"; mime_type: string; total_bytes: number }): Promise<ResumablePlan>
    part(uploadId: string, partNumber: number, chunk: Blob, onBytes: (loaded: number) => void): Promise<void>
    complete(uploadId: string): Promise<void>
}

export interface ResumableOptions {
    onProgress?: (pct: number) => void
    transport?: ResumableTransport
    maxAttempts?: number
    /** Waits between attempts; replaced in tests. */
    sleep?: (ms: number) => Promise<void>
}

const axiosTransport: ResumableTransport = {
    async init(body) {
        const res = await api.post<{ data: ResumablePlan }>("/v1/media/upload/resumable/init", body)
        return res.data.data
    },
    async part(uploadId, partNumber, chunk, onBytes) {
        await api.post(`/v1/media/upload/resumable/${uploadId}/chunk`, chunk, {
            params: { part_number: partNumber },
            headers: { "Content-Type": "application/octet-stream" },
            onUploadProgress: (e) => onBytes(e.loaded ?? 0),
        })
    },
    async complete(uploadId) {
        await api.post(`/v1/media/upload/resumable/${uploadId}/complete`)
    },
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function statusOf(err: unknown): number | null {
    const status = (err as { response?: { status?: unknown } } | null)?.response?.status
    return typeof status === "number" ? status : null
}

/** The wait before attempt `attempt + 1` (attempt is 1-based). */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
    const base = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** (attempt - 1))
    return Math.round(base * (0.75 + random() * 0.5))
}

/** The plan must cover the file exactly, or the object assembled at the end would be cut short. */
export function checkPlan(plan: ResumablePlan, size: number): void {
    const { chunk_size: chunk, total_parts: parts } = plan
    if (!Number.isInteger(chunk) || chunk <= 0 || !Number.isInteger(parts) || parts < 1 || Math.ceil(size / chunk) !== parts) {
        throw new Error(`The server's upload plan (${parts} parts of ${chunk} bytes) does not fit a ${size}-byte file.`)
    }
}

/** Is this the server telling a simple upload to go resumable (413 USE_RESUMABLE_UPLOAD)? */
export function isUseResumableUpload(err: unknown): boolean {
    const code = (err as { response?: { data?: { error?: { code?: unknown } } } } | null)?.response?.data?.error?.code
    return code === "USE_RESUMABLE_UPLOAD"
}

export async function uploadResumable(file: Blob & { type: string }, options: ResumableOptions = {}): Promise<string> {
    const transport = options.transport ?? axiosTransport
    const maxAttempts = Math.max(1, options.maxAttempts ?? PART_MAX_ATTEMPTS)
    const sleep = options.sleep ?? realSleep
    const total = file.size

    const plan = await transport.init({
        file_type: file.type.startsWith("video/") ? "video" : "image",
        mime_type: file.type,
        total_bytes: total,
    })
    checkPlan(plan, total)

    let done = 0
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

    for (let part = 1; part <= plan.total_parts; part++) {
        const start = (part - 1) * plan.chunk_size
        const end = Math.min(start + plan.chunk_size, total)
        const chunk = file.slice(start, end)
        const length = end - start
        for (let attempt = 1; ; attempt++) {
            try {
                await transport.part(plan.upload_id, part, chunk, (loaded) => report(Math.min(loaded, length)))
                break
            } catch (err) {
                report(0)
                const status = statusOf(err)
                if (attempt >= maxAttempts || (status !== null && PERMANENT_STATUSES.has(status))) throw err
                await sleep(backoffMs(attempt))
            }
        }
        done += length
        report(0)
    }

    await transport.complete(plan.upload_id)
    return plan.media_id
}
