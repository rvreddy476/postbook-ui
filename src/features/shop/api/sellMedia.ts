// A file from the seller's disk to a media id commerce-service will accept:
// a product photograph, or a KYC document image.
//
//   1. POST /v1/media/init          -> {media_id, upload_url}
//   2. PUT  <upload_url>            direct to storage, exactly one header
//   3. POST /v1/media/confirm       queues processing; idempotent
//   4. GET  /v1/media/{id}/status   until ready AND passed
//
// Step 4 is not optional for a product image: commerce-service's gallery
// write verifies every id (ErrMediaNotReady / ErrMediaNotPassed → 409), and
// the seller documents write verifies ownership the same way.
//
// The app's own `src/lib/mediaUpload.ts` `uploadMedia` does steps 1-3 but
// takes no purpose and never polls; it is not used here so a document can
// carry `upload_purpose: "kyc"` (the contract's word — media-service today
// stores only `composer` and leaves any other purpose NULL, which is what
// keeps the asset out of the reclamation sweep) and so an image is only
// attached once media-service says ready.
//
// media-service accepts file_type image|video|audio only. There is no
// document type, so a KYC document must be a JPEG, PNG or WebP photograph or
// scan; a PDF has nowhere to go and the picker does not offer one.

import api from "@/lib/api"

interface Envelope<T> {
  data?: T
}

export interface MediaInit {
  media_id: string
  upload_url: string
}

export type UploadPurpose = "product" | "kyc"

export async function initImage(file: { type: string; size: number }, purpose: UploadPurpose): Promise<MediaInit> {
  const body: Record<string, unknown> = {
    file_type: "image",
    mime_type: file.type,
    file_size_bytes: file.size,
    media_subtype: "general",
  }
  if (purpose === "kyc") body.upload_purpose = "kyc"
  const res = await api.post<Envelope<MediaInit>>("/v1/media/init", body)
  const data = res.data?.data
  if (!data?.media_id || !data?.upload_url) throw new Error("The server reserved no upload slot for this image.")
  return data
}

/** The bytes to storage with progress. XHR, not axios: the signed URL is the whole authorisation and storage's preflight allows only content-type. */
export function putImage(
  uploadUrl: string,
  body: Blob,
  contentType: string,
  opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) {
      reject(new DOMException("Upload cancelled", "AbortError"))
      return
    }
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", uploadUrl, true)
    xhr.setRequestHeader("Content-Type", contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) opts.onProgress?.(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else if (xhr.status === 403) reject(new Error("The upload link expired. Remove the image and add it again."))
      else reject(new Error(`Storage refused the upload (${xhr.status}).`))
    }
    xhr.onerror = () => reject(new Error("The connection to storage failed. Check your network and try again."))
    xhr.ontimeout = () => reject(new Error("The upload timed out."))
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"))
    opts.signal?.addEventListener("abort", () => xhr.abort(), { once: true })
    xhr.send(body)
  })
}

export async function confirmImage(mediaId: string): Promise<void> {
  await api.post("/v1/media/confirm", { media_id: mediaId })
}

export interface MediaStatus {
  processing_status?: string
  moderation_status?: string
}

export async function fetchImageStatus(mediaId: string): Promise<MediaStatus> {
  const res = await api.get<Envelope<MediaStatus>>(`/v1/media/${encodeURIComponent(mediaId)}/status`)
  return res.data?.data ?? {}
}

/** What a status means: keep waiting, done, or give up with a sentence. Pure. */
export function readImageStatus(status: MediaStatus): { done: boolean; error: string | null } {
  const processing = status.processing_status ?? ""
  const moderation = status.moderation_status ?? ""
  if (processing === "failed") return { done: true, error: "The image could not be processed. Try a different file." }
  if (processing === "rejected" || moderation === "rejected") return { done: true, error: "This image was not accepted. Choose another one." }
  if (moderation === "manual_review") return { done: true, error: "This image is held for review and cannot be attached yet." }
  if (processing === "ready" && moderation === "passed") return { done: true, error: null }
  return { done: false, error: null }
}

export async function waitForImage(mediaId: string, opts: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {}): Promise<void> {
  const interval = opts.intervalMs ?? 1500
  const deadline = Date.now() + (opts.timeoutMs ?? 90_000)
  for (;;) {
    if (opts.signal?.aborted) throw new DOMException("Upload cancelled", "AbortError")
    const verdict = readImageStatus(await fetchImageStatus(mediaId))
    if (verdict.done) {
      if (verdict.error) throw new Error(verdict.error)
      return
    }
    if (Date.now() > deadline) throw new Error("The image is taking too long to process. Try again in a moment.")
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}

/** The whole trip for one file; resolves with the media id the server may now be told about. */
export async function uploadSellerImage(
  file: File,
  purpose: UploadPurpose,
  opts: { onProgress?: (fraction: number) => void; onProcessing?: () => void; signal?: AbortSignal } = {},
): Promise<string> {
  const { media_id, upload_url } = await initImage(file, purpose)
  await putImage(upload_url, file, file.type, { onProgress: opts.onProgress, signal: opts.signal })
  await confirmImage(media_id)
  opts.onProcessing?.()
  await waitForImage(media_id, { signal: opts.signal })
  return media_id
}
