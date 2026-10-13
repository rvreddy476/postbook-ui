"use client"
import { useEffect, useId, useRef } from "react"
import { BriefcaseBusiness, ChevronDown } from "lucide-react"
import { PARTNER_MENU } from "./portalRoles"
import type { BusinessPartnerId } from "./partnerPortal"
import "./partnerPortal.css"

/** A keyboard-accessible disclosure with native checkboxes: more than one business is allowed. */
export function BusinessPartnerSelect({ value, onChange, error, disabled = false }: { value: readonly BusinessPartnerId[]; onChange(value: BusinessPartnerId[]): void; error?: string; disabled?: boolean }) {
  const id = useId()
  const root = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key === "Escape" && root.current?.open) { root.current.open = false; root.current.querySelector("summary")?.focus() }
      else if (!(event instanceof KeyboardEvent) && !root.current?.contains(event.target as Node) && root.current) root.current.open = false
    }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", close)
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close) }
  }, [])
  const labels = PARTNER_MENU.filter(item => value.includes(item.id)).map(item => item.label)
  return <div className="auth-field partner-business-field">
    <span id={`${id}-label`} className="auth-label">Business partner types <span aria-hidden="true">*</span></span>
    <details ref={root} className="partner-business-select">
      <summary aria-labelledby={`${id}-label ${id}-selection`} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} aria-invalid={Boolean(error)} aria-disabled={disabled} onClick={event => { if (disabled) event.preventDefault() }}>
        <BriefcaseBusiness size={18} aria-hidden="true" /><span id={`${id}-selection`}>{labels.length ? `${labels.length} business ${labels.length === 1 ? "type" : "types"} selected` : "Select your business types"}</span><ChevronDown size={17} aria-hidden="true" />
      </summary>
      <fieldset disabled={disabled}>
        <legend className="sr-only">Choose one or more business partner types</legend>
        {PARTNER_MENU.map(item => <label key={item.id}><input type="checkbox" name="businessPartners" value={item.id} checked={value.includes(item.id)} onChange={event => onChange(event.target.checked ? [...value, item.id] : value.filter(id => id !== item.id))} /><span><strong>{item.label}</strong><small>{item.detail}</small></span></label>)}
      </fieldset>
    </details>
    {labels.length ? <p className="partner-business-selected" aria-live="polite">{labels.join(" · ")}</p> : null}
    <p id={`${id}-hint`} className="auth-hint">Select all that apply. Each business has its own application and approval.</p>
    {error ? <p id={`${id}-error`} role="alert" className="partner-business-error">{error}</p> : null}
  </div>
}
