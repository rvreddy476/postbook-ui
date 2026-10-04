"use client"

/*
  The payment leg for ONE reference: a booking, or an extras bill (which is
  also how outstanding dues are paid).

    start() → open the intent (POST, server-idempotent on doorstep:booking:{id}
              / doorstep:extras:{bill}) → Razorpay | dev stub | unavailable
    then the poll: GET /bookings/:id/payment until the row for THIS
    reference says succeeded | failed | refunded, or 180 s pass.

  Nothing here marks anything paid. The Razorpay handler's success only
  moves the screen to "Confirming payment"; the poll's reading decides.

  The dev stub (NEXT_PUBLIC_ENABLE_STUB_PAYMENTS=true AND a "stub" session):
  the poll starts, then POST /bookings/:id/payment/stub-confirm asks the
  server to settle through payments-service's stub gateway. Its answer is
  never read as a verdict (model/payment.ts runStubLeg); the booking is paid
  when the poll says so. An extras bill has no stub-confirm route and waits
  for the payments test webhook.

  `settle` has exactly one caller: the poll's reading of GET /payment
  (__tests__/rules.test.ts guards that).
*/

import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"

import { openRazorpayCheckout } from "@/lib/razorpay"

import { getBookingPayments, stubConfirmBookingPayment, toDoorstepError } from "../api/client"
import { clearAttempt, readAttempt } from "../model/bookingAttempt"
import { isSettled, nextPaymentPollDelay, paymentRoute, readPayment, runStubLeg, type PaymentReading, type PaymentRef, type StubRefusal } from "../model/payment"
import type { PaymentIntent } from "../model/wire"
import { DOORSTEP, keys } from "./queries"

export type PaymentPhase =
  | { kind: "idle" }
  | { kind: "opening" }
  | { kind: "dialog" }
  /** Dev stub: `asked` once stub-confirm was sent; `refusal` its no. Still only the poll decides. */
  | { kind: "stub"; asked: boolean; refusal: StubRefusal | null }
  | { kind: "confirming" }
  | { kind: "settled"; reading: Exclude<PaymentReading, "confirming"> }
  | { kind: "timeout" }
  | { kind: "unavailable"; message: string }
  | { kind: "error"; code: string; message: string }

const STUB_ALLOWED = process.env.NEXT_PUBLIC_ENABLE_STUB_PAYMENTS === "true"

function localStore(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null
  } catch {
    return null
  }
}

function sessionUser(): { name?: string; email?: string } {
  try {
    const raw = window.localStorage.getItem("postbook_session")
    const u = raw ? (JSON.parse(raw) as { name?: string; loginId?: string }) : null
    const out: { name?: string; email?: string } = {}
    if (u?.name) out.name = u.name
    if (u?.loginId && u.loginId.includes("@")) out.email = u.loginId
    return out
  } catch {
    return {}
  }
}

export interface PayTarget extends PaymentRef {
  /** The booking whose GET /payment carries the verdict. */
  bookingId: string
  description: string
  open: () => Promise<PaymentIntent>
}

export function usePayment(target: PayTarget, onSettled?: (reading: Exclude<PaymentReading, "confirming">) => void) {
  const qc = useQueryClient()
  const [phase, setPhase] = useState<PaymentPhase>({ kind: "idle" })
  const pollRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; started: number; gen: number }>({ timer: null, started: 0, gen: 0 })
  const targetRef = useRef(target)
  targetRef.current = target
  const settledRef = useRef(onSettled)
  settledRef.current = onSettled

  const stopPoll = useCallback(() => {
    if (pollRef.current.timer) clearTimeout(pollRef.current.timer)
    pollRef.current.timer = null
    pollRef.current.gen++
  }, [])

  useEffect(() => stopPoll, [stopPoll])

  const settle = useCallback(
    (reading: Exclude<PaymentReading, "confirming">) => {
      setPhase({ kind: "settled", reading })
      const t = targetRef.current
      if (reading !== "failed" && t.referenceType === "doorstep_booking") {
        // The decision is done: the next booking is a new one.
        const attempt = readAttempt(localStore())
        if (attempt?.bookingId === t.bookingId) clearAttempt(localStore())
      }
      void qc.invalidateQueries({ queryKey: keys.booking(t.bookingId) })
      void qc.invalidateQueries({ queryKey: [...DOORSTEP, "bookings"] })
      void qc.invalidateQueries({ queryKey: keys.outstanding })
      void qc.invalidateQueries({ queryKey: keys.extrasBill(t.bookingId) })
      settledRef.current?.(reading)
    },
    [qc],
  )

  /** Polls the server's verdict. `quiet` keeps the current phase until a verdict arrives. */
  const poll = useCallback(
    (quiet = false) => {
      stopPoll()
      const gen = pollRef.current.gen
      pollRef.current.started = Date.now()
      if (!quiet) setPhase({ kind: "confirming" })
      const tick = async () => {
        if (gen !== pollRef.current.gen) return
        const t = targetRef.current
        try {
          const reading = readPayment(await getBookingPayments(t.bookingId), t)
          if (gen !== pollRef.current.gen) return
          if (isSettled(reading)) {
            settle(reading as Exclude<PaymentReading, "confirming">)
            return
          }
        } catch (error) {
          const e = toDoorstepError(error)
          if (e.status === 404) {
            if (!quiet) setPhase({ kind: "error", code: e.code, message: e.message })
            return
          }
        }
        const delay = nextPaymentPollDelay(Date.now() - pollRef.current.started)
        if (delay === null) {
          if (!quiet) setPhase({ kind: "timeout" })
          return
        }
        pollRef.current.timer = setTimeout(tick, delay)
      }
      void tick()
    },
    [settle, stopPoll],
  )

  /** Opens the intent and the checkout; `given` skips the POST when the intent is already in hand. */
  const start = useCallback(
    async (given?: PaymentIntent) => {
      stopPoll()
      setPhase({ kind: "opening" })
      let intent: PaymentIntent
      try {
        intent = given ?? (await targetRef.current.open())
      } catch (error) {
        const e = toDoorstepError(error)
        if (e.code === "DOORSTEP_PAYMENT_ALREADY_SETTLED") {
          poll()
          return
        }
        setPhase({ kind: "error", code: e.code, message: e.message })
        return
      }
      const route = paymentRoute(intent, { description: targetRef.current.description, stubAllowed: STUB_ALLOWED, prefill: sessionUser() })
      if (route.kind === "unavailable") {
        setPhase({ kind: "unavailable", message: route.message })
        return
      }
      if (route.kind === "stub") {
        // The poll starts first so the verdict is read whatever the confirm says.
        setPhase({ kind: "stub", asked: false, refusal: null })
        poll(true)
        const leg = await runStubLeg(targetRef.current, stubConfirmBookingPayment, toDoorstepError)
        setPhase((p) => (p.kind === "stub" ? { kind: "stub", asked: leg.asked, refusal: leg.refusal } : p))
        return
      }
      setPhase({ kind: "dialog" })
      try {
        await openRazorpayCheckout(route.options)
        poll()
      } catch {
        // Dismissed (or the SDK failed). The money may still have moved:
        // read quietly, and offer to pay again.
        setPhase({ kind: "idle" })
        poll(true)
      }
    },
    [poll, stopPoll],
  )

  return { phase, start, poll, stopPoll }
}
