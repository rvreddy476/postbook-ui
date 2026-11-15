"use client"

import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query"

import {
  fetchConversation,
  fetchThread,
  fetchEligibility,
  fetchNote,
  fetchReplies,
  TOP_REPLIES_LIMIT,
  fetchTimeline,
  fetchUserNotes,
  fetchBookmarks,
  fetchScheduled,
  fetchQuotes,
  fetchHashtagNotes,
  searchNotes,
  fetchTrends,
  type ResultsTab,
  type ProfileNotesTab,
  type Timeline,
} from "./api"
import type { Note, NotePage } from "./model"

/*
  Echo's reads, through react-query. Every list is an infinite query keyed
  under ["echo", …], so one note's change (a like, an edit, a delete) is
  written into every cached copy by updateNoteEverywhere.
*/

export const echoKeys = {
  all: ["echo"] as const,
  timeline: (t: Timeline) => ["echo", "timeline", t] as const,
  note: (id: string) => ["echo", "note", id] as const,
  conversation: (id: string) => ["echo", "conversation", id] as const,
  thread: (id: string) => ["echo", "thread", id] as const,
  replies: (id: string) => ["echo", "replies", id] as const,
  /** A timeline card's first replies (a plain NotePage, not an infinite list). */
  topReplies: (id: string) => ["echo", "top-replies", id] as const,
  user: (userId: string, tab: ProfileNotesTab) => ["echo", "user", userId, tab] as const,
  eligibility: ["echo", "eligibility"] as const,
}

const nextCursor = (last: NotePage) => last.nextCursor ?? undefined

export function useTimeline(t: Timeline, enabled = true) {
  return useInfiniteQuery({
    queryKey: echoKeys.timeline(t),
    queryFn: ({ pageParam }) => fetchTimeline(t, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: nextCursor,
    enabled,
  })
}

export function useNote(id: string, enabled = true) {
  return useQuery({ queryKey: echoKeys.note(id), queryFn: () => fetchNote(id), enabled: enabled && !!id, retry: false })
}

export function useConversation(id: string, enabled = true) {
  return useQuery({ queryKey: echoKeys.conversation(id), queryFn: () => fetchConversation(id), enabled: enabled && !!id, retry: false })
}

/** Every part of the thread the note is in, first part first. */
export function useThread(id: string, enabled = true) {
  return useQuery({ queryKey: echoKeys.thread(id), queryFn: () => fetchThread(id), enabled: enabled && !!id, retry: false })
}

export function useReplies(id: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: echoKeys.replies(id),
    queryFn: ({ pageParam }) => fetchReplies(id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: nextCursor,
    enabled: enabled && !!id,
  })
}

/**
 * The first replies under a timeline card, for its bubbles. Asked for only
 * once the card is on screen and has replies, cached per note, and never
 * holds the timeline up: the card draws without them until they arrive.
 */
export function useTopReplies(id: string, enabled: boolean) {
  return useQuery({
    queryKey: echoKeys.topReplies(id),
    queryFn: () => fetchReplies(id, null, TOP_REPLIES_LIMIT),
    enabled: enabled && !!id,
    staleTime: 60_000,
    retry: false,
  })
}

export function useUserNotes(userId: string, tab: ProfileNotesTab, enabled = true) {
  return useInfiniteQuery({
    queryKey: echoKeys.user(userId, tab),
    queryFn: ({ pageParam }) => fetchUserNotes(userId, tab, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: nextCursor,
    enabled: enabled && !!userId,
  })
}

/** Read fresh each time the composer opens (a lapsed Premium must not linger), so no cache time. */
export function useEligibilityReader() {
  const qc = useQueryClient()
  return () => qc.fetchQuery({ queryKey: echoKeys.eligibility, queryFn: fetchEligibility, staleTime: 0 })
}

/** Every note in a page list, flattened. */
export function flattenPages(data: InfiniteData<NotePage> | undefined): Note[] {
  if (!data) return []
  const seen = new Set<string>()
  const out: Note[] = []
  for (const page of data.pages) {
    for (const note of page.items) {
      if (seen.has(note.id)) continue
      seen.add(note.id)
      out.push(note)
    }
  }
  return out
}

function mapPages(data: InfiniteData<NotePage> | undefined, fn: (n: Note) => Note | null): InfiniteData<NotePage> | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((p) => ({ ...p, items: p.items.map(fn).filter((n): n is Note => n !== null) })),
  }
}

/** Apply a change to a note in every cached Echo list and detail. `fn` returning null removes it. */
export function updateNoteEverywhere(qc: QueryClient, fn: (n: Note) => Note | null) {
  qc.setQueriesData<InfiniteData<NotePage>>({ queryKey: ["echo", "timeline"] }, (d) => mapPages(d, fn))
  qc.setQueriesData<InfiniteData<NotePage>>({ queryKey: ["echo", "replies"] }, (d) => mapPages(d, fn))
  qc.setQueriesData<InfiniteData<NotePage>>({ queryKey: ["echo", "user"] }, (d) => mapPages(d, fn))
  qc.setQueriesData<InfiniteData<NotePage>>({ queryKey: ["echo", "list"] }, (d) => mapPages(d, fn))
  qc.setQueriesData<NotePage>({ queryKey: ["echo", "top-replies"] }, (d) => (d ? { ...d, items: d.items.map(fn).filter((n): n is Note => n !== null) } : d))
  qc.setQueriesData<Note[]>({ queryKey: ["echo", "conversation"] }, (d) => (d ? d.map(fn).filter((n): n is Note => n !== null) : d))
  qc.setQueriesData<Note[]>({ queryKey: ["echo", "thread"] }, (d) => (d ? d.map(fn).filter((n): n is Note => n !== null) : d))
  qc.setQueriesData<Note>({ queryKey: ["echo", "note"] }, (d) => (d ? fn(d) ?? d : d))
}

