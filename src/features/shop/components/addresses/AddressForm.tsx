"use client"

import { useId, useState } from "react"
import {
  ADDRESS_TYPE_LABELS,
  EMPTY_ADDRESS_FORM,
  validateAddress,
  type AddressErrors,
  type AddressField,
  type AddressFormValues,
  type AddressType,
} from "../../model/addresses"

export type { AddressFormValues } from "../../model/addresses"

export interface AddressFormProps {
  /** Pre-filled values, for editing. Missing fields are empty. */
  initial?: Partial<AddressFormValues>
  /** Called with valid values only; the form does not submit until every rule passes. */
  onSubmit: (values: AddressFormValues) => void | Promise<unknown>
  onCancel?: () => void
  /** Disables the controls while the caller's request is in flight. */
  busy?: boolean
  submitLabel?: string
  /** Hide the "make this my default" row (a checkout that saves a first address does not need it). */
  hideDefault?: boolean
}

/**
 * The one address form in the zone: the address book here, and W2's
 * checkout, which imports it from this path. Validation is
 * model/addresses.ts `validateAddress`; the form only shows the errors.
 */
export function AddressForm({ initial, onSubmit, onCancel, busy, submitLabel = "Save address", hideDefault }: AddressFormProps) {
  const [values, setValues] = useState<AddressFormValues>({ ...EMPTY_ADDRESS_FORM, ...initial })
  const [errors, setErrors] = useState<AddressErrors>({})
  const [touched, setTouched] = useState<Partial<Record<AddressField, boolean>>>({})
  const baseId = useId()

  const set = (field: AddressField) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const raw = event.target.type === "checkbox" ? (event.target as HTMLInputElement).checked : event.target.value
    const next = { ...values, [field]: raw } as AddressFormValues
    setValues(next)
    if (touched[field]) setErrors(validateAddress(next))
  }
  const blur = (field: AddressField) => () => {
    setTouched((t) => ({ ...t, [field]: true }))
    setErrors(validateAddress(values))
  }

  const field = (name: AddressField, label: string, extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}, full = false) => {
    const id = `${baseId}-${name}`
    const error = touched[name] ? errors[name] : undefined
    return (
      <div className={`shop-field${full ? " shop-field--full" : ""}`}>
        <label className="shop-field__label" htmlFor={id}>{label}</label>
        <input
          id={id}
          className={`shop-input${error ? " shop-input--invalid" : ""}`}
          value={String(values[name] ?? "")}
          onChange={set(name)}
          onBlur={blur(name)}
          disabled={busy}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...extra}
        />
        {error ? <span id={`${id}-error`} className="shop-field__error" role="alert">{error}</span> : null}
      </div>
    )
  }

  return (
    <form
      className="shop-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        const next = validateAddress(values)
        setErrors(next)
        setTouched({ contactName: true, phone: true, line1: true, line2: true, landmark: true, city: true, state: true, pincode: true, type: true, isDefault: true })
        if (Object.keys(next).length > 0) return
        void onSubmit(values)
      }}
    >
      {field("contactName", "Full name", { autoComplete: "name" }, true)}
      {field("phone", "Mobile number", { autoComplete: "tel", inputMode: "tel", placeholder: "10 digits" }, true)}
      {field("line1", "House / flat, street", { autoComplete: "address-line1" }, true)}
      {field("line2", "Area, colony (optional)", { autoComplete: "address-line2" }, true)}
      {field("landmark", "Landmark (optional)", {}, true)}
      {field("city", "City", { autoComplete: "address-level2" })}
      {field("state", "State", { autoComplete: "address-level1" })}
      {field("pincode", "PIN code", { autoComplete: "postal-code", inputMode: "numeric", placeholder: "6 digits" })}
      <div className="shop-field">
        <label className="shop-field__label" htmlFor={`${baseId}-type`}>Address type</label>
        <select id={`${baseId}-type`} className="shop-input" value={values.type} onChange={set("type")} disabled={busy}>
          {(Object.keys(ADDRESS_TYPE_LABELS) as AddressType[]).map((type) => (
            <option key={type} value={type}>{ADDRESS_TYPE_LABELS[type]}</option>
          ))}
        </select>
      </div>
      {!hideDefault ? (
        <label className="shop-form__check">
          <input type="checkbox" checked={values.isDefault} onChange={set("isDefault")} disabled={busy} />
          Make this my default address
        </label>
      ) : null}
      <div className="shop-form__actions">
        <button type="submit" className="shop-btn shop-btn--primary" disabled={busy}>{busy ? "Saving…" : submitLabel}</button>
        {onCancel ? <button type="button" className="shop-btn shop-btn--ghost" onClick={onCancel} disabled={busy}>Cancel</button> : null}
      </div>
    </form>
  )
}
