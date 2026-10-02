/*
  Media for dating, through media-service's upload flow:

    1. POST /v1/media/init          -> {media_id, upload_url}
    2. PUT  <upload_url>            direct to storage, one header
    3. POST /v1/media/confirm
    4. GET  /v1/media/{id}/status   until processed

  dating-service only accepts a finished, moderation-passed image
  (PHOTO_MEDIA_NOT_READY otherwise), so a photo waits for step 4. A selfie
  clip waits briefly too, and the submit still retries on MEDIA_NOT_READY.

  Also here: reading a dating photo. The image routes
  (`/v1/dating/photos/:id/full|blurred`) need the bearer token, and the
  browser's media cookie is scoped to /v1/media only, so an <img src> to
  them arrives anonymous. They are fetched with the token and shown from a
  blob URL instead.
*/

import api from "@/lib/api"

import { photoPath } from "../model/people"

interface Init {
  media_id: string
  upload_url: string
}

async function init(fileType: "image" | "video", mime: string, size: number): Promise<Init> {
  const res = await api.post("/v1/media/init", { file_type: fileType, media_subtype: "general", mime_type: mime, file_size_bytes: size })
  const data = res.data?.data as Init | undefined
  if (!data?.media_id || !data?.upload_url) throw new Error("upload_not_reserved")
  return data
}

function putBytes(url: string, body: Blob, mime: string, onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("cancelled", "AbortError"))
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url, true)
    xhr.setRequestHeader("Content-Type", mime)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total)
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("upload_refused")))
    xhr.onerror = () => reject(new Error("upload_failed"))
    xhr.onabort = () => reject(new DOMException("cancelled", "AbortError"))
    signal?.addEventListener("abort", () => xhr.abort(), { once: true })
    xhr.send(body)
  })
}

export type MediaVerdict = "ready" | "refused" | "waiting"

/** What a status row means. Pure. A clip has no moderation verdict to wait for. */
export function mediaVerdict(status: { processing_status?: string; moderation_status?: string }, kind: "image" | "video"): MediaVerdict {
  const processing = status.processing_status || ""
  const moderation = status.moderation_status || ""
  if (processing === "failed" || processing === "rejected" || moderation === "rejected") return "refused"
  if (processing !== "ready") return "waiting"
  if (kind === "image") return moderation === "passed" ? "ready" : moderation === "manual_review" ? "refused" : "waiting"
  return "ready"
}

async function waitUntilProcessed(mediaId: string, kind: "image" | "video", timeoutMs: number, signal?: AbortSignal): Promise<MediaVerdict> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (signal?.aborted) throw new DOMException("cancelled", "AbortError")
    const res = await api.get(`/v1/media/${encodeURIComponent(mediaId)}/status`)
    const verdict = mediaVerdict(res.data?.data ?? {}, kind)
    if (verdict !== "waiting") return verdict
    if (Date.now() > deadline) return "waiting"
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
}

export interface UploadOptions {
  onProgress?: (fraction: number) => void
  onProcessing?: () => void
  signal?: AbortSignal
}

/** A profile photo → a media id dating-service will accept. Throws `photo_refused` / `photo_slow`. */
export async function uploadPhoto(file: File, opts: UploadOptions = {}): Promise<string> {
  const { media_id, upload_url } = await init("image", file.type, file.size)
  await putBytes(upload_url, file, file.type, opts.onProgress, opts.signal)
  await api.post("/v1/media/confirm", { media_id })
  opts.onProcessing?.()
  const verdict = await waitUntilProcessed(media_id, "image", 90_000, opts.signal)
  if (verdict === "refused") throw new Error("photo_refused")
  if (verdict === "waiting") throw new Error("photo_slow")
  return media_id
}

/**
  A selfie clip → a media id. Does not insist on "ready": a clip still
  processing is submitted anyway and the submit's MEDIA_NOT_READY backoff
  covers the rest. Throws `clip_refused` when processing failed outright.
*/
export async function uploadSelfieClip(clip: Blob, mime: string, opts: UploadOptions = {}): Promise<string> {
  const { media_id, upload_url } = await init("video", mime, clip.size)
  await putBytes(upload_url, clip, mime, opts.onProgress, opts.signal)
  await api.post("/v1/media/confirm", { media_id })
  opts.onProcessing?.()
  const verdict = await waitUntilProcessed(media_id, "video", 20_000, opts.signal)
  if (verdict === "refused") throw new Error("clip_refused")
  return media_id
}

/** The image behind a server-named dating photo path, as a blob. Refuses any other path. */
export async function fetchPhotoBlob(serverPath: string, signal?: AbortSignal): Promise<Blob> {
  const path = photoPath(serverPath)
  if (!path) throw new Error("not_a_dating_photo")
  const res = await api.get(path, { responseType: "blob", signal })
  return res.data as Blob
}
