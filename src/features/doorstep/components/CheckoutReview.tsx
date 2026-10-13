"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, CalendarClock, Clock3, MapPin, MessageSquare, ReceiptText, UserRound, Zap } from "lucide-react"
import type { Address, Quote } from "../model/wire"
import { addressLine } from "../model/address"
import { formatPaise } from "../model/money"
import { formatDuration } from "../model/selection"
import { formatSlot, formatTime } from "../model/slots"
import { QuoteBill } from "./parts"
import { CheckoutSection, SecurePaymentNote } from "./BookingJourney"

export interface CheckoutReviewProps {
  quote: Quote
  address: Address | null
  name: string
  female: boolean
  asap: boolean
  eta: number | null
  slot: string | null
  notes: string
  onNotes: (value: string) => void
  slotPicker: ReactNode
  changeHref: string
  blocked: string | null
  busy: boolean
  onBook: () => void
  error?: ReactNode
}

export function CheckoutReview({ quote, address, name, female, asap, eta, slot, notes, onNotes, slotPicker, changeHref, blocked, busy, onBook, error }: CheckoutReviewProps) {
  const [editTime, setEditTime] = useState(!slot)
  const automatic = quote.assignmentMode === "automatic"
  useEffect(() => { if (!slot && !asap) setEditTime(true) }, [slot, asap])
  const when = asap ? (eta ? `Arrives in about ${eta} minutes` : "As soon as possible") : slot ? formatSlot(slot) : "Choose an available time"
  const payButton = <button type="button" className="ds-btn ds-btn--primary ds-btn--block" onClick={onBook} disabled={Boolean(blocked) || busy}>{busy ? automatic ? "Sending your request…" : "Reserving your appointment…" : automatic ? "Request this appointment" : "Continue to payment"}{!busy && <ArrowRight size={17} aria-hidden />}</button>
  return <div className="dsc-checkout-page">
    <div className="dsc-booking-layout">
      <div className="dsc-booking-main">
        <div className="dsc-checkout-sections">
          <CheckoutSection icon={UserRound} title="Your professional" action={!automatic && <Link className="dsc-link" href={changeHref}>Change</Link>}>
            <strong>{automatic ? "Assigned by Doorstep" : name || "Your selected professional"}</strong><p className="ds-meta">{automatic ? "We’ll match your service and appointment with an available, approved professional. Your price stays the same." : "Your selected professional receives the request after payment."}</p>{female && <p className="ds-meta">Woman professional requested.</p>}
          </CheckoutSection>
          <CheckoutSection icon={MapPin} title="Service address">
            {address ? <><strong>{address.label}</strong><p className="ds-meta">{addressLine(address)}</p></> : <p className="ds-alert" role="alert">The service address no longer matches your location. <Link href={changeHref} className="dsc-link">Review your selection</Link></p>}
          </CheckoutSection>
          <CheckoutSection icon={asap ? Zap : CalendarClock} title="Date & time" action={!asap ? <button type="button" className="dsc-link" onClick={() => setEditTime(v => !v)} aria-expanded={editTime} aria-controls="doorstep-checkout-time">{editTime ? "Close" : "Change"}</button> : undefined}>
            <strong>{when}</strong><p className="ds-meta">About {formatDuration(quote.durationMinutes)}{asap ? " · subject to professional acceptance" : " · India Standard Time"}</p>
            {!asap && <div id="doorstep-checkout-time" className="dsc-time-editor" hidden={!editTime}>{slotPicker}<button type="button" className="ds-btn ds-btn--outline dsc-time-editor__done" disabled={!slot} onClick={() => setEditTime(false)}>Use selected time</button></div>}
          </CheckoutSection>
          <CheckoutSection icon={MessageSquare} title="Visit instructions">
            <label className="ds-field">Anything we should know? <span className="ds-meta">Optional</span><textarea className="ds-input" value={notes} maxLength={500} onChange={e => onNotes(e.target.value)} placeholder="Flat or house number, landmark, parking…" /></label>
          </CheckoutSection>
          <CheckoutSection icon={ReceiptText} title="Payment">{automatic ? <p>Nothing to pay now. We’ll notify you when your professional accepts. Pay securely to confirm the appointment.</p> : <SecurePaymentNote />}<p className="ds-note">Your assigned professional can call your verified mobile number for directions and service coordination during this booking.</p></CheckoutSection>
        </div>
        <details className="dsc-cancellation"><summary>Cancellation & professional availability</summary><p>Free cancellation until your professional accepts, or up to 3 hours before the appointment. Review any applicable fee before cancelling from My bookings.</p><p>{automatic ? "If your professional becomes unavailable, we’ll look for a replacement at the same price. If we cannot find one, your booking is cancelled and any payment is refunded." : "If your chosen professional cannot take the job, you can select someone else or request a full refund."}</p></details>
      </div>
      <aside className="dsc-summary" aria-label="Booking summary">
        <div className="dsc-summary__heading"><h2>Your booking</h2><ReceiptText size={21} aria-hidden /></div>
        <QuoteBill lines={quote.lines} totalPaise={quote.totalPaise} taxablePaise={quote.taxablePaise} taxPaise={quote.taxPaise} note={quote.taxNote} provisional={quote.taxProvisional} />
        <div className="dsc-summary__appointment"><CalendarClock size={18} aria-hidden /><div><strong>{when}</strong><small>{automatic ? "Professional assigned by Doorstep" : name || "Selected professional"} · {formatDuration(quote.durationMinutes)}</small></div></div>
        {error}
        <p className="dsc-price-validity"><Clock3 size={14} aria-hidden />Price valid until {formatTime(quote.expiresAt)} IST</p>
        {payButton}
        {blocked && !busy && <p className="ds-note" role="status">{blocked}</p>}
        <p className="ds-note">{automatic ? "Your request is not confirmed until a professional accepts and payment is completed." : "Continue to reserve this appointment while you pay. Payment details are entered in the secure checkout, not here."}</p>
      </aside>
    </div>
    <div className="dsc-mobile-checkout"><div><small>Total to pay</small><strong>{formatPaise(quote.totalPaise)}</strong></div>{payButton}</div>
  </div>
}
