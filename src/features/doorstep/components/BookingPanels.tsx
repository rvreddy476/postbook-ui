"use client"

/*
  The panels of one booking: extras, cancel, reschedule, safety (SOS, share
  status, trusted contact), rating and rework. Each one calls its own route
  and shows the server's refusal in the customer's words.
*/

import { useQueryClient } from "@tanstack/react-query"
import { Check, Copy, LifeBuoy, RotateCcw, Share2, ShieldAlert, Star, X } from "lucide-react"
import { useState } from "react"

import { createShare, openExtrasPaymentIntent, putTrustedContact, raiseSOS, rateBooking, requestRework, revokeShare, toDoorstepError } from "../api/client"
import { keys, useCancelBooking, useCancelPreview, useDecideExtra, useExtras, useExtrasBill, useReschedule, useRework, useTrustedContact } from "../hooks/queries"
import { canDecideExtra, cancelRuleText, extrasTotals } from "../model/booking"
import { formatPaise } from "../model/money"
import { refusalLine } from "../model/refusals"
import { formatWhen } from "../model/slots"
import type { Booking, ShareToken } from "../model/wire"
import { Busy, MediaImg, Sheet } from "./parts"
import { PayPanel } from "./PayPanel"
import { SlotPicker } from "./SlotPicker"

function errLine(error: unknown): string {
  return refusalLine(toDoorstepError(error))
}

/* ── extras ───────────────────────────────────────────────────────── */

const EXTRA_STATUS_LABEL: Record<string, string> = {
  approved: "Approved",
  billed: "Billed",
  declined: "Declined",
  proposed: "Waiting for you",
  withdrawn: "Withdrawn",
}

const BILL_PAYABLE = new Set(["open", "payment_pending", "outstanding"])

