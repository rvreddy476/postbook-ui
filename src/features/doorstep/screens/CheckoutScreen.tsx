"use client"

/*
  /doorstep/checkout?quote=&address=&female=1&slot=…|asap=1&eta=&name=

    GET /quotes/:id (the picked professional's price), the visit address,
    and the time: the slot picked on the professionals list (changeable
    here on that professional's own grid, GET /slots?quote_id=) or "as soon
    as possible".
    Book & pay → the attempt's Idempotency-Key is saved to localStorage FIRST
               → POST /bookings {quote_id, address_id, slot_start | asap: true, require_female_pro}
               → the answer holds that professional and carries the payment
                 intent → Razorpay or the dev stub
               → "Confirming payment" until GET /bookings/:id/payment says paid
               → /doorstep/bookings/:id

  A lost answer keeps the key, so pressing Book again returns the same
  booking instead of holding the professional twice. A booking already made
  is paid for, never made again. The hold is counted down from the server's
  hold_expires_at; once it lapses the button is off and the customer picks
  again. When the professional was just taken, or their price changed, the
  way back is the professionals list with the same choices.
*/

import { useQueryClient } from "@tanstack/react-query"
import { CalendarClock, ReceiptText, Zap } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { createBooking, openBookingPaymentIntent, toDoorstepError } from "../api/client"
import { HoldCountdown, useNow } from "../components/HoldCountdown"
import { DuesBanner, ErrorState, Skel, StateBlock } from "../components/parts"
import { PayPanel } from "../components/PayPanel"
import { SlotPicker } from "../components/SlotPicker"
import { BookingHeading } from "../components/BookingJourney"
import { CheckoutReview } from "../components/CheckoutReview"
import { DOORSTEP, keys, useAddresses, useBooking, useOutstanding, useQuote } from "../hooks/queries"
import { addressLine } from "../model/address"
import { attemptSignature, bookWithSavedKey, clearAttempt, readAttempt } from "../model/bookingAttempt"
import { bookingBody, prosHref, selectionFromQuote } from "../model/professionals"
import { refusalLine } from "../model/refusals"
import { formatSlot, formatTime, holdExpired } from "../model/slots"
import type { Booking, PaymentIntent } from "../model/wire"
import { useCurrentLocation } from "@/features/maps/CurrentLocation"
import { sameCurrentPin } from "@/features/maps/useCurrentAddress"

function localStore(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null
  } catch {
    return null
  }
}

