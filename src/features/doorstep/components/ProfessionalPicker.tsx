"use client"

/*
  The professionals list (B1), shared by the booking step
  (/doorstep/s/[id]/pros) and the change-of-professional panel on a
  pro_unavailable booking.

    * Scheduled | As soon as possible, a date row (soonest + the next days)
      and the sort (price, rating, soonest — the server sorts);
    * one card per professional: first name, rating, jobs, the DISTANCE
      BAND only, their GST-inclusive price for exactly this selection, and
      their free times (scheduled) or an ETA (ASAP);
    * ASAP with nobody: says so and shows the scheduled alternatives at once
      as timed picks — the choices already made are kept.
*/

import { CalendarX2, MapPin, Star, UserRound, Zap } from "lucide-react"
import { useState } from "react"

import { changeMoney, changeMoneyLine } from "../model/proChange"
import { cardView, cityDates, listOutcome, offeredMode, pickFor, type ListView, type ProPick } from "../model/professionals"
import { dayParts } from "../model/slots"
import type { ListMode, ProfessionalCard, ProfessionalList, ProSort } from "../model/wire"
import { ErrorState, MediaImg, Skel, StateBlock } from "./parts"

const SORT_LABELS: { value: ProSort; label: string }[] = [
  { value: "price", label: "Price" },
  { value: "rating", label: "Rating" },
  { value: "soonest", label: "Soonest" },
]

