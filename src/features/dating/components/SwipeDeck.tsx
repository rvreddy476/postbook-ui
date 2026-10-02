"use client"

/*
  The card stack. This component only reports what the person asked for;
  it never removes a card. The screen removes one after the server accepts,
  and until then the card is held where it was thrown (`pending`). A refusal
  clears `pending` and the card settles back.

    drag right / ArrowRight  spark
    drag left  / ArrowLeft   pass
    tap / Enter / Space      open the full profile
    ArrowUp                  reserved for Super Spark (off until it is wired)
*/

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { BadgeCheck, Bookmark, Sparkles, X, Zap } from "lucide-react"

import { metaLine, nameLine } from "../model/people"
import { actionForDrag, actionForKey, type DeckCard, type SwipeAction } from "../model/pulse"
import { DatingPhoto } from "./DatingPhoto"

const TAP_SLOP_PX = 6

export interface SwipeDeckProps {
  /** Top card first. Only the first two are drawn. */
  cards: DeckCard[]
  /** The action the server is deciding for the top card, if any. */
  pending?: SwipeAction | null
  onAction: (action: SwipeAction, card: DeckCard) => void
  /** Super Spark is not wired yet: the control renders disabled unless this is true. */
  superSparkEnabled?: boolean
}

export function SwipeDeck({ cards, pending = null, onAction, superSparkEnabled = false }: SwipeDeckProps) {
  const [dx, setDx] = useState(0)
  const drag = useRef<{ startX: number; moved: number } | null>(null)
  const top = cards[0]
  const next = cards[1]
  if (!top) return null

  const busy = pending !== null
  const act = (action: SwipeAction) => {
    if (busy) return
    if (action === "super_spark" && !superSparkEnabled) return
    onAction(action, top)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (busy || (e.pointerType === "mouse" && e.button !== 0)) return
    drag.current = { startX: e.clientX, moved: 0 }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const delta = e.clientX - drag.current.startX
    drag.current.moved = Math.max(drag.current.moved, Math.abs(delta))
    setDx(delta)
  }
  const endDrag = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current
    if (!d) return
    drag.current = null
    const delta = e.clientX - d.startX
    setDx(0)
    if (cancelled) return
    if (d.moved < TAP_SLOP_PX) {
      act("open")
      return
    }
    const action = actionForDrag(delta)
    if (action) act(action)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    const action = actionForKey(e.key, superSparkEnabled)
    if (!action) return
    e.preventDefault()
    act(action)
  }

  const person = top.person
  const leaning = pending === "spark" ? "right" : pending === "pass" ? "left" : pending === "stash" ? "down" : dx > 24 ? "right" : dx < -24 ? "left" : ""
  const facts = metaLine(person)

  return (
    <div className="pulse-deck">
      <div className="pulse-deck__stack">
        {next ? (
          <div className="pulse-card pulse-card--under" aria-hidden="true">
            <DatingPhoto path={next.person.photoUrl} alt="" className="pulse-card__photo" />
          </div>
        ) : null}
        <div
          className="pulse-card pulse-card--top"
          role="group"
          tabIndex={0}
          aria-roledescription="profile card"
          aria-label={`${nameLine(person)}. Arrow right to spark, arrow left to pass, Enter to open the profile.`}
          aria-busy={busy || undefined}
          data-lean={leaning || undefined}
          data-pending={pending || undefined}
          style={drag.current && !busy ? { transform: `translateX(${dx}px) rotate(${dx / 28}deg)`, transition: "none" } : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e, false)}
          onPointerCancel={(e) => endDrag(e, true)}
          onKeyDown={onKeyDown}
        >
          <DatingPhoto path={person.photoUrl} alt={`${person.firstName || "Profile"} photo`} className="pulse-card__photo" />
          <span className="pulse-card__stamp pulse-card__stamp--spark" aria-hidden="true">
            Spark
          </span>
          <span className="pulse-card__stamp pulse-card__stamp--pass" aria-hidden="true">
            Pass
          </span>
          <div className="pulse-card__info">
            <p className="pulse-card__name">
              {nameLine(person)}
              {person.verified ? (
                <span className="pulse-verified" title="Verified">
                  <BadgeCheck size={16} aria-hidden="true" />
                  <span className="pulse-sr">Verified</span>
                </span>
              ) : null}
            </p>
            {facts.length ? <p className="pulse-card__meta">{facts.join(" · ")}</p> : null}
            {top.reasons.length ? <p className="pulse-card__meta">{top.reasons.join(" · ")}</p> : null}
          </div>
        </div>
      </div>

      <div className="pulse-deck__actions" role="group" aria-label="Card actions">
        <button type="button" className="pulse-act pulse-act--pass" onClick={() => act("pass")} disabled={busy} aria-label="Pass">
          <X size={22} aria-hidden="true" />
        </button>
        <button type="button" className="pulse-act" onClick={() => act("stash")} disabled={busy} aria-label="Save for later">
          <Bookmark size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="pulse-act"
          onClick={() => act("super_spark")}
          disabled={!superSparkEnabled || busy}
          aria-label={superSparkEnabled ? "Super Spark" : "Super Spark, not available yet"}
          title={superSparkEnabled ? "Super Spark" : "Super Spark is coming soon"}
        >
          <Zap size={20} aria-hidden="true" />
        </button>
        <button type="button" className="pulse-act pulse-act--spark" onClick={() => act("spark")} disabled={busy} aria-label="Spark">
          <Sparkles size={22} aria-hidden="true" />
        </button>
      </div>
      <p className="pulse-deck__hint">Drag the card, or use the arrow keys. Enter opens the full profile.</p>
    </div>
  )
}
