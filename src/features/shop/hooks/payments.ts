"use client"

/*
  The payment hooks: opening an intent, settling a stub (dev), and the
  poll runner. The runner owns timers, visibility and the network; every
  decision is orders/paymentPoll.ts, which is where the tests are.
*/

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"

import { confirmStubPayment, openPaymentIntent, readPayment } from "../api/payments"
import { errorStatus } from "../model/checkout"
import { toPaymentIntent, type PaymentIntent, type StubConfirmBody, type WirePaymentIntent } from "../model/payments"
import { afterWait, applyReadError, applyReading, initialPollState, isTerminal, nextStep, type PollState } from "../orders/paymentPoll"

export function useOpenPaymentIntent() {
  return useMutation<{ wire: WirePaymentIntent; intent: PaymentIntent }, unknown, string>({
    mutationFn: async (orderId) => {
      const wire = await openPaymentIntent(orderId)
      return { wire, intent: toPaymentIntent(wire) }
    },
  })
}

export function useConfirmStubPayment() {
  const qc = useQueryClient()
  return useMutation<void, unknown, { orderId: string; body: StubConfirmBody }>({
    mutationFn: ({ orderId, body }) => confirmStubPayment(orderId, body),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ["shop", "orders", "detail", vars.orderId] })
    },
  })
}

function tabVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState !== "hidden"
}

/**
  Polls GET /orders/:id/payment on the contract's schedule while `enabled`,
  and only while the tab is visible. `restart()` begins a fresh 180 s from
  now — the Refresh button after a timeout, or a new intent after a retry.
*/
export function usePaymentPoll(orderId: string, enabled: boolean): { state: PollState; restart: () => void } {
  const [state, setState] = useState<PollState>(initialPollState)
  const [generation, setGeneration] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled || !orderId) return
    let cancelled = false
    let current: PollState = initialPollState
    setState(current)

    const schedule = () => {
      if (cancelled || timerRef.current !== null) return
      const step = nextStep(current, tabVisible())
      if (!step) return
      timerRef.current = setTimeout(async () => {
        timerRef.current = null
        if (cancelled) return
        // Hidden since the wait began: no read; visibilitychange resumes.
        if (!tabVisible()) return
        current = afterWait(current, step.delayMs)
        try {
          current = applyReading(current, await readPayment(orderId))
        } catch (error) {
          current = applyReadError(current, errorStatus(error))
        }
        if (cancelled) return
        setState(current)
        if (!isTerminal(current)) schedule()
      }, step.delayMs)
    }

    const onVisibility = () => {
      if (tabVisible()) schedule()
    }
    document.addEventListener("visibilitychange", onVisibility)
    schedule()

    return () => {
      cancelled = true
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [orderId, enabled, generation])

  const restart = useCallback(() => setGeneration((g) => g + 1), [])
  return { state, restart }
}
