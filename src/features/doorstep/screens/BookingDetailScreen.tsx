"use client"

/*
  /doorstep/bookings/[id] — one booking, start to finish.

  Payment: while `pending_payment` the hold is counted down and the panel
  pays for THIS booking; "paid" is only GET /bookings/:id/payment.
  Live: a scoped realtime token + SSE on doorstep.booking.<id>; polling every
  10 s whenever it is not connected (30 s while it is). The professional's
  ETA moves only to a newer fix.
  OTPs: the start code from acceptance until the job starts, the end code
  only while the job is in progress (model/booking.ts otpToShow).
*/

import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, CalendarClock, KeyRound, MapPin, MessageCircle, Star, UserRound } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

import { openBookingPaymentIntent } from "../api/client"
import { CancelSheet, ExtrasPanel, RatingPanel, RescheduleSheet, ReworkPanel, SafetyPanel } from "../components/BookingPanels"
import { HoldCountdown, useNow } from "../components/HoldCountdown"
import { ErrorState, MediaImg, VisitImg, QuoteBill, Skel, StatusTag } from "../components/parts"
import { PayPanel } from "../components/PayPanel"
import { SupportPanel } from "../components/SupportPanel"
import { LIVE_POLL_MS, SLOW_POLL_MS, useLiveBooking } from "../hooks/live"
import { keys, useBooking } from "../hooks/queries"
import { addressLine } from "../model/address"
import { canAskRework, canRate, chatMayOpen, customerPhotos, isLive, newerFix, otpToShow, safetyOpen, timeline, type ProFix } from "../model/booking"
import { formatPaise } from "../model/money"
import { formatSlot, formatTime, formatWhen, holdExpired } from "../model/slots"
import type { Booking } from "../model/wire"

function OtpCard({ booking }: { booking: Booking }) {
  const otp = otpToShow(booking)
  if (!otp) return null
  return (
    <div className="ds-code" role="note">
      <div className="ds-row">
        <KeyRound size={16} aria-hidden="true" />
        <span>
          <strong>{otp.kind === "start" ? "Start code" : "End code"}</strong>
          <span className="ds-meta" style={{ display: "block" }}>
            {otp.kind === "start" ? "Share it with the professional when they're ready to begin." : "Share it only when you're happy the job is done."}
          </span>
        </span>
      </div>
      <span className="ds-code__digits" aria-label={`${otp.kind === "start" ? "Start" : "End"} code ${otp.code.split("").join(" ")}`}>
        {otp.code}
      </span>
    </div>
  )
}

function ProCard({ booking, fix }: { booking: Booking; fix: ProFix | null }) {
  const pro = booking.professional
  if (!pro) return null
  return (
    <section className="ds-card" aria-label="Your professional">
      <div className="ds-pro">
        {pro.photoMediaId ? <MediaImg mediaId={pro.photoMediaId} alt={pro.firstName} className="ds-avatar" /> : <span className="ds-avatar" aria-hidden="true"><UserRound size={20} /></span>}
        <div className="ds-grow">
          <strong>{pro.firstName}</strong>
          <span className="ds-meta ds-row" style={{ gap: 4 }}>
            {pro.ratingAvg !== null ? (
              <>
                <Star size={12} aria-hidden="true" /> {pro.ratingAvg.toFixed(1)}{" · "}
              </>
            ) : null}
            {pro.jobsCompleted} jobs
          </span>
        </div>
        {chatMayOpen(booking.status) ? (
          <Link href={`/doorstep/bookings/${encodeURIComponent(booking.id)}/chat`} className="ds-btn ds-btn--outline ds-btn--sm">
            <MessageCircle size={14} aria-hidden="true" /> Chat
          </Link>
        ) : null}
      </div>
      {booking.status === "en_route" && fix?.etaMinutes !== null && fix?.etaMinutes !== undefined ? (
        <p className="ds-info">
          Arriving in about {fix.etaMinutes} min · updated {formatTime(fix.at)}
        </p>
      ) : null}
      <p className="ds-note">Calls stay in the app: chat with your professional here. Their number is never shared, nor is yours.</p>
    </section>
  )
}

