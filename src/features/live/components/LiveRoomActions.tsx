import Link from "next/link"
import { Share2, UserCheck, UserPlus } from "lucide-react"

import type { ChatRole } from "../chat"

/**
 * Follow and Share in the room header of /live/[streamId] (parity audit
 * T-29). Viewers only: the host neither follows nor is offered Share here
 * (the studio has its own link).
 *
 *   signed out          Follow is a link to sign in, back to this room
 *   relationship loads  Follow waits (disabled)
 *   following           "Following" (pressed); pressing it unfollows
 *   no handle / blocked Follow is not offered (canFollow false)
 */
export function LiveRoomActions({
  role,
  canFollow,
  following,
  pending,
  signInHref,
  onToggleFollow,
  onShare,
}: {
  role: ChatRole
  /** A followable host: we know their handle and neither side blocks the other. */
  canFollow: boolean
  /** undefined while the relationship is loading. */
  following: boolean | undefined
  pending?: boolean
  signInHref: string
  onToggleFollow: () => void
  onShare: () => void
}) {
  if (role === "host") return null
  return (
    <div className="live-room-actions" data-testid="live-room-actions">
      {!canFollow ? null : role === "guest" ? (
        <Link href={signInHref} className="live-btn live-btn--primary">
          <UserPlus className="h-4 w-4" aria-hidden="true" /> Follow
        </Link>
      ) : (
        <button
          type="button"
          className={`live-btn ${following ? "live-btn--ghost live-follow--on" : "live-btn--primary"}`}
          aria-pressed={following === true}
          aria-busy={following === undefined || pending ? true : undefined}
          disabled={following === undefined || pending}
          onClick={onToggleFollow}
        >
          {following ? <UserCheck className="h-4 w-4" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
          {following ? "Following" : "Follow"}
        </button>
      )}
      <button type="button" className="live-btn live-btn--ghost" onClick={onShare} aria-label="Share this live stream">
        <Share2 className="h-4 w-4" aria-hidden="true" /> Share
      </button>
    </div>
  )
}