export function ExtrasPanel({ booking, refetchInterval }: { booking: Booking; refetchInterval: number | false }) {
  const extras = useExtras(booking.id, true, refetchInterval)
  const decide = useDecideExtra(booking.id)
  const hasApproved = (extras.data ?? []).some((e) => e.status === "approved" || e.status === "billed")
  const bill = useExtrasBill(booking.id, hasApproved || booking.status === "awaiting_extras_payment")
  const [error, setError] = useState<string | null>(null)

  const list = extras.data ?? []
  if (!list.length && !bill.data) return null
  const totals = extrasTotals(list)

  const onDecide = (extraId: string, approve: boolean) => {
    setError(null)
    decide.mutate({ extraId, approve }, { onError: (e) => setError(errLine(e)) })
  }

  return (
    <section className="ds-card" aria-labelledby="ds-extras">
      <h2 id="ds-extras" className="ds-h2">
        Extras
      </h2>
      <p className="ds-note">The professional proposes parts or extra work from a fixed rate card. Nothing is charged unless you approve it.</p>
      <div>
        {list.map((e) => (
          <div key={e.id} className="ds-extra">
            {e.evidenceMediaId ? <MediaImg mediaId={e.evidenceMediaId} alt={`Photo for ${e.name}`} className="ds-extra__img" /> : null}
            <div className="ds-grow">
              <strong>{e.name}</strong>
              <span className="ds-meta" style={{ display: "block" }}>
                {e.quantity} × {formatPaise(e.unitPricePaise)} = {formatPaise(e.totalPaise)} · {EXTRA_STATUS_LABEL[e.status] ?? e.status}
              </span>
              {canDecideExtra(booking.status, e) ? (
                <div className="ds-row" style={{ marginTop: 6 }}>
                  <button type="button" className="ds-btn ds-btn--primary ds-btn--sm" disabled={decide.isPending} onClick={() => onDecide(e.id, true)}>
                    <Check size={14} aria-hidden="true" /> Approve {formatPaise(e.totalPaise)}
                  </button>
                  <button type="button" className="ds-btn ds-btn--outline ds-btn--sm" disabled={decide.isPending} onClick={() => onDecide(e.id, false)}>
                    <X size={14} aria-hidden="true" /> Decline
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <dl className="ds-bill">
        <div className="ds-bill__row">
          <dt>Approved extras</dt>
          <dd>{formatPaise(totals.approvedPaise)}</dd>
        </div>
        {totals.pendingCount ? (
          <div className="ds-bill__row">
            <dt>Waiting for your decision ({totals.pendingCount})</dt>
            <dd>{formatPaise(totals.pendingPaise)}</dd>
          </div>
        ) : null}
      </dl>
      {error ? (
        <p className="ds-alert" role="alert">
          {error}
        </p>
      ) : null}
      {bill.data && BILL_PAYABLE.has(bill.data.status) && bill.data.amountPaise > 0 ? (
        <PayPanel
          title={bill.data.status === "outstanding" ? "Unpaid extras" : "Pay for extras"}
          target={{
            bookingId: booking.id,
            referenceType: "doorstep_extras",
            referenceId: bill.data.id,
            description: `Doorstep extras · ${booking.serviceName}`,
            open: () => openExtrasPaymentIntent(bill.data!.id),
          }}
          amountPaise={bill.data.amountPaise}
          readFirst
        />
      ) : null}
      {bill.data?.status === "paid" ? <p className="ds-ok">Extras paid{bill.data.paidAt ? ` · ${formatWhen(bill.data.paidAt)}` : ""}</p> : null}
    </section>
  )
}

/* ── cancel ───────────────────────────────────────────────────────── */

export function CancelSheet({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const preview = useCancelPreview(booking.id, true)
  const cancel = useCancelBooking()
  const [reason, setReason] = useState("")
  const p = preview.data

  return (
    <Sheet
      title="Cancel booking"
      onClose={onClose}
      foot={
        <>
          <button type="button" className="ds-btn ds-btn--ghost" onClick={onClose}>
            Keep booking
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--danger-solid"
            disabled={!p?.allowed || cancel.isPending || !reason.trim()}
            onClick={() => cancel.mutate({ id: booking.id, reason: reason.trim() }, { onSuccess: onClose })}
          >
            {cancel.isPending ? "Cancelling…" : "Cancel booking"}
          </button>
        </>
      }
    >
      {preview.isLoading ? <Busy label="Checking what cancelling costs…" /> : null}
      {preview.isError ? <p className="ds-alert">{errLine(preview.error)}</p> : null}
      {p ? (
        p.allowed ? (
          <>
            <dl className="ds-bill">
              <div className="ds-bill__row">
                <dt>Cancellation fee</dt>
                <dd>{formatPaise(p.feePaise)}</dd>
              </div>
              <div className="ds-bill__row ds-bill__row--total">
                <dt>Refund to you</dt>
                <dd>{formatPaise(p.refundPaise)}</dd>
              </div>
            </dl>
            {cancelRuleText(p.rule) ? <p className="ds-note">{cancelRuleText(p.rule)}</p> : null}
            <label className="ds-field">
              Why are you cancelling?
              <textarea className="ds-input" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
            </label>
          </>
        ) : (
          <p className="ds-info">This booking can&apos;t be cancelled now: the job has started.</p>
        )
      ) : null}
      {cancel.isError ? (
        <p className="ds-alert" role="alert">
          {errLine(cancel.error)}
        </p>
      ) : null}
    </Sheet>
  )
}

/* ── reschedule ───────────────────────────────────────────────────── */

export function RescheduleSheet({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const qc = useQueryClient()
  const move = useReschedule()
  const [slot, setSlot] = useState<string | null>(null)
  return (
    <Sheet
      title="Reschedule"
      onClose={onClose}
      foot={
        <>
          <button type="button" className="ds-btn ds-btn--ghost" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--primary"
            disabled={!slot || move.isPending}
            onClick={() =>
              slot &&
              move.mutate(
                { id: booking.id, slotStart: slot },
                {
                  onSuccess: onClose,
                  onError: (e) => {
                    if (toDoorstepError(e).code === "DOORSTEP_SLOT_TAKEN") {
                      setSlot(null)
                      void qc.invalidateQueries({ queryKey: ["doorstep", "customer", "slots"] })
                    }
                  },
                },
              )
            }
          >
            {move.isPending ? "Moving…" : "Move booking"}
          </button>
        </>
      }
    >
      <p className="ds-note">Free once, up to 3 hours before the visit.</p>
      <SlotPicker query={{ bookingId: booking.id, addressId: booking.address.id, requireFemalePro: booking.requireFemalePro }} enabled value={slot} onChange={setSlot} />
      {move.isError ? (
        <p className="ds-alert" role="alert">
          {errLine(move.error)}
        </p>
      ) : null}
    </Sheet>
  )
}

/* ── safety ───────────────────────────────────────────────────────── */

export function SafetyPanel({ booking }: { booking: Booking }) {
  const [sos, setSos] = useState(false)
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [share, setShare] = useState<ShareToken | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const contact = useTrustedContact(true)
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [cName, setCName] = useState("")
  const [cPhone, setCPhone] = useState("")

  const raise = () => {
    setSending(true)
    const go = (pos?: GeolocationPosition) =>
      raiseSOS(booking.id, { ...(pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : {}), ...(note.trim() ? { note: note.trim() } : {}) })
        .then(() => setSent("Our safety team has been alerted and will call you. If you are in danger, call 112."))
        .catch((e) => setSent(errLine(e)))
        .finally(() => {
          setSending(false)
          setSos(false)
        })
    if (typeof navigator !== "undefined" && navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => void go(p), () => void go(), { timeout: 5000, maximumAge: 60_000 })
    else void go()
  }

  const onShare = async () => {
    setMessage(null)
    try {
      const t = await createShare(booking.id)
      setShare(t)
      try {
        await navigator.clipboard.writeText(t.url)
        setMessage("Link copied. Anyone with it sees the status and locality, never your full address.")
      } catch {
        setMessage("Copy the link below. Anyone with it sees the status and locality, never your full address.")
      }
    } catch (e) {
      setMessage(errLine(e))
    }
  }

  const onRevoke = async () => {
    try {
      await revokeShare(booking.id)
      setShare(null)
      setMessage("The link no longer works.")
    } catch (e) {
      setMessage(errLine(e))
    }
  }

  const onSaveContact = async () => {
    try {
      await putTrustedContact({ name: cName.trim(), phone: cPhone.trim() })
      setEditing(false)
      void qc.invalidateQueries({ queryKey: keys.trustedContact })
    } catch (e) {
      setMessage(errLine(e))
    }
  }

  return (
    <section className="ds-card" aria-labelledby="ds-safety">
      <h2 id="ds-safety" className="ds-h2">
        Safety
      </h2>
      <div className="ds-row ds-wrap">
        <button type="button" className="ds-btn ds-btn--danger" onClick={() => setSos(true)}>
          <ShieldAlert size={14} aria-hidden="true" /> SOS
        </button>
        {share ? (
          <button type="button" className="ds-btn ds-btn--outline ds-btn--sm" onClick={() => void onRevoke()}>
            Stop sharing
          </button>
        ) : (
          <button type="button" className="ds-btn ds-btn--outline ds-btn--sm" onClick={() => void onShare()}>
            <Share2 size={14} aria-hidden="true" /> Share status
          </button>
        )}
      </div>
      {share ? (
        <div className="ds-row">
          <input className="ds-input ds-grow" readOnly value={share.url} aria-label="Share link" onFocus={(e) => e.target.select()} />
          <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" aria-label="Copy link" onClick={() => void navigator.clipboard?.writeText(share.url)}>
            <Copy size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {message ? <p className="ds-note">{message}</p> : null}
      {sent ? <p className="ds-info" role="status">{sent}</p> : null}

      <div className="ds-row">
        <LifeBuoy size={14} aria-hidden="true" />
        <span className="ds-grow ds-meta">
          {contact.data ? `Trusted contact: ${contact.data.name} (${contact.data.phoneMasked})` : "No trusted contact yet."}
        </span>
        <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" onClick={() => setEditing((v) => !v)}>
          {contact.data ? "Change" : "Add"}
        </button>
      </div>
      {editing ? (
        <div className="ds-form">
          <label className="ds-field">
            Name
            <input className="ds-input" value={cName} onChange={(e) => setCName(e.target.value)} autoComplete="off" />
          </label>
          <label className="ds-field">
            Phone (with country code)
            <input className="ds-input" value={cPhone} onChange={(e) => setCPhone(e.target.value)} inputMode="tel" placeholder="+91…" autoComplete="off" />
          </label>
          <button type="button" className="ds-btn ds-btn--primary ds-btn--sm" disabled={!cName.trim() || !/^\+\d{8,15}$/.test(cPhone.trim())} onClick={() => void onSaveContact()}>
            Save contact
          </button>
        </div>
      ) : null}

      {sos ? (
        <Sheet
          title="Send an SOS?"
          onClose={() => setSos(false)}
          foot={
            <>
              <button type="button" className="ds-btn ds-btn--ghost" onClick={() => setSos(false)}>
                Not now
              </button>
              <button type="button" className="ds-btn ds-btn--danger-solid" disabled={sending} onClick={raise}>
                {sending ? "Sending…" : "Send SOS"}
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>Our safety team is alerted at once with this booking and, if you allow it, your location. If you are in danger, call 112 first.</p>
          <label className="ds-field">
            What&apos;s happening? (optional)
            <textarea className="ds-input" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
          </label>
        </Sheet>
      ) : null}
    </section>
  )
}

/* ── rating ───────────────────────────────────────────────────────── */

const RATING_TAGS = ["Clean work", "Courteous", "Expert", "On time", "Tidy afterwards"] as const

export function RatingPanel({ booking }: { booking: Booking }) {
  const [stars, setStars] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [comment, setComment] = useState("")
  const [state, setState] = useState<{ kind: "idle" | "sending" | "done" } | { kind: "error"; message: string }>({ kind: "idle" })

  if (state.kind === "done") return <p className="ds-ok">Thanks for rating.</p>

  const submit = async () => {
    setState({ kind: "sending" })
    try {
      await rateBooking(booking.id, { stars, ...(tags.length ? { tags } : {}), ...(comment.trim() ? { comment: comment.trim() } : {}) })
      setState({ kind: "done" })
    } catch (e) {
      const err = toDoorstepError(e)
      if (err.code === "DOORSTEP_RATING_EXISTS") setState({ kind: "done" })
      else setState({ kind: "error", message: refusalLine(err) })
    }
  }

  return (
    <section className="ds-card" aria-labelledby="ds-rate">
      <h2 id="ds-rate" className="ds-h2">
        Rate {booking.professional?.firstName ?? "your professional"}
      </h2>
      <div className="ds-stars" role="radiogroup" aria-label="Stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={n <= stars} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setStars(n)}>
            <Star size={22} aria-hidden="true" />
          </button>
        ))}
      </div>
      {stars ? (
        <>
          <div className="ds-chips" role="group" aria-label="What went well">
            {RATING_TAGS.map((t) => (
              <button key={t} type="button" className="ds-chip" aria-pressed={tags.includes(t)} onClick={() => setTags((v) => (v.includes(t) ? v.filter((x) => x !== t) : [...v, t]))}>
                {t}
              </button>
            ))}
          </div>
          <label className="ds-field">
            Anything else? (optional)
            <textarea className="ds-input" value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} />
          </label>
          <button type="button" className="ds-btn ds-btn--primary ds-btn--sm" disabled={state.kind === "sending"} onClick={() => void submit()}>
            {state.kind === "sending" ? "Sending…" : "Submit rating"}
          </button>
        </>
      ) : null}
      {state.kind === "error" ? (
        <p className="ds-alert" role="alert">
          {state.message}
        </p>
      ) : null}
    </section>
  )
}

/* ── rework ───────────────────────────────────────────────────────── */

const REWORK_LABEL: Record<string, string> = {
  approved: "Approved",
  completed: "Redone",
  rejected: "Declined",
  requested: "Asked",
  scheduled: "Scheduled",
}

export function ReworkPanel({ booking }: { booking: Booking }) {
  const qc = useQueryClient()
  const list = useRework(booking.id, true)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [state, setState] = useState<{ kind: "idle" | "sending" } | { kind: "error"; message: string }>({ kind: "idle" })
  const existing = list.data ?? []

  const submit = async () => {
    setState({ kind: "sending" })
    try {
      await requestRework(booking.id, { reason: reason.trim() })
      setOpen(false)
      setState({ kind: "idle" })
      void qc.invalidateQueries({ queryKey: keys.rework(booking.id) })
    } catch (e) {
      setState({ kind: "error", message: errLine(e) })
    }
  }

  return (
    <section className="ds-card" aria-labelledby="ds-rework">
      <div className="ds-row">
        <h2 id="ds-rework" className="ds-h2 ds-grow">
          Not happy with the work?
        </h2>
        {!existing.length && !open ? (
          <button type="button" className="ds-btn ds-btn--outline ds-btn--sm" onClick={() => setOpen(true)}>
            <RotateCcw size={14} aria-hidden="true" /> Ask for a redo
          </button>
        ) : null}
      </div>
      {existing.map((r) => (
        <p key={r.id} className="ds-info">
          Redo {REWORK_LABEL[r.status] ?? r.status} · {formatWhen(r.createdAt)}
        </p>
      ))}
      {!existing.length && !open ? <p className="ds-note">A redo is free within the service&apos;s window after the visit.</p> : null}
      {open ? (
        <>
          <label className="ds-field">
            What needs redoing?
            <textarea className="ds-input" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="ds-row">
            <button type="button" className="ds-btn ds-btn--primary ds-btn--sm" disabled={!reason.trim() || state.kind === "sending"} onClick={() => void submit()}>
              {state.kind === "sending" ? "Sending…" : "Ask for a redo"}
            </button>
            <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : null}
      {state.kind === "error" ? (
        <p className="ds-alert" role="alert">
          {state.message}
        </p>
      ) : null}
    </section>
  )
}