/** The server's status_history, oldest first, then what is still ahead (model/booking.ts timeline). */
function Timeline({ booking }: { booking: Booking }) {
  return (
    <ol className="ds-steps" aria-label="Progress">
      {timeline(booking).map((s, i) => (
        <li key={`${i}-${s.status}`} className={`ds-step is-${s.state}`} aria-current={s.state === "current" ? "step" : undefined}>
          <span className="ds-step__dot" aria-hidden="true" />
          <span>
            {s.label}
            {s.at ? (
              <span className="ds-meta" style={{ display: "block", fontWeight: 400 }}>
                {formatWhen(s.at)}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  )
}

function Photos({ booking }: { booking: Booking }) {
  const { before, after } = customerPhotos(booking.photos)
  if (!after.length && !before.length) return null
  return (
    <section className="ds-card" aria-label="Photos">
      {before.length ? (
        <>
          <h2 className="ds-h2">Before</h2>
          <div className="ds-photos">
            {before.map((p) => (
              <VisitImg key={p.id} bookingId={booking.id} mediaId={p.mediaId} alt="Before the job" />
            ))}
          </div>
        </>
      ) : null}
      {after.length ? (
        <>
          <h2 className="ds-h2">After</h2>
          <div className="ds-photos">
            {after.map((p) => (
              <VisitImg key={p.id} bookingId={booking.id} mediaId={p.mediaId} alt="After the job" />
            ))}
          </div>
        </>
      ) : null}
    </section>
  )
}

function Money({ booking }: { booking: Booking }) {
  return (
    <section className="ds-card" aria-label="Bill">
      <h2 className="ds-h2">Bill</h2>
      <QuoteBill lines={booking.items} totalPaise={booking.totalPaise} taxablePaise={booking.taxablePaise} taxPaise={booking.taxPaise} />
      <dl className="ds-bill">
        {booking.paidPaise ? (
          <div className="ds-bill__row">
            <dt>Paid</dt>
            <dd>{formatPaise(booking.paidPaise)}</dd>
          </div>
        ) : null}
        {booking.extrasTotalPaise ? (
          <div className="ds-bill__row">
            <dt>Extras</dt>
            <dd>{formatPaise(booking.extrasTotalPaise)}</dd>
          </div>
        ) : null}
        {booking.cancellationFeePaise ? (
          <div className="ds-bill__row">
            <dt>Cancellation fee</dt>
            <dd>{formatPaise(booking.cancellationFeePaise)}</dd>
          </div>
        ) : null}
        {booking.refundedPaise ? (
          <div className="ds-bill__row">
            <dt>Refunded</dt>
            <dd>{formatPaise(booking.refundedPaise)}</dd>
          </div>
        ) : null}
        {booking.outstandingPaise ? (
          <div className="ds-bill__row">
            <dt>Unpaid</dt>
            <dd>{formatPaise(booking.outstandingPaise)}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}

function PendingPayment({ booking }: { booking: Booking }) {
  const now = useNow()
  const lapsed = holdExpired(booking.holdExpiresAt, now)
  return (
    <>
      <HoldCountdown holdExpiresAt={booking.holdExpiresAt} now={now} />
      <PayPanel
        target={{
          bookingId: booking.id,
          referenceType: "doorstep_booking",
          referenceId: booking.id,
          description: `Doorstep · ${booking.serviceName}`,
          open: () => openBookingPaymentIntent(booking.id),
        }}
        amountPaise={booking.totalPaise}
        readFirst
        disabled={lapsed ? "The hold lapsed. Book again from the service page." : null}
      />
    </>
  )
}

export function BookingDetailScreen({ bookingId }: { bookingId: string }) {
  const qc = useQueryClient()
  const [fix, setFix] = useState<ProFix | null>(null)
  const [sheet, setSheet] = useState<"cancel" | "reschedule" | null>(null)
  const connectedRef = useRef(false)

  const booking = useBooking(bookingId, (q) => {
    const s = q.state.data?.status
    if (s && isLive(s)) return connectedRef.current ? SLOW_POLL_MS : LIVE_POLL_MS
    return s === "pending_payment" ? LIVE_POLL_MS : false
  })
  const b = booking.data
  const live = Boolean(b && isLive(b.status))

  const onChange = useCallback(() => {
    void qc.invalidateQueries({ queryKey: keys.booking(bookingId) })
    void qc.invalidateQueries({ queryKey: keys.extras(bookingId) })
    void qc.invalidateQueries({ queryKey: keys.extrasBill(bookingId) })
    void qc.invalidateQueries({ queryKey: keys.messages(bookingId) })
  }, [bookingId, qc])
  const onFix = useCallback((next: ProFix) => setFix((prev) => newerFix(prev, next)), [])
  const stream = useLiveBooking(bookingId, live, { onChange, onFix })
  useEffect(() => {
    connectedRef.current = stream.connected
  }, [stream.connected])
  const interval = stream.connected ? SLOW_POLL_MS : LIVE_POLL_MS

  if (booking.isLoading) {
    return (
      <div className="ds-stack">
        <Skel h={24} w="40%" />
        <Skel h={120} />
        <Skel h={160} />
      </div>
    )
  }
  if (booking.isError || !b) return <ErrorState error={booking.error} what="This booking" onRetry={() => void booking.refetch()} />

  const showExtras = ["arrived", "in_progress", "awaiting_extras_payment", "completed"].includes(b.status) || b.extrasTotalPaise > 0

  return (
    <>
      <div className="ds-head">
        <div className="ds-row">
          <Link href="/doorstep/bookings" className="ds-back" aria-label="Back to bookings">
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <div className="ds-grow">
            <h1 className="ds-title">{b.serviceName}</h1>
            <p className="ds-sub ds-row" style={{ gap: 6 }}>
              <CalendarClock size={12} aria-hidden="true" />
              {formatSlot(b.slotStart)}
            </p>
          </div>
        </div>
        <div className="ds-row">
          {live ? <span className={stream.connected ? "ds-live is-on" : "ds-live"}>{stream.connected ? "Live" : "Updating"}</span> : null}
          <StatusTag status={b.status} />
        </div>
      </div>

      <div className="ds-grid2">
        <div className="ds-stack">
          {b.status === "pending_payment" ? <PendingPayment booking={b} /> : null}
          <OtpCard booking={b} />
          <ProCard booking={b} fix={fix} />
          {showExtras ? <ExtrasPanel booking={b} refetchInterval={live ? interval : false} /> : null}
          <Photos booking={b} />
          {canRate(b.status) && b.professional ? <RatingPanel booking={b} /> : null}
          {canAskRework(b.status, b.parentBookingId) ? <ReworkPanel booking={b} /> : null}
          {safetyOpen(b.status) ? <SafetyPanel booking={b} /> : null}
          <SupportPanel bookingId={b.id} />
        </div>

        <div className="ds-stack ds-sticky">
          <section className="ds-card" aria-label="Status">
            <Timeline booking={b} />
            {b.parentBookingId ? (
              <p className="ds-note">
                This is a free redo of{" "}
                <Link className="ds-link" href={`/doorstep/bookings/${encodeURIComponent(b.parentBookingId)}`}>
                  an earlier visit
                </Link>
                .
              </p>
            ) : null}
          </section>
          <section className="ds-card" aria-label="Address">
            <p className="ds-row" style={{ margin: 0, alignItems: "flex-start" }}>
              <MapPin size={14} aria-hidden="true" style={{ marginTop: 2, flex: "none" }} />
              <span>
                <strong>{b.address.label}</strong>
                <span className="ds-meta" style={{ display: "block" }}>
                  {addressLine(b.address)}
                </span>
              </span>
            </p>
            {b.requireFemalePro ? <p className="ds-note">You asked for a woman professional.</p> : null}
          </section>
          <Money booking={b} />
          {b.canReschedule || b.canCancel ? (
            <div className="ds-row ds-wrap">
              {b.canReschedule ? (
                <button type="button" className="ds-btn ds-btn--outline ds-btn--sm" onClick={() => setSheet("reschedule")}>
                  Reschedule
                </button>
              ) : null}
              {b.canCancel ? (
                <button type="button" className="ds-btn ds-btn--danger ds-btn--sm" onClick={() => setSheet("cancel")}>
                  Cancel booking
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {sheet === "cancel" ? <CancelSheet booking={b} onClose={() => setSheet(null)} /> : null}
      {sheet === "reschedule" ? <RescheduleSheet booking={b} onClose={() => setSheet(null)} /> : null}
    </>
  )
}
