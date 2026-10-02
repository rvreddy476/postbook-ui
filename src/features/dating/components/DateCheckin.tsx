"use client"

/*
  After-date check-ins (mechanic M14). Presentational only, so the tests can
  render them; the screens read the server and wire the actions.

    CheckinCards: "How did it go?" at the top of the matches page, one card
                  per ask, each leading to the match page's sheet;
    CheckinForm:  the questions — did you meet, then (only after yes) would
                  you meet again and did you feel safe, both optional;
    CheckinDone:  the answer in: thanks, or support and the way to report.
*/

import Link from "next/link"
import { CalendarHeart, Flag, ShieldCheck } from "lucide-react"

import { AGAIN_OPTIONS, checkinCardTitle, checkinHref, MET_OPTIONS, SAFE_OPTIONS, showFollowUps, supportLine, type AgainAnswer, type CheckinForm as Form, type DateCheckin, type MetAnswer } from "../model/dateCheckin"
import { DATING_BASE } from "../model/profile"
import { Button, Choices, LinkButton, Notice, Panel } from "./kit"

export const SAFETY_HREF = `${DATING_BASE}/safety`

export function CheckinCards({ items }: { items: DateCheckin[] }) {
  if (items.length === 0) return null
  return (
    <ul className="pulse-list" aria-label="Dates to tell us about">
      {items.map((c) => (
        <li key={c.matchId} className="pulse-checkin">
          <span className="pulse-checkin__icon" aria-hidden="true">
            <CalendarHeart size={18} />
          </span>
          <div className="pulse-checkin__text">
            <p className="pulse-checkin__title">{checkinCardTitle(c.person.firstName)}</p>
            <p className="pulse-checkin__body">A quick answer helps us keep Pulse safe. Only our team sees it.</p>
          </div>
          <LinkButton href={checkinHref(c.matchId)} variant="primary">
            Answer
          </LinkButton>
        </li>
      ))}
    </ul>
  )
}

/** The match page's unprompted way in. */
export function CheckinEntry({ onOpen }: { onOpen: () => void }) {
  return (
    <Panel title="Met up?" sub="Tell us how it went. Only our team sees your answer.">
      <div className="pulse-row">
        <Button icon={CalendarHeart} onClick={onOpen}>
          We met
        </Button>
      </div>
    </Panel>
  )
}

const safeValue =(v: boolean | null) => (v === null ? "" : v ? "yes" : "no")

export function CheckinForm({
  name,
  form,
  error,
  busy,
  onMet,
  onAgain,
  onSafe,
  onSubmit,
  onCancel,
}: {
  name: string
  form: Form
  error: string
  busy: boolean
  onMet: (met: MetAnswer) => void
  onAgain: (again: AgainAnswer) => void
  onSafe: (safe: boolean) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <form
      className="pulse-dialog"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <p className="pulse-dialog__body">Your answers stay between you and our team. {name} won&apos;t see them.</p>
      <Choices name="checkin-met" legend={`Did you meet ${name}?`} options={MET_OPTIONS} value={form.met} onChange={(v) => onMet(v as MetAnswer)} />
      {showFollowUps(form) ? (
        <>
          <Choices name="checkin-again" legend="Would you meet again? (optional)" options={AGAIN_OPTIONS} value={form.again} onChange={(v) => onAgain(v as AgainAnswer)} />
          <Choices name="checkin-safe" legend="Did you feel safe? (optional)" options={SAFE_OPTIONS} value={safeValue(form.feltSafe)} onChange={(v) => onSafe(v === "yes")} />
        </>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <div className="pulse-dialog__actions">
        <Button variant="quiet" onClick={onCancel} disabled={busy}>
          Not now
        </Button>
        <Button variant="primary" type="submit" busy={busy} disabled={!form.met}>
          Send
        </Button>
      </div>
    </form>
  )
}

/** After the answer: thanks, or — they didn't feel safe — support, the report and the safety page. */
export function CheckinDone({ report, line, name, canReport, onReport, onClose }: { report: boolean; line: string; name: string; canReport: boolean; onReport: () => void; onClose: () => void }) {
  if (!report) {
    return (
      <div className="pulse-dialog">
        <p className="pulse-dialog__body">{line}</p>
        <div className="pulse-dialog__actions">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div className="pulse-dialog">
      <Notice tone="info">
        <ShieldCheck size={14} aria-hidden="true" /> {supportLine(name)}
      </Notice>
      <p className="pulse-dialog__body">
        <Link href={SAFETY_HREF} className="pulse-checkin__link">
          See your safety tools
        </Link>
      </p>
      <div className="pulse-dialog__actions">
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
        {canReport ? (
          <Button variant="danger" icon={Flag} onClick={onReport}>
            Report {name}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