/** "As soon as possible · around 12:15 pm" for an ASAP booking, else the slot. */
export function whenLine(b: Pick<Booking, "asap" | "slotStart">): string {
  return b.asap ? `As soon as possible · around ${formatTime(b.slotStart)}` : formatSlot(b.slotStart)
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
    <div className="ds-stack dsc-payment-stage">
      <section className="ds-card" aria-label="Your booking">
        <h2 className="ds-h2">{booking.serviceName}</h2>
        {booking.professional ? <p style={{ margin: 0 }}>With {booking.professional.firstName}</p> : null}
        <p className="ds-row" style={{ margin: 0 }}>
          {booking.asap ? <Zap size={14} aria-hidden="true" /> : <CalendarClock size={14} aria-hidden="true" />}
          {whenLine(booking)}
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
        disabled={lapsed ? "The payment window has closed. Return to the service to request a new appointment." : null}
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
  const booking = useBooking(bookingId, 5_000)
  if (booking.isLoading) return <Skel h={200} />
  if (booking.isError || !booking.data) return <ErrorState error={booking.error} what="Your booking" onRetry={() => void booking.refetch()} />
  if (booking.data.status === "matching") return <StateBlock icon={<CalendarClock size={24} />} title="Finding an available professional" text="Your request has been sent. We’ll notify you when a professional accepts, then you can confirm payment. You haven’t been charged." action={<Link href={`/doorstep/bookings/${encodeURIComponent(bookingId)}`} className="ds-btn ds-btn--outline">View request</Link>} />
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

/** Refusals after which the customer picks again from the professionals list. */
const PICK_AGAIN = new Set(["DOORSTEP_SLOT_TAKEN", "DOORSTEP_SLOT_UNAVAILABLE", "DOORSTEP_PRICE_UNAVAILABLE", "DOORSTEP_QUOTE_EXPIRED", "DOORSTEP_HOLD_EXPIRED"])

export function CheckoutScreen() {
  const { point } = useCurrentLocation()
  const now = useNow(10_000)
  const params = useSearchParams()
  const quoteId = params.get("quote") ?? ""
  const addressId = params.get("address") ?? ""
  const female = params.get("female") === "1"
  const asap = params.get("asap") === "1"
  const etaParam = Number(params.get("eta"))
  const eta = Number.isSafeInteger(etaParam) && etaParam > 0 ? etaParam : null
  const proName = (params.get("name") ?? "").slice(0, 60)
  const qc = useQueryClient()
  const quote = useQuote(quoteId)
  const addresses = useAddresses()
  const outstanding = useOutstanding()
  const [slot, setSlot] = useState<string | null>(asap ? null : params.get("slot"))
  const [notes, setNotes] = useState("")
  const [booking, setBooking] = useState(false)
  const [refusal, setRefusal] = useState<{ line: string; pickAgain: boolean } | null>(null)
  const [made, setMade] = useState<{ booking: Booking; intent: PaymentIntent } | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  // A booking already made for this price is paid for, not made again.
  useEffect(() => {
    const a = readAttempt(localStore())
    if (a?.bookingId && a.signature.startsWith(`${quoteId}|`)) setPendingId(a.bookingId)
  }, [quoteId])

  const address = (addresses.data ?? []).find((a) => a.id === addressId && point && sameCurrentPin(a.lat, a.lng, point)) ?? null
  const q = quote.data
  const automatic = (made?.booking.assignmentMode ?? q?.assignmentMode) === "automatic"

  if (!quoteId || !addressId) {
    return <StateBlock icon={<ReceiptText size={22} />} title="Nothing to book" text="Choose a service first." action={<Link href="/doorstep" className="ds-btn ds-btn--primary ds-btn--sm">Browse services</Link>} />
  }
  if (made) return <Shell back={null} automatic={automatic}>{made.booking.status === "matching" ? <PendingPay bookingId={made.booking.id} /> : <PayStep booking={made.booking} intent={made.intent} />}</Shell>
  if (pendingId) return <Shell back={null} automatic={automatic}><PendingPay bookingId={pendingId} /></Shell>

  if (quote.isLoading || addresses.isLoading) {
    return (
      <Shell back={null} automatic={automatic}>
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
  if (quote.isError || !q) return <Shell back={null} automatic={automatic}><ErrorState error={quote.error} what="The price" onRetry={() => void quote.refetch()} /></Shell>

  if (addresses.isError) return <Shell back={null} automatic={automatic}><ErrorState error={addresses.error} what="Your address" onRetry={() => void addresses.refetch()} /></Shell>

  const again = automatic ? `/doorstep/s/${encodeURIComponent(q.serviceId)}?${selectionFromQuote(q, female)}` : prosHref(q.serviceId, selectionFromQuote(q, female), addressId, { mode: asap ? "asap" : "scheduled", date: null, sort: "price" })
  const scheduledAgain = prosHref(q.serviceId, selectionFromQuote(q, female), addressId, { mode: "scheduled", date: null, sort: "price" })
  const expired = q.status !== "open" || !Number.isFinite(Date.parse(q.expiresAt)) || Date.parse(q.expiresAt) <= now
  if (expired) {
    return (
      <Shell back={again} automatic={automatic}>
        <StateBlock
          icon={<ReceiptText size={22} />}
          title="This price has expired"
          text="Prices hold for 15 minutes. Pick again; your choices are kept."
          action={
            <Link href={again} className="ds-btn ds-btn--primary ds-btn--sm">
              {automatic ? "Review service" : "Back to the professionals"}
            </Link>
          }
        />
      </Shell>
    )
  }

  const dues = (outstanding.data?.totalPaise ?? 0) > 0
  const blocked = dues ? "Pay your dues to book again." : !address ? "Your location changed. Go back to the service to refresh the professionals and price." : !asap && !slot ? "Pick a time." : null

  const onBook = async () => {
    if (blocked || booking || !address || (!asap && !slot)) return
    if (Date.parse(q.expiresAt) <= Date.now()) { setRefusal({ line: "This price has expired. Refresh your selection before paying.", pickAgain: true }); return }
    setBooking(true)
    setRefusal(null)
    const when = asap ? ({ asap: true } as const) : { slotStart: slot as string }
    const signature = attemptSignature({ quoteId: q.id, addressId: address.id, slotStart: asap ? "asap" : (slot as string), requireFemalePro: female })
    const body = bookingBody({ quoteId: q.id, addressId: address.id, when, female, notes })
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
      setRefusal({ line: "We couldn't hear back about your booking. Check your connection and continue again — you won't be booked twice.", pickAgain: false })
      return
    }
    const e = toDoorstepError(outcome.error)
    setRefusal({ line: refusalLine(e), pickAgain: PICK_AGAIN.has(e.code) })
    if (e.code === "DOORSTEP_SLOT_TAKEN" || e.code === "DOORSTEP_SLOT_UNAVAILABLE") {
      setSlot(null)
      void qc.invalidateQueries({ queryKey: [...DOORSTEP, "slots"] })
      void qc.invalidateQueries({ queryKey: keys.allPros })
    }
    if (e.code === "DOORSTEP_PRICE_UNAVAILABLE") void qc.invalidateQueries({ queryKey: keys.allPros })
    if (e.code === "DOORSTEP_OUTSTANDING_DUE") void qc.invalidateQueries({ queryKey: keys.outstanding })
    if (e.code === "DOORSTEP_QUOTE_EXPIRED") void qc.invalidateQueries({ queryKey: keys.quote(q.id) })
  }

  return (
    <Shell back={again} automatic={automatic}>
      <DuesBanner outstanding={outstanding.data} />
      <CheckoutReview
        quote={q} address={address} name={proName} female={female} asap={asap} eta={eta}
        slot={slot} notes={notes} onNotes={setNotes} changeHref={again}
        slotPicker={<SlotPicker query={{ quoteId: q.id, addressId: address?.id, requireFemalePro: female }} enabled={Boolean(address)} value={slot} onChange={setSlot} />}
        busy={booking} blocked={blocked} onBook={() => void onBook()}
        error={refusal ? <div className="ds-alert ds-stack" role="alert"><span>{refusal.line}</span>{refusal.pickAgain && <Link href={asap ? scheduledAgain : again} className="dsc-link">{asap ? "See available appointments" : "Review availability"}</Link>}</div> : null}
      />
    </Shell>
  )
}

function Shell({ back, children, automatic = false }: { back: string | null; children: React.ReactNode; automatic?: boolean }) {
  return <><BookingHeading active={automatic ? 1 : 2} automatic={automatic} title={automatic ? "Choose your appointment" : "Review your booking"} description={automatic ? "Choose a time. We’ll assign an available professional at your fixed service price." : "Your service, your time. One final check before payment."} back={back ?? "/doorstep"} backLabel={back && !automatic ? "Back to professionals" : "Back to services"} />{children}</>
}
