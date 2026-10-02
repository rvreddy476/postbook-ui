/* The caller's photos and prompts. */

import { toMyPhoto, toMyPhotos, type MyPhoto } from "../model/photos"
import { toClipResult, type ClipResult } from "../model/promptClips"
import { toPromptAnswer, toPromptAnswers, toPromptCatalog, type PromptAnswer, type PromptQuestion } from "../model/prompts"
import { del, get, patch, post, put, seg } from "./client"

/** GET /photos/me — the owner's view, with the moderation reason. */
export async function fetchMyPhotos(): Promise<MyPhoto[]> {
  return toMyPhotos(await get("/photos/me"))
}

export async function createPhoto(mediaId: string, isPrimary: boolean, sortOrder: number): Promise<MyPhoto | null> {
  return toMyPhoto(await post("/photos", { media_id: mediaId, is_primary: isPrimary, sort_order: sortOrder, visibility: "public" }))
}

export async function updatePhoto(id: string, body: { is_primary?: boolean; visibility?: string; sort_order?: number }): Promise<MyPhoto | null> {
  return toMyPhoto(await patch(`/photos/${seg(id)}`, body))
}

export async function deletePhoto(id: string): Promise<void> {
  await del(`/photos/${seg(id)}`)
}

export async function fetchPromptCatalog(): Promise<PromptQuestion[]> {
  return toPromptCatalog(await get("/prompts/catalog"))
}

export async function fetchPrompts(): Promise<PromptAnswer[]> {
  return toPromptAnswers(await get("/prompts"))
}

export async function upsertPrompt(promptId: number, answer: string): Promise<PromptAnswer | null> {
  return toPromptAnswer(await put(`/prompts/${seg(promptId)}`, { answer: answer.trim() }))
}

export async function deletePrompt(promptId: number): Promise<void> {
  await del(`/prompts/${seg(promptId)}`)
}

/** PUT /prompts/:id/clip {media_id} (M15): attach an uploaded voice or video clip. */
export async function putPromptClip(promptId: number, mediaId: string): Promise<ClipResult | null> {
  return toClipResult(await put(`/prompts/${seg(promptId)}/clip`, { media_id: mediaId }))
}

/** DELETE /prompts/:id/clip (M15). A clip-only answer goes with it. */
export async function deletePromptClip(promptId: number): Promise<void> {
  await del(`/prompts/${seg(promptId)}/clip`)
}
