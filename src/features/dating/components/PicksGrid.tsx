"use client"

/*
  Daily picks (mechanic M7): the grid, and one pick opened in full.
  Presentational only — the screen wires the mutations — so the tests can
  render it.

  Every spark and pass made here is sent with `source: "picks"` (PICKS_SOURCE)
  by the screen, so it spends no deck card. Opening one draws the card the
  picks read already carried, with Spark and Pass beside it. GET /people/:id
  also allows one of today's picks, so the opened pick links to the person
  page too (a page to come back to; it has no actions of its own).
*/

import type { ReactNode } from "react"
import { BadgeCheck, ChevronLeft, Sparkles, UserRound, X } from "lucide-react"

import { nameLine, personHref } from "../model/people"
import { pickTileLabel } from "../model/picks"
import type { DeckCard } from "../model/pulse"
import type { ActionSource } from "../model/sparks"
import { DatingPhoto } from "./DatingPhoto"
import { Button, LinkButton, TravelPill } from "./kit"

/** Where every action on this page comes from. */
export const PICKS_SOURCE: ActionSource = "picks"

export type PickAction = "spark" | "pass"

export interface PickActionsProps {
  /** The candidate the server is deciding for, if any. */
  acting?: string
  /** Which action that is. */
  pending?: PickAction | null
  onSpark: (card: DeckCard) => void
  onPass: (card: DeckCard) => void
}

function PickActions({ card, acting = "", pending = null, onSpark, onPass }: PickActionsProps & { card: DeckCard }) {
  const busy = acting === card.candidateId
  const anyBusy = acting !== ""
  const first = card.person.firstName || "them"
  return (
    <div className="pulse-pick__actions" data-source={PICKS_SOURCE}>
      <Button variant="quiet" icon={X} busy={busy && pending === "pass"} disabled={anyBusy} onClick={() => onPass(card)} aria-label={`Pass on ${first}`}>
        Pass
      </Button>
      <Button variant="primary" icon={Sparkles} busy={busy && pending === "spark"} disabled={anyBusy} onClick={() => onSpark(card)} aria-label={`Spark ${first}`}>
        Spark
      </Button>
    </div>
  )
}

export function PickTile({ card, onOpen, ...actions }: PickActionsProps & { card: DeckCard; onOpen: (card: DeckCard) => void }) {
  const person = card.person
  return (
    <li className="pulse-like">
      <button type="button" className="pulse-like__tile" aria-label={pickTileLabel(card)} onClick={() => onOpen(card)}>
        <DatingPhoto path={person.photoUrl} alt="" className="pulse-like__photo" />
        {person.travelling ? (
          <span className="pulse-like__travel" aria-hidden="true">
            <TravelPill person={person} />
          </span>
        ) : null}
        <span className="pulse-like__caption" aria-hidden="true">
          <span className="pulse-like__name">{nameLine(person)}</span>
          {person.verified ? <BadgeCheck size={14} className="pulse-like__verified" /> : null}
        </span>
      </button>
      <PickActions card={card} {...actions} />
    </li>
  )
}

/** Today's picks in the server's order. */
export function PicksGrid({ cards, onOpen, ...actions }: PickActionsProps & { cards: DeckCard[]; onOpen: (card: DeckCard) => void }) {
  return (
    <ul className="pulse-likes" aria-label="Today's picks">
      {cards.map((card) => (
        <PickTile key={card.candidateId} card={card} onOpen={onOpen} {...actions} />
      ))}
    </ul>
  )
}

/** One pick opened in full, with the same two actions; `details` is the person page's body. */
export function PickOpen({ card, details, safety, onBack, ...actions }: PickActionsProps & { card: DeckCard; details: ReactNode; safety?: ReactNode; onBack: () => void }) {
  return (
    <div className="pulse-stack">
      <div className="pulse-row">
        <Button variant="quiet" icon={ChevronLeft} onClick={onBack}>
          Back to picks
        </Button>
        {card.person.userId ? (
          <LinkButton href={personHref(card.person.userId)} variant="quiet" icon={UserRound}>
            Full profile
          </LinkButton>
        ) : null}
      </div>
      {details}
      <PickActions card={card} {...actions} />
      {safety}
    </div>
  )
}
