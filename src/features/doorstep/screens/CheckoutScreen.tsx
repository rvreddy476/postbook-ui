"use client"

/*
  /doorstep/checkout?quote=&address=&female=1

    GET /quotes/:id (the price), GET /slots for it, the visit address.
    Book & pay → the attempt's Idempotency-Key is saved to localStorage FIRST
               → POST /bookings {quote_id, address_id, slot_start, require_female_pro}
               → the answer holds a professional for 10 minutes and carries
                 the payment intent → Razorpay or the dev stub
               → "Confirming payment" until GET /bookings/:id/payment says paid
               → /doorstep/bookings/:id

  A lost answer keeps the key, so pressing Book again returns the same
  booking instead of holding a second professional. A booking already made
  is paid for, never made again. The hold is counted down from the server's
  hold_expires_at; once it lapses the button is off and the customer starts
  again with a fresh price.
*/

import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, CalendarClock, ReceiptText } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { createBooking, openBookingPaymentIntent, toDoorstepError } from "../api/client"
import { HoldCountdown, useNow } from "../components/HoldCountdown"
import { DuesBanner, ErrorState, QuoteBill, Skel, StateBlock } from "../components/parts"
import { PayPanel } from "../components/PayPanel"
import { SlotPicker } from "../components/SlotPicker"
import { DOORSTEP, keys, useAddresses, useBooking, useOutstanding, useQuote } from "../hooks/queries"
import { addressLine } from "../model/address"
import { attemptSignature, bookWithSavedKey, clearAttempt, readAttempt } from "../model/bookingAttempt"
import { formatPaise } from "../model/money"
import { refusalLine } from "../model/refusals"
import { formatDuration } from "../model/selection"
import { formatSlot, holdExpired } from "../model/slots"
import type { Booking, PaymentIntent } from "../model/wire"

function localStore(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null
  } catch {
    return null
  }
}

/** The pay step for a booking in hand: the hold, then the payment. */
function PayStep({ booking, intent }: { booking: Booking; intent: PaymentIntent | null }) {
  const router = useRouter()
  const now = useNow()
  const lapsed = holdExpired(booking.holdExpiresAt, now)
  const onSettled = useCallback(
    (reading: string) => {
      if (reading === "paid") router.push(`/doorstep/bookings/${encodeURIComponent(booking.id)}`)
    },
    [booking.id, router],
  )
  useEffect(() => {
    if (lapsed) clearAttempt(localStore())
  }, [lapsed])

  return (
    <div className="ds-stack">
      <section className="ds-card" aria-label="Your booking">
        <h2 className="ds-h2">{booking.serviceName}</h2>
        <p className="ds-row" style={{ margin: 0 }}>
          <CalendarClock size={14} aria-hidden="true" />
          {formatSlot(booking.slotStart)}
        </p>
        <p className="ds-meta" style={{ margin: 0 }}>
          {addressLine(booking.address)}
        </p>
        <HoldCountdown holdExpiresAt={booking.holdExpiresAt} now={now} />
      </section>
      <PayPanel
        target={{
          bookingId: booking.id,
          referenceType: "doorstep_booking",
          referenceId: booking.id,
          description: `Doorstep · ${booking.serviceName}`,
          open: () => openBookingPaymentIntent(booking.id),
        }}
        amountPaise={booking.totalPaise}
        autoIntent={lapsed ? null : intent}
        readFirst={!intent}
        disabled={lapsed ? "The hold lapsed. Go back to the service for a fresh price and slot." : null}
        onSettled={onSettled}
      />
      <Link href={`/doorstep/bookings/${encodeURIComponent(booking.id)}`} className="ds-link" style={{ fontSize: 12 }}>
        Open this booking
      </Link>
    </div>
  )
}

