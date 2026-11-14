"use client"

/*
  The network and timers behind /premium. Every decision is in model.ts.

  The purchase: POST /checkout {"plan"} → a review of the server's price,
  GST and total (nothing is paid yet) → Pay opens the Razorpay dialog from
  the server's client_session and amount_paise (the GST total) (lib/razorpay, the same helper memberships,
  the shop and Doorstep use) → poll GET /passes/:id until paid | failed |
  refunded, or about two minutes pass. The dialog's success handler only
  starts the poll; nothing on this side marks a pass paid.
*/

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useReducer, useRef, useState } from "react"

import { forceRefresh } from "@/lib/accessToken"
import { openRazorpayCheckout } from "@/lib/razorpay"

import { fetchMyPremium, fetchPremiumInvoice, fetchPremiumInvoiceDocument, fetchPremiumInvoices, fetchPremiumPlans, readPremiumPass, startPremiumCheckout } from "./api"
import {
  idlePurchase,
  initialPassPoll,
  invoiceFileName,
  nextInvoiceWait,
  nextPassWait,
  passPollDone,
  passPollError,
  passPollRead,
  purchaseReducer,
  razorpayOptions,
  toPremiumError,
  type PassPoll,
  type PremiumPlan,
  type PurchaseEvent,
  type RazorpayOpen,
} from "./model"

export const PREMIUM_KEYS = {
  all: ["premium"] as const,
  plans: ["premium", "plans"] as const,
  me: ["premium", "me"] as const,
  invoices: ["premium", "invoices"] as const,
  passInvoice: (passId: string) => ["premium", "pass-invoice", passId] as const,
}

/** A 4xx or a 503 (the switch off, maintenance) will not change by asking again. */
const retry = (count: number, error: unknown) => {
  const status = toPremiumError(error).status
  if (status >= 400 && status < 500) return false
  if (status === 503) return false
  return count < 2
}

export function usePremiumPlans(enabled = true) {
  return useQuery({ queryKey: PREMIUM_KEYS.plans, queryFn: fetchPremiumPlans, enabled, retry, staleTime: 60_000 })
}

export function useMyPremium(enabled = true) {
  return useQuery({ queryKey: PREMIUM_KEYS.me, queryFn: fetchMyPremium, enabled, retry, staleTime: 15_000 })
}

/**
  Whether a way into /premium may show (the Settings row). Premium has no
  GET /v1/features key; the plans call is the switch: it answers 503
  PREMIUM_NOT_ENABLED while PREMIUM_ENABLED is off. Fails closed: hidden
  until the plans call has answered 200, and hidden on any error.
*/
export function usePremiumAvailable(enabled = true): boolean {
  const plans = usePremiumPlans(enabled)
  return premiumEntryVisible(plans.isSuccess, plans.isError)
}

export function premiumEntryVisible(answered: boolean, failed: boolean): boolean {
  return answered && !failed
}

