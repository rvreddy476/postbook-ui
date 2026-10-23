"use client"

/*
  The Members tab on a channel and a profile: the creator's members-only
  posts, shorts and videos, from by-author?members_only=true
  (useMembersOnlyRows), paged by the same cursor. A
  non-member sees each item locked — title, cover blurred, lock — and Join;
  the server already redacted the body, which is what decides the lock.
*/

import { useMemo } from "react"
import Link from "next/link"
import { Lock } from "lucide-react"

import { mediaServeUrl } from "@/features/posttube/model"
import { useAuthUser } from "@/store/auth"

import { useMembersOnlyRows } from "../hooks"
import { formatDuration, gatedHref, kindLabel, membersLocked, type GatedRow } from "../model"
import { JoinButton } from "./JoinButton"

export interface MembersTabProps {
  authorId: string
  authorName?: string
  isOwner: boolean
}

export function MembersTab({ authorId, authorName, isOwner }: MembersTabProps) {
  const q = useMembersOnlyRows(authorId)
  const rows = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data])
  const viewer = useAuthUser()
  const owner = isOwner || viewer?.id === authorId
  const anyLocked = rows.some((r) => membersLocked({ tierRequiredId: r.tierRequiredId, bodyRedacted: r.bodyRedacted, isOwner: owner, access: "unknown", trustServedBody: true }))

  if (q.isPending) {
    return (
      <div data-membership="members-tab" className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="aspect-video animate-pulse rounded-xl bg-brand-secondary" />
        ))}
      </div>
    )
  }
  if (q.isError && rows.length === 0) {
    return (
      <div data-membership="members-tab" role="alert" className="py-10 text-center text-sm text-muted-foreground">
        Members-only posts couldn&apos;t load.{" "}
        <button type="button" className="font-semibold text-primary-ink underline underline-offset-2" onClick={() => void q.refetch()}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <div data-membership="members-tab" className="space-y-4">
      {anyLocked ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand-divider bg-brand-card px-4 py-3">
          <Lock className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-brand-text">{authorName?.trim() ? `Join ${authorName.trim()}'s membership to open these.` : "Join to open these."}</p>
          <JoinButton creatorId={authorId} creatorName={authorName} />
        </div>
      ) : null}
      {rows.length === 0 && !q.hasNextPage ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{owner ? "Nothing members-only yet. Choose a level under Members only when you post." : "No members-only posts yet."}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rows.map((r) => (
            <MemberTile key={r.id} row={r} locked={membersLocked({ tierRequiredId: r.tierRequiredId, bodyRedacted: r.bodyRedacted, isOwner: owner, access: "unknown", trustServedBody: true })} />
          ))}
        </div>
      )}
      {q.hasNextPage ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
            className="rounded-full border border-brand-divider bg-brand-card px-4 py-2 text-sm font-semibold text-brand-text hover:bg-brand-secondary disabled:opacity-50"
          >
            {q.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function MemberTile({ row, locked }: { row: GatedRow; locked: boolean }) {
  const cover = row.coverMediaId ? mediaServeUrl(row.coverMediaId) : ""
  const length = formatDuration(row.durationMs)
  const title = row.title || kindLabel(row.contentType)
  return (
    <Link href={gatedHref(row)} data-membership-tile={row.id} data-locked={locked ? "" : undefined} className="group block min-w-0 rounded-xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-outline">
      <span className="relative block aspect-video overflow-hidden rounded-xl bg-brand-secondary">
        {cover ? <img src={cover} alt="" className={`h-full w-full object-cover ${locked ? "scale-110 blur-xl" : ""}`} /> : null}
        {locked ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-card text-brand-text shadow-sm">
              <Lock className="h-4 w-4" aria-hidden="true" />
            </span>
          </span>
        ) : null}
        {length ? <span className="absolute bottom-1.5 right-1.5 rounded bg-brand-card px-1.5 text-xs font-semibold text-brand-text">{length}</span> : null}
      </span>
      <span className="mt-1.5 block truncate text-sm font-semibold text-brand-text group-hover:underline">{title}</span>
      <span className="block text-xs text-muted-foreground">
        {kindLabel(row.contentType)}
        {locked ? " · Members only" : ""}
      </span>
    </Link>
  )
}