/** Mode, date and sort. Changing any of them keeps everything else. */
export function ListControls({ view, onChange, now, days = 7 }: { view: ListView; onChange: (v: ListView) => void; now: number; days?: number }) {
  const dates = cityDates(now, days)
  return (
    <div className="ds-stack" style={{ gap: 10 }}>
      <div className="ds-seg" role="group" aria-label="When">
        <button type="button" aria-pressed={view.mode === "scheduled"} onClick={() => onChange({ ...view, mode: "scheduled" })}>
          Scheduled
        </button>
        <button type="button" aria-pressed={view.mode === "asap"} onClick={() => onChange({ ...view, mode: "asap", date: null })}>
          <Zap size={13} aria-hidden="true" /> As soon as possible
        </button>
      </div>
      {view.mode === "scheduled" ? (
        <ul className="ds-days" aria-label="Day">
          <li>
            <button type="button" className="ds-day" aria-pressed={view.date === null} onClick={() => onChange({ ...view, date: null })}>
              <span>Next</span>
              <strong>free</strong>
              <span>times</span>
            </button>
          </li>
          {dates.map((d) => {
            const p = dayParts(d)
            return (
              <li key={d}>
                <button type="button" className="ds-day" aria-pressed={view.date === d} onClick={() => onChange({ ...view, date: d })} aria-label={`${p.weekday} ${p.day} ${p.month}`}>
                  <span>{p.weekday}</span>
                  <strong>{p.day}</strong>
                  <span>{p.month}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
      <div className="ds-row ds-wrap" role="group" aria-label="Sort by">
        <span className="ds-meta">Sort by</span>
        {SORT_LABELS.map((s) => (
          <button key={s.value} type="button" className="ds-chip" aria-pressed={view.sort === s.value} onClick={() => onChange({ ...view, sort: s.value })}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ProCardItem({
  card,
  mode,
  zone,
  oneDate,
  showDifference,
  busy,
  onPick,
}: {
  card: ProfessionalCard
  mode: ListMode
  zone: string
  oneDate: boolean
  showDifference: boolean
  busy: boolean
  onPick: (pick: ProPick, card: ProfessionalCard) => void
}) {
  const v = cardView(card, mode, { zone, oneDate })
  const money = showDifference ? changeMoney(card.differencePaise) : null
  const [open, setOpen] = useState(false)
  const pick = (how: { asap: true } | { slotStart: string }) => {
    const p = pickFor(card, how)
    if (p) onPick(p, card)
  }
  return (
    <li className="ds-procard">
      <div className="ds-pro">
        {card.photoMediaId ? (
          <MediaImg mediaId={card.photoMediaId} alt={v.name} className="ds-avatar" />
        ) : (
          <span className="ds-avatar" aria-hidden="true">
            <UserRound size={20} />
          </span>
        )}
        <div className="ds-grow">
          <strong>{v.name}</strong>
          <span className="ds-meta ds-row ds-wrap" style={{ gap: 6 }}>
            <span className="ds-row" style={{ gap: 3 }}>
              <Star size={11} aria-hidden="true" />
              {v.rating}
            </span>
            <span>· {v.jobs}</span>
            <span className="ds-row" style={{ gap: 3 }}>
              · <MapPin size={11} aria-hidden="true" />
              {v.distance}
            </span>
          </span>
        </div>
        <div className="ds-procard__price">
          <span className="ds-price">{v.price}</span>
          <span className="ds-meta">incl. GST</span>
        </div>
      </div>

      {money && money.kind !== "unknown" ? <p className={money.kind === "charge" ? "ds-warnbox" : "ds-info"}>{changeMoneyLine(money)}</p> : null}

      <button type="button" className="ds-link ds-procard__more" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide price details" : "Price details"}
      </button>
      {open ? (
        <ul className="ds-list-plain ds-meta">
          {v.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : null}

      {mode === "asap" ? (
        <div className="ds-row ds-wrap">
          <span className="ds-grow ds-row" style={{ gap: 4 }}>
            <Zap size={13} aria-hidden="true" />
            {v.eta ?? "Available now"}
          </span>
          <button type="button" className="ds-btn ds-btn--primary ds-btn--sm" disabled={busy || card.etaMinutes === null} onClick={() => pick({ asap: true })}>
            Book {v.name} now
          </button>
        </div>
      ) : v.times.length ? (
        <div className="ds-stack" style={{ gap: 6 }}>
          <span className="ds-meta">Free {oneDate ? "on this day" : "next"}{v.sameDay ? " · also takes same-day jobs" : ""}</span>
          <ul className="ds-slots" aria-label={`${v.name}'s free times`}>
            {v.times.map((t) => (
              <li key={t.start}>
                <button type="button" className="ds-slot" disabled={busy} onClick={() => pick({ slotStart: t.start })}>
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="ds-note">No free time {oneDate ? "on this day" : "soon"}.</p>
      )}
    </li>
  )
}

/**
  The list with its states. `list` is the server's answer; the cards are
  drawn in the server's order. In the ASAP-nobody case the alternatives are
  drawn as a scheduled list, and `onSwitchToScheduled` moves the whole view
  to scheduled with the same choices.
*/
export function ProList({
  list,
  loading,
  error,
  onRetry,
  showDifference = false,
  busy,
  onPick,
  onSwitchToScheduled,
  emptyText,
}: {
  list: ProfessionalList | undefined
  loading: boolean
  error: unknown
  onRetry: () => void
  showDifference?: boolean
  busy: boolean
  onPick: (pick: ProPick, card: ProfessionalCard) => void
  onSwitchToScheduled: () => void
  emptyText: string
}) {
  if (loading) {
    return (
      <div className="ds-stack">
        <Skel h={120} />
        <Skel h={120} />
      </div>
    )
  }
  if (error || !list) return <ErrorState error={error} what="The professionals" onRetry={onRetry} />

  const outcome = listOutcome(list)
  const mode = offeredMode(outcome)
  const oneDate = list.date !== null
  const cards = outcome.kind === "cards" ? outcome.cards : outcome.kind === "asap_none" ? outcome.alternatives : []

  return (
    <div className="ds-stack">
      {outcome.kind === "asap_none" ? (
        <div className="ds-warnbox ds-stack" role="status" style={{ gap: 6 }}>
          <strong>Nobody is free right now.</strong>
          <span>
            {cards.length
              ? "Here are the next free times instead, for the same choices and address. Pick a time, or check again in a few minutes."
              : "Nobody has a free time soon either. Try another day."}
          </span>
          <button type="button" className="ds-btn ds-btn--outline ds-btn--sm" style={{ alignSelf: "flex-start" }} onClick={onSwitchToScheduled}>
            Choose a day instead
          </button>
        </div>
      ) : null}
      {outcome.kind === "empty" ? (
        <StateBlock icon={<CalendarX2 size={22} />} title={outcome.mode === "asap" ? "Nobody is free right now" : "No professional is free"} text={emptyText} />
      ) : null}
      {cards.length ? (
        <ul className="ds-procards" aria-label="Professionals">
          {cards.map((c) => (
            <ProCardItem key={c.proId} card={c} mode={mode} zone={list.timezone} oneDate={oneDate && outcome.kind === "cards"} showDifference={showDifference} busy={busy} onPick={onPick} />
          ))}
        </ul>
      ) : null}
      <p className="ds-note">Times are in Hyderabad time. Distance is shown as a range only; a professional&apos;s exact location is never shared.</p>
    </div>
  )
}
