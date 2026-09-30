"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { validateShipForm, type ShipFormErrors, type ShipFormValues } from "../../model/sell"
import { Notice, TextField } from "./primitives"

/** Courier + tracking number, validated by ../../model/sell validateShipForm before POST /seller/orders/:id/ship. */
export function ShipForm({ onSubmit, onCancel, busy, error }: { onSubmit: (values: ShipFormValues) => void; onCancel: () => void; busy: boolean; error: string | null }) {
  const [values, setValues] = useState<ShipFormValues>({ courier: "", tracking_number: "" })
  const [attempted, setAttempted] = useState(false)
  const errors: ShipFormErrors = validateShipForm(values)

  return (
    <form
      noValidate
      className="shop-sell-form"
      onSubmit={(e) => {
        e.preventDefault()
        setAttempted(true)
        if (Object.keys(errors).length > 0) return
        onSubmit(values)
      }}
    >
      <TextField id="ship-courier" label="Courier" required value={values.courier} onChange={(v) => setValues((s) => ({ ...s, courier: v }))} error={attempted ? errors.courier ?? null : null} maxLength={60} />
      <TextField
        id="ship-tracking"
        label="Tracking number"
        required
        value={values.tracking_number}
        onChange={(v) => setValues((s) => ({ ...s, tracking_number: v }))}
        error={attempted ? errors.tracking_number ?? null : null}
        help="As printed on the label. Spaces are removed."
        maxLength={40}
      />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <div className="shop-sell-actions">
        <Button type="submit" disabled={busy}>
          {busy ? "Booking…" : "Mark as shipped"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Back
        </Button>
      </div>
    </form>
  )
}
