"use client"

import { useEffect, useRef } from "react"
import type { InfiniteData } from "@tanstack/react-query"

import { flattenPages } from "../hooks"
import { echoErrorMessage, type NotePage } from "../model"
import { NoteCard } from "./NoteCard"

interface PagedQuery {
  data: InfiniteData<NotePage> | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => unknown
  refetch: () => unknown
}

/** A cursor-paged list of notes: loads the next page as its end scrolls into view. */
export function NoteList({ query, empty }: { query: PagedQuery; empty: string }) {
  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query

  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) fetchNextPage()
    }, { rootMargin: "400px" })
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  if (query.isLoading) {
    return (
      <p role="status" className="px-4 py-10 text-center text-sm text-muted-foreground">
        Loading…
      </p>
    )
  }
  if (query.isError) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">{echoErrorMessage(query.error)}</p>
        <button type="button" onClick={() => query.refetch()} className="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-brand-text hover:bg-brand-secondary">
          Try again
        </button>
      </div>
    )
  }
  const notes = flattenPages(query.data)
  if (notes.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <div>
      <ul className="divide-y divide-border">
        {notes.map((n) => (
          <li key={n.id}>
            <NoteCard note={n} />
          </li>
        ))}
      </ul>
      <div ref={sentinel} className="flex justify-center py-4">
        {hasNextPage && (
          <button type="button" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="rounded-full px-4 py-1.5 text-sm font-medium text-primary-ink hover:bg-primary-tint disabled:opacity-50">
            {isFetchingNextPage ? "Loading…" : "Show more"}
          </button>
        )}
      </div>
    </div>
  )
}
