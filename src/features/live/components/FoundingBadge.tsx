"use client"

import { useRef } from "react"
import { Award } from "lucide-react"

import { useUserBadges } from "@/hooks/useLiveV2"
import { foundingEarnedStep, hasFoundingBadge, parseBadges } from "../discovery"
import "../surfaces.css"

export const FOUNDING_LABEL = "Founding creator"
export const FOUNDING_TOOLTIP = "One of the first creators to go live here"
export const FOUNDING_EARNED_COPY = "You earned the Founding creator badge."

/**
 * The permanent badge of a creator who streamed early. `badges` is the
 * creator card's list as it came (absent, empty or without the badge →
 * nothing is rendered). `compact` is the icon alone, for tiles.
 */
export function FoundingBadge({ badges, compact = false }: { badges: unknown; compact?: boolean }) {
  if (!hasFoundingBadge(parseBadges(badges))) return null
  return (
    <span className={`live-founding${compact ? " live-founding--compact" : ""}`} title={FOUNDING_TOOLTIP} role="img" aria-label={`${FOUNDING_LABEL}: ${FOUNDING_TOOLTIP}`}>
      <Award aria-hidden="true" />
      {compact ? null : <span aria-hidden="true">{FOUNDING_LABEL}</span>}
    </span>
  )
}

/** The badge of a user read through GET /users/:userId/badges (the channel masthead). Absent or failed → nothing. */
export function UserFoundingBadge({ userId, compact }: { userId: string | null | undefined; compact?: boolean }) {
  const { data } = useUserBadges(userId)
  return <FoundingBadge badges={data} compact={compact} />
}

type StreamLike = { status?: unknown; creator?: { badges?: unknown } | null } | null | undefined

/**
 * True once the host's stream is over and the badge is on their card when
 * it was not before the stream. "Before" is the card on the first row this
 * page saw while the stream was not yet over; a page opened on a finished
 * stream never claims the badge was just earned.
 */
export function useFoundingEarned(stream: StreamLike): boolean {
  const before = useRef<string[] | null>(null)
  const step = foundingEarnedStep(before.current, stream)
  before.current = step.before
  return step.earned
}

/** The one line on the host's ended panel. */
export function FoundingEarnedNote({ stream }: { stream: StreamLike }) {
  if (!useFoundingEarned(stream)) return null
  return (
    <p className="live-founding-note" role="status">
      <Award aria-hidden="true" />
      {FOUNDING_EARNED_COPY}
    </p>
  )
}