/** A new note goes at the top of the Following timeline; a reply at the top of its parent's replies. */
export function showCreatedNotes(qc: QueryClient, notes: readonly Note[]) {
  for (const note of notes) {
    // A scheduled note is visible only in the author's Scheduled list.
    if (note.status === "scheduled") {
      void qc.invalidateQueries({ queryKey: ["echo", "list", "scheduled"] })
      continue
    }
    const keys = note.replyToId ? [echoKeys.replies(note.replyToId)] : [echoKeys.timeline("following"), echoKeys.timeline("for-you")]
    for (const key of keys) {
      qc.setQueryData<InfiniteData<NotePage>>(key, (d) => {
        if (!d || d.pages.length === 0) return d
        const [first, ...rest] = d.pages
        if (first.items.some((n) => n.id === note.id)) return d
        return { ...d, pages: [{ ...first, items: [note, ...first.items] }, ...rest] }
      })
    }
    if (note.replyToId) {
      const parent = note.replyToId
      void qc.invalidateQueries({ queryKey: echoKeys.topReplies(parent) })
      updateNoteEverywhere(qc, (n) => (n.id === parent ? { ...n, replyCount: n.replyCount + 1 } : n))
    }
    if (note.quoteOfId) {
      const quoted = note.quoteOfId
      updateNoteEverywhere(qc, (n) => (n.id === quoted ? { ...n, quoteCount: n.quoteCount + 1 } : n))
    }
  }
}

// ── Echo v2 lists (each under ["echo","list",…] so updateNoteEverywhere reaches it) ──

function useNotePages(key: readonly unknown[], fetchPage: (cursor: string | null) => Promise<NotePage>, enabled = true) {
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: nextCursor,
    enabled,
    retry: false,
  })
}

export const echoListKeys = {
  bookmarks: ["echo", "list", "bookmarks"] as const,
  scheduled: ["echo", "list", "scheduled"] as const,
  quotes: (id: string) => ["echo", "list", "quotes", id] as const,
  hashtag: (tag: string, tab: ResultsTab) => ["echo", "list", "hashtag", tag.toLowerCase(), tab] as const,
  search: (q: string, tab: ResultsTab) => ["echo", "list", "search", q, tab] as const,
  trends: ["echo", "trends"] as const,
  peek: (t: Timeline) => ["echo", "peek", t] as const,
}

export const useBookmarks = (enabled = true) => useNotePages(echoListKeys.bookmarks, fetchBookmarks, enabled)
export const useScheduled = (enabled = true) => useNotePages(echoListKeys.scheduled, fetchScheduled, enabled)
export const useQuotes = (id: string) => useNotePages(echoListKeys.quotes(id), (c) => fetchQuotes(id, c), !!id)
export const useHashtagNotes = (tag: string, tab: ResultsTab) => useNotePages(echoListKeys.hashtag(tag, tab), (c) => fetchHashtagNotes(tag, tab, c), !!tag)
export const useSearchNotes = (q: string, tab: ResultsTab, enabled = true) => useNotePages(echoListKeys.search(q, tab), (c) => searchNotes(q, tab, c), enabled)

export function useTrends(limit = 10, enabled = true) {
  return useQuery({ queryKey: [...echoListKeys.trends, limit], queryFn: () => fetchTrends(limit), enabled, retry: false, staleTime: 5 * 60_000 })
}

/** Can this viewer post / reply? Shown up front (the composer or the Premium card); the server still decides at submit. */
export function useEligibility(enabled = true) {
  return useQuery({ queryKey: echoKeys.eligibility, queryFn: fetchEligibility, enabled, retry: false, staleTime: 60_000 })
}

/**
 * The newest page of a timeline, read again every minute, for the
 * "Show N posts" pill: how many notes at its top are not in the list yet.
 */
export function usePeek(t: Timeline, enabled = true) {
  return useQuery({ queryKey: echoListKeys.peek(t), queryFn: () => fetchTimeline(t, null), enabled, refetchInterval: 60_000, refetchIntervalInBackground: false, retry: false })
}

/** Notes at the top of `fresh` that `shown` does not have yet, counted until the first one already shown. */
export function newNotesCount(fresh: readonly Pick<Note, "id">[], shown: readonly Pick<Note, "id">[]): number {
  if (shown.length === 0) return 0
  const have = new Set(shown.map((n) => n.id))
  let count = 0
  for (const n of fresh) {
    if (have.has(n.id)) break
    count += 1
  }
  return count
}
