"use client"

/*
  What a non-member sees in place of members-only content: the title and
  cover the server keeps on a redacted row, a lock, and Join (the Join
  sheet). Never the caption, text or media — the server does not send them,
  and these cards do not ask for them.
*/

import { Lock, MessageCircle } from "lucide-react"

import { formatDuration } from "../model"
import { JoinButton } from "./JoinButton"

import "../memberships.css"

interface LockProps {
  creatorId: string
  creatorName?: string
  tierRequiredId?: string | null
  /** The row's tier_required_price_paise: lets the Join sheet highlight the levels that unlock it. */
  requiredPricePaise?: number | null
}

/** A post card's body when it is locked. */
export function PostLock({ creatorId, creatorName, tierRequiredId, requiredPricePaise, durationMs = 0 }: LockProps & { durationMs?: number }) {
  const who = creatorName?.trim()
  const length = formatDuration(durationMs)
  return (
    <div data-membership="post-lock" className="my-3 rounded-2xl border border-brand-divider bg-brand-secondary px-5 py-6 text-center">
      <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary-tint text-primary-ink">
        <Lock className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-base font-semibold text-brand-text">Members only</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {who ? `Join ${who}'s membership to see this post.` : "Join this creator's membership to see this post."}
        {length ? ` Video · ${length}` : ""}
      </p>
      <div className="mt-4">
        <JoinButton creatorId={creatorId} creatorName={creatorName} requiredTierId={tierRequiredId} requiredPricePaise={requiredPricePaise} />
      </div>
    </div>
  )
}

/** The small badge a member (or the author) sees on members-only content. */
export function MembersBadge({ className = "" }: { className?: string }) {
  return (
    <span data-membership="badge" className={`inline-flex items-center gap-1 rounded-full bg-primary-tint px-2 py-0.5 text-xs font-semibold text-primary-ink ${className}`}>
      <Lock className="h-3 w-3" aria-hidden="true" /> Members
    </span>
  )
}

/**
  A reel on the stage, locked: the cover blurred behind a lock and Join. No
  caption, no player. `inline` draws it as a 16:9 card (the watch page's
  player slot) instead of filling its parent.
*/
export function StageLock({
  creatorId,
  creatorName,
  tierRequiredId,
  requiredPricePaise,
  coverUrl,
  title,
  durationMs = 0,
  kind = "reel",
  inline = false,
}: LockProps & { coverUrl?: string | null; title?: string; durationMs?: number; kind?: "reel" | "video"; inline?: boolean }) {
  const who = creatorName?.trim()
  const length = formatDuration(durationMs)
  const what = kind === "video" ? "video" : "short"
  return (
    <div data-membership={kind === "video" ? "video-lock" : "reel-lock"} className={`mship-stage-lock${inline ? " mship-stage-lock--inline" : ""}`}>
      {coverUrl ? <span className="mship-stage-lock__cover" style={{ backgroundImage: `url("${coverUrl}")` }} aria-hidden="true" /> : null}
      <span className="mship-stage-lock__icon">
        <Lock size={22} aria-hidden="true" />
      </span>
      <p className="mship-stage-lock__title">Members only</p>
      {title ? <p className="mship-stage-lock__hint">{title}</p> : null}
      <p className="mship-stage-lock__hint">{who ? `${who} shares this ${what} with members. Join to watch it.` : `Join to watch this ${what}.`}</p>
      {length ? <p className="mship-stage-lock__meta">{length}</p> : null}
      <JoinButton creatorId={creatorId} creatorName={creatorName} requiredTierId={tierRequiredId} requiredPricePaise={requiredPricePaise} />
    </div>
  )
}

/** The comments panel on a members-only post, for a non-member (403 MEMBERS_ONLY). */
export function CommentsLock({ creatorId, creatorName, tierRequiredId, requiredPricePaise }: LockProps) {
  return (
    <div data-membership="comments-lock" role="status" className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-secondary text-muted-foreground">
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-brand-text">Only members can read and write comments</p>
      <JoinButton creatorId={creatorId} creatorName={creatorName} requiredTierId={tierRequiredId} requiredPricePaise={requiredPricePaise} />
    </div>
  )
}
