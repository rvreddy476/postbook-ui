/*
  Echo's routes (modernsmapp docs/designs/echo-contract.md), through the
  shared axios client, so the session, refresh and envelope rules are the
  same as every other call.

    GET    /v1/feed/notes/following | for-you   ?cursor=&limit=
    GET    /v1/notes/:id   /:id/conversation   /:id/replies?cursor=&limit=
    GET    /v1/notes/users/:userId?tab=notes|replies|reposts&cursor=&limit=
    GET    /v1/notes/me/eligibility
    POST   /v1/notes            (Idempotency-Key)
    POST   /v1/notes/thread     (Idempotency-Key)
    PATCH  /v1/notes/:id        {text?, reply_policy?}
    DELETE /v1/notes/:id
    POST   /v1/posts/:id/like   (the existing heart toggle)
    POST / DELETE /v1/posts/:id/repost  {type:"plain"}
*/

import api from "@/lib/api"

import {
  parseEligibility,
  parseNote,
  parseNotePage,
  parseThread,
  type Eligibility,
  type Note,
  type NotePage,
  type ReplyPolicy,
} from "./model"

export type Timeline = "following" | "for-you"
export type ProfileNotesTab = "notes" | "replies" | "reposts"

export const TIMELINES: readonly { value: Timeline; label: string }[] = [
  { value: "following", label: "Following" },
  { value: "for-you", label: "For You" },
]

export const PROFILE_NOTES_TABS: readonly { value: ProfileNotesTab; label: string }[] = [
  { value: "notes", label: "Notes" },
  { value: "replies", label: "Replies" },
  { value: "reposts", label: "Reposts" },
]

export const PAGE_SIZE = 20

/** `?cursor=&limit=`, leaving out an empty cursor. */
export function pageQuery(cursor: string | null | undefined, limit = PAGE_SIZE, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams(extra)
  if (cursor) q.set("cursor", cursor)
  q.set("limit", String(limit))
  return q.toString()
}

const id = (value: string) => encodeURIComponent(value)

export const echoPaths = {
  timeline: (t: Timeline, cursor?: string | null) => `/v1/feed/notes/${t}?${pageQuery(cursor)}`,
  note: (noteId: string) => `/v1/notes/${id(noteId)}`,
  conversation: (noteId: string) => `/v1/notes/${id(noteId)}/conversation`,
  replies: (noteId: string, cursor?: string | null) => `/v1/notes/${id(noteId)}/replies?${pageQuery(cursor)}`,
  userNotes: (userId: string, tab: ProfileNotesTab, cursor?: string | null) => `/v1/notes/users/${id(userId)}?${pageQuery(cursor, PAGE_SIZE, { tab })}`,
  eligibility: "/v1/notes/me/eligibility",
  create: "/v1/notes",
  thread: "/v1/notes/thread",
  like: (noteId: string) => `/v1/posts/${id(noteId)}/like`,
  repost: (noteId: string) => `/v1/posts/${id(noteId)}/repost`,
} as const

function mustNote(body: unknown): Note {
  const note = parseNote(body)
  if (!note) throw new Error("The note could not be read.")
  return note
}

export async function fetchTimeline(t: Timeline, cursor?: string | null): Promise<NotePage> {
  return parseNotePage((await api.get(echoPaths.timeline(t, cursor))).data)
}

export async function fetchNote(noteId: string): Promise<Note> {
  return mustNote((await api.get(echoPaths.note(noteId))).data)
}

export async function fetchConversation(noteId: string): Promise<Note[]> {
  return parseNotePage((await api.get(echoPaths.conversation(noteId))).data).items
}

export async function fetchReplies(noteId: string, cursor?: string | null): Promise<NotePage> {
  return parseNotePage((await api.get(echoPaths.replies(noteId, cursor))).data)
}

export async function fetchUserNotes(userId: string, tab: ProfileNotesTab, cursor?: string | null): Promise<NotePage> {
  return parseNotePage((await api.get(echoPaths.userNotes(userId, tab, cursor))).data)
}

export async function fetchEligibility(): Promise<Eligibility> {
  return parseEligibility((await api.get(echoPaths.eligibility)).data)
}

export interface CreateNoteBody {
  text: string
  media_ids?: string[]
  reply_to_id?: string
  quote_of_id?: string
  reply_policy?: ReplyPolicy
}

/**
 * The create body: only what is set. reply_to_id and quote_of_id are
 * mutually exclusive (400 INVALID_REQUEST); a reply wins, since a reply
 * composer never carries a quote.
 */
export function createNoteBody(input: { text: string; mediaIds?: readonly string[]; replyToId?: string | null; quoteOfId?: string | null; replyPolicy?: ReplyPolicy }): CreateNoteBody {
  const body: CreateNoteBody = { text: input.text.trim() }
  if (input.mediaIds && input.mediaIds.length) body.media_ids = [...new Set(input.mediaIds)]
  if (input.replyToId) body.reply_to_id = input.replyToId
  else if (input.quoteOfId) body.quote_of_id = input.quoteOfId
  if (input.replyPolicy) body.reply_policy = input.replyPolicy
  return body
}

export async function createNote(body: CreateNoteBody, idempotencyKey: string): Promise<Note> {
  return mustNote((await api.post(echoPaths.create, body, { headers: { "Idempotency-Key": idempotencyKey } })).data)
}

export interface ThreadBody {
  entries: { text: string; media_ids?: string[] }[]
  reply_policy?: ReplyPolicy
}

export async function createThread(body: ThreadBody, idempotencyKey: string): Promise<Note[]> {
  return parseThread((await api.post(echoPaths.thread, body, { headers: { "Idempotency-Key": idempotencyKey } })).data)
}

export async function editNote(noteId: string, patch: { text?: string; reply_policy?: ReplyPolicy }): Promise<Note> {
  return mustNote((await api.patch(echoPaths.note(noteId), patch)).data)
}

export async function deleteNote(noteId: string): Promise<void> {
  await api.delete(echoPaths.note(noteId))
}

/** The heart: post-service's existing toggle. Answers the new state and count. */
export async function toggleLike(noteId: string): Promise<{ liked: boolean; count: number | null }> {
  const res = await api.post(echoPaths.like(noteId))
  const data = (res.data?.data ?? {}) as { liked?: unknown; count?: unknown }
  return { liked: data.liked === true, count: typeof data.count === "number" ? data.count : null }
}

export async function setRepost(noteId: string, reposted: boolean): Promise<void> {
  if (reposted) await api.post(echoPaths.repost(noteId), { type: "plain" })
  else await api.delete(echoPaths.repost(noteId))
}
