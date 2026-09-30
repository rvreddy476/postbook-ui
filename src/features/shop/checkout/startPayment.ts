/*
  Opening the payment for an order, shared by the Pay button and the order
  page's "Complete payment" / "Try again".

  What it does NOT do: mark anything paid. The Razorpay handler result only
  ends the dialog; the order page polls GET /orders/:id/payment and the
  order becomes paid on the signature-verified webhook alone.
*/

import { openRazorpayCheckout } from "@/lib/razorpay"

import { prefillFromSession, razorpayOptions, type PaymentIntent } from "../model/payments"

export type PaymentStart =
  | { kind: "razorpay"; dialog: Promise<"completed" | "dismissed"> }
  | { kind: "stub" }
  | { kind: "unavailable" }

/** The cached session user, for the dialog's prefill. Never a credential. */
export function readSessionUser(): { name?: string; loginId?: string } | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem("postbook_session")
    return raw ? (JSON.parse(raw) as { name?: string; loginId?: string }) : null
  } catch {
    return null
  }
}

/**
  Razorpay: the dialog opens (after the SDK loads) and the promise says
  how it ended — nothing more. Stub: the caller draws the dev button.
  Unknown: the caller says payment is unavailable.
*/
export function startPayment(intent: PaymentIntent, orderNumber: string): PaymentStart {
  if (intent.provider === "stub") return { kind: "stub" }
  if (intent.provider !== "razorpay") return { kind: "unavailable" }
  let options
  try {
    options = razorpayOptions(intent, { orderNumber, prefill: prefillFromSession(readSessionUser()) })
  } catch {
    return { kind: "unavailable" }
  }
  const dialog = openRazorpayCheckout(options).then(
    () => "completed" as const,
    () => "dismissed" as const,
  )
  return { kind: "razorpay", dialog }
}
