"use client"

import { KeyRound } from "lucide-react"
import { useState } from "react"

import { verifyPickup } from "../../api/client"
import { kitchenMessage, toFailure } from "../../model/errors"
import { normalisePickupCode } from "../../model/orders"

/** The rider reads their pickup code; the order is PICKED_UP only when it matches. */
export function PickupCode({ orderId, onVerified }: { orderId: string; onVerified: () => void }) {
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code || busy || locked) return
    setBusy(true)
    setError(null)
    try {
      await verifyPickup(orderId, code)
      setCode("")
      onVerified()
    } catch (err) {
      const f = toFailure(err)
      if (f.code === "FOOD_PICKUP_CODE_ATTEMPTS_EXCEEDED") setLocked(true)
      // A wrong code answers 400 PICKUP_VERIFY_FAILED with internal text: never show that text.
      setError(f.status === 400 && f.code !== "INVALID_BODY" ? kitchenMessage({ ...f, code: "PICKUP_VERIFY_FAILED" }) : kitchenMessage(f))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="kit-form" style={{ gap: 6 }} onSubmit={submit}>
      <label className="kit-label" htmlFor={`pickup-${orderId}`}>
        <KeyRound size={12} aria-hidden /> Rider&apos;s pickup code
      </label>
      <div className="kit-row">
        <input
          id={`pickup-${orderId}`}
          className="kit-input kit-input--code"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          value={code}
          disabled={locked}
          onChange={(e) => setCode(normalisePickupCode(e.target.value))}
          aria-invalid={error ? true : undefined}
        />
        <button type="submit" className="kit-btn kit-btn--primary kit-btn--sm" disabled={!code || busy || locked}>
          {busy ? "Checking…" : "Hand over"}
        </button>
      </div>
      {error ? <span className="kit-error">{error}</span> : <span className="kit-hint">Ask the rider to read the code from their app.</span>}
    </form>
  )
}
