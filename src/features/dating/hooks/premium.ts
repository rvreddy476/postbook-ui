"use client"

/*
  Passes: the catalogue, what I hold, and the checkout runner.

  The runner owns the idempotency key, the Razorpay dialog and the poll's
  timers; every decision is model/premium.ts. A purchase is "paid" only when
  GET /premium/purchases/:id/payment says so — the dialog ending, however it
  ended, only starts the poll.
*/

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"

import { createIdempotencyKeyHolder } from "@/lib/idempotency"
import { openRazorpayCheckout } from "@/lib/razorpay"

import { createPurchase, fetchCatalogue, fetchMyPremium, readPurchasePayment } from "../api/premium"
import { datingErrorCopy, isNetworkError, isPremiumUnavailable, NETWORK_COPY } from "../model/errors"
import { afterRead, afterReadError, initialPoll, nextPollDelay, pollDone, productTitle, razorpayOptions, type MyPremium, type PollState, type Product } from "../model/premium"
import { errorStatus } from "../model/wire"
import { KEYS } from "./profile"

const retry = (count: number, error: unknown) => {
  const status = errorStatus(error)
  if (status >= 400 && status < 500) return false
  return count < 2
}

export function useCatalogue() {
  return useQuery<Product[]>({ queryKey: KEYS.catalogue, queryFn: fetchCatalogue, retry, staleTime: 5 * 60_000 })
}

export function useMyPremium() {
  return useQuery<MyPremium>({ queryKey: KEYS.premiumMe, queryFn: fetchMyPremium, retry })
}

export type CheckoutState =
  | { kind: "idle"; notice: string }
  | { kind: "starting"; productId: string }
  | { kind: "dialog"; productId: string }
  | { kind: "confirming"; productName: string }
  | { kind: "paid"; productName: string; refunding: boolean }
  | { kind: "failed"; productId: string; productName: string; reason: string }
  | { kind: "still_confirming"; productName: string }
  | { kind: "unavailable" }

const tabVisible = () => typeof document === "undefined" || document.visibilityState !== "hidden"

export function useCheckout() {
  const qc = useQueryClient()
  const [state, setState] = useState<CheckoutState>({ kind: "idle", notice: "" })
  const [poll, setPoll] = useState<{ purchaseId: string; productName: string; generation: number } | null>(null)
  // One key per decision to buy; reused on a resend, replaced after a verdict.
  const key = useRef(createIdempotencyKeyHolder())
  const busy = useRef(false)

  const buy = useCallback(async (product: Product) => {
    if (busy.current) return
    busy.current = true
    const productName = productTitle(product)
    setState({ kind: "starting", productId: product.id })
    try {
      const purchase = await createPurchase(product.id, key.current.current())
      const options = razorpayOptions(purchase, productName)
      if (options) {
        setState({ kind: "dialog", productId: product.id })
        // Completed or dismissed: either way the server is asked.
        await openRazorpayCheckout(options).catch(() => undefined)
      } else if (purchase.status === "confirming" || !purchase.id) {
        // Nothing to open and nothing settled: there is no way to pay this one.
        key.current.reset()
        setState({ kind: "failed", productId: product.id, productName, reason: "Online payment isn't available right now." })
        return
      }
      setState({ kind: "confirming", productName })
      setPoll((p) => ({ purchaseId: purchase.id, productName, generation: (p?.generation ?? 0) + 1 }))
    } catch (error) {
      if (isPremiumUnavailable(error)) {
        key.current.reset()
        setState({ kind: "unavailable" })
      } else if (isNetworkError(error)) {
        // The purchase may exist: keep the key so a resend returns it.
        setState({ kind: "idle", notice: NETWORK_COPY })
      } else {
        key.current.reset()
        setState({ kind: "idle", notice: datingErrorCopy(error) })
      }
    } finally {
      busy.current = false
    }
  }, [])

  useEffect(() => {
    if (!poll) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let current: PollState = initialPoll

    const settle = (s: PollState) => {
      if (s.phase === "paid") {
        key.current.reset()
        setState({ kind: "paid", productName: poll.productName, refunding: s.refundStatus !== "" })
        void qc.invalidateQueries({ queryKey: KEYS.premiumMe })
        // A pass lifts allowances and a pack adds Super Sparks.
        void qc.invalidateQueries({ queryKey: KEYS.allowances })
        // A pass shows who sparked you (M4): the grid and the incoming list are read again.
        void qc.invalidateQueries({ queryKey: KEYS.sparks })
        // A pass makes read receipts available (M9).
        void qc.invalidateQueries({ queryKey: KEYS.readReceipts })
      } else if (s.phase === "failed" || s.phase === "stopped") {
        key.current.reset()
        setState({ kind: "failed", productId: "", productName: poll.productName, reason: "" })
      } else if (s.phase === "timed_out") {
        setState({ kind: "still_confirming", productName: poll.productName })
      }
    }

    const schedule = () => {
      if (cancelled || timer !== null) return
      const delay = nextPollDelay(current, tabVisible())
      if (delay === null) {
        if (!pollDone(current) && tabVisible()) settle({ ...current, phase: "timed_out" })
        return
      }
      timer = setTimeout(async () => {
        timer = null
        if (cancelled || !tabVisible()) return
        try {
          current = afterRead(current, delay, await readPurchasePayment(poll.purchaseId))
        } catch (error) {
          current = afterReadError(current, delay, errorStatus(error))
        }
        if (cancelled) return
        if (pollDone(current)) settle(current)
        else schedule()
      }, delay)
    }

    const onVisibility = () => {
      if (tabVisible()) schedule()
    }
    document.addEventListener("visibilitychange", onVisibility)
    schedule()
    return () => {
      cancelled = true
      if (timer !== null) clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [poll, qc])

  /** After a timeout: the same purchase, another 180 s. */
  const checkAgain = useCallback(() => {
    setPoll((p) => (p ? { ...p, generation: p.generation + 1 } : p))
    setState((s) => (s.kind === "still_confirming" ? { kind: "confirming", productName: s.productName } : s))
  }, [])

  /** Back to the catalogue. A failed purchase cannot be paid again, so the next buy is a new one. */
  const done = useCallback(() => {
    setPoll(null)
    setState({ kind: "idle", notice: "" })
  }, [])

  return { state, buy, checkAgain, done }
}
