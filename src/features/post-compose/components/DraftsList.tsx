"use client"

import Link from "next/link"
import { FileText, Loader2, Trash2 } from "lucide-react"

import { draftSummary, mediaServeUrl, type PostDraftRow } from "../model"

/** Where a draft opens: the full-page composer, with the draft loaded into its details. */
export const draftHref = (id: string) => `/create/post?draft=${encodeURIComponent(id)}`

export interface DraftsListProps {
  rows: readonly PostDraftRow[]
  onDelete: (row: PostDraftRow) => void
  /** The draft whose delete is in flight. */
  deletingId?: string | null
  now?: number
}

/** Pure presentation, so tests render it without a query client. */
export function DraftsList({ rows, onDelete, deletingId = null, now }: DraftsListProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-12 text-center" data-compose="drafts-empty">
        <FileText className="h-8 w-8 text-brand-text/40" aria-hidden="true" />
        <p className="text-[15px] font-semibold text-brand-text">No drafts</p>
        <p className="max-w-xs text-[13px] text-brand-text/60">Save a post with Drafts and it waits here until you post it.</p>
      </div>
    )
  }
  return (
    <ul className="divide-y divide-brand-divider" aria-label="Drafts" data-compose="drafts-list">
      {rows.map((row) => {
        const summary = draftSummary(row, now)
        const deleting = deletingId === row.id
        return (
          <li key={row.id} className="flex items-center gap-3 py-3" data-draft={row.id}>
            <Link href={draftHref(row.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl hover:bg-brand-secondary/60">
              <span className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-secondary">
                {summary.thumbMediaId ? (
                  <img src={mediaServeUrl(summary.thumbMediaId)} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <FileText className="h-5 w-5 text-brand-text/50" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-brand-text">{summary.heading}</span>
                <span className="block truncate text-[12px] text-brand-text/60">{summary.meta}</span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => onDelete(row)}
              disabled={deleting}
              aria-label={`Delete draft ${summary.heading}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand-text/70 hover:bg-brand-secondary hover:text-danger disabled:opacity-40"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