/** A booking made by an earlier press of Book, read back by id. */
function PendingPay({ bookingId }: { bookingId: string }) {
  const booking = useBooking(bookingId)
  if (booking.isLoading) return <Skel h={200} />
  if (booking.isError || !booking.data) return <ErrorState error={booking.error} what="Your booking" onRetry={() => void booking.refetch()} />
  if (booking.data.status !== "pending_payment") {
    return (
      <StateBlock
        icon={<ReceiptText size={22} />}
        title="This booking is past payment"
        action={
          <Link href={`/doorstep/bookings/${encodeURIComponent(bookingId)}`} className="ds-btn ds-btn--primary ds-btn--sm">
            Open booking
          </Link>
        }
      />
    )
  }
  return <PayStep booking={booking.data} intent={null} />
}

export function CheckoutScreen() {
  const params = useSearchParams()
  const quoteId = params.get("quote") ?? ""
  const addressId = params.get("address") ?? ""
  const female = params.get("female") === "1"
  const qc = useQueryClient()
  const quote = useQuote(quoteId)
  const addresses = useAddresses()
  const outstanding = useOutstanding()
  const [slot, setSlot] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [booking, setBooking] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [made, setMade] = useState<{ booking: Booking; intent: PaymentIntent } | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  // A booking already made for this price is paid for, not made again.
  useEffect(() => {
    const a = readAttempt(localStore())
    if (a?.bookingId && a.signature.startsWith(`${quoteId}|`)) setPendingId(a.bookingId)
  }, [quoteId])

  const address = (addresses.data ?? []).find((a) => a.id === addressId) ?? null
  const q = quote.data

  if (!quoteId || !addressId) {
    return <StateBlock icon={<ReceiptText size={22} />} title="Nothing to book" text="Choose a service first." action={<Link href="/doorstep" className="ds-btn ds-btn--primary ds-btn--sm">Browse services</Link>} />
  }
  if (made) return <Shell back={null}><PayStep booking={made.booking} intent={made.intent} /></Shell>
  if (pendingId) return <Shell back={null}><PendingPay bookingId={pendingId} /></Shell>

  if (quote.isLoading || addresses.isLoading) {
    return (
      <Shell back={null}>
        <div className="ds-grid2">
          <div className="ds-stack">
            <Skel h={80} />
            <Skel h={200} />
          </div>
          <Skel h={220} />
        </div>
      </Shell>
    )
  }
  if (quote.isError || !q) return <Shell back={null}><ErrorState error={quote.error} what="The price" onRetry={() => void quote.refetch()} /></Shell>

  const back = `/doorstep/s/${encodeURIComponent(q.serviceId)}`
  const expired = q.status !== "open" || Date.parse(q.expiresAt) <= Date.now()
  if (expired) {
    return (
      <Shell back={back}>
        <StateBlock
          icon={<ReceiptText size={22} />}
          title="This price has expired"
          text="Prices hold for 15 minutes. Get a fresh one; it takes a second."
          action={
            <Link href={back} className="ds-btn ds-btn--primary ds-btn--sm">
              Back to the service
            </Link>
          }
        />
      </Shell>
    )
  }

  const dues = (outstanding.data?.totalPaise ?? 0) > 0
  const blocked = dues ? "Pay your dues to book again." : !address ? "That address is no longer saved. Go back and choose it again." : !slot ? "Pick a slot." : null

  const onBook = async () => {
    if (blocked || booking || !slot || !address) return
    setBooking(true)
    setRefusal(null)
    const signature = attemptSignature({ quoteId: q.id, addressId: address.id, slotStart: slot, requireFemalePro: female })
    const body = { quote_id: q.id, address_id: address.id, slot_start: slot, require_female_pro: female, ...(notes.trim() ? { notes: notes.trim() } : {}) }
    const outcome = await bookWithSavedKey(localStore(), signature, (key) => createBooking(body, key), (e) => toDoorstepError(e).status)
    setBooking(false)
    if (outcome.kind === "booked") {
      void qc.invalidateQueries({ queryKey: [...DOORSTEP, "bookings"] })
      setMade({ booking: outcome.created.booking, intent: outcome.created.paymentIntent })
      return
    }
    if (outcome.kind === "reused") {
      setPendingId(outcome.attempt.bookingId)
      return
    }
    if (outcome.kind === "lost") {
      setRefusal("We couldn't hear back about your booking. Check your connection and press Book again — you won't be booked twice.")
      return
    }
    const e = toDoorstepError(outcome.error)
    setRefusal(refusalLine(e))
    if (e.code === "DOORSTEP_SLOT_TAKEN" || e.code === "DOORSTEP_SLOT_UNAVAILABLE") {
      setSlot(null)
      void qc.invalidateQueries({ queryKey: [...DOORSTEP, "slots"] })
    }
    if (e.code === "DOORSTEP_OUTSTANDING_DUE") void qc.invalidateQueries({ queryKey: keys.outstanding })
    if (e.code === "DOORSTEP_QUOTE_EXPIRED") void qc.invalidateQueries({ queryKey: keys.quote(q.id) })
  }

  return (
    <Shell back={back}>
      <DuesBanner outstanding={outstanding.data} />
      <div className="ds-grid2">
        <div className="ds-stack">
          <section className="ds-card" aria-label="Visit address">
            <div className="ds-row">
              <h2 className="ds-h2 ds-grow">Visit address</h2>
              <Link href="/doorstep/addresses" className="ds-link" style={{ fontSize: 12 }}>
                Edit addresses
              </Link>
            </div>
            {address ? (
              <p style={{ margin: 0 }}>
                <strong>{address.label}</strong>
                <span className="ds-meta" style={{ display: "block" }}>
                  {addressLine(address)}
                </span>
              </p>
            ) : (
              <p className="ds-alert">That address is no longer saved.</p>
            )}
            {female ? <p className="ds-note">You asked for a woman professional; only their slots are shown.</p> : null}
          </section>

          <section className="ds-card" aria-label="Slot">
            <h2 className="ds-h2">Pick a slot</h2>
            <SlotPicker query={{ quoteId: q.id, addressId: address?.id, requireFemalePro: female }} enabled={Boolean(address)} value={slot} onChange={setSlot} />
          </section>

          <section className="ds-card">
            <label className="ds-field">
              Anything the professional should know? (optional)
              <textarea className="ds-input" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="Gate code, parking, pets…" />
            </label>
            <p className="ds-note">The professional sees only your locality until they accept the job.</p>
          </section>
        </div>

        <aside className="ds-card ds-sticky" aria-label="Bill">
          <h2 className="ds-h2">Bill</h2>
          <QuoteBill lines={q.lines} totalPaise={q.totalPaise} taxablePaise={q.taxablePaise} taxPaise={q.taxPaise} note={q.taxNote} provisional={q.taxProvisional} />
          <p className="ds-meta" style={{ margin: 0 }}>
            About {formatDuration(q.durationMinutes)}
            {slot ? ` · ${formatSlot(slot)}` : ""}
          </p>
          {refusal ? (
            <p className="ds-alert" role="alert">
              {refusal}
            </p>
          ) : null}
          <button type="button" className="ds-btn ds-btn--primary ds-btn--block" onClick={() => void onBook()} disabled={Boolean(blocked) || booking}>
            {booking ? "Holding your slot…" : `Book and pay ${formatPaise(q.totalPaise)}`}
          </button>
          {blocked && !booking ? <p className="ds-note">{blocked}</p> : null}
          <p className="ds-note">Your slot is held for 10 minutes while you pay. Free cancellation until a professional accepts, or up to 3 hours before.</p>
        </aside>
      </div>
    </Shell>
  )
}

function Shell({ back, children }: { back: string | null; children: React.ReactNode }) {
  return (
    <>
      <div className="ds-head">
        <div className="ds-row">
          <Link href={back ?? "/doorstep"} className="ds-back" aria-label="Back">
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <h1 className="ds-title">Book</h1>
        </div>
      </div>
      {children}
    </>
  )
}
