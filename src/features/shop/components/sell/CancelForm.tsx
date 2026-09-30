"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CANCEL_REASON_MAX, validateCancelReason } from "../../model/sell"
import { Field, Notice, Textarea } from "./primitives"

/** The reason the buyer reads, validated before POST /seller/orders/:id/cancel {reason}. */
export function CancelForm({ onSubmit, onCancel, busy, error }: { onSubmit: (reason: string) => void; onCancel: () => void; busy: boolean; error: string | null }) {
  const [reason, setReason] = useState("")
  const [attempted, setAttempted] = useState(false)
  const problem = validateCancelReason(reason)

  return (
    <form
      noValidate
      className="shop-sell-form"
      onSubmit={(e) => {
        e.preventDefault()
        setAttempted(true)
        if (problem) return
        onSubmit(reason)
      }}
    >
      <Field id="cancel-reason" label="Reason the buyer will read" required error={attempted ? problem : null}>
        <Textarea id="cancel-reason" rows={3} maxLength={CANCEL_REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <p className="shop-sell-muted">The refund is automatic; nothing about the money is decided here.</p>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <div className="shop-sell-actions">
        <Button type="submit" variant="outline" disabled={busy}>
          {busy ? "Cancelling…" : "Cancel this order"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Back
        </Button>
      </div>
    </form>
  )
}
