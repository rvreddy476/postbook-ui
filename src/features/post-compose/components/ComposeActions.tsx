"use client"

import { Loader2, Send } from "lucide-react"

export interface ComposeActionsProps {
  onDrafts: () => void
  onPost: () => void
  canPost: boolean
  posting: boolean
  savingDraft: boolean
  /** Why a draft cannot be saved now, shown as the button's description; null when it can. */
  draftBlocked?: string | null
  /** "Drafts" in a new post, "Save" in a draft being edited. */
  draftsLabel?: string
  postLabel?: string
}

/*
  The two buttons at the foot of the details: Drafts (saves a server draft)
  and Post. Neither goes while the other is running.
*/
export function ComposeActions({
  onDrafts,
  onPost,
  canPost,
  posting,
  savingDraft,
  draftBlocked = null,
  draftsLabel = "Drafts",
  postLabel = "Post",
}: ComposeActionsProps) {
  const busy = posting || savingDraft
  return (
    <div className="flex w-full items-center gap-3" data-compose="actions">
      <button
        type="button"
        onClick={onDrafts}
        disabled={busy || !canPost || Boolean(draftBlocked)}
        title={draftBlocked ?? undefined}
        aria-describedby={draftBlocked ? "post-compose-draft-blocked" : undefined}
        data-action="drafts"
        className="flex flex-1 items-center justify-center gap-2 rounded-full border border-brand-divider bg-brand-secondary px-5 py-2.5 text-[14px] font-semibold text-brand-text transition hover:bg-brand-text/10 disabled:opacity-40"
      >
        {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {savingDraft ? "Saving…" : draftsLabel}
      </button>
      {draftBlocked ? (
        <span id="post-compose-draft-blocked" className="sr-only">
          {draftBlocked}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onPost}
        disabled={busy || !canPost}
        data-action="post"
        className="bg-primary-grad flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold text-primary-foreground shadow-sm transition hover:shadow-md active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
      >
        {posting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
        {posting ? "Posting…" : postLabel}
      </button>
    </div>
  )
}
