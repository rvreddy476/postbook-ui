"use client"

import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query"

import {
  fetchConversation,
  fetchEligibility,
  fetchNote,
  fetchReplies,
  fetchTimeline,
  fetchUserNotes,
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
  replies: (id: string) => ["echo", "replies", id] as const,
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

export function useReplies(id: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: echoKeys.replies(id),
    queryFn: ({ pageParam }) => fetchReplies(id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: nextCursor,
    enabled: enabled && !!id,
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
  qc.setQueriesData<Note[]>({ queryKey: ["echo", "conversation"] }, (d) => (d ? d.map(fn).filter((n): n is Note => n !== null) : d))
  qc.setQueriesData<Note>({ queryKey: ["echo", "note"] }, (d) => (d ? fn(d) ?? d : d))
}

/** A new note goes at the top of the Following timeline; a reply at the top of its parent's replies. */
export function showCreatedNotes(qc: QueryClient, notes: readonly Note[]) {
  for (const note of notes) {
    const key = note.replyToId ? echoKeys.replies(note.replyToId) : echoKeys.timeline("following")
    qc.setQueryData<InfiniteData<NotePage>>(key, (d) => {
      if (!d || d.pages.length === 0) return d
      const [first, ...rest] = d.pages
      if (first.items.some((n) => n.id === note.id)) return d
      return { ...d, pages: [{ ...first, items: [note, ...first.items] }, ...rest] }
    })
    if (note.replyToId) {
      const parent = note.replyToId
      updateNoteEverywhere(qc, (n) => (n.id === parent ? { ...n, replyCount: n.replyCount + 1 } : n))
    }
  }
}
