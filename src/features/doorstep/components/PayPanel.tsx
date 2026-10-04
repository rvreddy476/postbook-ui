"use client"

/*
  One payment, start to verdict: a booking, an extras bill, or outstanding
  dues. "Paid" is only ever the server's reading of GET /bookings/:id/payment
  for this reference (hooks/payment.ts).
*/

import { useEffect, useRef } from "react"

import { usePayment, type PayTarget } from "../hooks/payment"
import { formatPaise } from "../model/money"
import { PAYMENT_LINES, type PaymentReading } from "../model/payment"
import { refusalLine } from "../model/refusals"
import type { PaymentIntent } from "../model/wire"
import { Busy } from "./parts"

export function PayPanel({
  target,
  amountPaise,
  title = "Payment",
  autoIntent,
  readFirst = false,
  disabled,
  onSettled,
}: {
  target: PayTarget
  amountPaise: number | null
  title?: string
  /** An intent already in hand (POST /bookings answered with one): open it at once. */
  autoIntent?: PaymentIntent | null
  /** Arriving later (reload, from a list): read the server's verdict quietly first. */
  readFirst?: boolean
  /** A reason the button is off (the hold lapsed…). */
  disabled?: string | null
  onSettled?: (reading: Exclude<PaymentReading, "confirming">) => void
}) {
  const { phase, start, poll } = usePayment(target, onSettled)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (autoIntent) void start(autoIntent)
    else if (readFirst) poll(true)
  }, [autoIntent, poll, readFirst, start])

  const working = phase.kind === "opening" || phase.kind === "dialog" || phase.kind === "confirming"
  const paidish = phase.kind === "settled" && phase.reading !== "failed"
  const failed = phase.kind === "settled" && phase.reading === "failed"

  return (
    <section className="ds-card" aria-label={title} aria-live="polite">
      <h2 className="ds-h2">{title}</h2>
      {phase.kind === "opening" ? <Busy label="Opening the payment…" /> : null}
      {phase.kind === "dialog" ? <Busy label="Finish paying in the Razorpay window." /> : null}
      {phase.kind === "confirming" ? <Busy label={PAYMENT_LINES.confirming} /> : null}
      {phase.kind === "timeout" ? (
        <div className="ds-stack">
          <p className="ds-info">We&apos;re still waiting to hear from the bank. If money left your account it will be confirmed or refunded automatically.</p>
          <button type="button" className="ds-btn ds-btn--outline ds-btn--sm" onClick={() => poll()}>
            Check again
          </button>
        </div>
      ) : null}
      {paidish ? <p className={phase.reading === "paid" ? "ds-ok" : "ds-info"}>{PAYMENT_LINES[phase.reading]}</p> : null}
      {failed ? <p className="ds-alert">{PAYMENT_LINES.failed}. You can try again.</p> : null}
      {phase.kind === "unavailable" ? (
        <p className="ds-alert" role="alert">
          {phase.message}
        </p>
      ) : null}
      {phase.kind === "error" ? (
        <p className="ds-alert" role="alert">
          {refusalLine({ status: 0, code: phase.code, message: phase.message, fromServer: true })}
        </p>
      ) : null}
      {phase.kind === "stub" ? (
        <div className="ds-stack">
          <Busy label={PAYMENT_LINES.confirming} />
          {phase.refusal ? (
            <p className="ds-alert" role="alert">
              {phase.refusal.code === "DOORSTEP_STUB_UNAVAILABLE"
                ? "This stack takes real payments, so the development stub can't settle it."
                : phase.refusal.code === "DOORSTEP_NOT_FOUND"
                  ? "Development payments aren't available on this deployment."
                  : refusalLine({ ...phase.refusal, fromServer: true })}{" "}
              This page still waits for the server&apos;s verdict.
            </p>
          ) : (
            <p className="ds-note">
              {phase.asked
                ? "Development payments are on: the stub settlement was requested. This page waits for the server's verdict."
                : target.referenceType === "doorstep_booking"
                  ? "Development payments are on: requesting the stub settlement…"
                  : "Development payments are on. Settle this stub payment with the payments test webhook; this page waits for the server's verdict."}
            </p>
          )}
        </div>
      ) : null}

      {!working && !paidish && phase.kind !== "stub" ? (
        <>
          <button type="button" className="ds-btn ds-btn--primary ds-btn--block" onClick={() => void start()} disabled={Boolean(disabled)}>
            {phase.kind === "idle" ? "Pay" : "Try again"}
            {amountPaise !== null ? ` ${formatPaise(amountPaise)}` : ""}
          </button>
          {disabled ? <p className="ds-note">{disabled}</p> : <p className="ds-note">Online payment only, on a secure Razorpay window. No cash.</p>}
        </>
      ) : null}
    </section>
  )
}
