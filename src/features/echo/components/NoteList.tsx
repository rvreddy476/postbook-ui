"use client"

import { useEffect, useRef } from "react"
import type { InfiniteData } from "@tanstack/react-query"

import { flattenPages } from "../hooks"
import { echoErrorMessage, type Note, type NotePage } from "../model"
import { listUnavailable } from "../v2"
import { NoteCard } from "./NoteCard"

export interface PagedQuery {
  data: InfiniteData<NotePage> | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => unknown
  refetch: () => unknown
}

export function ListMessage({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="mx-auto max-w-sm px-8 py-12" data-echo-empty>
      <p className="text-3xl font-extrabold leading-tight text-brand-text">{title}</p>
      {detail && <p className="mt-2 text-base text-muted-foreground">{detail}</p>}
    </div>
  )
}

export function Spinner() {
  return (
    <div role="status" aria-label="Loading" className="flex justify-center py-8">
      <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary/30 border-t-primary" />
    </div>
  )
}

/**
 * A cursor-paged list of posts: loads the next page as its end scrolls into
 * view. A route the server has not shipped yet (404) or switched off (503)
 * reads as "not available yet", not as an error to retry.
 */
export function NoteList({
  query,
  empty,
  emptyDetail,
  filter,
  render,
  order,
}: {
  query: PagedQuery
  empty: string
  emptyDetail?: string
  /** Keep only some notes (the profile's Media tab). */
  filter?: (n: Note) => boolean
  render?: (n: Note) => React.ReactNode
  /** Re-order the loaded posts (the post page's reply sort). */
  order?: (a: Note, b: Note) => number
}) {
  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query

  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) fetchNextPage()
      },
      { rootMargin: "600px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  if (query.isLoading) return <Spinner />
  if (query.isError) {
    if (listUnavailable(query.error)) return <ListMessage title="Not available yet" detail="This part of Echo isn't switched on yet. Check back soon." />
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <p className="text-base text-muted-foreground">{echoErrorMessage(query.error)}</p>
        <button type="button" onClick={() => query.refetch()} className="rounded-full bg-primary-ink px-4 py-1.5 text-sm font-bold text-primary-foreground hover:bg-primary-hover">
          Retry
        </button>
      </div>
    )
  }
  const all = flattenPages(query.data)
  const kept = filter ? all.filter(filter) : all
  const notes = order ? [...kept].sort(order) : kept
  return (
    <div>
      {notes.length === 0 && !hasNextPage ? (
        <ListMessage title={empty} detail={emptyDetail} />
      ) : (
        <ul className="divide-y divide-border border-b border-border">
          {notes.map((n) => (
            <li key={n.id}>{render ? render(n) : <NoteCard note={n} />}</li>
          ))}
        </ul>
      )}
      <div ref={sentinel} className="flex justify-center py-2">
        {isFetchingNextPage ? <Spinner /> : null}
      </div>
    </div>
  )
}
