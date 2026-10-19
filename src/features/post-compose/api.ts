/*
  post-service's create and composer-draft routes, for the feed composers.

    POST   /v1/posts                      create (Idempotency-Key required)
    GET    /v1/posts/drafts               the author's drafts
    GET    /v1/posts/drafts/:id           one draft
    POST   /v1/posts/drafts               save a new draft
    PATCH  /v1/posts/drafts/:id           replace a draft's contents
    DELETE /v1/posts/drafts/:id           delete it
    POST   /v1/posts/drafts/:id/publish   publish it now (the draft id becomes the post id)

  Media goes up through lib/mediaUpload.ts first, exactly as the create does.
*/

import api from "@/lib/api"
import { updateMediaAltText, uploadMedia } from "@/lib/mediaUpload"
import type { PostDetail } from "@/types/profile"

import {
  MAX_ALT_TEXT_LENGTH,
  toDraftRow,
  toDraftRows,
  type ComposeMedia,
  type CreatePostBody,
  type PostDraftRequest,
  type PostDraftRow,
  type UploadedMedia,
} from "./model"

interface Envelope<T> {
  data: T
}

export async function createPost(body: CreatePostBody, idempotencyKey: string): Promise<PostDetail> {
  const res = await api.post<Envelope<PostDetail>>("/v1/posts", body, {
    headers: { "Idempotency-Key": idempotencyKey },
  })
  return res.data.data
}

export async function listPostDrafts(limit = 50): Promise<PostDraftRow[]> {
  const res = await api.get<Envelope<unknown>>("/v1/posts/drafts", { params: { limit } })
  return toDraftRows(res.data.data)
}

export async function getPostDraft(id: string): Promise<PostDraftRow> {
  const res = await api.get<Envelope<unknown>>(`/v1/posts/drafts/${encodeURIComponent(id)}`)
  const row = toDraftRow(res.data.data)
  if (!row) throw new Error("This draft could not be read.")
  return row
}

export async function createPostDraft(request: PostDraftRequest): Promise<PostDraftRow> {
  const res = await api.post<Envelope<unknown>>("/v1/posts/drafts", request)
  const row = toDraftRow(res.data.data)
  if (!row) throw new Error("The draft was saved but could not be read back.")
  return row
}

export async function updatePostDraft(id: string, request: PostDraftRequest): Promise<PostDraftRow> {
  const res = await api.patch<Envelope<unknown>>(`/v1/posts/drafts/${encodeURIComponent(id)}`, request)
  const row = toDraftRow(res.data.data)
  if (!row) throw new Error("The draft was saved but could not be read back.")
  return row
}

export async function deletePostDraft(id: string): Promise<void> {
  await api.delete(`/v1/posts/drafts/${encodeURIComponent(id)}`)
}

export async function publishPostDraft(id: string): Promise<PostDetail> {
  const res = await api.post<Envelope<PostDetail>>(`/v1/posts/drafts/${encodeURIComponent(id)}/publish`)
  return res.data.data
}

/**
 * Upload every item that has no media id yet, in parallel. `onUploaded` hears
 * each id as it lands, so the composer keeps it: a failed post retried later
 * re-uploads nothing. Throws when any upload fails (the ones that landed have
 * already been reported).
 */
export async function uploadPending(
  media: readonly ComposeMedia[],
  onUploaded?: (key: string, mediaId: string) => void,
): Promise<UploadedMedia[]> {
  return Promise.all(
    media.map(async (item) => {
      if (item.mediaId) return { mediaId: item.mediaId, kind: item.kind, altText: item.altText }
      if (!item.file) throw new Error("A photo is missing. Remove it and add it again.")
      const mediaId = await uploadMedia(item.file, item.kind, "general")
      onUploaded?.(item.key, mediaId)
      return { mediaId, kind: item.kind, altText: item.altText }
    }),
  )
}

/**
 * The create route has no alt-text field, so each description is written onto
 * its asset before the post goes out. Best-effort, like the server's own draft
 * publish: a refusal leaves that photo without one and the post still goes.
 */
export async function applyAltTexts(media: readonly UploadedMedia[]): Promise<void> {
  await Promise.allSettled(
    media
      .filter((m) => m.kind === "image" && (m.altText ?? "").trim())
      .map((m) => updateMediaAltText(m.mediaId, (m.altText ?? "").trim().slice(0, MAX_ALT_TEXT_LENGTH))),
  )
}

/** The server's message for a refused request, or null. */
export function serverMessage(err: unknown): string | null {
  if (err && typeof err === "object" && "response" in err) {
    const msg = (err as { response?: { data?: { error?: { message?: unknown } } } }).response?.data?.error?.message
    if (typeof msg === "string" && msg) return msg
  }
  return null
}

/** The server's error code for a refused request, or null. */
export function serverCode(err: unknown): string | null {
  if (err && typeof err === "object" && "response" in err) {
    const code = (err as { response?: { data?: { error?: { code?: unknown } } } }).response?.data?.error?.code
    if (typeof code === "string" && code) return code
  }
  return null
}

/** A request that never got an answer (offline, timeout): the only kind worth retrying as is. */
export function isNetworkFailure(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const e = err as { response?: unknown; request?: unknown; isAxiosError?: boolean }
  return Boolean(e.isAxiosError && !e.response)
}