export function usePremiumPurchase() {
  const qc = useQueryClient()
  const [state, dispatch] = useReducer(purchaseReducer, idlePurchase)
  const [poll, setPoll] = useState<{ passId: string; generation: number } | null>(null)
  const busy = useRef(false)
  const lastPlan = useRef<PremiumPlan | null>(null)
  /** The open checkout waiting on Pay: its pass and the dialog's options. */
  const pending = useRef<{ passId: string; options: RazorpayOpen } | null>(null)

  const send = useCallback((event: PurchaseEvent) => dispatch(event), [])

  const buy = useCallback(
    async (plan: PremiumPlan) => {
      if (busy.current) return
      busy.current = true
      lastPlan.current = plan
      pending.current = null
      setPoll(null)
      send({ type: "start", plan: plan.code })
      try {
        let checkout
        try {
          checkout = await startPremiumCheckout(plan.code)
        } catch (error) {
          send({ type: "start_failed", error })
          // GST could not be worked out, or the price moved: the cards'
          // numbers may be stale, so read the plans again.
          void qc.invalidateQueries({ queryKey: PREMIUM_KEYS.plans })
          return
        }
        const options = razorpayOptions(checkout, `Momentum Premium, ${plan.durationDays} days`)
        send({ type: "started", canOpen: !!options, checkout })
        if (options) pending.current = { passId: checkout.passId, options }
      } finally {
        busy.current = false
      }
    },
    [qc, send],
  )

  /** Pay on the review: opens Razorpay for the server's amount_paise (the GST total). */
  const pay = useCallback(async () => {
    const open = pending.current
    if (busy.current || !open) return
    busy.current = true
    pending.current = null
    send({ type: "pay" })
    try {
      try {
        await openRazorpayCheckout(open.options)
      } catch {
        // Closed without paying (or the SDK failed). Money may still have
        // moved: read the pass quietly in the background via /me later.
        send({ type: "dialog_dismissed" })
        void qc.invalidateQueries({ queryKey: PREMIUM_KEYS.me })
        return
      }
      send({ type: "dialog_completed" })
      setPoll((p) => ({ passId: open.passId, generation: (p?.generation ?? 0) + 1 }))
    } finally {
      busy.current = false
    }
  }, [qc, send])

  useEffect(() => {
    if (!poll) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let current: PassPoll = initialPassPoll

    const step = () => {
      const wait = nextPassWait(current)
      if (wait === null) return
      timer = setTimeout(async () => {
        timer = null
        if (cancelled) return
        try {
          current = passPollRead(current, wait, await readPremiumPass(poll.passId))
        } catch (error) {
          current = passPollError(current, wait, toPremiumError(error).status)
        }
        if (cancelled) return
        send({ type: "poll", poll: current })
        if (current.phase === "paid") {
          void qc.invalidateQueries({ queryKey: PREMIUM_KEYS.all })
          void qc.invalidateQueries({ queryKey: ["echo"] })
          // The premium role reaches the token's scopes on the next refresh;
          // posting checks live, so this only matters for UI reading scopes.
          void forceRefresh().catch(() => undefined)
        }
        if (!passPollDone(current)) step()
      }, wait)
    }
    step()
    return () => {
      cancelled = true
      if (timer !== null) clearTimeout(timer)
    }
  }, [poll, qc, send])

  /** After "still confirming": the same pass, another two minutes. */
  const checkAgain = useCallback(() => {
    send({ type: "check_again" })
    setPoll((p) => (p ? { ...p, generation: p.generation + 1 } : p))
  }, [send])

  /** Try again: the same plan (the server reopens its open checkout within 30 minutes). */
  const retryLast = useCallback(() => {
    if (lastPlan.current) void buy(lastPlan.current)
  }, [buy])

  const reset = useCallback(() => {
    pending.current = null
    setPoll(null)
    send({ type: "reset" })
    void qc.invalidateQueries({ queryKey: PREMIUM_KEYS.me })
  }, [qc, send])

  /** passId: the pass the poll read, so the success view can ask it for its invoice. */
  return { state, buy, pay, checkAgain, retryLast, reset, passId: poll?.passId ?? null }
}

/* ── tax invoices and credit notes ──────────────────────────────── */

export function usePremiumInvoices(enabled = true) {
  return useQuery({ queryKey: PREMIUM_KEYS.invoices, queryFn: fetchPremiumInvoices, enabled, retry, staleTime: 30_000 })
}

/**
  The success view's invoice. The pass read that ended the poll can win the
  race with the invoice (issued on the same signed event), so while the pass
  names none it is read again briefly (model.nextInvoiceWait). Once it
  appears, the Invoices list is refreshed too.
*/
export function usePaidInvoice(passId: string | null, knownInvoiceId: string | null) {
  const qc = useQueryClient()
  const waiting = !!passId && !knownInvoiceId
  const q = useQuery({
    queryKey: PREMIUM_KEYS.passInvoice(passId ?? ""),
    queryFn: () => readPremiumPass(passId ?? ""),
    enabled: waiting,
    retry: false,
    refetchInterval: (query) => nextInvoiceWait(query.state.dataUpdateCount + query.state.errorUpdateCount, query.state.data?.invoiceId ?? null) ?? false,
  })
  const invoiceId = knownInvoiceId ?? q.data?.invoiceId ?? null
  useEffect(() => {
    if (invoiceId) void qc.invalidateQueries({ queryKey: PREMIUM_KEYS.invoices })
  }, [invoiceId, qc])
  const reads = (qc.getQueryState(PREMIUM_KEYS.passInvoice(passId ?? ""))?.dataUpdateCount ?? 0) + q.errorUpdateCount
  return { invoiceId, gaveUp: !invoiceId && nextInvoiceWait(reads, null) === null }
}

export interface InvoiceTarget {
  id: string
  /** The document number, for the file name; read from the detail when unknown. */
  number?: string
}

/** Hands the browser a file to save (an object URL, revoked shortly after). */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
  Fetches the document with the user's token through the API client, then
  saves it as "<number with / as ->.pdf". Throws the client's error, so a
  404 reads as "Invoice not found" (model.invoiceErrorMessage).
*/
export async function downloadPremiumInvoice(target: InvoiceTarget, save: (blob: Blob, filename: string) => void = saveBlob): Promise<string> {
  const number = target.number || (await fetchPremiumInvoice(target.id))?.number || ""
  const blob = await fetchPremiumInvoiceDocument(target.id)
  const filename = invoiceFileName(number)
  save(blob, filename)
  return filename
}

export function useDownloadPremiumInvoice() {
  return useMutation<string, unknown, InvoiceTarget>({ mutationFn: (target) => downloadPremiumInvoice(target) })
}
