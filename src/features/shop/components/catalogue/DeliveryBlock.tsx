"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Truck } from "lucide-react"
import { deliveryHeadline, isValidPincode, normalisePincode, type DeliveryView } from "../../model/delivery"

/**
 * Under the price: "Delivery by Sat, 3 Oct", then "to 500081 · Change". The
 * Change link opens a small pincode field in place (six digits). Not
 * serviceable reads "Not deliverable to 500081". With no pincode and nobody
 * signed in, it asks for one. The states are decided in model/delivery.ts.
 */
export function DeliveryBlock({ view, onPincode }: { view: DeliveryView; onPincode: (pincode: string) => boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const fieldId = useId()
  const errorId = `${fieldId}-error`

  useEffect(() => {
    if (editing) input.current?.focus()
  }, [editing])

  const pincode = "pincode" in view ? view.pincode : null
  const open = () => {
    setDraft(pincode ?? "")
    setError(null)
    setEditing(true)
  }
  const submit = () => {
    const value = normalisePincode(draft)
    if (!isValidPincode(value)) {
      setError("Enter a 6-digit pincode")
      return
    }
    if (onPincode(value)) {
      setEditing(false)
      setError(null)
    }
  }

  const headline = deliveryHeadline(view)
  return (
    <div className="shop-delivery">
      <Truck size={16} aria-hidden="true" className="shop-delivery__icon" />
      <div className="shop-delivery__body" aria-live="polite">
        {view.kind === "loading" ? (
          <div className="shop-skeleton" style={{ height: 14, width: 160 }} aria-label="Checking delivery" />
        ) : (
          <p className={`shop-delivery__headline${view.kind === "not_serviceable" || view.kind === "invalid" ? " shop-delivery__headline--warn" : ""}`}>
            {view.kind === "by" ? (
              <>Delivery by <time dateTime={view.iso}>{view.date}</time></>
            ) : headline}
          </p>
        )}
        {!editing ? (
          <p className="shop-delivery__to">
            {pincode && (view.kind === "by" || view.kind === "loading" || view.kind === "unavailable") ? <span>to {pincode}</span> : null}
            <button type="button" className="shop-delivery__change" onClick={open}>
              {pincode ? "Change" : "Enter pincode"}
            </button>
          </p>
        ) : (
          <form
            className="shop-delivery__form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            <label htmlFor={fieldId} className="sr-only">Delivery pincode</label>
            <input
              ref={input}
              id={fieldId}
              className={`shop-input shop-input--sm shop-delivery__input${error ? " shop-input--invalid" : ""}`}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="Pincode"
              maxLength={7}
              value={draft}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => {
                setDraft(event.target.value.replace(/[^\d\s-]/g, ""))
                if (error) setError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setEditing(false)
              }}
            />
            <button type="submit" className="shop-btn shop-btn--outline shop-btn--sm">Check</button>
            <button type="button" className="shop-btn shop-btn--ghost shop-btn--sm" onClick={() => setEditing(false)}>Cancel</button>
            {error ? <p id={errorId} className="shop-field__error shop-delivery__error" role="alert">{error}</p> : null}
          </form>
        )}
      </div>
    </div>
  )
}
