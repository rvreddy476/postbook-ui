/*
  Echo v2 routes (modernsmapp docs/designs/echo-v2-contract.md §2), all
  under /v1/notes on post-service, plus the existing share counter.

    POST   /v1/notes                     adds poll?, scheduled_at?
    POST   /v1/notes/:id/poll/vote       {option_index}          → Note
    GET    /v1/notes/me/scheduled        ?cursor=&limit=         → {items, next_cursor}
    PATCH  /v1/notes/:id/schedule        {scheduled_at}          → Note
    DELETE /v1/notes/:id/schedule                                → 204
    POST / DELETE /v1/notes/:id/bookmark                         → {bookmarked, count}
    GET    /v1/notes/bookmarks           ?cursor=&limit=
    POST   /v1/notes/views               {note_ids} (≤50)        → 204
    GET    /v1/notes/:id/quotes          ?cursor=&limit=
    GET    /v1/notes/trends              ?limit=                 → {items:[{tag, note_count, rank}]}
    GET    /v1/notes/hashtags/:tag       ?tab=top|latest&cursor=&limit=
    GET    /v1/notes/search              ?q=&tab=top|latest&cursor=&limit=
    POST   /v1/posts/:id/share           {share_type:"external"} (copy link, send via chat)
*/

import api from "@/lib/api"

import { parseNote, parseNotePage, unwrap, type Note, type NotePage } from "../model"
import { parseTrends, type Trend, VIEWS_MAX_PER_CALL } from "../v2"
import { pageQuery } from "./index"

export type ResultsTab = "top" | "latest"

const id = (value: string) => encodeURIComponent(value)

export const echoV2Paths = {
  vote: (noteId: string) => `/v1/notes/${id(noteId)}/poll/vote`,
  scheduled: (cursor?: string | null) => `/v1/notes/me/scheduled?${pageQuery(cursor)}`,
  schedule: (noteId: string) => `/v1/notes/${id(noteId)}/schedule`,
  bookmark: (noteId: string) => `/v1/notes/${id(noteId)}/bookmark`,
  bookmarks: (cursor?: string | null) => `/v1/notes/bookmarks?${pageQuery(cursor)}`,
  views: "/v1/notes/views",
  quotes: (noteId: string, cursor?: string | null) => `/v1/notes/${id(noteId)}/quotes?${pageQuery(cursor)}`,
  trends: (limit = 10) => `/v1/notes/trends?limit=${Math.min(30, Math.max(1, limit))}`,
  hashtag: (tag: string, tab: ResultsTab, cursor?: string | null) => `/v1/notes/hashtags/${id(tag.replace(/^#/, ""))}?${pageQuery(cursor, undefined, { tab })}`,
  search: (q: string, tab: ResultsTab, cursor?: string | null) => `/v1/notes/search?${pageQuery(cursor, undefined, { q, tab })}`,
  share: (noteId: string) => `/v1/posts/${id(noteId)}/share`,
} as const

function mustNote(body: unknown): Note {
  const note = parseNote(body)
  if (!note) throw new Error("The note could not be read.")
  return note
}

export async function votePoll(noteId: string, optionIndex: number): Promise<Note> {
  return mustNote((await api.post(echoV2Paths.vote(noteId), { option_index: optionIndex })).data)
}

export async function fetchScheduled(cursor?: string | null): Promise<NotePage> {
  return parseNotePage((await api.get(echoV2Paths.scheduled(cursor))).data)
}

export async function reschedule(noteId: string, at: Date): Promise<Note> {
  return mustNote((await api.patch(echoV2Paths.schedule(noteId), { scheduled_at: at.toISOString() })).data)
}

export async function deleteScheduled(noteId: string): Promise<void> {
  await api.delete(echoV2Paths.schedule(noteId))
}

export async function setBookmark(noteId: string, on: boolean): Promise<{ bookmarked: boolean; count: number | null }> {
  const res = on ? await api.post(echoV2Paths.bookmark(noteId)) : await api.delete(echoV2Paths.bookmark(noteId))
  const data = (unwrap(res.data) ?? {}) as { bookmarked?: unknown; count?: unknown }
  return { bookmarked: typeof data.bookmarked === "boolean" ? data.bookmarked : on, count: typeof data.count === "number" ? data.count : null }
}

export async function fetchBookmarks(cursor?: string | null): Promise<NotePage> {
  return parseNotePage((await api.get(echoV2Paths.bookmarks(cursor))).data)
}

/** One views call; callers batch (ViewBatcher). Over 50 ids is cut to 50. */
export async function sendViews(noteIds: readonly string[]): Promise<void> {
  if (noteIds.length === 0) return
  await api.post(echoV2Paths.views, { note_ids: noteIds.slice(0, VIEWS_MAX_PER_CALL) })
}

export async function fetchQuotes(noteId: string, cursor?: string | null): Promise<NotePage> {
  return parseNotePage((await api.get(echoV2Paths.quotes(noteId, cursor))).data)
}

export async function fetchTrends(limit = 10): Promise<Trend[]> {
  return parseTrends((await api.get(echoV2Paths.trends(limit))).data)
}

export async function fetchHashtagNotes(tag: string, tab: ResultsTab, cursor?: string | null): Promise<NotePage> {
  return parseNotePage((await api.get(echoV2Paths.hashtag(tag, tab, cursor))).data)
}

export async function searchNotes(q: string, tab: ResultsTab, cursor?: string | null): Promise<NotePage> {
  return parseNotePage((await api.get(echoV2Paths.search(q, tab, cursor))).data)
}

/** Counts a share (copy link, send via chat). Answers the new count when the server sent one. */
export async function recordNoteShare(noteId: string): Promise<number | null> {
  const res = await api.post(echoV2Paths.share(noteId), { share_type: "external" })
  const data = (unwrap(res.data) ?? {}) as { count?: unknown }
  return typeof data.count === "number" ? data.count : null
}
