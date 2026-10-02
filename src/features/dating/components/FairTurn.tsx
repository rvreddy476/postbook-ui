"use client"

/*
  Fair turn (mechanic M11): the calm note over the deck while new sparks are
  on hold because matches are waiting on the viewer's reply. Presentational
  only; the screen decides when it shows (model/fairTurn currentFairTurn).
*/

import { MessagesSquare } from "lucide-react"

import { FAIR_TURN_BODY, FAIR_TURN_MATCHES_HREF, fairTurnHeadline, type FairTurn } from "../model/fairTurn"
import { LinkButton } from "./kit"

export function FairTurnNotice({ turn }: { turn: FairTurn }) {
  return (
    <section className="pulse-fairturn" role="status" aria-labelledby="pulse-fairturn-title">
      <span className="pulse-fairturn__icon" aria-hidden="true">
        <MessagesSquare size={18} />
      </span>
      <div className="pulse-fairturn__text">
        <h2 id="pulse-fairturn-title" className="pulse-fairturn__title">
          {fairTurnHeadline(turn)}
        </h2>
        <p className="pulse-fairturn__body">{FAIR_TURN_BODY}</p>
      </div>
      <LinkButton href={FAIR_TURN_MATCHES_HREF} variant="primary" icon={MessagesSquare}>
        Go to matches
      </LinkButton>
    </section>
  )
}
