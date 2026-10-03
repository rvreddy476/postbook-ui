"use client"

/*
  The payment leg for ONE order, on the order page.

    start(method) → POST /payments/intents (saved key) → Razorpay | stub | unavailable
    then the poll: GET /orders/:id/payment until paid | failed | refund, or 180 s.

  Nothing here marks the order paid. The Razorpay handler's success only
  moves the screen to "Confirming payment"; the poll's reading decides.
  A retry pays the same order with a new intent key.
*/

import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"

import { openRazorpayCheckout } from "@/lib/razorpay"

import { confirmStubPayment, createPaymentIntent, getOrderPayment, toFeastError } from "../api/client"
import { clearAttempt, newKey, readAttempt } from "../model/checkoutAttempt"
import {
  forgetIntentKey,
  intentKeyFor,
  isSettled,
  nextPaymentPollDelay,
  paymentRoute,
  readPayment,
  stubConfirmBody,
  type PaymentMethod,
  type PaymentReading,
} from "../model/payment"
import type { PaymentIntent } from "../model/wire"
import { keys } from "./queries"

export type PaymentPhase =
  | { kind: "idle" }
  | { kind: "opening" }
  | { kind: "dialog" }
  | { kind: "stub"; intent: PaymentIntent }
  | { kind: "confirming" }
  | { kind: "settled"; reading: Exclude<PaymentReading, "confirming"> }
  | { kind: "timeout" }
  | { kind: "unavailable"; message: string }
  | { kind: "error"; message: string }

const STUB_ALLOWED = process.env.NEXT_PUBLIC_ENABLE_STUB_PAYMENTS === "true"

function sessionStore(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null
  } catch {
    return null
  }
}

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

export function useOrderPayment(orderId: string, orderNumber: string) {
  const qc = useQueryClient()
  const [phase, setPhase] = useState<PaymentPhase>({ kind: "idle" })
  const pollRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; started: number; gen: number }>({ timer: null, started: 0, gen: 0 })

  const stopPoll = useCallback(() => {
    if (pollRef.current.timer) clearTimeout(pollRef.current.timer)
    pollRef.current.timer = null
    pollRef.current.gen++
  }, [])

  useEffect(() => stopPoll, [stopPoll])

  const settle = useCallback(
    (reading: Exclude<PaymentReading, "confirming">) => {
      setPhase({ kind: "settled", reading })
      if (reading !== "failed") {
        // The decision is done: the next checkout is a new one.
        const attempt = readAttempt(localStore())
        if (attempt?.orderId === orderId) clearAttempt(localStore())
      }
      void qc.invalidateQueries({ queryKey: keys.order(orderId) })
      void qc.invalidateQueries({ queryKey: keys.orders })
    },
    [orderId, qc],
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
        try {
          const reading = readPayment(await getOrderPayment(orderId))
          if (gen !== pollRef.current.gen) return
          if (isSettled(reading)) {
            settle(reading as Exclude<PaymentReading, "confirming">)
            return
          }
        } catch (error) {
          const e = toFeastError(error)
          // 404 / 409 are permanent: this order has no online payment to read.
          if (e.status === 404 || e.status === 409) {
            if (!quiet) setPhase({ kind: "error", message: e.message })
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
    [orderId, settle, stopPoll],
  )

  const start = useCallback(
    async (method: PaymentMethod, retry = false) => {
      stopPoll()
      if (retry) forgetIntentKey(sessionStore(), orderId)
      setPhase({ kind: "opening" })
      let intent: PaymentIntent
      try {
        intent = await createPaymentIntent(orderId, method, intentKeyFor(sessionStore(), orderId, newKey))
      } catch (error) {
        setPhase({ kind: "error", message: toFeastError(error).message })
        return
      }
      const route = paymentRoute(intent, { orderNumber, stubAllowed: STUB_ALLOWED, prefill: sessionUser() })
      if (route.kind === "unavailable") {
        setPhase({ kind: "unavailable", message: route.message })
        return
      }
      if (route.kind === "stub") {
        setPhase({ kind: "stub", intent })
        return
      }
      setPhase({ kind: "dialog" })
      try {
        await openRazorpayCheckout(route.options)
        // The dialog ended with a payment: the server decides from here.
        poll()
      } catch {
        // Dismissed (or the SDK failed). The money may still have moved:
        // read quietly, and offer to pay again.
        setPhase({ kind: "idle" })
        poll(true)
      }
    },
    [orderId, orderNumber, poll, stopPoll],
  )

  const settleStub = useCallback(
    async (intent: PaymentIntent) => {
      setPhase({ kind: "confirming" })
      try {
        await confirmStubPayment(orderId, stubConfirmBody(intent), newKey())
      } catch (error) {
        setPhase({ kind: "error", message: toFeastError(error).message })
        return
      }
      poll()
    },
    [orderId, poll],
  )

  return { phase, start, settleStub, poll, stopPoll }
}
