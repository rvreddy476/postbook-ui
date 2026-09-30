"use client"

import { Minus, Plus } from "lucide-react"

/** − n +, clamped to [min, max]. `min` is 1 on the product page and 0 on a bag line (0 removes). */
export function QuantityStepper({ value, min = 1, max, onChange, disabled, label, small }: {
  value: number
  min?: number
  max: number
  onChange: (next: number) => void
  disabled?: boolean
  label: string
  small?: boolean
}) {
  return (
    <div className={`shop-stepper${small ? " shop-stepper--sm" : ""}`} role="group" aria-label={label}>
      <button
        type="button"
        className="shop-stepper__btn"
        aria-label={`Decrease quantity for ${label}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus size={14} aria-hidden="true" />
      </button>
      <span className="shop-stepper__value" aria-live="polite">{value}</span>
      <button
        type="button"
        className="shop-stepper__btn"
        aria-label={`Increase quantity for ${label}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
