"use client"

/*
  Who liked you (mechanic M4): the grid. Presentational only — the screen
  wires the router and the mutations — so the tests can render it.

  Locked: the server's blurred image for each card, a Super Spark star, a lock
  pill, and the way to a pass. A locked card carries no person, so nothing
  here can name one; its image route only ever serves the blurred variant.
  Unlocked: each person, with Spark back and Decline.
*/

import { BadgeCheck, Crown, Layers, Lock, Sparkles, Star } from "lucide-react"

import { LIKED_YOU_CTA, lockedTileLabel, moreThanShown, unlockedTileLabel, type LikedYou, type LikedYouCard } from "../model/likedYou"
import { nameLine } from "../model/people"
import { DATING_BASE } from "../model/profile"
import { DatingPhoto } from "./DatingPhoto"
import { Button, LinkButton } from "./kit"

export const PREMIUM_HREF = `${DATING_BASE}/premium`

function SuperStar() {
  return (
    <span className="pulse-like__star" aria-hidden="true">
      <Star size={12} />
    </span>
  )
}

/** The call to action over a locked grid. */
export function LikedYouUpsell({ total }: { total: number }) {
  return (
    <section className="pulse-likes__upsell" aria-labelledby="pulse-likes-upsell-title">
      <span className="pulse-likes__upsell-icon" aria-hidden="true">
        <Lock size={20} />
      </span>
      <div className="pulse-likes__upsell-text">
        <h2 id="pulse-likes-upsell-title" className="pulse-likes__upsell-title">
          {total === 1 ? "Someone is waiting to hear back" : `${total} people are waiting to hear back`}
        </h2>
        <p className="pulse-likes__upsell-body">Their photos stay blurred until you have a pass. Without one, you may still meet them in your deck.</p>
      </div>
      <div className="pulse-likes__upsell-actions">
        <LinkButton href={PREMIUM_HREF} variant="primary" icon={Crown}>
          {LIKED_YOU_CTA}
        </LinkButton>
        <LinkButton href={DATING_BASE} icon={Layers}>
          Open the deck
        </LinkButton>
      </div>
    </section>
  )
}

/** A blurred card. Clicking it leads to the same upsell as the button. */
export function LockedTile({ card, onUpsell }: { card: LikedYouCard; onUpsell: () => void }) {
  return (
    <li className={card.isSuper ? "pulse-like pulse-like--super" : "pulse-like"}>
      <button type="button" className="pulse-like__tile" aria-label={lockedTileLabel(card)} onClick={onUpsell}>
        <DatingPhoto path={card.photoUrl} alt="" className="pulse-like__photo" />
        {card.isSuper ? <SuperStar /> : null}
        <span className="pulse-like__lock" aria-hidden="true">
          <Lock size={12} />
          <span>Hidden</span>
        </span>
      </button>
    </li>
  )
}

export function UnlockedTile({
  card,
  acting,
  accepting,
  onOpen,
  onAccept,
  onDecline,
}: {
  card: LikedYouCard
  acting: string
  accepting: boolean
  onOpen: (card: LikedYouCard) => void
  onAccept: (card: LikedYouCard) => void
  onDecline: (card: LikedYouCard) => void
}) {
  const person = card.person
  const busy = acting === card.sparkId
  const first = person?.firstName || "them"
  return (
    <li className={card.isSuper ? "pulse-like pulse-like--super" : "pulse-like"}>
      <button type="button" className="pulse-like__tile" aria-label={unlockedTileLabel(card)} disabled={!person} onClick={() => onOpen(card)}>
        <DatingPhoto path={card.photoUrl} alt="" className="pulse-like__photo" />
        {card.isSuper ? <SuperStar /> : null}
        <span className="pulse-like__caption" aria-hidden="true">
          <span className="pulse-like__name">{person ? nameLine(person) : "Someone who has left Pulse"}</span>
          {person?.verified ? <BadgeCheck size={14} className="pulse-like__verified" /> : null}
        </span>
      </button>
      {card.note ? <p className="pulse-like__note">“{card.note}”</p> : null}
      <div className="pulse-like__actions">
        <Button variant="primary" icon={Sparkles} busy={busy && accepting} disabled={busy || !person} onClick={() => onAccept(card)} aria-label={`Spark back to ${first}`}>
          Spark back
        </Button>
        <Button variant="quiet" disabled={busy} onClick={() => onDecline(card)} aria-label={`Decline ${first}`}>
          Decline
        </Button>
      </div>
    </li>
  )
}

/** The grid in the server's order (Super Sparks first). */
export function LikedYouGrid({
  data,
  acting = "",
  accepting = false,
  onOpen,
  onUpsell,
  onAccept,
  onDecline,
}: {
  data: LikedYou
  acting?: string
  accepting?: boolean
  onOpen: (card: LikedYouCard) => void
  onUpsell: () => void
  onAccept: (card: LikedYouCard) => void
  onDecline: (card: LikedYouCard) => void
}) {
  const more = moreThanShown(data)
  return (
    <>
      {data.unlocked ? null : <LikedYouUpsell total={data.total} />}
      <ul className="pulse-likes" aria-label={data.unlocked ? "People who sparked you" : "Hidden sparks"}>
        {data.cards.map((card) =>
          data.unlocked ? (
            <UnlockedTile key={card.sparkId} card={card} acting={acting} accepting={accepting} onOpen={onOpen} onAccept={onAccept} onDecline={onDecline} />
          ) : (
            <LockedTile key={card.sparkId} card={card} onUpsell={onUpsell} />
          ),
        )}
      </ul>
      {more > 0 ? <p className="pulse-likes__more">And {more} more.</p> : null}
    </>
  )
}
