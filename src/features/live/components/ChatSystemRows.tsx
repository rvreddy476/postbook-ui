import { Pin, UserPlus } from "lucide-react"

/**
 * A system line in the chat list ("Asha and 3 others joined"). It is not a
 * message: no author, no menu, never stored (features/live/joins.ts).
 */
export function ChatJoinRow({ label }: { label: string }) {
  if (!label) return null
  return (
    <div className="live-chat__system" data-system="joined">
      <UserPlus size={13} aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

/** The pinned message above the chat list, for everyone in the room. */
export function PinnedMessageBar({
  name,
  text,
  canUnpin,
  onUnpin,
  busy,
}: {
  name: string
  text: string
  canUnpin?: boolean
  onUnpin?: () => void
  busy?: boolean
}) {
  return (
    <div className="live-chat__pinned" role="note" aria-label="Pinned message">
      <Pin size={14} aria-hidden="true" className="live-chat__pinned-icon" />
      <div className="live-chat__pinned-text">
        <span className="live-chat__name">{name}</span>
        <p className="live-chat__message">{text}</p>
      </div>
      {canUnpin ? (
        <button type="button" className="live-btn live-btn--ghost live-chat__unpin" disabled={busy} onClick={onUnpin}>
          Unpin
        </button>
      ) : null}
    </div>
  )
}
