/*
  The caller's OWN photos (GET /photos/me, POST/PATCH/DELETE /photos). These
  rows carry a `media_id` and no image route, so the owner's preview is the
  media-service read of their own upload (`/v1/media/:id/serve`), never a
  dating `/full` path built here.
*/

import { bool, num, obj, str, time, arr } from "./wire"

export type ModerationTone = "success" | "warning" | "danger" | "muted"

export interface MyPhoto {
  id: string
  mediaId: string
  sortOrder: number
  isPrimary: boolean
  visibility: string
  moderationStatus: string
  moderationReason: string
  createdAt: string
}

export function toMyPhoto(wire: unknown): MyPhoto | null {
  const w = obj(wire)
  const id = str(w.id)
  if (!id) return null
  return {
    id,
    mediaId: str(w.media_id),
    sortOrder: num(w.sort_order),
    isPrimary: bool(w.is_primary),
    visibility: str(w.visibility),
    moderationStatus: str(w.moderation_status),
    moderationReason: str(w.moderation_reason),
    createdAt: time(w.created_at),
  }
}

export function toMyPhotos(wire: unknown): MyPhoto[] {
  return arr(wire)
    .map(toMyPhoto)
    .filter((p): p is MyPhoto => p !== null)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder)
}

export function ownPhotoSrc(photo: Pick<MyPhoto, "mediaId">): string {
  return photo.mediaId ? `/v1/media/${encodeURIComponent(photo.mediaId)}/serve` : ""
}

export function moderationView(photo: Pick<MyPhoto, "moderationStatus" | "moderationReason">): { label: string; tone: ModerationTone; reason: string } {
  switch (photo.moderationStatus) {
    case "approved":
      return { label: "Approved", tone: "success", reason: "" }
    case "rejected":
      return { label: "Not accepted", tone: "danger", reason: photo.moderationReason || "This photo doesn't meet the photo rules. Remove it and add another." }
    case "pending":
    case "manual_review":
      return { label: "In review", tone: "warning", reason: "" }
    default:
      return { label: "Checking", tone: "muted", reason: "" }
  }
}

export const MAX_PHOTOS = 6
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp"
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024

/** Why a picked file cannot be a photo, or "". */
export function photoFileProblem(file: { type: string; size: number }): string {
  if (!PHOTO_ACCEPT.split(",").includes(file.type)) return "Choose a JPG, PNG or WebP photo."
  if (file.size <= 0) return "That file is empty."
  if (file.size > PHOTO_MAX_BYTES) return "Choose a photo under 10 MB."
  return ""
}
